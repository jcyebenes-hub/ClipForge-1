/**
 * Sistema de Internacionalización (i18n) para ClipForge
 * Soporta Español (es) e Inglés (en) con persistencia en localStorage.
 */

export type Idioma = 'es' | 'en';

export const DICCIONARIO = {
  es: {
    // General & Navbar
    app_name: 'ClipForge',
    tagline: 'Convierte vídeos largos en Shorts virales con IA',
    dashboard: 'Dashboard',
    publicar: 'Publicar',
    landing: 'Landing',
    nuevo_proyecto: 'Crear clips nuevos',
    plan_gratis: 'Plan Gratis',
    cerrar_sesion: 'Cerrar sesión',
    conectar_youtube: 'Conectar YouTube',
    desconectar_youtube: 'Desconectar',
    estadisticas: 'Estadísticas',
    como_se_procesa: '¿Cómo se procesa tu vídeo?',
    privacidad_garantizada: 'Tu vídeo se procesa en tu navegador; solo se sube el resultado final.',

    // Landing
    hero_badge: 'IA Gratuita para Creadores de Contenido',
    hero_title_1: 'Convierte vídeos largos en',
    hero_title_2: 'Shorts virales',
    hero_title_3: 'con IA en segundos',
    hero_subtitle: 'La IA recorta, subtitula y publica automáticamente en TikTok, YouTube e Instagram. 100% gratis y procesado de forma privada en tu navegador.',
    btn_empezar_gratis: 'Empezar gratis ahora',
    btn_ver_demo: 'Ver cómo funciona',
    stats_shorts_creados: 'Shorts creados',
    stats_tiempo_ahorrado: 'Horas ahorradas',
    stats_satisfaccion: 'Calificación',

    // Features
    feat_1_title: 'Detección de Hooks Virales',
    feat_1_desc: 'La IA analiza el contenido con Llama 3.3 y encuentra los momentos de mayor retención emocional.',
    feat_2_title: 'Subtítulos Animados Estilo Hormozi',
    feat_2_desc: 'Subtítulos dinámicos palabra por palabra con colores, emojis y efectos karaoke para captar atención.',
    feat_3_title: 'Reencuadre 9:16 Inteligente',
    feat_3_desc: 'Conversión automática a formato vertical con seguimiento de caras y fondos difuminados.',
    feat_4_title: 'Publicación Automática Multicanal',
    feat_4_desc: 'Programa tus clips directamente en YouTube Shorts, TikTok e Instagram Reels desde un solo calendario.',

    // Editor & Process
    editor_titulo: 'Editor de Clip Viral',
    btn_descargar_mp4: 'Descargar MP4',
    btn_exportar: 'Exportar Clip',
    btn_guardar_cambios: 'Guardar Cambios',
    procesando_en_navegador: 'Procesando en tu navegador (~1-3 min)...',
    subtitulos_estilo: 'Estilo de subtítulos',
    tipo_encuadre: 'Tipo de encuadre',
    score_viral: 'Score Viral',

    // Errores
    error_404_title: 'Página no encontrada',
    error_404_desc: 'La página que estás buscando no existe o ha sido movida.',
    btn_volver_inicio: 'Volver al Inicio',
    btn_ir_dashboard: 'Ir al Dashboard',
    error_boundary_title: 'Ha ocurrido un error inesperado',
    error_boundary_desc: 'No te preocupes, tus proyectos y clips están seguros.',
    btn_reintentar: 'Reintentar',
  },
  en: {
    // General & Navbar
    app_name: 'ClipForge',
    tagline: 'Turn long videos into viral Shorts with AI',
    dashboard: 'Dashboard',
    publicar: 'Publish',
    landing: 'Landing',
    nuevo_proyecto: 'Create new clips',
    plan_gratis: 'Free Plan',
    cerrar_sesion: 'Log out',
    conectar_youtube: 'Connect YouTube',
    desconectar_youtube: 'Disconnect',
    estadisticas: 'Analytics',
    como_se_procesa: 'How is your video processed?',
    privacidad_garantizada: 'Your video is processed in your browser; only the final clip is uploaded.',

    // Landing
    hero_badge: 'Free AI for Content Creators',
    hero_title_1: 'Turn long videos into',
    hero_title_2: 'viral Shorts',
    hero_title_3: 'with AI in seconds',
    hero_subtitle: 'AI automatically trims, captions and publishes to TikTok, YouTube and Instagram. 100% free and processed privately in your browser.',
    btn_empezar_gratis: 'Start free now',
    btn_ver_demo: 'See how it works',
    stats_shorts_creados: 'Shorts created',
    stats_tiempo_ahorrado: 'Hours saved',
    stats_satisfaccion: 'Satisfaction',

    // Features
    feat_1_title: 'Viral Hook Detection',
    feat_1_desc: 'AI analyzes content with Llama 3.3 and pinpoints high-retention emotional moments.',
    feat_2_title: 'Animated Hormozi-Style Captions',
    feat_2_desc: 'Dynamic word-by-word captions with custom colors, emojis and karaoke animations.',
    feat_3_title: 'Smart 9:16 Reframing',
    feat_3_desc: 'Automatic vertical aspect ratio conversion with face-tracking and blurred background fill.',
    feat_4_title: 'Automated Multi-Channel Publishing',
    feat_4_desc: 'Schedule your clips directly to YouTube Shorts, TikTok and Instagram Reels from one calendar.',

    // Editor & Process
    editor_titulo: 'Viral Clip Editor',
    btn_descargar_mp4: 'Download MP4',
    btn_exportar: 'Export Clip',
    btn_guardar_cambios: 'Save Changes',
    procesando_en_navegador: 'Processing in your browser (~1-3 min)...',
    subtitulos_estilo: 'Caption style',
    tipo_encuadre: 'Framing mode',
    score_viral: 'Viral Score',

    // Errors
    error_404_title: 'Page Not Found',
    error_404_desc: 'The page you are looking for does not exist or has been moved.',
    btn_volver_inicio: 'Back to Home',
    btn_ir_dashboard: 'Go to Dashboard',
    error_boundary_title: 'An unexpected error occurred',
    error_boundary_desc: "Don't worry, your projects and clips are safe.",
    btn_reintentar: 'Retry',
  },
};

export type TranslationKey = keyof typeof DICCIONARIO['es'];
