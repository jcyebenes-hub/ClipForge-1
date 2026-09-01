export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          nombre: string | null;
          created_at: string;
          plan: 'gratis' | 'pro' | 'creador' | 'agencia' | string;
          marca_de_agua: boolean;
        };
        Insert: {
          id: string;
          email?: string | null;
          nombre?: string | null;
          created_at?: string;
          plan?: string;
          marca_de_agua?: boolean;
        };
        Update: {
          id?: string;
          email?: string | null;
          nombre?: string | null;
          created_at?: string;
          plan?: string;
          marca_de_agua?: boolean;
        };
      };
      proyectos: {
        Row: {
          id: string;
          user_id: string;
          titulo: string;
          nombre?: string | null;
          url_youtube: string | null;
          archivo_nombre: string | null;
          video_url?: string | null;
          subtitulos_json?: Json | null;
          transcripcion?: string | null;
          estado: 'nuevo' | 'importando' | 'transcrito' | 'analizado' | 'clips_listos' | 'exportado';
          duracion_seg: number | null;
          creado_en: string;
          actualizado_en: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          titulo: string;
          nombre?: string | null;
          url_youtube?: string | null;
          archivo_nombre?: string | null;
          video_url?: string | null;
          subtitulos_json?: Json | null;
          transcripcion?: string | null;
          estado?: 'nuevo' | 'importando' | 'transcrito' | 'analizado' | 'clips_listos' | 'exportado';
          duracion_seg?: number | null;
          creado_en?: string;
          actualizado_en?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          titulo?: string;
          nombre?: string | null;
          url_youtube?: string | null;
          archivo_nombre?: string | null;
          video_url?: string | null;
          subtitulos_json?: Json | null;
          transcripcion?: string | null;
          estado?: 'nuevo' | 'importando' | 'transcrito' | 'analizado' | 'clips_listos' | 'exportado';
          duracion_seg?: number | null;
          creado_en?: string;
          actualizado_en?: string;
        };
      };
      clips: {
        Row: {
          id: string;
          proyecto_id: string;
          inicio_seg: number;
          fin_seg: number;
          puntuacion_viral: number;
          titulo_hook: string;
          cta: string | null;
          hashtags?: string[] | null;
          descripcion?: string | null;
          mejor_momento_primera_frase?: string | null;
          titulos_sugeridos?: string[] | null;
          ctas_sugeridos?: string[] | null;
          hook_como_primer_subtitulo?: boolean | null;
          subtitulos_json: Json | null;
          video_url: string | null;
          video_vertical_url?: string | null;
          video_short_url?: string | null;
          estado: string;
          creado_en: string;
        };
        Insert: {
          id?: string;
          proyecto_id: string;
          inicio_seg: number;
          fin_seg: number;
          puntuacion_viral?: number;
          titulo_hook: string;
          cta?: string | null;
          hashtags?: string[] | null;
          descripcion?: string | null;
          mejor_momento_primera_frase?: string | null;
          titulos_sugeridos?: string[] | null;
          ctas_sugeridos?: string[] | null;
          hook_como_primer_subtitulo?: boolean | null;
          subtitulos_json?: Json | null;
          video_url?: string | null;
          video_vertical_url?: string | null;
          video_short_url?: string | null;
          estado?: string;
          creado_en?: string;
        };
        Update: {
          id?: string;
          proyecto_id?: string;
          inicio_seg?: number;
          fin_seg?: number;
          puntuacion_viral?: number;
          titulo_hook?: string;
          cta?: string | null;
          hashtags?: string[] | null;
          descripcion?: string | null;
          mejor_momento_primera_frase?: string | null;
          titulos_sugeridos?: string[] | null;
          ctas_sugeridos?: string[] | null;
          hook_como_primer_subtitulo?: boolean | null;
          subtitulos_json?: Json | null;
          video_url?: string | null;
          video_vertical_url?: string | null;
          video_short_url?: string | null;
          estado?: string;
          creado_en?: string;
        };
      };
      configs_canal: {
        Row: {
          id: string;
          user_id: string;
          url_canal_youtube?: string | null;
          canal_id?: string | null;
          canal_nombre?: string | null;
          activo?: boolean;
          auto_crear_shorts?: boolean;
          auto_publicar?: boolean;
          estilo_predeterminado?: string | null;
          frecuencia_publicacion?: string | null;
          creado_en?: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          url_canal_youtube?: string | null;
          canal_id?: string | null;
          canal_nombre?: string | null;
          activo?: boolean;
          auto_crear_shorts?: boolean;
          auto_publicar?: boolean;
          estilo_predeterminado?: string | null;
          frecuencia_publicacion?: string | null;
          creado_en?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          url_canal_youtube?: string | null;
          canal_id?: string | null;
          canal_nombre?: string | null;
          activo?: boolean;
          auto_crear_shorts?: boolean;
          auto_publicar?: boolean;
          estilo_predeterminado?: string | null;
          frecuencia_publicacion?: string | null;
          creado_en?: string;
        };
      };
      uso_usuario: {
        Row: {
          id: string;
          user_id: string | null;
          ip_hash: string;
          fecha: string;
          transcribir_count: number;
          analizar_count: number;
          exportar_count: number;
          min_datos: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          ip_hash: string;
          fecha: string;
          transcribir_count?: number;
          analizar_count?: number;
          exportar_count?: number;
          min_datos?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          ip_hash?: string;
          fecha?: string;
          transcribir_count?: number;
          analizar_count?: number;
          exportar_count?: number;
          min_datos?: number;
          created_at?: string;
        };
      };
      publicaciones_programadas: {
        Row: {
          id: string;
          user_id: string;
          clip_id: string;
          proyecto_id: string;
          titulo: string;
          descripcion: string | null;
          plataforma: 'youtube' | 'tiktok' | 'instagram' | string;
          fecha_programada: string;
          estado: 'programado' | 'publicado' | 'error';
          error_mensaje?: string | null;
          publicado_en?: string | null;
          video_url?: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          clip_id: string;
          proyecto_id: string;
          titulo: string;
          descripcion?: string | null;
          plataforma: 'youtube' | 'tiktok' | 'instagram' | string;
          fecha_programada: string;
          estado?: 'programado' | 'publicado' | 'error';
          error_mensaje?: string | null;
          publicado_en?: string | null;
          video_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          clip_id?: string;
          proyecto_id?: string;
          titulo?: string;
          descripcion?: string | null;
          plataforma?: 'youtube' | 'tiktok' | 'instagram' | string;
          fecha_programada?: string;
          estado?: 'programado' | 'publicado' | 'error';
          error_mensaje?: string | null;
          publicado_en?: string | null;
          video_url?: string | null;
          created_at?: string;
        };
      };
    };
  };
};

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Proyecto = Database['public']['Tables']['proyectos']['Row'];
export type Clip = Database['public']['Tables']['clips']['Row'];
export type ConfigCanal = Database['public']['Tables']['configs_canal']['Row'];
export type UsoUsuario = Database['public']['Tables']['uso_usuario']['Row'];
export type PublicacionProgramada = Database['public']['Tables']['publicaciones_programadas']['Row'];
