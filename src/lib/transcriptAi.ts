/**
 * Proveedor de respaldo GRATIS para transcripciones de YouTube.
 *
 * Nuestro servidor (IP de centro de datos) es bloqueado por YouTube al leer
 * subtítulos. Este proveedor delega esa descarga en youtube-transcript.ai,
 * cuya infraestructura (Cloudflare) NO está bloqueada, y nos devuelve el
 * transcript en Markdown con marcas de tiempo [m:ss].
 *
 * Uso: gratis y sin clave bajo límites de "fair use" (prototipado / bajo
 * volumen). Para un producto comercial de alto volumen habría que contactar a
 * youtube-transcript.ai o usar un proxy propio (Fase 2).
 *
 * Devuelve null si no se puede obtener (para que el llamador siga su flujo).
 */

function parseTimestamp(s: string): number {
  const m = s.match(/\[(\d+):(\d+)\]/);
  if (!m) return 0;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

function parseDuracion(s: string): number {
  // "2:52" o "1:02:03"
  const parts = s.split(':').map((n) => parseInt(n, 10) || 0);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] || 0;
}

function distribuirPalabras(text: string, start: number, end: number) {
  const palabras = text.split(/\s+/).filter(Boolean);
  const dur = Math.max(1, end - start);
  const paso = dur / Math.max(1, palabras.length);
  return palabras.map((w, i) => ({
    word: w,
    start: Number((start + i * paso).toFixed(2)),
    end: Number((start + (i + 1) * paso * 0.95).toFixed(2)),
  }));
}

export async function transcribirViaTranscriptAi(
  videoId: string,
  lang = 'es'
): Promise<any | null> {
  try {
    const urls = [
      `https://youtube-transcript.ai/transcript/${videoId}.txt?lang=${lang}`,
      `https://youtube-transcript.ai/transcript/${videoId}.txt`,
    ];

    let body = '';
    for (const u of urls) {
      const res = await fetch(u, { headers: { 'User-Agent': 'ClipForge/1.0' } });
      if (res.ok) {
        body = await res.text();
        if (body && body.includes('## Transcript')) break;
      }
    }
    if (!body || !body.includes('## Transcript')) return null;

    const titleMatch = body.match(/^# Transcript:\s*(.+)$/m);
    const langMatch = body.match(/Language:\s*([a-zA-Z]{2,3})/);
    const durMatch = body.match(/Duration:\s*([\d:]+)/);

    const lineas = body
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.startsWith('['));
    if (lineas.length === 0) return null;

    const parsed = lineas.map((l) => ({
      start: parseTimestamp(l),
      text: l.replace(/\[\d+:\d+\]\s*/, '').trim(),
    }));

    const segments: any[] = [];
    for (let i = 0; i < parsed.length; i++) {
      const start = parsed[i].start;
      const next = i + 1 < parsed.length ? parsed[i + 1].start : null;
      const est = Math.max(4, Math.min(60, Math.round(parsed[i].text.split(/\s+/).length * 0.4)));
      const end = next !== null && next > start ? next : start + est;
      segments.push({
        id: i,
        start,
        end,
        text: parsed[i].text,
        words: distribuirPalabras(parsed[i].text, start, end),
      });
    }

    const words = segments.flatMap((s) => s.words || []);
    const text = parsed.map((p) => p.text).join(' ');
    const duration = durMatch
      ? parseDuracion(durMatch[1])
      : segments.length
        ? segments[segments.length - 1].end
        : 0;

    return {
      task: 'transcribe',
      language: langMatch ? langMatch[1] : lang,
      duration,
      text,
      segments,
      words,
      provider: 'youtube-transcript-ai',
      video_id: videoId,
      titulo_video: titleMatch ? titleMatch[1].trim() : '',
    };
  } catch {
    return null;
  }
}
