/**
 * País de quien entra, leído de la cabecera que pone Cloudflare delante del servidor.
 * No llama a ningún servicio de pago y no guarda nada.
 */

import { idiomaDePais, nombrePais, paisDeCabecera } from '@/src/lib/paisViral';

export async function GET(req: Request) {
  const pais = paisDeCabecera(
    req.headers.get('cf-ipcountry') || req.headers.get('x-country-code')
  );
  return Response.json({
    pais,
    idioma: pais ? idiomaDePais(pais) : null,
    nombre: pais ? nombrePais(pais) : null,
  });
}
