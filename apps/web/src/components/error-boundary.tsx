"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="p-8 rounded-3xl border border-rose-500/20 bg-rose-500/5 text-rose-200 text-center max-w-lg mx-auto my-8">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-rose-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-lg font-black mb-2">Module Load Failure</h3>
          <p className="text-xs opacity-80 mb-6 max-w-sm mx-auto">{this.state.error?.message || "An unexpected error occurred in this section."}</p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-6 py-2.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 text-xs font-black uppercase tracking-widest rounded-xl transition-all border border-rose-500/30"
          >
            Retry Section
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

interface WidgetProps {
  children: ReactNode;
  title?: string;
}

export class WidgetErrorBoundary extends Component<WidgetProps, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("WidgetErrorBoundary caught an error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 text-amber-200 text-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="font-semibold">{this.props.title || "Widget unavailable"}</span>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-100 border border-amber-500/30"
            >
              Retry
            </button>
          </div>
          <p className="text-[11px] opacity-70 truncate">{this.state.error?.message || "Error rendering component"}</p>
        </div>
      );
    }

    return this.props.children;
  }
}
