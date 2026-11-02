import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, FileText } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleRestoreSafetyDraft = () => {
    try {
      const draft = localStorage.getItem('openscript_draft_fountain');
      if (draft) {
        navigator.clipboard.writeText(draft);
        alert('Your latest draft text has been copied to your clipboard!');
      }
    } catch {}
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0d0e12] p-6 text-white font-sans">
          <div className="max-w-md w-full bg-[#161820] border border-amber-500/40 rounded-2xl p-6 shadow-2xl flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-4 shadow-lg shadow-amber-500/10">
              <AlertTriangle className="w-7 h-7" />
            </div>
            
            <h2 className="text-lg font-bold text-white font-serif mb-1">
              Studio Screenplay Recovered
            </h2>
            <p className="text-xs text-gray-400 mb-5 leading-relaxed">
              OpenScript detected a render interruption. Your script drafts are safely preserved in local storage.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 w-full">
              <button
                onClick={this.handleReload}
                className="flex-1 py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Reload Screenplay</span>
              </button>
              
              <button
                onClick={this.handleRestoreSafetyDraft}
                className="py-2.5 px-4 rounded-xl bg-[#212530] hover:bg-[#2b3040] text-gray-200 font-mono text-xs border border-white/10 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <FileText className="w-4 h-4" />
                <span>Copy Safety Text</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
