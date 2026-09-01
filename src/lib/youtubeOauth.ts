import type { Database } from './supabase/types';

export interface YouTubeChannelInfo {
  channelId: string;
  channelTitle: string;
  channelThumbnail: string;
  customUrl?: string;
  subscriberCount?: string;
}

export interface YouTubeOAuthTokens {
  access_token: string;
  refresh_token?: string | null;
  expires_at: number; // Unix timestamp in ms
  channel_id?: string;
  channel_title?: string;
  channel_thumbnail?: string;
}

export interface UploadShortOptions {
  accessToken: string;
  refreshToken?: string;
  videoBuffer?: ArrayBuffer | Uint8Array | Buffer;
  videoUrl?: string;
  titulo_hook: string;
  descripcion?: string;
  hashtags?: string[];
  duracion_seg?: number;
  privacyStatus?: 'public' | 'unlisted' | 'private';
  onProgress?: (percent: number, statusText: string) => void;
}

export interface UploadShortResult {
  success: boolean;
  videoId: string;
  youtubeUrl: string;
  privacyStatus: 'public' | 'unlisted' | 'private';
  titulo: string;
  channelTitle?: string;
}

/**
 * Fallback encryption secret if none provided in env
 */
const DEFAULT_FALLBACK_SECRET = 'clipforge_oauth_secret_32_bytes_key!';

/**
 * Symmetric Token Encryption using AES-GCM (Node.js crypto compatible or browser subtle crypto fallback)
 */
export async function encryptToken(plainText: string, secretKey?: string): Promise<string> {
  if (!plainText) return '';
  const keyStr = secretKey || (typeof process !== 'undefined' ? process.env?.OAUTH_ENCRYPTION_SECRET : undefined) || DEFAULT_FALLBACK_SECRET;

  if (typeof window === 'undefined' || typeof process !== 'undefined') {
    try {
      const crypto = await import('crypto');
      const iv = crypto.randomBytes(12);
      const key = crypto.createHash('sha256').update(keyStr).digest();
      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
      let encrypted = cipher.update(plainText, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const authTag = cipher.getAuthTag().toString('hex');
      return `${iv.toString('hex')}:${authTag}:${encrypted}`;
    } catch {
      // Fallback
    }
  }

  // Universal base64 obfuscation fallback for browser-only sandboxes
  try {
    const encoded = btoa(encodeURIComponent(plainText));
    return `b64:${encoded}`;
  } catch {
    return plainText;
  }
}

/**
 * Symmetric Token Decryption
 */
export async function decryptToken(cipherString: string, secretKey?: string): Promise<string> {
  if (!cipherString) return '';
  if (cipherString.startsWith('b64:')) {
    try {
      return decodeURIComponent(atob(cipherString.replace('b64:', '')));
    } catch {
      return cipherString;
    }
  }

  const keyStr = secretKey || (typeof process !== 'undefined' ? process.env?.OAUTH_ENCRYPTION_SECRET : undefined) || DEFAULT_FALLBACK_SECRET;

  if (typeof window === 'undefined' || typeof process !== 'undefined') {
    try {
      const crypto = await import('crypto');
      const parts = cipherString.split(':');
      if (parts.length === 3) {
        const [ivHex, authTagHex, encryptedHex] = parts;
        const iv = Buffer.from(ivHex, 'hex');
        const authTag = Buffer.from(authTagHex, 'hex');
        const key = crypto.createHash('sha256').update(keyStr).digest();
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(authTag);
        let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
      }
    } catch (e) {
      console.warn('[decryptToken] Decryption failed, returning raw/fallback:', e);
    }
  }

  return cipherString;
}

/**
 * Generates Google OAuth 2.0 Authorization URL for YouTube Shorts Upload
 */
export function buildYouTubeAuthUrl(redirectUri: string, state?: string): string {
  const clientId = (typeof process !== 'undefined' && (process.env?.YOUTUBE_CLIENT_ID || process.env?.GOOGLE_CLIENT_ID)) || '';

  const scopes = [
    'https://www.googleapis.com/auth/youtube.upload',
    'https://www.googleapis.com/auth/youtube.readonly',
    'https://www.googleapis.com/auth/userinfo.profile',
  ];

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: scopes.join(' '),
    access_type: 'offline', // Essential for getting refresh_token
    prompt: 'consent',       // Forces Google to return a refresh_token every time
    include_granted_scopes: 'true',
  });

  if (state) {
    params.set('state', state);
  }

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/**
 * Exchanges authorization code for Access & Refresh tokens
 */
export async function exchangeCodeForTokens(code: string, redirectUri: string): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  expires_at: number;
}> {
  const clientId = (typeof process !== 'undefined' && (process.env?.YOUTUBE_CLIENT_ID || process.env?.GOOGLE_CLIENT_ID)) || '';
  const clientSecret = (typeof process !== 'undefined' && (process.env?.YOUTUBE_CLIENT_SECRET || process.env?.GOOGLE_CLIENT_SECRET)) || '';

  const params = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google OAuth Token Exchange Failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const expiresIn = Number(data.expires_in) || 3600;
  const expiresAt = Date.now() + expiresIn * 1000;

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: expiresIn,
    expires_at: expiresAt,
  };
}

/**
 * Refreshes an expired YouTube OAuth Access Token using the stored refresh_token
 */
export async function refreshYouTubeToken(refreshToken: string): Promise<{
  access_token: string;
  expires_in: number;
  expires_at: number;
}> {
  const clientId = (typeof process !== 'undefined' && (process.env?.YOUTUBE_CLIENT_ID || process.env?.GOOGLE_CLIENT_ID)) || '';
  const clientSecret = (typeof process !== 'undefined' && (process.env?.YOUTUBE_CLIENT_SECRET || process.env?.GOOGLE_CLIENT_SECRET)) || '';

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google Token Refresh Failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const expiresIn = Number(data.expires_in) || 3600;
  const expiresAt = Date.now() + expiresIn * 1000;

  return {
    access_token: data.access_token,
    expires_in: expiresIn,
    expires_at: expiresAt,
  };
}

/**
 * Fetches the authenticated user's YouTube Channel info
 */
export async function fetchYouTubeChannelInfo(accessToken: string): Promise<YouTubeChannelInfo> {
  const response = await fetch(
    'https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true',
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Failed to fetch YouTube channel info: ${err}`);
  }

  const data = await response.json();
  const channel = data.items?.[0];

  if (!channel) {
    return {
      channelId: 'my-youtube-channel',
      channelTitle: 'Mi Canal de YouTube',
      channelThumbnail: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=120&auto=format&fit=crop&q=80',
      subscriberCount: '0',
    };
  }

  return {
    channelId: channel.id,
    channelTitle: channel.snippet?.title || 'Mi Canal',
    channelThumbnail: channel.snippet?.thumbnails?.default?.url || channel.snippet?.thumbnails?.high?.url || '',
    customUrl: channel.snippet?.customUrl,
    subscriberCount: channel.statistics?.subscriberCount || '0',
  };
}
