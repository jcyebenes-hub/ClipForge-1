import { uploadShortResumable, validateShortRequirements } from '../../../../lib/youtubeUploader';
import { decryptToken } from '../../../../lib/youtubeOauth';
import { supabase } from '../../../../lib/supabase/client';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      user_id,
      clip_id,
      video_url,
      titulo_hook,
      descripcion = '',
      hashtags = [],
      duracion_seg = 30,
      privacy_status = 'public',
    } = body;

    if (!titulo_hook) {
      return new Response(JSON.stringify({ error: 'El título o gancho del vídeo es obligatorio' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 1. Validate requirements
    const validation = validateShortRequirements({
      duracion_seg: Number(duracion_seg),
      isVerticalRatio: true,
    });

    if (!validation.valid) {
      return new Response(JSON.stringify({ error: validation.errors.join(' ') }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 2. Fetch User OAuth tokens
    let accessToken = '';
    let refreshToken = '';

    if (user_id) {
      try {
        const { data: tokenRecord } = await (supabase.from('user_oauth' as any) as any)
          .select('*')
          .eq('user_id', user_id)
          .eq('provider', 'youtube')
          .single();

        if (tokenRecord) {
          accessToken = await decryptToken(tokenRecord.access_token);
          if (tokenRecord.refresh_token) {
            refreshToken = await decryptToken(tokenRecord.refresh_token);
          }
        }
      } catch (err) {
        console.warn('Could not fetch token from DB:', err);
      }
    }

    // If client supplied token in body
    if (!accessToken && body.access_token) {
      accessToken = body.access_token;
      refreshToken = body.refresh_token || '';
    }

    if (!accessToken) {
      return new Response(
        JSON.stringify({
          error: 'No se encontró una cuenta de YouTube vinculada. Por favor, conecta tu canal de YouTube primero.',
          code: 'OAUTH_REQUIRED',
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 3. Perform Resumable Upload
    const result = await uploadShortResumable({
      accessToken,
      refreshToken,
      userId: user_id,
      videoUrl: video_url,
      title: titulo_hook,
      description: descripcion,
      hashtags: Array.isArray(hashtags) ? hashtags : [],
      duracion_seg: Number(duracion_seg),
      privacyStatus: privacy_status,
    });

    // 4. Update clip status in DB if clip_id is provided
    if (clip_id) {
      try {
        await (supabase.from('clips') as any)
          .update({
            estado: 'publicado',
          })
          .eq('id', clip_id);
      } catch {}
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('YouTube upload error in API route:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'Error desconocido al subir el Short a YouTube',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
