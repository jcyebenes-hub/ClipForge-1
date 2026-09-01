import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase/client';
import { decryptToken } from '../lib/youtubeOauth';
import type { YouTubeChannelInfo, YouTubeOAuthTokens } from '../lib/youtubeOauth';
import type { ResumableUploadResult } from '../lib/youtubeUploader';
import { toast } from 'sonner';

interface YouTubeAuthContextType {
  isConnected: boolean;
  channel: YouTubeChannelInfo | null;
  loading: boolean;
  connectYouTube: () => Promise<void>;
  disconnectYouTube: () => void;
  uploadClipToYouTube: (options: {
    clipId: string;
    videoUrl?: string;
    titulo_hook: string;
    descripcion?: string;
    hashtags?: string[];
    duracion_seg?: number;
    privacyStatus?: 'public' | 'unlisted' | 'private';
    onProgress?: (percent: number, text: string) => void;
  }) => Promise<ResumableUploadResult>;
  refreshChannelStatus: () => Promise<void>;
}

const YouTubeAuthContext = createContext<YouTubeAuthContextType | undefined>(undefined);

export const YouTubeAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isSupabaseConfigured } = useAuth();
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [channel, setChannel] = useState<YouTubeChannelInfo | null>(null);
  const [tokens, setTokens] = useState<YouTubeOAuthTokens | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Load existing connection from Supabase or localStorage
  const refreshChannelStatus = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Try Supabase user_oauth table
      if (isSupabaseConfigured && user) {
        try {
          const { data, error } = await (supabase.from('user_oauth' as any) as any)
            .select('*')
            .eq('user_id', user.id)
            .eq('provider', 'youtube')
            .single();

          if (!error && data) {
            const decAccessToken = await decryptToken(data.access_token);
            const decRefreshToken = data.refresh_token ? await decryptToken(data.refresh_token) : undefined;

            setTokens({
              access_token: decAccessToken,
              refresh_token: decRefreshToken,
              expires_at: data.expires_at || Date.now() + 3600000,
              channel_id: data.channel_id,
              channel_title: data.channel_title,
              channel_thumbnail: data.channel_thumbnail,
            });

            setChannel({
              channelId: data.channel_id || 'my-channel',
              channelTitle: data.channel_title || 'Canal de YouTube',
              channelThumbnail: data.channel_thumbnail || '',
            });

            setIsConnected(true);
            setLoading(false);
            return;
          }
        } catch (dbErr) {
          console.warn('Error reading user_oauth from Supabase:', dbErr);
        }
      }

      // 2. Fallback to localStorage
      const localOauthKey = user ? `clipforge_yt_oauth_${user.id}` : 'clipforge_yt_oauth_local';
      const stored = localStorage.getItem(localOauthKey);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setTokens(parsed.tokens);
          setChannel(parsed.channel);
          setIsConnected(true);
          setLoading(false);
          return;
        } catch {}
      }

      setIsConnected(false);
      setChannel(null);
      setTokens(null);
    } finally {
      setLoading(false);
    }
  }, [user, isSupabaseConfigured]);

  useEffect(() => {
    refreshChannelStatus();
  }, [refreshChannelStatus]);

  // Listen for postMessage from OAuth popup
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS' && event.data.provider === 'youtube') {
        const receivedChannel: YouTubeChannelInfo = event.data.channel || {
          channelId: 'connected-channel',
          channelTitle: 'Canal de YouTube Conectado',
          channelThumbnail: '',
        };
        const receivedTokens: YouTubeOAuthTokens = event.data.tokens;

        setChannel(receivedChannel);
        setTokens(receivedTokens);
        setIsConnected(true);

        // Persist locally
        const localKey = user ? `clipforge_yt_oauth_${user.id}` : 'clipforge_yt_oauth_local';
        localStorage.setItem(
          localKey,
          JSON.stringify({
            channel: receivedChannel,
            tokens: receivedTokens,
            connectedAt: new Date().toISOString(),
          })
        );

        toast.success(`¡Canal "${receivedChannel.channelTitle}" conectado con éxito!`);
      } else if (event.data?.type === 'OAUTH_AUTH_ERROR') {
        toast.error('No se pudo completar la conexión con YouTube');
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [user]);

  // Initiate popup OAuth flow
  const connectYouTube = async () => {
    try {
      const stateParam = user ? `uid:${user.id}` : 'uid:demo-user';
      const authEndpoint = `/api/youtube/auth?format=json&state=${encodeURIComponent(stateParam)}`;

      const response = await fetch(authEndpoint, {
        headers: { Accept: 'application/json' },
      });

      let authUrl = '';
      if (response.ok) {
        const data = await response.json();
        authUrl = data.url;
      } else {
        // Build direct fallback Google OAuth URL
        const redirectUri = `${window.location.origin}/api/youtube/callback`;
        authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${
          encodeURIComponent((import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || '')
        }&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(
          'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly'
        )}&access_type=offline&prompt=consent&state=${encodeURIComponent(stateParam)}`;
      }

      // Open OAuth provider directly in popup as per AI Studio iframe requirements
      const popup = window.open(
        authUrl,
        'oauth_youtube_popup',
        'width=600,height=750,menubar=no,toolbar=no,location=no,status=no'
      );

      if (!popup || popup.closed || typeof popup.closed === 'undefined') {
        toast.warning('El navegador bloqueó la ventana emergente. Por favor, permite ventanas emergentes para conectar YouTube.');
      } else {
        popup.focus();
      }
    } catch (err: any) {
      console.error('Error initiating YouTube OAuth:', err);
      toast.error(`Error al conectar con YouTube: ${err.message || err}`);
    }
  };

  const disconnectYouTube = async () => {
    const localKey = user ? `clipforge_yt_oauth_${user.id}` : 'clipforge_yt_oauth_local';
    localStorage.removeItem(localKey);

    if (isSupabaseConfigured && user) {
      try {
        await (supabase.from('user_oauth' as any) as any)
          .delete()
          .eq('user_id', user.id)
          .eq('provider', 'youtube');
      } catch (err) {
        console.warn('Error deleting user_oauth record:', err);
      }
    }

    setIsConnected(false);
    setChannel(null);
    setTokens(null);
    toast.info('Canal de YouTube desconectado');
  };

  // Upload Short API caller
  const uploadClipToYouTube = async (options: {
    clipId: string;
    videoUrl?: string;
    titulo_hook: string;
    descripcion?: string;
    hashtags?: string[];
    duracion_seg?: number;
    privacyStatus?: 'public' | 'unlisted' | 'private';
    onProgress?: (percent: number, text: string) => void;
  }): Promise<ResumableUploadResult> => {
    const {
      clipId,
      videoUrl,
      titulo_hook,
      descripcion = '',
      hashtags = [],
      duracion_seg = 30,
      privacyStatus = 'public',
      onProgress,
    } = options;

    onProgress?.(15, 'Validando cuenta de YouTube y preparando vídeo...');

    const payload = {
      user_id: user?.id || 'demo-user',
      clip_id: clipId,
      video_url: videoUrl,
      titulo_hook,
      descripcion,
      hashtags,
      duracion_seg,
      privacy_status: privacyStatus,
      access_token: tokens?.access_token,
      refresh_token: tokens?.refresh_token,
    };

    onProgress?.(35, 'Iniciando subida resumable en YouTube Data API...');

    const response = await fetch('/api/youtube/upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: response.statusText }));
      if (response.status === 401) {
        setIsConnected(false);
      }
      throw new Error(errorData.error || `Fallo en la subida a YouTube (${response.status})`);
    }

    const result: ResumableUploadResult = await response.json();
    onProgress?.(100, '¡Short publicado con éxito en YouTube!');

    return result;
  };

  return (
    <YouTubeAuthContext.Provider
      value={{
        isConnected,
        channel,
        loading,
        connectYouTube,
        disconnectYouTube,
        uploadClipToYouTube,
        refreshChannelStatus,
      }}
    >
      {children}
    </YouTubeAuthContext.Provider>
  );
};

export const useYouTube = (): YouTubeAuthContextType => {
  const context = useContext(YouTubeAuthContext);
  if (!context) {
    throw new Error('useYouTube debe ser utilizado dentro de un YouTubeAuthProvider');
  }
  return context;
};
