/**
 * lib/cuotaYoutube.ts
 * Control de la cuota diaria de la API de YouTube.
 *
 * POR QUÉ EXISTE
 * --------------
 * La búsqueda de vídeos virales cuesta 102 unidades de cuota y Google da
 * 10.000 al día para TODA la aplicación, no por usuario. Es el único recurso
 * de ClipForge que cuesta dinero de verdad: el corte de vídeo ocurre en el
 * navegador del usuario y la transcripción va por otra vía con su propio límite.
 *
 * Sin control, unas pocas decenas de búsquedas agotan la cuota de todos y el
 * resto del día la función deja de responder. Por eso hay DOS topes:
 *
 *   1. GLOBAL   — nunca superar la cuota del proyecto. Es el que protege el bolsillo.
 *   2. POR USUARIO — reparto justo, para que una sola persona no se lo coma todo.
 *
 * El contador es EN MEMORIA y se reinicia con el proceso. Es una limitación
 * conocida: si Render reinicia el servicio, el contador vuelve a cero. Se acepta
 * porque el tope global sigue siendo una red de seguridad mucho mejor que nada,
 * y porque persistirlo exigiría una tabla nueva.
 *
 * El núcleo es PURO para poder probarlo en Node.
 */

/** Unidades que da Google al día para todo el proyecto. */
export const CUOTA_YOUTUBE_DIA = 10000;

/** search.list (100) + videos.list (1) + channels.list (1). */
export const COSTE_BUSQUEDA_TENDENCIAS = 102;

/**
 * Margen que se reserva para el resto de llamadas del día (análisis de canales,
 * información de vídeos al pegar un enlace…). Sin este colchón, agotar las
 * búsquedas dejaría inutilizable todo lo demás.
 */
export const RESERVA_CUOTA = 1500;

/** Cuántas búsquedas de virales caben en el día sin tocar la reserva. */
export const BUSQUEDAS_GLOBALES_MAX_DIA = Math.floor(
  (CUOTA_YOUTUBE_DIA - RESERVA_CUOTA) / COSTE_BUSQUEDA_TENDENCIAS
);

/** Búsquedas por usuario y día, según el plan. */
export const BUSQUEDAS_POR_PLAN: Record<string, number> = {
  gratis: 5,
  creador: 20,
  pro: 40,
  agencia: 40,
};

/** Lo que se aplica si el plan no se reconoce o no hay sesión. */
export const BUSQUEDAS_POR_DEFECTO = 5;

export type MotivoLimite = 'global' | 'usuario';

export interface VeredictoCuota {
  ok: boolean;
  motivo?: MotivoLimite;
  mensaje?: string;
}

/** Límite diario que le toca a un plan. Nunca devuelve 0 ni negativo. */
export function limiteUsuario(plan?: string | null): number {
  const clave = (plan || '').trim().toLowerCase();
  const limite = BUSQUEDAS_POR_PLAN[clave];
  if (typeof limite !== 'number' || !Number.isFinite(limite) || limite <= 0) {
    return BUSQUEDAS_POR_DEFECTO;
  }
  return Math.floor(limite);
}

/**
 * Decide si se puede buscar. El tope global va PRIMERO: por mucho plan que
 * tenga alguien, si el proyecto se queda sin cuota no hay nada que hacer.
 */
export function puedeBuscar(opts: {
  globalesHoy: number;
  usuarioHoy: number;
  plan?: string | null;
}): VeredictoCuota {
  const globales = Math.max(0, Math.floor(opts.globalesHoy || 0));
  const usuario = Math.max(0, Math.floor(opts.usuarioHoy || 0));

  if (globales >= BUSQUEDAS_GLOBALES_MAX_DIA) {
    return {
      ok: false,
      motivo: 'global',
      mensaje:
        'Hoy se ha agotado la cuota diaria de búsquedas de ClipForge. Vuelve mañana: se renueva a medianoche.',
    };
  }

  const limite = limiteUsuario(opts.plan);
  if (usuario >= limite) {
    return {
      ok: false,
      motivo: 'usuario',
      mensaje: `Has usado tus ${limite} búsquedas de vídeos virales de hoy. Vuelve mañana o pásate al plan Creador para tener ${BUSQUEDAS_POR_PLAN.creador}.`,
    };
  }

  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Contador en memoria, con reinicio automático al cambiar el día      */
/* ------------------------------------------------------------------ */

interface EstadoCuota {
  fecha: string;
  globales: number;
  porUsuario: Map<string, number>;
}

let estado: EstadoCuota = { fecha: '', globales: 0, porUsuario: new Map() };

function hoyUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Si cambió el día, se empieza de cero. */
function asegurarDia(): void {
  const hoy = hoyUTC();
  if (estado.fecha !== hoy) {
    estado = { fecha: hoy, globales: 0, porUsuario: new Map() };
  }
}

/** Cuenta una búsqueda ya hecha. */
export function registrarBusqueda(identificador?: string | null): void {
  asegurarDia();
  estado.globales += 1;
  const clave = identificador || 'anonimo';
  estado.porUsuario.set(clave, (estado.porUsuario.get(clave) || 0) + 1);
}

/** Cuántas búsquedas lleva hoy el proyecto y ese usuario en concreto. */
export function busquedasHoy(identificador?: string | null): { globales: number; usuario: number } {
  asegurarDia();
  return {
    globales: estado.globales,
    usuario: identificador ? estado.porUsuario.get(identificador) || 0 : 0,
  };
}

/** Solo para los tests: deja el contador como al arrancar. */
export function reiniciarCuotaParaPruebas(): void {
  estado = { fecha: '', globales: 0, porUsuario: new Map() };
}
