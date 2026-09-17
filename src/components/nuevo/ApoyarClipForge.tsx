'use client';

import { useEffect, useState } from 'react';
import { trackEvent } from '../../lib/analytics';

/**
 * ApoyarClipForge
 *
 * Dos piezas de monetización, ninguna de las cuales necesita servidor propio ni DDL:
 *
 *  1. BOTÓN DE KO-FI. Solo se renderiza si VITE_KOFI_URL está definida en el
 *     entorno. Mientras no exista la cuenta de Ko-fi, el botón no aparece: mejor
 *     ausencia que un enlace roto. Se define en Render y en Cloudflare Pages
 *     (VITE_KOFI_URL=https://ko-fi.com/tuusuario) y requiere un redeploy.
 *
 *  2. CAPTURA DE CORREO para la lista de espera del plan Pro. Se guarda con
 *     trackEvent('correo_capturado'), que escribe en la tabla `eventos`.
 *     El correo se registra con trackEvent('correo_capturado'), que escribe en la
 *     tabla `eventos` (su política de inserción pública sí está aplicada,
 *     verificado contra la base real). Además queda en localStorage como respaldo.
 */


/**
 * Marca de Ko-fi dibujada como SVG inline (taza con corazón). Se usa inline para
 * que cargue sin red y se vea nítida a cualquier tamaño.
 */
function LogoKofi({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 36" className={className} role="img" aria-label="Ko-fi" fill="none">
      <path
        d="M4 5h26a3 3 0 0 1 3 3v13a11 11 0 0 1-11 11H15A11 11 0 0 1 4 21Z"
        fill="#ffffff"
        stroke="#141414"
        strokeWidth="3"
      />
      <path d="M33 11h3a6 6 0 0 1 0 12h-3" stroke="#141414" strokeWidth="3" fill="none" />
      <path
        d="M17.5 13c-2.2-3-7-1.8-7 2c0 3 4.2 5.2 7 8c2.8-2.8 7-5 7-8c0-3.8-4.8-5-7-2Z"
        fill="#FF5E5B"
      />
    </svg>
  );
}

const CLAVE_LS = 'clipforge_lista_espera_email';

const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

interface Props {
  /** Texto de cabecera. Útil para adaptar el mensaje al contexto. */
  titulo?: string;
  /** Variante de una línea para incrustar junto a Descargar/Compartir. */
  compacto?: boolean;
  className?: string;
}

export function ApoyarClipForge({ titulo, compacto = false, className = '' }: Props) {
  const kofiUrl = ((import.meta.env.VITE_KOFI_URL as string | undefined) || '').trim();
  const [email, setEmail] = useState('');
  const [estado, setEstado] = useState<'idle' | 'enviado' | 'error'>('idle');
  const [mensaje, setMensaje] = useState('');

  // Si ya dejó su correo en este navegador, no se le vuelve a pedir.
  useEffect(() => {
    try {
      const guardado = localStorage.getItem(CLAVE_LS);
      if (guardado) setEstado('enviado');
    } catch {
      /* modo privado o localStorage bloqueado: se muestra el formulario igual */
    }
  }, []);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    const limpio = email.trim();
    if (!EMAIL_VALIDO.test(limpio)) {
      setEstado('error');
      setMensaje('Ese correo no parece válido. Revisa la dirección, por favor.');
      return;
    }
    setEstado('enviado');
    setMensaje('');
    try {
      localStorage.setItem(CLAVE_LS, limpio);
    } catch {
      /* no bloquea nada si localStorage no está disponible */
    }
    // trackEvent nunca lanza: si Supabase rechaza la escritura, el correo sigue
    // en localStorage y el usuario ve su confirmación igualmente.
    await trackEvent('correo_capturado', { email: limpio });
  };

  if (compacto) {
    if (!kofiUrl) return null;
    return (
      <div
        className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border border-purple-900/40 bg-[#0d0d1b] px-3 py-2 ${className}`}
      >
        <span className="text-[11px] text-slate-400">
          ClipForge es gratis y sin anuncios. Si te salva tiempo, invítanos a un café.
        </span>
        <a
          href={kofiUrl}
          target="_blank"
          rel="noopener noreferrer nofollow"
          onClick={() => void trackEvent('click_donacion', { destino: 'kofi' })}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#FF5E5B] px-2.5 py-1 text-[11px] font-bold text-white transition hover:brightness-110"
        >
          <LogoKofi className="h-4 w-4" />
          Apóyanos en Ko-fi
        </a>
      </div>
    );
  }

  return (
    <div
      className={`rounded-2xl border border-purple-900/40 bg-[#090912] p-4 flex flex-col gap-4 ${className}`}
    >
      {titulo ? (
        <p className="text-sm font-semibold text-purple-200">{titulo}</p>
      ) : (
        <p className="text-sm font-semibold text-purple-200">
          ClipForge es gratis y sin anuncios
        </p>
      )}

      <p className="text-xs leading-relaxed text-slate-400">
        No ponemos publicidad: estorba justo cuando vas a descargar tu clip. Si te resulta
        útil, puedes invitarnos a un café o dejarnos tu correo para avisarte cuando salga el
        plan Pro (sin marca de agua y sin límite mensual).
      </p>

      {kofiUrl ? (
        <a
          href={kofiUrl}
          target="_blank"
          rel="noopener noreferrer nofollow"
          onClick={() => void trackEvent('click_donacion', { destino: 'kofi' })}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#FF5E5B] px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
        >
          <LogoKofi className="h-5 w-5" />
          Invítanos a un café en Ko-fi
        </a>
      ) : (
        <p className="text-[11px] text-slate-500">
          (El botón de donaciones aparece en cuanto se configure <code>VITE_KOFI_URL</code>.)
        </p>
      )}

      {estado === 'enviado' ? (
        <p className="text-xs font-medium text-emerald-400">
          ¡Gracias! Te avisaremos en cuanto el plan Pro esté disponible.
        </p>
      ) : (
        <form onSubmit={enviar} className="flex flex-col gap-2 sm:flex-row">
          <input
            type="email"
            value={email}
            onChange={(ev) => {
              setEmail(ev.target.value);
              if (estado === 'error') setEstado('idle');
            }}
            placeholder="tu@correo.com"
            aria-label="Tu correo electrónico"
            className="flex-1 rounded-xl border border-purple-900/50 bg-black/40 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-purple-500 focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-xl border border-purple-700/60 px-4 py-2 text-sm font-semibold text-purple-200 transition hover:bg-purple-900/30"
          >
            Avísame del plan Pro
          </button>
        </form>
      )}

      {estado === 'error' && mensaje ? (
        <p className="text-xs text-red-400">{mensaje}</p>
      ) : null}
    </div>
  );
}

export default ApoyarClipForge;
