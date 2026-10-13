import React from 'react';
import { CORREO_CONTACTO, PLAZO_BORRADO_DIAS, mailtoContacto } from '../../lib/contacto';
import { Bloque, MarcoLegal } from './MarcoLegal';

interface Props {
  onNavigate?: (path: string) => void;
}

/**
 * Política de privacidad en una URL pública, sin login.
 * Dice lo que la app hace de verdad. No afirma un cumplimiento que no se puede demostrar.
 */
export default function PrivacidadPage({ onNavigate }: Props) {
  const ir = (path: string) => {
    if (onNavigate) onNavigate(path);
    else window.location.assign(path);
  };

  return (
    <MarcoLegal
      titulo="Política de privacidad"
      bajada="Vigente desde el 13 de octubre de 2026. Explica qué datos guarda ClipForge, quién más los ve y cómo pedir que se borren."
      onNavigate={onNavigate}
    >
      <Bloque titulo="Quién es el responsable">
        <p>
          ClipForge es la web de{' '}
          <a className="text-cyan-300 underline" href="https://clipforge-7hdq.onrender.com/">
            clipforge-7hdq.onrender.com
          </a>
          . El responsable del tratamiento es quien atiende{' '}
          <a className="font-semibold text-cyan-300 underline" href={mailtoContacto()}>
            {CORREO_CONTACTO}
          </a>
          . No hay otra empresa ni otro buzón.
        </p>
      </Bloque>

      <Bloque titulo="Qué datos guardamos">
        <p>Solo lo que hace falta para que la cuenta y los clips funcionen:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Correo, nombre y contraseña. La contraseña se guarda cifrada; nosotros no la vemos.</li>
          <li>Si entras con Google, el identificador que Google nos devuelve. No pedimos tu contraseña de Google.</li>
          <li>Si activas la huella, una credencial ligada a este sitio. No sale de tu móvil hacia nosotros en claro.</li>
          <li>Los vídeos que subes, los enlaces de YouTube, los clips generados, títulos, descripciones y la transcripción.</li>
          <li>Visitas, clics, exportaciones y errores, para saber si la app falla. Si has iniciado sesión, van ligados a tu cuenta.</li>
        </ul>
      </Bloque>

      <Bloque titulo="Qué sale de tu dispositivo">
        <p>
          El corte del vídeo y los subtítulos quemados se hacen en tu navegador, con la CPU de tu móvil u ordenador. El archivo no se manda a un servidor para editarlo.
        </p>
        <p>
          Sí sale el audio, y solo para transcribirlo: lo recibe Groq (modelo Whisper) y nos devuelve el texto con los tiempos. No usamos tus vídeos para entrenar un modelo propio, ni los vendemos.
        </p>
        <p>
          Cuando buscas vídeos virales, el servidor pregunta a YouTube por datos públicos (título, visitas, canal). No accede a tu cuenta de YouTube para eso.
        </p>
      </Bloque>

      <Bloque titulo="Quién más los ve">
        <ul className="list-disc space-y-1 pl-5">
          <li>Supabase, en Irlanda (eu-west-1): la cuenta, la base de datos y los archivos.</li>
          <li>Render: aloja la web. No guardamos ahí una copia de tus vídeos.</li>
          <li>Groq: el audio, solo para devolver la transcripción. Puede tratarlo fuera de la Unión Europea.</li>
          <li>Google: el inicio de sesión si lo eliges, las búsquedas públicas de YouTube y las tipografías de la página.</li>
          <li>Ko-fi: solo si decides apoyar el proyecto. El pago ocurre en su web. Nosotros no vemos ni guardamos tu tarjeta.</li>
        </ul>
      </Bloque>

      <Bloque titulo="Para qué los usamos">
        <p>
          Para crear tu cuenta, generar y guardar tus clips, aplicar el límite del plan gratis (60 minutos al mes y marca de agua) y avisarte si algo falla. No hay publicidad de terceros ni venta de datos.
        </p>
      </Bloque>

      <Bloque titulo="Cuánto tiempo">
        <p>
          Mientras la cuenta exista. Si borras un proyecto, se borra ese proyecto. Si pides el borrado de la cuenta, borramos la cuenta, los proyectos, los clips, los archivos y los contadores ligados a ese correo en un plazo de {PLAZO_BORRADO_DIAS} días.
        </p>
        <p>
          No conservamos una copia aparte de los vídeos. Lo que ya descargaste a tu teléfono se queda en tu teléfono: eso no lo podemos borrar nosotros.
        </p>
      </Bloque>

      <Bloque titulo="Cómo pedir el borrado, una copia o una corrección">
        <p>
          Escribe a {CORREO_CONTACTO} desde el mismo correo con el que te registraste. También puedes usar la página de borrado, que no pide instalar la app ni iniciar sesión.
        </p>
        <button
          type="button"
          onClick={() => ir('/eliminar-cuenta')}
          className="mt-2 inline-flex rounded-xl bg-purple-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-purple-500"
        >
          Pedir el borrado de la cuenta
        </button>
      </Bloque>

      <Bloque titulo="Menores">
        <p>
          ClipForge no está dirigida a menores de 16 años. Si tienes menos, no crees una cuenta. Si nos dices que una cuenta es de un menor, la borramos.
        </p>
      </Bloque>

      <Bloque titulo="Cookies">
        <p>
          Guardamos la sesión y el idioma en el navegador para que no tengas que entrar cada vez. No usamos cookies de publicidad.
        </p>
      </Bloque>
    </MarcoLegal>
  );
}
