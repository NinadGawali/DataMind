import React from 'react';

export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      errorMessage: error?.message || 'Unexpected frontend error',
    };
  }

  componentDidCatch(error, info) {
    console.error('App crashed:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 p-6 flex items-center justify-center">
          <div className="max-w-2xl w-full rounded-xl border border-red-500/40 bg-red-950/30 p-6">
            <h1 className="text-xl font-bold text-red-300 mb-2">Frontend Runtime Error</h1>
            <p className="text-sm text-slate-200 mb-3">
              The UI hit an error while rendering. Check the browser console for full details.
            </p>
            <pre className="text-xs whitespace-pre-wrap break-words text-red-200 bg-black/30 p-3 rounded">
              {this.state.errorMessage}
            </pre>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
