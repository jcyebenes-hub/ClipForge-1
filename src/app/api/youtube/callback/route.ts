import { exchangeCodeForTokens, fetchYouTubeChannelInfo, encryptToken } from '../../../../lib/youtubeOauth';
import type { YouTubeChannelInfo } from '../../../../lib/youtubeOauth';
import { supabase } from '../../../../lib/supabase/client';

export async function GET(req: Request) {
  try {
    const urlObj = new URL(req.url);
    const code = urlObj.searchParams.get('code');
    const state = urlObj.searchParams.get('state') || '';
    const error = urlObj.searchParams.get('error');

    if (error) {
      return new Response(
        `<!DOCTYPE html>
        <html>
          <head><title>Error de Autenticación</title></head>
          <body style="background:#0a0a12;color:#f87171;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
            <div style="text-align:center;padding:2rem;background:#141424;border-radius:1rem;border:1px solid #7f1d1d;">
              <h2>Acceso cancelado o denegado</h2>
              <p style="color:#94a3b8;font-size:14px;">No se concedieron los permisos requeridos para publicar Shorts en YouTube.</p>
              <button onclick="window.close()" style="margin-top:1rem;padding:0.5rem 1rem;background:#ef4444;color:white;border:none;border-radius:0.5rem;cursor:pointer;">Cerrar ventana</button>
            </div>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'OAUTH_AUTH_ERROR', error: '${error}' }, '*');
              }
            </script>
          </body>
        </html>`,
        { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      );
    }

    if (!code) {
      return new Response('Código de autorización no proporcionado', { status: 400 });
    }

    const redirectUri = `${urlObj.origin}/api/youtube/callback`;
    const tokens = await exchangeCodeForTokens(code, redirectUri);

    // Fetch Channel Profile
    let channelInfo: YouTubeChannelInfo = {
      channelId: 'youtube-channel',
      channelTitle: 'Canal de YouTube',
      channelThumbnail: '',
      subscriberCount: '0',
    };

    try {
      channelInfo = await fetchYouTubeChannelInfo(tokens.access_token);
    } catch (chanErr) {
      console.warn('Could not fetch channel details:', chanErr);
    }

    // Encrypt tokens
    const encryptedAccess = await encryptToken(tokens.access_token);
    const encryptedRefresh = tokens.refresh_token ? await encryptToken(tokens.refresh_token) : null;

    // Parse user_id from state if passed
    let userId = '';
    if (state && state.startsWith('uid:')) {
      userId = state.replace('uid:', '');
    }

    // Save to Supabase user_oauth table if user id known or if Supabase is active
    if (userId) {
      try {
        await (supabase.from('user_oauth' as any) as any).upsert({
          user_id: userId,
          provider: 'youtube',
          access_token: encryptedAccess,
          refresh_token: encryptedRefresh,
          expires_at: tokens.expires_at,
          channel_id: channelInfo.channelId,
          channel_title: channelInfo.channelTitle,
          channel_thumbnail: channelInfo.channelThumbnail,
          updated_at: new Date().toISOString(),
        });
      } catch (dbErr) {
        console.warn('Could not save tokens to user_oauth table:', dbErr);
      }
    }

    // Return HTML page that broadcasts postMessage and closes popup
    const channelJson = JSON.stringify(channelInfo);
    const safeTokensJson = JSON.stringify({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: tokens.expires_at,
      channel: channelInfo,
    });

    return new Response(
      `<!DOCTYPE html>
      <html>
        <head>
          <title>YouTube Conectado con Éxito</title>
          <style>
            body {
              background-color: #0a0a12;
              color: #f8fafc;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              height: 100vh;
              margin: 0;
            }
            .card {
              text-align: center;
              padding: 2.5rem;
              background: #121222;
              border-radius: 1.25rem;
              border: 1px solid rgba(168, 85, 247, 0.4);
              box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
              max-width: 380px;
            }
            .avatar {
              width: 64px;
              height: 64px;
              border-radius: 50%;
              border: 2px solid #a855f7;
              margin: 0 auto 1rem;
              object-fit: cover;
            }
            h2 { margin: 0 0 0.5rem; color: #fff; font-size: 1.25rem; }
            p { margin: 0; color: #94a3b8; font-size: 0.875rem; }
            .badge {
              display: inline-block;
              margin-top: 1rem;
              padding: 0.25rem 0.75rem;
              background: rgba(34, 197, 94, 0.2);
              color: #4ade80;
              border: 1px solid rgba(34, 197, 94, 0.4);
              border-radius: 9999px;
              font-size: 0.75rem;
              font-weight: 600;
            }
          </style>
        </head>
        <body>
          <div class="card">
            ${channelInfo.channelThumbnail ? `<img class="avatar" src="${channelInfo.channelThumbnail}" alt="Canal" />` : ''}
            <h2>¡Canal Conectado!</h2>
            <p><strong>${channelInfo.channelTitle}</strong> se ha vinculado a ClipForge.</p>
            <div class="badge">Listo para publicar Shorts</div>
            <p style="margin-top: 1.5rem; font-size: 0.75rem; color: #64748b;">Esta ventana se cerrará automáticamente...</p>
          </div>
          <script>
            try {
              const payload = {
                type: 'OAUTH_AUTH_SUCCESS',
                provider: 'youtube',
                channel: ${channelJson},
                tokens: ${safeTokensJson}
              };
              if (window.opener) {
                window.opener.postMessage(payload, '*');
                setTimeout(() => {
                  window.close();
                }, 1200);
              } else {
                setTimeout(() => {
                  window.location.href = '/dashboard';
                }, 1500);
              }
            } catch (err) {
              console.error('PostMessage error:', err);
            }
          </script>
        </body>
      </html>`,
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  } catch (error: any) {
    console.error('YouTube OAuth Callback Error:', error);
    return new Response(
      `<!DOCTYPE html>
      <html>
        <head><title>Error en Callback</title></head>
        <body style="background:#0a0a12;color:#f87171;font-family:sans-serif;padding:2rem;">
          <h3>Error en la autenticación con YouTube</h3>
          <p style="color:#94a3b8;">${error.message || 'Error desconocido'}</p>
          <button onclick="window.close()" style="padding:0.5rem 1rem;background:#ef4444;color:white;border:none;border-radius:0.5rem;cursor:pointer;">Cerrar</button>
        </body>
      </html>`,
      { status: 500, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }
}
