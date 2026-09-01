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
      share_to_feed = true,
    } = body;

    if (!video_url) {
      return new Response(JSON.stringify({ error: 'Se requiere una URL pública de vídeo para publicar en Instagram Reels' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 1. Fetch Instagram OAuth credentials
    let accessToken = body.access_token || '';
    let igUserId = body.ig_user_id || '';

    if ((!accessToken || !igUserId) && user_id) {
      try {
        const { data: record } = await (supabase.from('user_oauth' as any) as any)
          .select('*')
          .eq('user_id', user_id)
          .eq('provider', 'instagram')
          .single();

        if (record?.access_token) {
          accessToken = await decryptToken(record.access_token);
          igUserId = record.channel_id || record.account_id || '';
        }
      } catch (e) {
        console.warn('Could not fetch Instagram token from DB:', e);
      }
    }

    if (!accessToken || !igUserId) {
      return new Response(
        JSON.stringify({
          error: 'No se encontró una cuenta de Instagram Profesional vinculada. Conéctala o usa la exportación manual.',
          code: 'INSTAGRAM_AUTH_REQUIRED',
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 2. Format caption with hashtags
    const formattedTags = (hashtags || []).map((h: string) => (h.startsWith('#') ? h : `#${h}`));
    const fullCaption = `${(caption || '').trim()}\n\n${formattedTags.join(' ')}\n\nPublicado con ClipForge AI`.trim();

    // 3. Step 1: Create IG Media Container (media_type=REELS)
    const containerParams = new URLSearchParams({
      media_type: 'REELS',
      video_url: video_url,
      caption: fullCaption,
      share_to_feed: String(share_to_feed),
      access_token: accessToken,
    });

    const createContainerRes = await fetch(`https://graph.facebook.com/v21.0/${igUserId}/media`, {
      method: 'POST',
      body: containerParams,
    });

    const containerData = await createContainerRes.json();

    if (!createContainerRes.ok || containerData.error) {
      const err = containerData.error?.message || `Instagram Container Error (${createContainerRes.status})`;
      return new Response(JSON.stringify({ error: err, details: containerData }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const creationId = containerData.id;

    // 4. Step 2: Poll container status (up to 3 tries before proceeding or letting async handle)
    let isReady = false;
    for (let i = 0; i < 3; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      const statusRes = await fetch(`https://graph.facebook.com/v21.0/${creationId}?fields=status_code&access_token=${accessToken}`);
      if (statusRes.ok) {
        const sData = await statusRes.json();
        if (sData.status_code === 'FINISHED') {
          isReady = true;
          break;
        }
      }
    }

    // 5. Step 3: Publish container
    let publishData: any = { id: creationId };
    if (isReady) {
      const publishParams = new URLSearchParams({
        creation_id: creationId,
        access_token: accessToken,
      });

      const publishRes = await fetch(`https://graph.facebook.com/v21.0/${igUserId}/media_publish`, {
        method: 'POST',
        body: publishParams,
      });

      publishData = await publishRes.json();
    }

    // Update DB
    if (clip_id) {
      try {
        await (supabase.from('publicaciones' as any) as any)
          .update({
            estado: 'publicado',
            url_publicacion: `https://www.instagram.com/reel/${publishData.id || creationId}`,
            updated_at: new Date().toISOString(),
          })
          .eq('clip_id', clip_id)
          .eq('plataforma', 'instagram');
      } catch {}
    }

    return new Response(
      JSON.stringify({
        success: true,
        media_id: publishData.id || creationId,
        platform: 'instagram',
        message: isReady ? 'Reel publicado con éxito en Instagram' : 'Reel en proceso de transcodificación por Meta Graph API',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Instagram publish error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Error al publicar en Instagram Reels' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
