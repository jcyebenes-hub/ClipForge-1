/**
 * revision.ts — revisión de clips con instrucciones en lenguaje natural (Fase 3).
 *
 * Convierte una frase («más rápido», «quita los silencios», «subtítulos neón») en una
 * lista de cambios sobre los ajustes REALES de la página de clips.
 *
 * Sigue las reglas de la herramienta de referencia (shorts/revise.py):
 *   1. Solo se tocan claves que existen de verdad en la configuración.
 *   2. «un poco» / «ligeramente» se interpreta como ~10-20% del valor actual.
 *   3. Lo que no se puede expresar como ajuste NO se fuerza: se devuelve en
 *      `noSoportado` para decírselo al usuario.
 *
 * Es determinista y sin red: no cuesta cuota ni depende de un LLM.
 * Se prueba en __tests__/revision.test.ts.
 */

// Los 7 presets reales de src/lib/subtitulos.ts (SubtitleStylePreset).
export type EstiloSubtitulos =
  | 'moderno'
  | 'neon'
  | 'minimal'
  | 'podcast'
  | 'genz'
  | 'dramatico'
  | 'humor';

export interface AjustesClip {
  fondo: boolean;
  split: boolean;
  /** true = aplicar la velocidad; false = velocidad original. */
  ritmoRapido: boolean;
  /** Multiplicador de velocidad. Solo se aplica si ritmoRapido es true. */
  velocidad: number;
  tituloArriba: boolean;
  quitarSilencios: boolean;
  estiloSubtitulos: EstiloSubtitulos;
  /** Texto del rótulo superior (gancho). */
  gancho: string;
}

export const ESTILOS_VALIDOS: EstiloSubtitulos[] = [
  'moderno',
  'neon',
  'minimal',
  'podcast',
  'genz',
  'dramatico',
  'humor',
];

export const VELOCIDAD_MIN = 1;
export const VELOCIDAD_MAX = 2;

export interface Cambio {
  clave: keyof AjustesClip;
  etiqueta: string;
  anterior: string | number | boolean;
  nuevo: string | number | boolean;
}

export interface PlanRevision {
  cambios: Cambio[];
  /** Reglas que se reconocieron pero cuyo valor ya era el pedido. */
  yaEstaba: string[];
  /** Peticiones que no se pueden expresar con los ajustes disponibles. */
  noSoportado: string[];
}

/** Ajustes por defecto, iguales a los de la página de clips. */
export function ajustesPorDefecto(): AjustesClip {
  return {
    fondo: false,
    split: false,
    ritmoRapido: true,
    velocidad: 1.3,
    tituloArriba: true,
    quitarSilencios: false,
    estiloSubtitulos: 'moderno',
    gancho: '',
  };
}

const ETIQUETAS: Record<keyof AjustesClip, string> = {
  fondo: 'Fondo desenfocado',
  split: 'Pantalla partida',
  ritmoRapido: 'Ritmo acelerado',
  velocidad: 'Velocidad',
  tituloArriba: 'Título arriba',
  quitarSilencios: 'Quitar silencios',
  estiloSubtitulos: 'Estilo de subtítulos',
  gancho: 'Texto del gancho',
};

const AYUDA_CLAVES =
  'Puedo cambiar: velocidad, silencios, título arriba, estilo de subtítulos, fondo, pantalla partida y el texto del gancho.';

