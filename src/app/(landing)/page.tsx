import React, { useState } from 'react';
import { Navbar } from '../../components/landing/navbar';
import { Hero } from '../../components/landing/hero';
import { Logos } from '../../components/landing/logos';
import { ComoFunciona } from '../../components/landing/como-funciona';
import { Funciones } from '../../components/landing/funciones';
import { Pricing } from '../../components/landing/pricing';
import { Faq } from '../../components/landing/faq';
import { Footer } from '../../components/landing/footer';
import { 
  Sparkles, 
  X, 
  CheckCircle2, 
  Youtube, 
  Upload, 
  Loader2, 
  Flame, 
  Share2, 
  Download, 
  Scissors, 
  Play,
  Mail,
  Shield,
  FileText
} from 'lucide-react';

interface LandingPageProps {
  onNavigate?: (path: string) => void;
}

export default function LandingPage({ onNavigate }: LandingPageProps = {}) {
  // Demo / Try Free Modal State
  const [demoModalOpen, setDemoModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'url' | 'file'>('url');
  const [videoInput, setVideoInput] = useState('https://www.youtube.com/watch?v=podcast-innovacion-2026');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedClips, setProcessedClips] = useState<Array<{
    title: string;
    duration: string;
    score: number;
    hook: string;
  }> | null>(null);

  // Legal / Info Modals
  const [activeModal, setActiveModal] = useState<'terms' | 'privacy' | 'contact' | null>(null);
  const [selectedPlanAlert, setSelectedPlanAlert] = useState<string | null>(null);

  const handleStartFree = () => {
    if (onNavigate) {
      onNavigate('/registro');
    } else {
      setDemoModalOpen(true);
    }
  };

  const handleRunAiDemo = (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    setProcessedClips(null);

    // Simulate real AI clipping with Whisper + Face Tracking
    setTimeout(() => {
      setIsProcessing(false);
      setProcessedClips([
        {
          title: '🔥 La regla de los 3 segundos en Shorts',
          duration: '0:42 min',
          score: 99,
          hook: '"Si no atrapas en el segundo uno, has perdido el 80%..."',
        },
        {
          title: '⚡ El mayor error al editar en vertical',
          duration: '0:58 min',
          score: 96,
          hook: '"Mucha gente recorta sin centrar la cara y ocurre esto..."',
        },
        {
          title: '💡 Cómo multiplicar reproducciones orgánicas',
          duration: '0:35 min',
          score: 94,
          hook: '"El algoritmo de YouTube premia la retención superior al 70%"',
        },
      ]);
    }, 1800);
  };

  const handleSelectPlan = (planName: string) => {
    setSelectedPlanAlert(planName);
    setTimeout(() => {
      setSelectedPlanAlert(null);
    }, 4000);
  };

  return (
    <div className="min-h-screen bg-[#0a0a12] text-slate-100 relative selection:bg-purple-600/30 selection:text-cyan-300">
      
      {/* Plan Selected Notification Toast */}
      {selectedPlanAlert && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#16142e] border border-purple-500 text-white px-5 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-5">
          <div className="w-8 h-8 rounded-xl bg-purple-600 flex items-center justify-center text-cyan-300">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs font-bold text-cyan-400">Plan Seleccionado</p>
            <p className="text-sm font-semibold text-slate-100">
              Has seleccionado el <span className="text-purple-300 font-bold">Plan {selectedPlanAlert}</span>. ¡Iniciando entorno!
            </p>
          </div>
          <button 
            onClick={() => setSelectedPlanAlert(null)}
            className="p-1 text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 1. Navbar */}
      <Navbar 
        onStartFree={handleStartFree} 
        onLogin={() => onNavigate?.('/login')} 
      />

      <main>
        {/* 2. Hero */}
        <Hero 
          onStartFree={handleStartFree} 
          onWatchDemo={() => {
            const elem = document.getElementById('como-funciona');
            elem?.scrollIntoView({ behavior: 'smooth' });
          }} 
        />

        {/* 3. Logos */}
        <Logos />

        {/* 4. Cómo funciona */}
        <ComoFunciona />

        {/* 5. Funciones */}
        <Funciones />

        {/* 6. Pricing */}
        <Pricing onSelectPlan={handleSelectPlan} />

        {/* 7. FAQ */}
        <Faq />
      </main>

      {/* 8. Footer */}
      <Footer 
        onOpenPrivacy={() => setActiveModal('privacy')}
        onOpenTerms={() => setActiveModal('terms')}
        onOpenContact={() => setActiveModal('contact')}
      />

      {/* Interactive Try Free / Demo Video Studio Modal */}
      {demoModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-[#0f0f1d] border border-purple-600/50 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 sm:p-8 shadow-2xl relative">
            
            {/* Close Button */}
            <button
              onClick={() => {
                setDemoModalOpen(false);
                setProcessedClips(null);
              }}
              className="absolute top-5 right-5 p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 text-xs font-bold text-purple-400 uppercase tracking-wider mb-2">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <span>Entorno de Pruebas Instantáneo</span>
            </div>

            <h3 className="text-2xl font-black text-white mb-2 font-['Plus_Jakarta_Sans',sans-serif]">
              Prueba ClipForge con tu propio vídeo
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 mb-6">
              Experimenta el procesado local con IA: detección automática de clips, Whisper subtítulos y encuadre 9:16.
            </p>

            {/* Input Form */}
            <form onSubmit={handleRunAiDemo} className="space-y-4">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('url')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    activeTab === 'url'
                      ? 'bg-purple-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Youtube className="w-3.5 h-3.5" />
                  <span>Enlace de YouTube</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('file')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    activeTab === 'file'
                      ? 'bg-purple-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Subir Archivo</span>
                </button>
              </div>

              {activeTab === 'url' ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    URL del vídeo o podcast:
                  </label>
                  <input
                    type="url"
                    required
                    value={videoInput}
                    onChange={(e) => setVideoInput(e.target.value)}
                    placeholder="https://youtube.com/watch?v=..."
                    className="w-full px-4 py-3 bg-[#080812] border border-purple-900/60 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
                  />
                </div>
              ) : (
                <div className="border-2 border-dashed border-purple-800/60 rounded-2xl p-6 text-center bg-[#090914] hover:border-purple-500 transition-colors cursor-pointer">
                  <Upload className="w-8 h-8 text-purple-400 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-200">Arrastra tu vídeo aquí o haz clic para buscar</p>
                  <p className="text-xs text-slate-500 mt-1">MP4, MOV, MKV hasta 2 GB</p>
                </div>
              )}

              <button
                type="submit"
                disabled={isProcessing}
                className="w-full py-3.5 px-6 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-500 hover:from-purple-500 hover:to-cyan-400 shadow-xl shadow-purple-900/40 flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-cyan-300" />
                    <span>Analizando voz, rostros y ganchos con IA...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-cyan-200" />
                    <span>Analizar y Generar Clips Virales (Gratis)</span>
                  </>
                )}
              </button>
            </form>

            {/* Generated Results Preview */}
            {processedClips && (
              <div className="mt-8 pt-6 border-t border-purple-900/40 animate-in fade-in duration-300">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>¡3 Clips Virales Extraídos con Éxito!</span>
                  </div>
                  <span className="text-xs text-slate-400">Procesado en 1.8s</span>
                </div>

                <div className="space-y-3">
                  {processedClips.map((clip, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-xl bg-[#141428] border border-purple-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg bg-purple-900/50 border border-purple-600/40 flex items-center justify-center text-cyan-300 shrink-0 font-bold text-xs">
                          9:16
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-white">{clip.title}</h4>
                            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-500/40">
                              Viral: {clip.score}%
                            </span>
                          </div>
                          <p className="text-xs text-purple-300/80 italic mt-0.5">{clip.hook}</p>
                          <p className="text-[10px] text-slate-400 mt-1">Duración: {clip.duration} • Subtítulos Whisper + FaceTrack</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => alert(`Descargando clip "${clip.title}" en 1080p vertical...`)}
                          className="px-3 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-xs font-bold text-white flex items-center gap-1.5 cursor-pointer shadow-md"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Descargar</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* Legal & Contact Modals */}
      {activeModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#101020] border border-purple-800/60 rounded-2xl w-full max-w-lg p-6 relative shadow-2xl">
            <button
              onClick={() => setActiveModal(null)}
              className="absolute top-4 right-4 p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            {activeModal === 'terms' && (
              <div>
                <div className="flex items-center gap-2 text-purple-400 mb-2 font-bold">
                  <FileText className="w-5 h-5" />
                  <span>Términos del Servicio</span>
                </div>
                <h3 className="text-xl font-bold text-white mb-3">Términos de Uso de ClipForge (2026)</h3>
                <div className="text-xs text-slate-300 space-y-3 leading-relaxed max-h-60 overflow-y-auto pr-2">
                  <p>
                    1. <strong>Uso legítimo:</strong> Los usuarios son responsables del contenido que suben a ClipForge. Solo se permite procesar vídeos sobre los que poseas derechos de autor o permisos explícitos.
                  </p>
                  <p>
                    2. <strong>Privacidad del procesado local:</strong> En el plan gratis, los vídeos no se transfieren a servidores externos y se procesan en el navegador.
                  </p>
                  <p>
                    3. <strong>Disponibilidad:</strong> ClipForge ofrece una garantía de operatividad de motores de IA y transcripción continua.
                  </p>
                </div>
              </div>
            )}

            {activeModal === 'privacy' && (
              <div>
                <div className="flex items-center gap-2 text-cyan-400 mb-2 font-bold">
                  <Shield className="w-5 h-5" />
                  <span>Política de Privacidad</span>
                </div>
                <h3 className="text-xl font-bold text-white mb-3">Tu privacidad es prioritaria</h3>
                <div className="text-xs text-slate-300 space-y-3 leading-relaxed max-h-60 overflow-y-auto pr-2">
                  <p>
                    No vendemos tus datos a terceros ni entrenamos modelos públicos con tus vídeos personales sin consentimiento.
                  </p>
                  <p>
                    Cumplimos estrictamente con el RGPD y las normativas europeas de protección de datos.
                  </p>
                </div>
              </div>
            )}

            {activeModal === 'contact' && (
              <div>
                <div className="flex items-center gap-2 text-purple-300 mb-2 font-bold">
                  <Mail className="w-5 h-5" />
                  <span>Contacto & Soporte</span>
                </div>
                <h3 className="text-xl font-bold text-white mb-3">¿Tienes alguna pregunta?</h3>
                <p className="text-xs text-slate-300 mb-4">
                  Escríbenos directamente y nuestro equipo de soporte te responderá en menos de 24 horas.
                </p>
                <div className="p-3 bg-[#151528] rounded-xl border border-slate-700 text-xs font-mono text-cyan-300 mb-4">
                  contacto@clipforge.ai
                </div>
                <button
                  onClick={() => setActiveModal(null)}
                  className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 rounded-xl font-bold text-xs text-white"
                >
                  Cerrar
                </button>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
