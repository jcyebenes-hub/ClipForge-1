import React, { useState } from 'react';
import {
  Sparkles,
  Zap,
  Tag,
  MessageSquare,
  Flame,
  Check,
  RefreshCw,
  Loader2,
  Copy,
  Plus,
  X,
  Sliders,
  Type,
  FileText,
} from 'lucide-react';
import { toast } from 'sonner';

export interface ViralHookData {
  titulo_gancho: string[];
  cta: string[];
  hashtags: string[];
  descripcion: string;
  mejor_momento_primera_frase: string;
}

interface ViralShortSectionProps {
  clipId: string;
  proyectoId: string;
  transcripcion?: string;
  duracionSeg?: number;
  currentTituloHook: string;
  currentCta?: string;
  currentHashtags?: string[];
  currentDescripcion?: string;
  currentMejorMomentoPrimeraFrase?: string;
  titulosSugeridos?: string[];
  ctasSugeridos?: string[];
  hookComoPrimerSubtitulo?: boolean;
  onUpdateViralMeta: (data: {
    titulo_hook: string;
    cta?: string;
    hashtags?: string[];
    descripcion?: string;
    mejor_momento_primera_frase?: string;
    titulos_sugeridos?: string[];
    ctas_sugeridos?: string[];
  }) => void;
  onGenerarShortConHook: (hookPhrase: string) => Promise<void>;
  isProcessingShort?: boolean;
}