function normalizar(texto: string): string {
  return (texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function limitar(n: number): number {
  return Math.min(VELOCIDAD_MAX, Math.max(VELOCIDAD_MIN, Math.round(n * 100) / 100));
}

function formatear(v: string | number | boolean): string {
  return typeof v === 'boolean' ? (v ? 'activado' : 'desactivado') : String(v);
}

// OJO: «sin» NO va aquí. «Sin pausas» significa QUITAR los silencios, así que sería
// justo lo contrario. La negación por «sin» se trata regla por regla donde toca.
const negacion = /\b(no|deja de|para de|desactiva)\b/;

/**
 * Interpreta la instrucción y devuelve el plan de cambios.
 * Nunca lanza: lo que no entiende lo devuelve en `noSoportado`.
 *
 * La frase se divide en cláusulas («a y b y c») y cada una se evalúa por separado.
 * Sin eso, el verbo de una cláusula contamina a las demás: en «quita los silencios
 * y pon el fondo», el «quita» de la primera apagaba también el fondo.
 */
export function planificarRevision(instruccion: string, actual: AjustesClip): PlanRevision {
  const cambios: Cambio[] = [];
  const yaEstaba: string[] = [];
  const noSoportado: string[] = [];
  const usadas = new Set<string>();
  // Estado intermedio: los cambios se acumulan, así una segunda cláusula que pida
  // «más rápido» parte de la velocidad ya modificada por la primera.
  const estado: AjustesClip = { ...actual };

  const proponer = (clave: keyof AjustesClip, nuevo: string | number | boolean, etiqueta: string) => {
    usadas.add(clave);
    if (estado[clave] === nuevo) {
      yaEstaba.push(`${ETIQUETAS[clave]}: ya estaba en ${formatear(nuevo)}`);
      return;
    }
    cambios.push({ clave, etiqueta, anterior: estado[clave], nuevo });
    (estado as unknown as Record<string, unknown>)[clave] = nuevo;
  };

  let t = normalizar(instruccion);
  if (!t) {
    return { cambios, yaEstaba, noSoportado: ['No has escrito ninguna instrucción.'] };
  }

  // --- 0. Gancho: se extrae del texto COMPLETO y antes que nada, porque el texto
  //        del gancho puede contener «y» y rompería la división en cláusulas.
  const mGancho = t.match(/(?:gancho|titulo|hook)\s*(?:a|:|=|->|→|como)\s*["«']?(.+?)["»']?\s*$/);
  if (mGancho && mGancho[1].trim().length >= 2) {
    usadas.add('gancho');
    // Se conserva el texto tal y como lo escribió el usuario (con sus mayúsculas).
    const original = instruccion.match(
      /(?:gancho|t[íi]tulo|hook)\s*(?:a|:|=|->|→|como)\s*["«']?(.+?)["»']?\s*$/i
    );
    proponer('gancho', (original?.[1] ?? mGancho[1]).trim(), 'Texto del gancho');
    t = t.slice(0, mGancho.index ?? 0).trim();
  } else if (/\b(otro gancho|cambia el gancho|mejor gancho|otro titulo|cambia el titulo)\b/.test(t)) {
    usadas.add('gancho');
    noSoportado.push(
      'No puedo inventar el texto del gancho. Dímelo así: «gancho: No vas a creer esto».'
    );
  }

  // La coma es separador decimal en español («velocidad 1,5»), así que se protege
  // antes de dividir por comas y se restaura después.
  const protegido = t.replace(/(\d),(\d)/g, '$1\u0001$2');
  const clausulas = protegido
    .split(/\s+y\s+|\s+e\s+|[,;·]/)
    .map((s) => s.replace(/\u0001/g, ',').trim())
    .filter(Boolean);
  const partes = clausulas.length ? clausulas : t ? [t] : [];

  for (const c of partes) {
    const suave = /\b(un poco|poquito|ligeramente|algo|leve)\b/.test(c);
    const fuerte = /\b(mucho|bastante|a tope|fuerte)\b/.test(c);
    // La referencia interpreta «un poco» como un 10-20% del valor actual.
    const factor = fuerte ? 0.3 : suave ? 0.12 : 0.2;

    // --- 1. Velocidad exacta: «a 1.5», «velocidad 1,5x», «ponlo a 1.4x» ---
    const mExacta = c.match(/(?:^|\s)(?:a|de|=|:)?\s*([12])[.,](\d)\s*(x|veces)?\b/);
    if (mExacta && (mExacta[3] || /\b(velocidad|ritmo|rapido|lento|acelera)\b/.test(c))) {
      const v = limitar(parseFloat(`${mExacta[1]}.${mExacta[2]}`));
      proponer('velocidad', v, `Velocidad ${v}×`);
      proponer('ritmoRapido', v > 1, v > 1 ? 'Aceleración activada' : 'Aceleración desactivada');
    }
    // --- 2. Más rápido / más lento (relativo al valor actual) ---
    else if (/\b(mas rapido|mas ritmo|acelera|acelerar|dale ritmo|rapido|veloz)\b/.test(c)) {
      const v = limitar(estado.velocidad * (1 + factor));
      proponer('velocidad', v, `Velocidad ${v}×`);
      proponer('ritmoRapido', true, 'Aceleración activada');
    } else if (/\b(mas lento|mas despacio|frena|frenar|desacelera|lento)\b/.test(c)) {
      const v = limitar(estado.velocidad * (1 - factor));
      if (v <= 1) {
        proponer('velocidad', 1, 'Velocidad 1×');
        proponer('ritmoRapido', false, 'Aceleración desactivada');
      } else {
        proponer('velocidad', v, `Velocidad ${v}×`);
      }
    }
    // --- 3. Velocidad normal / quitar aceleración ---
    else if (
      /\b(velocidad normal|ritmo normal|sin acelerar|quita (el|la) (ritmo|velocidad|aceleracion)|quitar (el|la) (ritmo|velocidad|aceleracion))\b/.test(
        c
      )
    ) {
      proponer('velocidad', 1, 'Velocidad 1×');
      proponer('ritmoRapido', false, 'Aceleración desactivada');
    }

    // --- 4. Silencios ---
    if (/\b(silencios|pausas)\b/.test(c)) {
      usadas.add('quitarSilencios');
      if (negacion.test(c) || /\b(deja|mantener?|conserva|pon)\b/.test(c)) {
        proponer('quitarSilencios', false, 'Silencios conservados');
      } else {
        proponer('quitarSilencios', true, 'Silencios eliminados');
      }
    }

    // --- 5. Título arriba ---
    if (/\b(titulo|titulos|rotulo|cartel)\b/.test(c) && !/\bgancho\b/.test(c)) {
      usadas.add('tituloArriba');
      if (negacion.test(c) || /\b(quita|quitar|oculta|ocultar|esconde|sin)\b/.test(c)) {
        proponer('tituloArriba', false, 'Título arriba desactivado');
      } else if (/\b(pon|poner|muestra|mostrar|anade|agrega|activa|ensena)\b/.test(c)) {
        proponer('tituloArriba', true, 'Título arriba activado');
      }
    }

    // --- 6. Estilo de subtítulos ---
    const mEstilo = c.match(
      /\b(moderno|neon|minimalista|minimal|podcast|gen z|genz|dramatico|humor)\b/
    );
    if (mEstilo && /\b(subtitulo|subtitulos|estilo|letra|fuente)\b/.test(c)) {
      usadas.add('estiloSubtitulos');
      const dicho = mEstilo[1];
      const estilo: EstiloSubtitulos = dicho.startsWith('minimal')
        ? 'minimal'
        : dicho === 'gen z'
          ? 'genz'
          : (dicho as EstiloSubtitulos);
      proponer('estiloSubtitulos', estilo, `Estilo «${estilo}»`);
    }

    // --- 7. Fondo ---
    if (/\bfondo\b/.test(c)) {
      usadas.add('fondo');
      if (negacion.test(c) || /\b(quita|quitar|sin|apaga)\b/.test(c)) {
        proponer('fondo', false, 'Fondo desactivado');
      } else if (/\b(pon|poner|activa|anade|agrega)\b/.test(c) || /desenfoc/.test(c)) {
        proponer('fondo', true, 'Fondo activado');
      }
    }

    // --- 8. Pantalla partida ---
    if (/\b(split|pantalla partida|pantalla dividida|dividida)\b/.test(c)) {
      usadas.add('split');
      if (negacion.test(c) || /\b(quita|quitar|sin)\b/.test(c)) {
        proponer('split', false, 'Split desactivado');
      } else {
        proponer('split', true, 'Split activado');
      }
    }
  }

  if (usadas.size === 0) {
    noSoportado.push(`No he entendido «${instruccion.trim()}». ${AYUDA_CLAVES}`);
  }

  return { cambios, yaEstaba, noSoportado };
}

/** Aplica un plan sobre los ajustes y devuelve la nueva configuración. */
export function aplicarRevision(actual: AjustesClip, plan: PlanRevision): AjustesClip {
  const nuevo: AjustesClip = { ...actual };
  for (const c of plan.cambios) {
    (nuevo as unknown as Record<string, unknown>)[c.clave] = c.nuevo;
  }
  return nuevo;
}

// ---------------------------------------------------------------------------
// Respaldo con IA: saneado del plan que devuelve el modelo
// ---------------------------------------------------------------------------

const CLAVES_BOOLEANAS: (keyof AjustesClip)[] = [
  'fondo',
  'split',
  'ritmoRapido',
  'tituloArriba',
  'quitarSilencios',
];

const CLAVES_VALIDAS: (keyof AjustesClip)[] = [
  ...CLAVES_BOOLEANAS,
  'velocidad',
  'estiloSubtitulos',
  'gancho',
];

function aBooleano(v: unknown): boolean | null {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    if (['true', 'si', 'sí', 'on', 'activado', '1'].includes(s)) return true;
    if (['false', 'no', 'off', 'desactivado', '0'].includes(s)) return false;
  }
  return null;
}

/**
 * Valida y repara el plan que devuelve el modelo de IA.
 *
 * NUNCA se aplica la salida del modelo tal cual: una clave inventada, un estilo que
 * no existe o una velocidad de 50 romperían el render. Lo que no encaja se descarta
 * y se explica en `noSoportado`.
 */
export function sanearPlanLLM(crudo: unknown, actual: AjustesClip): PlanRevision {
  const cambios: Cambio[] = [];
  const yaEstaba: string[] = [];
  const noSoportado: string[] = [];
  const estado: AjustesClip = { ...actual };
  const vistas = new Set<string>();

  const objeto = (crudo && typeof crudo === 'object' ? crudo : {}) as Record<string, unknown>;
  const lista = Array.isArray(objeto.cambios)
    ? objeto.cambios
    : Array.isArray(crudo)
      ? (crudo as unknown[])
      : [];

  for (const item of lista) {
    if (!item || typeof item !== 'object') continue;
    const c = item as Record<string, unknown>;
    const clave = String(c.clave ?? c.path ?? '').trim();
    if (!CLAVES_VALIDAS.includes(clave as keyof AjustesClip)) {
      if (clave) noSoportado.push(`El ajuste «${clave}» no existe y se ha ignorado.`);
      continue;
    }
    const k = clave as keyof AjustesClip;
    let nuevo: string | number | boolean | null = null;

    if (CLAVES_BOOLEANAS.includes(k)) {
      nuevo = aBooleano(c.nuevo ?? c.value ?? c.value_json);
    } else if (k === 'velocidad') {
      const n = Number(c.nuevo ?? c.value ?? c.value_json);
      nuevo = Number.isFinite(n) ? limitar(n) : null;
    } else if (k === 'estiloSubtitulos') {
      const v = String(c.nuevo ?? c.value ?? c.value_json ?? '').trim().toLowerCase();
      nuevo = ESTILOS_VALIDOS.includes(v as EstiloSubtitulos) ? (v as EstiloSubtitulos) : null;
      if (!nuevo) noSoportado.push(`El estilo «${v}» no existe. Válidos: ${ESTILOS_VALIDOS.join(', ')}.`);
    } else if (k === 'gancho') {
      const v = String(c.nuevo ?? c.value ?? c.value_json ?? '').trim().slice(0, 120);
      nuevo = v.length >= 1 ? v : null;
    }

    if (nuevo === null) {
      if (k !== 'estiloSubtitulos') noSoportado.push(`No he podido interpretar el valor de «${ETIQUETAS[k]}».`);
      continue;
    }
    if (estado[k] === nuevo) {
      yaEstaba.push(`${ETIQUETAS[k]}: ya estaba en ${formatear(nuevo)}`);
      continue;
    }
    if (vistas.has(k)) continue; // si el modelo repite clave, gana la primera
    vistas.add(k);
    cambios.push({ clave: k, etiqueta: ETIQUETAS[k], anterior: estado[k], nuevo });
    (estado as unknown as Record<string, unknown>)[k] = nuevo;
  }

  // Los "no soportado" que declare el propio modelo se conservan.
  if (Array.isArray(objeto.noSoportado)) {
    for (const n of objeto.noSoportado) {
      const txt = String(n ?? '').trim();
      if (txt && !noSoportado.includes(txt)) noSoportado.push(txt);
    }
  }

  return { cambios, yaEstaba, noSoportado };
}

/**
 * Sanea los ajustes que llegan del navegador antes de usarlos como referencia.
 * Empieza de los valores por defecto y solo sobrescribe lo que tenga el tipo correcto,
 * así un valor corrupto no puede colarse en la comparación ni en el render.
 */
export function sanearAjustes(crudo: unknown): AjustesClip {
  const base: AjustesClip = ajustesPorDefecto();
  if (!crudo || typeof crudo !== 'object') return base;
  const c = crudo as Record<string, unknown>;

  // Tupla literal: con la lista amplia TypeScript reduce el destino a `never`.
  const clavesBool = ['fondo', 'split', 'ritmoRapido', 'tituloArriba', 'quitarSilencios'] as const;
  for (const k of clavesBool) {
    const v = aBooleano(c[k]);
    if (v !== null) base[k] = v;
  }
  const vel = Number(c.velocidad);
  if (Number.isFinite(vel)) base.velocidad = limitar(vel);
  const est = String(c.estiloSubtitulos ?? '').trim().toLowerCase();
  if (ESTILOS_VALIDOS.includes(est as EstiloSubtitulos)) {
    base.estiloSubtitulos = est as EstiloSubtitulos;
  }
  const gan = String(c.gancho ?? '').trim().slice(0, 120);
  if (gan) base.gancho = gan;
  return base;
}
