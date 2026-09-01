import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertOctagon, RefreshCw, Copy, Check, ShieldAlert } from 'lucide-react';
import { trackError } from '../../lib/analytics';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  copied: boolean;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      copied: false,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, copied: false };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
    trackError(error.message || 'Error no controlado en interfaz', 'React ErrorBoundary');
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleCopyError = () => {
    if (this.state.error) {
      navigator.clipboard.writeText(this.state.error.stack || this.state.error.message);
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0a0a12] text-slate-100 flex items-center justify-center p-4">
          <div className="max-w-lg w-full p-8 rounded-3xl bg-[#121222] border border-red-900/40 shadow-2xl text-center relative overflow-hidden">
            <div className="w-16 h-16 rounded-2xl bg-red-950/80 border border-red-800/50 flex items-center justify-center text-red-400 mx-auto mb-4 shadow-lg shadow-red-950/50">
              <AlertOctagon className="w-8 h-8" />
            </div>

            <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight font-['Plus_Jakarta_Sans',sans-serif]">
              Ha ocurrido un error inesperado
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-2 mb-6">
              El estado de la aplicación se ha protegido para evitar pérdida de datos en tus clips.
            </p>

            {this.state.error && (
              <div className="text-left bg-[#0c0c16] border border-slate-800 p-3.5 rounded-xl mb-6 text-[11px] font-mono text-red-300 max-h-32 overflow-y-auto">
                {this.state.error.message}
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={this.handleReload}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-md shadow-purple-900/40 transition-all cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Recargar aplicación</span>
              </button>

              <button
                onClick={this.handleCopyError}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-[#18182c] border border-purple-900/40 transition-all cursor-pointer"
              >
                {this.state.copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                <span>{this.state.copied ? 'Copiado' : 'Copiar detalle'}</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
