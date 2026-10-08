import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class PurchasingErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Purchasing Module Error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="p-8 my-6 bg-zinc-900 border border-zinc-800 rounded-2xl text-center space-y-4 max-w-xl mx-auto">
          <div className="inline-flex p-3 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <AlertTriangle size={28} />
          </div>
          <h2 className="text-base font-semibold text-white">Purchasing Module Notice</h2>
          <p className="text-xs text-zinc-400">
            An issue occurred while rendering the purchasing view. The rest of Splus Enterprises Portal continues to function normally.
          </p>
          {this.state.error && (
            <div className="p-2.5 rounded bg-zinc-950 font-mono text-[11px] text-zinc-400 text-left overflow-x-auto">
              {this.state.error.message}
            </div>
          )}
          <button
            onClick={this.handleReset}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors"
          >
            <RefreshCw size={14} />
            <span>Reload Module View</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
