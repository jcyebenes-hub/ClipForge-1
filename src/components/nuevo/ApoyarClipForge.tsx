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
 *     IMPORTANTE: verificado contra la base real, la política de inserción
 *     pública de esa tabla NO está aplicada, así que el insert se deniega con
 *     42501 y trackEvent lo ignora en silencio. El correo queda igualmente
 *     guardado en localStorage del usuario. Para que llegue a Supabase hay que
 *     ejecutar una vez la política `eventos_insert_publica`
 *     (supabase/migrations/20260902_add_eventos_table.sql).
 */

const CLAVE_LS = 'clipforge_lista_espera_email';

const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

interface Props {
  /** Texto de cabecera. Útil para adaptar el mensaje al contexto. */
  titulo?: string;
  className?: string;
}

export function ApoyarClipForge({ titulo, className = '' }: Props) {
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
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-pink-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-pink-500"
        >
          ☕ Invítanos a un café en Ko-fi
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
