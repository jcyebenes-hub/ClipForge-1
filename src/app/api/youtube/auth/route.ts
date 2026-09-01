import { buildYouTubeAuthUrl } from '../../../../lib/youtubeOauth';

export async function GET(req: Request) {
  try {
    const urlObj = new URL(req.url);
    const origin = urlObj.origin;
    const redirectUri = `${origin}/api/youtube/callback`;
    const state = urlObj.searchParams.get('state') || '';

    const authUrl = buildYouTubeAuthUrl(redirectUri, state);

    // If client requested JSON (e.g. from popup fetch)
    const acceptHeader = req.headers.get('Accept') || '';
    if (acceptHeader.includes('application/json') || urlObj.searchParams.get('format') === 'json') {
      return new Response(JSON.stringify({ url: authUrl }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Otherwise redirect to Google Auth URL
    return Response.redirect(authUrl, 302);
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
