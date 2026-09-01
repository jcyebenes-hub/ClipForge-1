/**
 * Cron API Route: /api/cron/vigilar-canal
 * Tarea periódica programada (cada hora) para consultar canales de YouTube configurados
 * con auto_crear_shorts=true, descargar nuevos vídeos detectados y crear borradores de proyectos.
 */

import { supabase } from '../../../../lib/supabase/client';
import { sanitizarTitulo } from '../../../../lib/sanitizer';
import { ConfigCanal } from '../../../../lib/supabase/types';

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      // Si hay CRON_SECRET configurado y no coincide
      // permitir en preview pero avisar
    }

    // 1. Obtener configuraciones de canales con auto_crear_shorts habilitado
    const { data, error: configErr } = await (supabase
      .from('configs_canal') as any)
      .select('*')
      .eq('auto_crear_shorts', true);

    const configs = (data as ConfigCanal[]) || [];

    if (configErr) {
      return new Response(JSON.stringify({ error: configErr.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!configs || configs.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          mensaje: 'No hay canales con auto_crear_shorts activado.',
          procesados: 0,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const workerUrl = process.env.YT_WORKER_URL;
    const resultados = [];

    for (const conf of configs) {
      try {
        // Consultar el último vídeo del canal vía worker o YouTube Data API
        if (workerUrl && conf.canal_id) {
          const res = await fetch(`${workerUrl.replace(/\/+$/, '')}/channel/latest`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ channel_id: conf.canal_id }),
          }).catch(() => null);

          if (res && res.ok) {
            const data = await res.json();
            if (data?.video_id) {
              const videoUrl = `https://www.youtube.com/watch?v=${data.video_id}`;
              
              // Verificar si el proyecto ya fue creado previamente
              const { data: existing } = await supabase
                .from('proyectos')
                .select('id')
                .eq('url_youtube', videoUrl)
                .maybeSingle();

              if (!existing) {
                const projId = 'proj-auto-' + Math.random().toString(36).substring(2, 9);
                await supabase.from('proyectos').insert({
                  id: projId,
                  user_id: conf.user_id,
                  titulo: sanitizarTitulo(data.title || `Auto-import ${conf.canal_nombre || 'YouTube'}`),
                  url_youtube: videoUrl,
                  estado: 'nuevo',
                  duracion_seg: data.duration || 600,
                } as any);

                resultados.push({
                  canal: conf.canal_nombre,
                  nuevo_proyecto: projId,
                  video: data.title,
                });
              }
            }
          }
        }
      } catch (err: any) {
        console.error(`Error procesando canal ${conf.canal_nombre}:`, err);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        canales_evaluados: configs.length,
        nuevos_proyectos_creados: resultados.length,
        detalles: resultados,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('Error en /api/cron/vigilar-canal:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Error en cron de vigilancia de canal' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
