import { supabase } from '../../../../lib/supabase/client';
import { uploadShortResumable } from '../../../../lib/youtubeUploader';
import { decryptToken } from '../../../../lib/youtubeOauth';

export async function GET(req: Request) {
  try {
    const nowIso = new Date().toISOString();

    // 1. Fetch scheduled publications that are past due and still 'programado'
    const { data: pendingPosts, error: fetchErr } = await (supabase.from('publicaciones' as any) as any)
      .select('*, clips(*)')
      .eq('estado', 'programado')
      .lte('fecha_programada', nowIso)
      .limit(10);

    if (fetchErr) {
      console.error('[Cron Publicar] Error querying pending posts:', fetchErr);
      return new Response(JSON.stringify({ error: fetchErr.message }), { status: 500 });
    }

    if (!pendingPosts || pendingPosts.length === 0) {
      return new Response(
        JSON.stringify({
          message: 'No hay publicaciones pendientes de procesar.',
          timestamp: nowIso,
          processedCount: 0,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const results = [];

    for (const post of pendingPosts) {
      try {
        const platform = post.plataforma;
        const clip = post.clips;
        const videoUrl = post.video_url || clip?.video_short_url || clip?.video_vertical_url || clip?.preview_url;

        if (!videoUrl) {
          throw new Error('No se encontró URL de vídeo para el clip programado');
        }

        // --- YOUTUBE SHORTS ---
        if (platform === 'youtube') {
          const { data: userOauth } = await (supabase.from('user_oauth' as any) as any)
            .select('*')
            .eq('user_id', post.user_id)
            .eq('provider', 'youtube')
            .single();

          if (!userOauth) throw new Error('Cuenta de YouTube no vinculada para el usuario');

          const accessToken = await decryptToken(userOauth.access_token);
          const refreshToken = userOauth.refresh_token ? await decryptToken(userOauth.refresh_token) : undefined;

          const uploadResult = await uploadShortResumable({
            accessToken,
            refreshToken,
            userId: post.user_id,
            videoUrl,
            title: post.titulo || clip?.titulo_hook || 'Short Viral',
            description: post.descripcion || clip?.descripcion || '',
            hashtags: post.hashtags || clip?.hashtags || [],
            duracion_seg: clip?.duracion_seg || 30,
            privacyStatus: post.privacy_status || 'public',
          });

          await (supabase.from('publicaciones' as any) as any)
            .update({
              estado: 'publicado',
              url_publicacion: uploadResult.youtubeUrl,
              updated_at: new Date().toISOString(),
            })
            .eq('id', post.id);

          results.push({ id: post.id, status: 'publicado', platform, url: uploadResult.youtubeUrl });
        } 
        // --- TIKTOK ---
        else if (platform === 'tiktok') {
          const res = await fetch(`${new URL(req.url).origin}/api/tiktok/publish`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              user_id: post.user_id,
              clip_id: post.clip_id,
              video_url: videoUrl,
              caption: post.titulo || clip?.titulo_hook,
              hashtags: post.hashtags || clip?.hashtags,
            }),
          });

          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Error al publicar en TikTok');

          await (supabase.from('publicaciones' as any) as any)
            .update({
              estado: 'publicado',
              updated_at: new Date().toISOString(),
            })
            .eq('id', post.id);

          results.push({ id: post.id, status: 'publicado', platform, data });
        }
        // --- INSTAGRAM ---
        else if (platform === 'instagram') {
          const res = await fetch(`${new URL(req.url).origin}/api/instagram/publish`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              user_id: post.user_id,
              clip_id: post.clip_id,
              video_url: videoUrl,
              caption: post.titulo || clip?.titulo_hook,
              hashtags: post.hashtags || clip?.hashtags,
            }),
          });

          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Error al publicar en Instagram');

          await (supabase.from('publicaciones' as any) as any)
            .update({
              estado: 'publicado',
              updated_at: new Date().toISOString(),
            })
            .eq('id', post.id);

          results.push({ id: post.id, status: 'publicado', platform, data });
        }
      } catch (postErr: any) {
        console.error(`[Cron Publicar] Error processing post ${post.id}:`, postErr);
        await (supabase.from('publicaciones' as any) as any)
          .update({
            estado: 'error',
            error_mensaje: postErr.message || 'Error desconocido',
            updated_at: new Date().toISOString(),
          })
          .eq('id', post.id);

        results.push({ id: post.id, status: 'error', error: postErr.message });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processedCount: results.length,
        results,
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[Cron Publicar Fatal Error]:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
