import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { POST } from '../src/app/api/tendencias/route';
import { reiniciarCuotaParaPruebas } from '../src/lib/cuotaYoutube';

/**
 * Prueba la ruta /api/tendencias de verdad, con fetch interceptado.
 * Lo que interesa comprobar es la URL que se le manda a YouTube: el selector de
 * mercado no sirve de nada si los parámetros no llegan bien.
 */

const IDS = ['aaaaaaaaaaa', 'bbbbbbbbbbb', 'ccccccccccc'];

function respuestaBusqueda() {
  return { items: IDS.map((id) => ({ id: { videoId: id } })) };
}

function respuestaVideos() {
  const hace5dias = new Date(Date.now() - 5 * 86400000).toISOString();
  return {
    items: IDS.map((id, i) => ({
      id,
      snippet: {
        title: `Vídeo de prueba ${i}`,
        publishedAt: hace5dias,
        channelTitle: `Canal ${i}`,
        channelId: `UCcanal${i}`,
        tags: [],
      },
      statistics: { viewCount: String(1000000 - i * 1000), likeCount: '5000', commentCount: '300' },
      contentDetails: { duration: 'PT30S' },
    })),
  };
}

let urls: URL[] = [];

function instalarFetchFalso() {
  urls = [];
  const fetchFalso = vi.fn(async (entrada: unknown) => {
    const url = new URL(String(entrada));
    urls.push(url);
    const cuerpo = url.pathname.endsWith('/search')
      ? respuestaBusqueda()
      : url.pathname.endsWith('/videos')
        ? respuestaVideos()
        : { items: [] };
    return {
      ok: true,
      status: 200,
      json: async () => cuerpo,
      text: async () => JSON.stringify(cuerpo),
    };
  });
  (globalThis as unknown as { fetch: unknown }).fetch = fetchFalso;
}

function peticion(cuerpo: Record<string, unknown>) {
  return new Request('http://localhost/api/tendencias', {
    method: 'POST',
    body: JSON.stringify(cuerpo),
    headers: { 'Content-Type': 'application/json' },
  });
}

/** La URL de la llamada a search.list, que es la que lleva los filtros. */
function urlDeBusqueda(): URL {
  const encontrada = urls.find((u) => u.pathname.endsWith('/search'));
  if (!encontrada) throw new Error('no se llamó a search.list');
  return encontrada;
}

