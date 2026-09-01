-- Migración para añadir soporte de Hooks virales, CTAs, hashtags, descripciones y primeros subtítulos hook
-- Ejecutar en el SQL Editor de Supabase

ALTER TABLE clips 
ADD COLUMN IF NOT EXISTS titulo_hook TEXT,
ADD COLUMN IF NOT EXISTS cta TEXT,
ADD COLUMN IF NOT EXISTS hashtags TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS descripcion TEXT,
ADD COLUMN IF NOT EXISTS mejor_momento_primera_frase TEXT,
ADD COLUMN IF NOT EXISTS titulos_sugeridos TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS ctas_sugeridos TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS hook_como_primer_subtitulo BOOLEAN DEFAULT true;
