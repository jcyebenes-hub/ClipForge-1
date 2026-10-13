/**
 * Decisiones del botón «Hazlo todo tú».
 * No descarga el vídeo. Si YouTube no deja leer subtítulos, el agente se para.
 */

import { idiomaDePais } from './paisViral';

export interface VideoCandidato {
  id?: string;
  titulo?: string;
}

export function urlDeVideoYoutube(id: string): string {
  return `https://www.youtube.com/watch?v=${id}`;
}

/** El primer vídeo con un id de YouTube válido. Si no hay, null. */
export function elegirVideoViral(videos: VideoCandidato[]): { id: string; titulo: string } | null {
  for (const video of videos) {
    const id = String(video.id || '').trim();
    if (/^[\w-]{11}$/.test(id)) {
      return { id, titulo: (video.titulo || 'Vídeo viral').trim() || 'Vídeo viral' };
    }
  }
  return null;
}

export function mercadoDelAgente(
  elegido: string | null,
  detectado: string | null
): { region: string; idioma: string; estricto: boolean } {
  const marca = (elegido || 'AUTO').trim().toUpperCase();
  if (marca === 'GLOBAL') return { region: 'GLOBAL', idioma: '', estricto: false };
  if (marca === 'LATAM') return { region: 'MX', idioma: 'es', estricto: false };
  const pais = marca === 'AUTO' || !marca ? (detectado || 'ES') : marca;
  return { region: pais, idioma: idiomaDePais(pais) || 'es', estricto: true };
}

/**
 * Sin subtítulos no hay descarga automática. El usuario sube el archivo.
 * Devolver otra cosa sería prometer una nube que esta app no tiene.
 */
export function queHacerSiNoHaySubtitulos(): 'parar_y_pedir_archivo' {
  return 'parar_y_pedir_archivo';
}
