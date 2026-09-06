/**
 * Subida de archivos por trozos usando el protocolo tus (resumable uploads).
 *
 * Por qué existe: con una subida normal (un solo POST con todo el archivo) el
 * navegador informa del progreso según va metiendo bytes en su búfer de envío, así
 * que la barra sube casi de golpe hasta ~85-99% y luego se queda clavada, que es
 * exactamente lo que parece un cuelgue. Con tus el archivo se manda en trozos y el
 * SERVIDOR confirma cada trozo devolviendo el byte por el que va (cabecera
 * `Upload-Offset`), de modo que el porcentaje mostrado es el realmente almacenado.
 *
 * Endpoint de Supabase Storage: `POST {SUPABASE_URL}/storage/v1/upload/resumable`
 * (verificado: responde `tus-resumable: 1.0.0` y aplica las mismas políticas RLS que
 * la subida normal; con la clave anon devuelve 403 "new row violates row-level
 * security policy", igual que `POST /storage/v1/object/...`).
 */

/** Tamaño de cada trozo. 5 MB queda holgadamente dentro de los límites habituales. */
export const TUS_CHUNK_BYTES = 5 * 1024 * 1024;

/** Codifica a base64 de forma segura con UTF-8 (btoa solo acepta latin1). */
export function b64Utf8(texto: string): string {
  const bytes = new TextEncoder().encode(texto);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

export interface OpcionesTus {
  /** Ruta dentro del bucket, p. ej. `{user_id}/{project_id}/original.mp4`. */
  storagePath: string;
  /** Nombre del bucket de Supabase Storage. */
  bucket: string;
  /** Access token de la sesión del usuario (Authorization: Bearer). */
  token: string;
  /** Clave anon del proyecto (cabecera apikey). */
  anonKey: string;
  /** Base de la API de almacenamiento, p. ej. `https://xxx.supabase.co/storage/v1`. */
  baseUrl: string;
  /** Tamaño máximo de trozo (por defecto 5 MB). */
  chunkBytes?: number;
  /** Se llama tras cada trozo confirmado por el servidor. */
  onProgreso?: (porcentaje: number, bytesConfirmados: number) => void;
}

/**
 * Sube `file` al bucket indicado en trozos de `chunkBytes`.
 * Lanza un error con formato `"{status}::{cuerpo}"` si el servidor rechaza algo,
 * para que quien lo use pueda traducirlo a un mensaje comprensible.
 */
export async function subirPorTrozosTus(file: File, opciones: OpcionesTus): Promise<void> {
  const {
    storagePath,
    bucket,
    token,
    anonKey,
    baseUrl,
    chunkBytes = TUS_CHUNK_BYTES,
    onProgreso,
  } = opciones;

  const comunes = {
    Authorization: `Bearer ${token}`,
    apikey: anonKey,
    'Tus-Resumable': '1.0.0',
  } as Record<string, string>;

  // 1) Creación: declaramos tamaño y metadatos; el servidor responde con la URL
  //    concreta donde hay que mandar los trozos.
  const metadata = [
    `bucketName ${b64Utf8(bucket)}`,
    `objectName ${b64Utf8(storagePath)}`,
    `contentType ${b64Utf8(file.type || 'application/octet-stream')}`,
    `x-upsert ${b64Utf8('true')}`,
  ].join(',');

  const create = await fetch(`${baseUrl}/upload/resumable`, {
    method: 'POST',
    headers: {
      ...comunes,
      'Upload-Length': String(file.size),
      'Upload-Metadata': metadata,
    },
  });
  if (!create.ok) throw new Error(`${create.status}::${await create.text()}`);

  const location = create.headers.get('Location');
  if (!location) throw new Error('0::El servidor no devolvió la dirección de subida');
  const uploadUrl = new URL(location, `${baseUrl}/upload/resumable/`).toString();

  // 2) Trozos: cada PATCH manda un pedazo y el servidor contesta con el offset
  //    ya guardado. Ese offset es el que alimenta la barra de progreso.
  let offset = 0;
  while (offset < file.size) {
    const fin = Math.min(offset + chunkBytes, file.size);
    const respuesta = await fetch(uploadUrl, {
      method: 'PATCH',
      headers: {
        ...comunes,
        'Content-Type': 'application/offset+octet-stream',
        'Upload-Offset': String(offset),
      },
      body: file.slice(offset, fin),
    });
    if (!respuesta.ok) throw new Error(`${respuesta.status}::${await respuesta.text()}`);

    const siguiente = Number(respuesta.headers.get('Upload-Offset'));
    if (!Number.isFinite(siguiente) || siguiente <= offset) {
      throw new Error('0::El servidor no confirmó el avance de la subida');
    }
    offset = siguiente;
    onProgreso?.(Math.min(100, Math.round((offset / file.size) * 100)), offset);
  }
}
