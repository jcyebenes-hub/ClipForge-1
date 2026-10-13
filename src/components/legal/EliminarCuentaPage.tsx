import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  CORREO_CONTACTO,
  PLAZO_BORRADO_DIAS,
  mailtoBorrado,
  textoSolicitudBorrado,
} from '../../lib/contacto';
import { Bloque, MarcoLegal } from './MarcoLegal';

interface Props {
  onNavigate?: (path: string) => void;
}

/**
 * Recurso web de borrado de cuenta. Google Play exige que funcione sin abrir
 * la app y sin iniciar sesión. El borrado real es manual: no hay clave de
 * administrador en el servidor para hacerlo sola la app, y no se finge lo contrario.
 */
export default function EliminarCuentaPage({ onNavigate }: Props) {
  const { user } = useAuth();
  const email = user?.email ?? null;
  const [copiado, setCopiado] = useState(false);

  const ir = (path: string) => {
    if (onNavigate) onNavigate(path);
    else window.location.assign(path);
  };

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(
        `Para: ${CORREO_CONTACTO}\nAsunto: Borrar mi cuenta de ClipForge\n\n${textoSolicitudBorrado(email)}`
      );
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2500);
    } catch {
      setCopiado(false);
    }
  };

  return (
    <MarcoLegal
      titulo="Eliminar tu cuenta"
      bajada="Puedes pedirlo desde aquí, sin instalar la app y sin iniciar sesión. El borrado lo hacemos a mano."
      onNavigate={onNavigate}
    >
      <Bloque titulo="Qué se borra">
        <ul className="list-disc space-y-1 pl-5">
          <li>La cuenta (correo y acceso).</li>
          <li>Proyectos, clips, transcripciones y los vídeos subidos a ClipForge.</li>
          <li>Los contadores de uso ligados a esa cuenta.</li>
        </ul>
      </Bloque>

      <Bloque titulo="Qué no podemos borrar">
        <ul className="list-disc space-y-1 pl-5">
          <li>Los archivos que ya descargaste a tu teléfono u ordenador.</li>
          <li>Un pago hecho en Ko-fi: eso está en la cuenta de Ko-fi, no en la nuestra.</li>
        </ul>
      </Bloque>

      <Bloque titulo="Cómo pedirlo">
        <p>
          Escribe a{' '}
          <a className="font-semibold text-cyan-300 underline" href={mailtoBorrado(email)}>
            {CORREO_CONTACTO}
          </a>{' '}
          desde el mismo correo con el que te registraste. Si escribes desde otro, no podemos saber qué cuenta es.
        </p>
        {email ? (
          <p className="rounded-xl border border-purple-800/50 bg-purple-950/30 px-3 py-2 text-xs text-purple-100">
            Estás dentro de la cuenta <span className="font-bold">{email}</span>. El correo de abajo ya lo incluye.
          </p>
        ) : (
          <p className="text-xs text-slate-400">
            No has iniciado sesión, y no hace falta. En el mensaje, pon el correo de la cuenta.
          </p>
        )}
        <div className="flex flex-col gap-2 pt-2 sm:flex-row">
          <a
            id="pedir-borrado-correo"
            href={mailtoBorrado(email)}
            className="inline-flex flex-1 items-center justify-center rounded-xl bg-red-600 px-4 py-3 text-center text-sm font-bold text-white hover:bg-red-500"
          >
            Escribir para borrar la cuenta
          </a>
          <button
            type="button"
            id="copiar-solicitud-borrado"
            onClick={copiar}
            className="inline-flex flex-1 items-center justify-center rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-bold text-slate-100 hover:bg-slate-800"
          >
            {copiado ? 'Solicitud copiada' : 'Copiar la solicitud'}
          </button>
        </div>
        <p className="text-xs text-slate-400">
          Lo hacemos en un plazo de {PLAZO_BORRADO_DIAS} días desde que llega el correo. Te contestamos al mismo buzón cuando esté borrada. Hasta entonces la cuenta sigue activa.
        </p>
      </Bloque>

      <p className="text-xs text-slate-500">
        Más detalle en la{' '}
        <button type="button" onClick={() => ir('/privacidad')} className="text-cyan-400 underline">
          política de privacidad
        </button>
        .
      </p>
    </MarcoLegal>
  );
}
