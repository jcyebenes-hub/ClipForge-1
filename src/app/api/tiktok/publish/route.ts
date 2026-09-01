import { supabase } from '../../../../lib/supabase/client';
import { decryptToken } from '../../../../lib/youtubeOauth';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      user_id,
      clip_id,
      video_url,
      caption,
      hashtags = [],
      privacy_level = 'PUBLIC_TO_EVERYONE', // 'PUBLIC_TO_EVERYONE' | 'MUTUAL_FOLLOW_FRIENDS' | 'SELF_ONLY'
      disable_duet = false,
      disable_comment = false,
      disable_stitch = false,
    } = body;

    if (!video_url) {
      return new Response(JSON.stringify({ error: 'Se requiere una URL accesible del vídeo para publicar en TikTok' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 1. Fetch user TikTok OAuth token from Supabase or body
    let accessToken = body.access_token || '';
    if (!accessToken && user_id) {
      try {
        const { data: record } = await (supabase.from('user_oauth' as any) as any)
          .select('*')
          .eq('user_id', user_id)
          .eq('provider', 'tiktok')
          .single();

        if (record?.access_token) {
          accessToken = await decryptToken(record.access_token);
        }
      } catch (e) {
        console.warn('Could not fetch TikTok token from DB:', e);
      }
    }

    if (!accessToken) {
      return new Response(
        JSON.stringify({
          error: 'No se encontró una cuenta de TikTok vinculada. Conéctala o usa la opción "Exportar para TikTok".',
          code: 'TIKTOK_AUTH_REQUIRED',
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 2. Format title and hashtags (TikTok description limit is 2200 chars)
    const formattedTags = (hashtags || []).map((h: string) => (h.startsWith('#') ? h : `#${h}`));
    const fullText = `${(caption || '').trim()} ${formattedTags.join(' ')}`.trim().slice(0, 2200);

    // 3. Step 1: INIT - Request TikTok video upload endpoint
    const initPayload = {
      post_info: {
        title: fullText,
        privacy_level: privacy_level,
        disable_duet: disable_duet,
        disable_comment: disable_comment,
        disable_stitch: disable_stitch,
        video_cover_timestamp_ms: 1000,
      },
      source_info: {
        source: 'PULL_FROM_URL',
        video_url: video_url,
      },
    };

    const initRes = await fetch('https://open.tiktokapis.com/v2/post/publish/video/init/', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
      },
      body: JSON.stringify(initPayload),
    });

    const initData = await initRes.json();

    if (!initRes.ok || initData.error?.code !== 'ok') {
      const errMsg = initData.error?.message || `TikTok API Init Error (${initRes.status})`;
      return new Response(JSON.stringify({ error: errMsg, details: initData }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const publishId = initData.data?.publish_id;

    // 4. Update publication status in DB if clip_id passed
    if (clip_id) {
      try {
        await (supabase.from('publicaciones' as any) as any)
          .update({
            estado: 'publicado',
            url_publicacion: `https://www.tiktok.com/@share/video/${publishId}`,
            updated_at: new Date().toISOString(),
          })
          .eq('clip_id', clip_id)
          .eq('plataforma', 'tiktok');
      } catch {}
    }

    return new Response(
      JSON.stringify({
        success: true,
        publish_id: publishId,
        platform: 'tiktok',
        message: 'Vídeo enviado al pipeline de procesamiento de TikTok con éxito',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('TikTok publish error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Error al publicar en TikTok' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