export function ViralShortSection({
  clipId,
  proyectoId,
  transcripcion = '',
  duracionSeg = 30,
  currentTituloHook,
  currentCta,
  currentHashtags,
  currentDescripcion,
  currentMejorMomentoPrimeraFrase,
  titulosSugeridos,
  ctasSugeridos,
  hookComoPrimerSubtitulo = true,
  onUpdateViralMeta,
  onGenerarShortConHook,
  isProcessingShort = false,
}: ViralShortSectionProps) {
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [selectedTitle, setSelectedTitle] = useState<string>(currentTituloHook || '');
  const [titleOptions, setTitleOptions] = useState<string[]>(
    titulosSugeridos && titulosSugeridos.length > 0
      ? titulosSugeridos
      : [
          currentTituloHook || 'El error del 99% que destruye tus vídeos',
          'La regla de oro para retención extrema',
          'Cómo lograr esto en 30 segundos',
        ]
  );
  const [selectedCta, setSelectedCta] = useState<string>(
    currentCta || 'Sígueme para más trucos diarios'
  );
  const [ctaOptions, setCtaOptions] = useState<string[]>(
    ctasSugeridos && ctasSugeridos.length > 0
      ? ctasSugeridos
      : [
          currentCta || 'Sígueme para más trucos diarios',
          'Guarda este vídeo para aplicarlo en tu próximo reel',
        ]
  );
  const [hashtags, setHashtags] = useState<string[]>(
    currentHashtags && currentHashtags.length > 0
      ? currentHashtags
      : ['#shorts', '#viral', '#creadores', '#edicion', '#algoritmo', '#marketing', '#trucos', '#retencion']
  );
  const [newTagInput, setNewTagInput] = useState('');
  const [descripcion, setDescripcion] = useState<string>(
    currentDescripcion || 'Descubre la técnica exacta para multiplicar la retención de tus vídeos cortos y hacerlos despegar. #shorts #viral'
  );
  const [primerSubtituloHook, setPrimerSubtituloHook] = useState<string>(
    currentMejorMomentoPrimeraFrase || currentTituloHook || 'El secreto de la retención'
  );
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Synchronize internal state with props when changed externally
  React.useEffect(() => {
    if (currentTituloHook) setSelectedTitle(currentTituloHook);
  }, [currentTituloHook]);

  React.useEffect(() => {
    if (currentCta) setSelectedCta(currentCta);
  }, [currentCta]);

  React.useEffect(() => {
    if (currentHashtags && currentHashtags.length > 0) setHashtags(currentHashtags);
  }, [currentHashtags]);

  React.useEffect(() => {
    if (currentDescripcion) setDescripcion(currentDescripcion);
  }, [currentDescripcion]);

  React.useEffect(() => {
    if (currentMejorMomentoPrimeraFrase) setPrimerSubtituloHook(currentMejorMomentoPrimeraFrase);
  }, [currentMejorMomentoPrimeraFrase]);

  /**
   * Generates AI Viral Hooks using Llama 3.3 70B via /api/hooks
   */
  const handleGenerateAiHooks = async () => {
    setIsGeneratingAi(true);
    toast.loading('Generando hooks virales con Llama 3.3 70B...', { id: 'hooks-loading' });

    try {
      const res = await fetch('/api/hooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clip_id: clipId,
          proyecto_id: proyectoId,
          transcripcion,
          duracion_seg: duracionSeg,
          titulo_actual: currentTituloHook,
        }),
      });

      if (!res.ok) {
        throw new Error(`Error en API: status ${res.status}`);
      }

      const data = await res.json();
      if (data.success) {
        const newTitles: string[] = data.titulo_gancho || [];
        const newCtas: string[] = data.cta || [];
        const newTags: string[] = data.hashtags || [];
        const newDesc: string = data.descripcion || '';
        const newHookPhrase: string = data.mejor_momento_primera_frase || '';

        if (newTitles.length > 0) {
          setTitleOptions(newTitles);
          setSelectedTitle(newTitles[0]);
        }
        if (newCtas.length > 0) {
          setCtaOptions(newCtas);
          setSelectedCta(newCtas[0]);
        }
        if (newTags.length > 0) {
          setHashtags(newTags);
        }
        if (newDesc) {
          setDescripcion(newDesc);
        }
        if (newHookPhrase) {
          setPrimerSubtituloHook(newHookPhrase);
        }

        onUpdateViralMeta({
          titulo_hook: newTitles[0] || selectedTitle,
          cta: newCtas[0] || selectedCta,
          hashtags: newTags,
          descripcion: newDesc,
          mejor_momento_primera_frase: newHookPhrase,
          titulos_sugeridos: newTitles,
          ctas_sugeridos: newCtas,
        });

        toast.success(
          data.provider === 'groq-llama-3.3'
            ? '¡Hooks virales optimizados con Llama 3.3 70B!'
            : '¡Hooks virales generados con motor heurístico!',
          { id: 'hooks-loading' }
        );
      } else {
        throw new Error(data.error || 'Respuesta inválida');
      }
    } catch (err: any) {
      console.error('Error generating AI hooks:', err);
      toast.error(`Error generando hooks: ${err.message || 'Inténtalo de nuevo'}`, { id: 'hooks-loading' });
    } finally {
      setIsGeneratingAi(false);
    }
  };

  /**
   * Title selection / modification
   */
  const handleSelectTitle = (t: string) => {
    setSelectedTitle(t);
    onUpdateViralMeta({
      titulo_hook: t,
      cta: selectedCta,
      hashtags,
      descripcion,
      mejor_momento_primera_frase: primerSubtituloHook,
      titulos_sugeridos: titleOptions,
      ctas_sugeridos: ctaOptions,
    });
  };

  const handleTitleInputChange = (val: string) => {
    setSelectedTitle(val);
    onUpdateViralMeta({
      titulo_hook: val,
      cta: selectedCta,
      hashtags,
      descripcion,
      mejor_momento_primera_frase: primerSubtituloHook,
      titulos_sugeridos: titleOptions,
      ctas_sugeridos: ctaOptions,
    });
  };

  /**
   * CTA selection
   */
  const handleSelectCta = (c: string) => {
    setSelectedCta(c);
    onUpdateViralMeta({
      titulo_hook: selectedTitle,
      cta: c,
      hashtags,
      descripcion,
      mejor_momento_primera_frase: primerSubtituloHook,
      titulos_sugeridos: titleOptions,
      ctas_sugeridos: ctaOptions,
    });
  };

  /**
   * Hashtag management
   */
  const handleAddHashtag = () => {
    let clean = newTagInput.trim();
    if (!clean) return;
    if (!clean.startsWith('#')) clean = `#${clean}`;
    if (!hashtags.includes(clean)) {
      const updated = [...hashtags, clean];
      setHashtags(updated);
      setNewTagInput('');
      onUpdateViralMeta({
        titulo_hook: selectedTitle,
        cta: selectedCta,
        hashtags: updated,
        descripcion,
        mejor_momento_primera_frase: primerSubtituloHook,
        titulos_sugeridos: titleOptions,
        ctas_sugeridos: ctaOptions,
      });
    }
  };

  const handleRemoveHashtag = (tagToRemove: string) => {
    const updated = hashtags.filter((h) => h !== tagToRemove);
    setHashtags(updated);
    onUpdateViralMeta({
      titulo_hook: selectedTitle,
      cta: selectedCta,
      hashtags: updated,
      descripcion,
      mejor_momento_primera_frase: primerSubtituloHook,
      titulos_sugeridos: titleOptions,
      ctas_sugeridos: ctaOptions,
    });
  };

  /**
   * Description change
   */
  const handleDescriptionChange = (val: string) => {
    setDescripcion(val);
    onUpdateViralMeta({
      titulo_hook: selectedTitle,
      cta: selectedCta,
      hashtags,
      descripcion: val,
      mejor_momento_primera_frase: primerSubtituloHook,
      titulos_sugeridos: titleOptions,
      ctas_sugeridos: ctaOptions,
    });
  };

  /**
   * Subtitle hook phrase change
   */
  const handleHookPhraseChange = (val: string) => {
    setPrimerSubtituloHook(val);
    onUpdateViralMeta({
      titulo_hook: selectedTitle,
      cta: selectedCta,
      hashtags,
      descripcion,
      mejor_momento_primera_frase: val,
      titulos_sugeridos: titleOptions,
      ctas_sugeridos: ctaOptions,
    });
  };

  const handleCopy = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    toast.success(`Copiado al portapapeles: ${fieldName}`);
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <div className="bg-gradient-to-br from-[#120f26] via-[#0d0d1b] to-[#17122b] border border-fuchsia-500/30 rounded-2xl p-4.5 space-y-4 shadow-xl shadow-fuchsia-950/20 relative overflow-hidden">
      {/* Glow decorative accent */}
      <div className="absolute top-0 right-0 w-64 h-32 bg-fuchsia-600/10 blur-3xl pointer-events-none" />

      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-fuchsia-900/30 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-gradient-to-tr from-fuchsia-600 to-pink-600 text-white shadow-lg shadow-fuchsia-600/30">
            <Flame className="w-4 h-4 text-yellow-300 animate-pulse" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <span>Tu Short Viral</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-fuchsia-950 text-fuchsia-300 border border-fuchsia-700/60">
                Llama-3.3 70B
              </span>
            </h4>
            <p className="text-xs text-slate-400">
              Ganchos honest clickbait, llamadas a la acción y metadatos optimizados para retención.
            </p>
          </div>
        </div>

        <button
          onClick={handleGenerateAiHooks}
          disabled={isGeneratingAi}
          className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-fuchsia-950 text-fuchsia-300 border border-fuchsia-700/60 hover:bg-fuchsia-900 hover:text-white transition-colors cursor-pointer shrink-0 disabled:opacity-50"
        >
          {isGeneratingAi ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Generando...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
              <span>Regenerar con IA</span>
            </>
          )}
        </button>
      </div>

      <div className="space-y-4">
        {/* 1. Selector de Título Gancho (3 opciones editables) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-yellow-400" />
              <span>1. Título Gancho ("Clickbait Honesto" ≤60 caracteres)</span>
            </label>
            <span className="text-[11px] font-mono text-slate-400">
              {selectedTitle.length}/60 chars
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {titleOptions.map((title, idx) => {
              const isSelected = selectedTitle === title;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectTitle(title)}
                  className={`text-left p-2.5 rounded-xl border text-xs transition-all relative cursor-pointer ${
                    isSelected
                      ? 'bg-fuchsia-950/80 border-fuchsia-500 text-white shadow-md shadow-fuchsia-950/50'
                      : 'bg-[#141424] border-purple-900/40 text-slate-300 hover:bg-[#1c1c32] hover:border-purple-700/60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-1.5">
                    <span className="font-bold text-[10px] text-fuchsia-400 font-mono">
                      Opción #{idx + 1}
                    </span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-fuchsia-400 shrink-0" />}
                  </div>
                  <p className="mt-1 line-clamp-2 leading-relaxed font-medium">"{title}"</p>
                </button>
              );
            })}
          </div>

          {/* Editable title input */}
          <div className="relative">
            <input
              type="text"
              maxLength={60}
              value={selectedTitle}
              onChange={(e) => handleTitleInputChange(e.target.value)}
              placeholder="Escribe o personaliza tu título gancho..."
              className="w-full bg-[#121224] border border-fuchsia-900/50 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-fuchsia-500 focus:ring-1 focus:ring-fuchsia-500 transition-colors pr-8"
            />
            <button
              onClick={() => handleCopy(selectedTitle, 'Título')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
              title="Copiar título"
            >
              {copiedField === 'Título' ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* 2. Selector de CTA (2 opciones editables) */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5 text-cyan-400" />
            <span>2. Llamada a la Acción (CTA)</span>
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {ctaOptions.map((cta, idx) => {
              const isSelected = selectedCta === cta;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectCta(cta)}
                  className={`text-left p-2.5 rounded-xl border text-xs transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-cyan-950/80 border-cyan-500 text-white shadow-md shadow-cyan-950/50'
                      : 'bg-[#141424] border-purple-900/40 text-slate-300 hover:bg-[#1c1c32] hover:border-purple-700/60'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="font-bold text-[10px] text-cyan-400 font-mono">
                      CTA #{idx + 1}
                    </span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                  </div>
                  <p className="mt-1 font-medium">"{cta}"</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. Chips de Hashtags Editables (8 hashtags) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-pink-400" />
              <span>3. Hashtags Relevantes ({hashtags.length} hashtags)</span>
            </label>
            <button
              onClick={() => handleCopy(hashtags.join(' '), 'Hashtags')}
              className="text-[11px] text-pink-300 hover:text-pink-200 inline-flex items-center gap-1 cursor-pointer"
            >
              {copiedField === 'Hashtags' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>Copiar todos</span>
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5 p-2 bg-[#121224] border border-purple-900/40 rounded-xl min-h-[44px] items-center">
            {hashtags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gradient-to-r from-purple-900/60 to-pink-900/60 border border-pink-700/40 text-pink-200 shadow-sm"
              >
                <span>{tag}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveHashtag(tag)}
                  className="p-0.5 rounded-full hover:bg-pink-800/80 text-pink-300 hover:text-white cursor-pointer"
                  title="Eliminar hashtag"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}

            {/* Input to add new hashtag */}
            <div className="inline-flex items-center gap-1 ml-1">
              <input
                type="text"
                value={newTagInput}
                onChange={(e) => setNewTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddHashtag();
                  }
                }}
                placeholder="+ Añadir tag..."
                className="w-24 bg-transparent border-b border-purple-700/60 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-pink-400 px-1 py-0.5"
              />
              <button
                type="button"
                onClick={handleAddHashtag}
                className="p-1 rounded bg-purple-900 hover:bg-purple-800 text-purple-200 hover:text-white cursor-pointer"
                title="Añadir"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>

        {/* 4. Descripción (~150 caracteres con hashtag principal) */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-emerald-400" />
              <span>4. Descripción del Short (~150 caracteres)</span>
            </label>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono text-slate-400">
                {descripcion.length}/150 chars
              </span>
              <button
                onClick={() => handleCopy(descripcion, 'Descripción')}
                className="text-[11px] text-emerald-300 hover:text-emerald-200 inline-flex items-center gap-1 cursor-pointer"
              >
                {copiedField === 'Descripción' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>Copiar</span>
              </button>
            </div>
          </div>

          <textarea
            rows={2}
            maxLength={180}
            value={descripcion}
            onChange={(e) => handleDescriptionChange(e.target.value)}
            className="w-full bg-[#121224] border border-purple-900/40 rounded-lg p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors resize-none"
            placeholder="Descripción con propuesta de valor y hashtag..."
          />
        </div>

        {/* 5. Hook como Primer Subtítulo + Botón de Quemado */}
        <div className="p-3.5 bg-gradient-to-r from-fuchsia-950/60 via-[#17122b] to-purple-950/60 border border-fuchsia-500/50 rounded-xl space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Type className="w-3.5 h-3.5 text-yellow-400" />
                <span>Primer Subtítulo "Hook" (0 - 1.5s)</span>
              </span>
              <p className="text-[11px] text-fuchsia-300">
                Aparece en los primeros 1.5s con animación de zoom sutil para retener el scroll.
              </p>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-fuchsia-950 text-fuchsia-300 border border-fuchsia-700">
              ≤ 8 palabras
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-2.5">
            <input
              type="text"
              value={primerSubtituloHook}
              onChange={(e) => handleHookPhraseChange(e.target.value)}
              placeholder="Frase más impactante del clip (ej: El error del 99%)..."
              className="flex-1 w-full bg-[#100f20] border border-fuchsia-700/60 rounded-lg px-3 py-2 text-xs text-yellow-300 font-bold placeholder-slate-500 focus:outline-none focus:border-yellow-400"
            />

            <button
              type="button"
              onClick={() => onGenerarShortConHook(primerSubtituloHook)}
              disabled={isProcessingShort}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-fuchsia-600 via-pink-600 to-amber-500 hover:from-fuchsia-500 hover:to-amber-400 text-white shadow-lg shadow-pink-600/30 transition-all cursor-pointer shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessingShort ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Quemando Hook en Vídeo...</span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 text-yellow-300 fill-yellow-300" />
                  <span>Usar este hook en el vídeo</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
