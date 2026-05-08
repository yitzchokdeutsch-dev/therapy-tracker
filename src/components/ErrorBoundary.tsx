"use client";

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error) => void;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    this.props.onError?.(error);
    // Plug in Sentry here: Sentry.captureException(error, { extra: info })
    console.error("[ErrorBoundary]", error.message, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        this.props.fallback ?? (
          <div className="card p-8 text-center max-w-md mx-auto mt-12">
            <div className="text-3xl mb-3 text-red-500">⚠</div>
            <div className="font-semibold text-ink-900 mb-1">Something went wrong</div>
            <div className="text-sm text-ink-400 mb-5 font-mono break-all">
              {this.state.error.message}
            </div>
            <button
              onClick={() => this.setState({ error: null })}
              className="btn-outline btn-sm"
            >
              Try again
            </button>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
