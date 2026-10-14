export interface SegmentoFicha {
  start: number;
  end: number;
  text: string;
}

export interface CorteFicha {
  titulo: string;
  inicio: number;
  fin: number;
}

export interface Capitulo {
  segundo: number;
  marca: string;
  texto: string;
}

export function marcaTiempo(segundos: number): string {
  const total = Math.max(0, Math.floor(segundos));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, '0');
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${ss}`;
  return `${m}:${ss}`;
}

function limpiar(texto: string, max = 70): string {
  const plano = texto.replace(/\s+/g, ' ').replace(/^[#\-–\s]+/, '').trim();
  if (!plano) return '';
  if (plano.length <= max) return plano;
  return `${plano.slice(0, max - 1).trimEnd()}…`;
}

function anadir(
  puntos: { segundo: number; texto: string }[],
  segundo: number,
  texto: string
): void {
  const limpio = limpiar(texto);
  if (!limpio) return;
  const s = Math.max(0, Math.floor(segundo));
  if (puntos.some((p) => Math.abs(p.segundo - s) < 10)) return;
  puntos.push({ segundo: s, texto: limpio });
}

/** Capítulos reales. No inventa temas: usa cortes y frases de la transcripción. */
export function capitulosDeVideo(opts: {
  cortes: CorteFicha[];
  segmentos: SegmentoFicha[];
  duracionSeg?: number;
}): Capitulo[] {
  const cortes = [...opts.cortes]
    .filter((c) => Number.isFinite(c.inicio))
    .sort((a, b) => a.inicio - b.inicio);
  const segmentos = [...opts.segmentos]
    .filter((s) => Number.isFinite(s.start) && limpiar(s.text))
    .sort((a, b) => a.start - b.start);
  const puntos: { segundo: number; texto: string }[] = [];

  const primero = cortes[0];
  if (primero && primero.inicio < 8) {
    anadir(puntos, 0, primero.titulo);
  } else {
    anadir(puntos, 0, segmentos[0]?.text || 'Empieza');
  }

  for (const corte of cortes) {
    anadir(puntos, corte.inicio, corte.titulo);
  }

  const duracion =
    opts.duracionSeg ||
    segmentos[segmentos.length - 1]?.end ||
    cortes[cortes.length - 1]?.fin ||
    0;

  if (puntos.length < 3 && duracion > 20) {
    for (const fraccion of [0.33, 0.66]) {
      const objetivo = duracion * fraccion;
      const seg =
        segmentos.find((s) => s.start >= objetivo - 8) ||
        segmentos.find((s) => s.start >= objetivo * 0.5);
      if (seg) anadir(puntos, seg.start, seg.text);
      if (puntos.length >= 3) break;
    }
  }

  puntos.sort((a, b) => a.segundo - b.segundo);
  if (puntos[0]?.segundo !== 0) {
    puntos.unshift({ segundo: 0, texto: limpiar(segmentos[0]?.text || 'Empieza') });
  }

  return puntos.slice(0, 12).map((p) => ({
    segundo: p.segundo,
    marca: marcaTiempo(p.segundo),
    texto: p.texto,
  }));
}

export function textoFicha(opts: {
  titulo: string;
  cortes: CorteFicha[];
  segmentos: SegmentoFicha[];
  duracionSeg?: number;
}): string {
  const capitulos = capitulosDeVideo(opts);
  const cortes = [...opts.cortes].sort((a, b) => a.inicio - b.inicio);
  const intro = limpiar(
    opts.segmentos
      .slice(0, 2)
      .map((s) => s.text)
      .join(' '),
    220
  );
  const lineas = [
    limpiar(opts.titulo, 100) || 'Vídeo',
    '',
    intro,
    '',
    'Capítulos:',
    ...capitulos.map((c) => `${c.marca} ${c.texto}`),
    '',
    'Cortes:',
    ...cortes.map(
      (c, i) =>
        `${i + 1}. ${limpiar(c.titulo, 80)} (${marcaTiempo(c.inicio)}–${marcaTiempo(c.fin)})`
    ),
  ];
  return lineas.filter((linea, i, todas) => linea !== '' || todas[i - 1] !== '').join('\n').trim();
}

export function textoDeCorte(corte: CorteFicha & { texto?: string }): string {
  return [
    limpiar(corte.titulo, 80),
    '',
    limpiar(corte.texto || '', 500),
    '',
    `${marcaTiempo(corte.inicio)}–${marcaTiempo(corte.fin)}`,
  ]
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
