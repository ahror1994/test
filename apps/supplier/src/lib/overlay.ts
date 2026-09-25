import { create } from 'zustand';
import { haptic } from './haptics';

type ToastKind = 'success' | 'error' | 'info';
type ConfirmReq = {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  resolve: (ok: boolean) => void;
};

type State = {
  toast: { id: number; text: string; kind: ToastKind } | null;
  confirmReq: ConfirmReq | null;
};

export const useOverlay = create<State>(() => ({ toast: null, confirmReq: null }));

let toastTimer: ReturnType<typeof setTimeout> | null = null;

export function toast(text: string, kind: ToastKind = 'success') {
  if (kind === 'success') haptic.success();
  if (kind === 'error') haptic.error();
  if (toastTimer) clearTimeout(toastTimer);
  useOverlay.setState({ toast: { id: Date.now(), text, kind } });
  toastTimer = setTimeout(() => useOverlay.setState({ toast: null }), kind === 'error' ? 4000 : 2600);
}

/** Cross-platform confirm (RN Alert is a no-op on web). */
export function confirm(opts: Omit<ConfirmReq, 'resolve'>): Promise<boolean> {
  return new Promise((resolve) => {
    useOverlay.setState({
      confirmReq: {
        ...opts,
        resolve: (ok) => {
          useOverlay.setState({ confirmReq: null });
          resolve(ok);
        },
      },
    });
  });
}
