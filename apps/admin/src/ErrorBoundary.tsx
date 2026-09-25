import { Component, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

const RELOAD_KEY = 'taptym_admin_chunk_reload';

/** Catches render errors; after a redeploy old lazy chunks 404, so reload once to fetch the new build. */
export class ErrorBoundary extends Component<{ children: ReactNode; resetKey?: string }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    const chunk = /dynamically imported module|Importing a module script failed|Failed to fetch/i.test(error.message);
    if (chunk && !sessionStorage.getItem(RELOAD_KEY)) {
      sessionStorage.setItem(RELOAD_KEY, '1');
      window.location.reload();
    }
  }

  componentDidUpdate(prev: { resetKey?: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
    if (!this.state.error) sessionStorage.removeItem(RELOAD_KEY);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="empty">
        <div className="e-icon"><AlertTriangle size={26} /></div>
        <b>Что-то пошло не так</b>
        <div>Страница не загрузилась. Обновите её — данные не потеряются.</div>
        <div className="mt-16">
          <button className="btn btn-primary" onClick={() => window.location.reload()}>
            <RotateCcw size={16} /> Обновить страницу
          </button>
        </div>
      </div>
    );
  }
}