describe('/api/tendencias · filtro de mercado', () => {
  beforeEach(() => {
    process.env.YOUTUBE_API_KEY = 'clave-de-prueba-no-real';
    instalarFetchFalso();
    // Cada prueba parte de la cuota intacta: si no, se agotan entre ellas.
    reiniciarCuotaParaPruebas();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('por defecto busca en España y en español', async () => {
    const res = await POST(peticion({ palabraClave: 'minecraft' }));
    expect(res.status).toBe(200);

    const busca = urlDeBusqueda();
    expect(busca.searchParams.get('regionCode')).toBe('ES');
    expect(busca.searchParams.get('relevanceLanguage')).toBe('es');

    const datos = await res.json();
    expect(datos.region).toBe('ES');
    expect(datos.idioma).toBe('es');
    expect(datos.sinFiltro).toBe(false);
  });

  it('Latinoamérica cambia el país pero mantiene el español', async () => {
    await POST(peticion({ palabraClave: 'minecraft', region: 'MX', idioma: 'es' }));

    const busca = urlDeBusqueda();
    expect(busca.searchParams.get('regionCode')).toBe('MX');
    expect(busca.searchParams.get('relevanceLanguage')).toBe('es');
  });

  it('GLOBAL no manda ni país ni idioma', async () => {
    const res = await POST(peticion({ palabraClave: 'minecraft', region: 'GLOBAL', idioma: '' }));
    expect(res.status).toBe(200);

    const busca = urlDeBusqueda();
    // La clave está en que NO aparezcan: si se mandaran vacíos, YouTube los ignora
    // igual, pero ensuciarían la URL y darían una falsa sensación de filtro.
    expect(busca.searchParams.has('regionCode')).toBe(false);
    expect(busca.searchParams.has('relevanceLanguage')).toBe(false);

    const datos = await res.json();
    expect(datos.region).toBe('GLOBAL');
    expect(datos.idioma).toBeNull();
    expect(datos.sinFiltro).toBe(true);
  });

  it('GLOBAL se reconoce aunque venga en minúsculas o con espacios', async () => {
    await POST(peticion({ palabraClave: 'minecraft', region: '  global  ' }));
    expect(urlDeBusqueda().searchParams.has('regionCode')).toBe(false);
  });

  it('un país cualquiera se acepta y llega a la API', async () => {
    await POST(peticion({ palabraClave: 'minecraft', region: 'ar', idioma: 'es-419' }));
    const busca = urlDeBusqueda();
    expect(busca.searchParams.get('regionCode')).toBe('AR');
    expect(busca.searchParams.get('relevanceLanguage')).toBe('es-419');
  });

  it('sigue mandando el resto de parámetros intactos', async () => {
    await POST(peticion({ palabraClave: 'minecraft', dias: 30 }));
    const busca = urlDeBusqueda();
    expect(busca.searchParams.get('videoDuration')).toBe('short');
    expect(busca.searchParams.get('order')).toBe('viewCount');
    expect(busca.searchParams.get('type')).toBe('video');
    expect(busca.searchParams.get('maxResults')).toBe('50');
    expect(busca.searchParams.get('q')).toBe('minecraft');
    expect(busca.searchParams.get('publishedAfter')).toBeTruthy();
  });

  it('con país estricto quita el canal que declara otro y deja el que no declara', async () => {
    const fetchFalso = vi.fn(async (entrada: unknown) => {
      const url = new URL(String(entrada));
      if (url.pathname.endsWith('/search')) return { ok: true, status: 200, json: async () => respuestaBusqueda() };
      if (url.pathname.endsWith('/videos')) return { ok: true, status: 200, json: async () => respuestaVideos() };
      return {
        ok: true,
        status: 200,
        json: async () => ({
          items: [
            { id: 'UCcanal0', snippet: { country: 'MX', title: 'México', publishedAt: new Date().toISOString() }, statistics: {} },
            { id: 'UCcanal1', snippet: { title: 'Sin país', publishedAt: new Date().toISOString() }, statistics: {} },
            { id: 'UCcanal2', snippet: { country: 'ES', title: 'España', publishedAt: new Date().toISOString() }, statistics: {} },
          ],
        }),
      };
    });
    (globalThis as unknown as { fetch: unknown }).fetch = fetchFalso;

    const res = await POST(peticion({
      palabraClave: 'políticos',
      region: 'ES',
      idioma: 'es',
      paisEstricto: true,
    }));
    expect(res.status).toBe(200);
    const datos = await res.json();
    expect(datos.descartadosPais).toBe(1);
    expect(datos.analizados).toBe(2);
    const canales = datos.informe.destacados.map((v: { canal: string }) => v.canal);
    expect(canales).not.toContain('Canal 0');
    expect(canales).toContain('Canal 1');
    expect(canales).toContain('Canal 2');
  });

  it('sin país estricto no quita un canal hispano de otro país', async () => {
    const fetchFalso = vi.fn(async (entrada: unknown) => {
      const url = new URL(String(entrada));
      if (url.pathname.endsWith('/search')) return { ok: true, status: 200, json: async () => respuestaBusqueda() };
      if (url.pathname.endsWith('/videos')) return { ok: true, status: 200, json: async () => respuestaVideos() };
      return {
        ok: true,
        status: 200,
        json: async () => ({
          items: IDS.map((_, i) => ({
            id: `UCcanal${i}`,
            snippet: { country: 'MX', title: `Canal ${i}`, publishedAt: new Date().toISOString() },
            statistics: {},
          })),
        }),
      };
    });
    (globalThis as unknown as { fetch: unknown }).fetch = fetchFalso;

    const res = await POST(peticion({ palabraClave: 'políticos', region: 'ES', idioma: 'es' }));
    const datos = await res.json();
    expect(res.status).toBe(200);
    expect(datos.descartadosPais).toBe(0);
    expect(datos.analizados).toBe(3);
  });

  it('sin clave de API avisa en lugar de petar', async () => {
    delete process.env.YOUTUBE_API_KEY;
    const res = await POST(peticion({ palabraClave: 'minecraft' }));
    expect(res.status).toBe(503);
    const datos = await res.json();
    expect(datos.error).toContain('YOUTUBE_API_KEY');
  });
});
