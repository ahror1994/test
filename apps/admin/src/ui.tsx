import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, CheckCircle2, Inbox, Loader2, Phone, X, XCircle } from 'lucide-react';
import { formatPhone, formatPrice } from '@taptym/shared';
import { errorText } from './api';
import type { Tone } from './labels';

/* ---------- toasts ---------- */

type ToastItem = { id: number; text: string; kind: 'ok' | 'error' };
const ToastCtx = createContext<{ ok: (t: string) => void; error: (e: unknown) => void }>({ ok: () => {}, error: () => {} });
export const useToast = () => useContext(ToastCtx);

/* ---------- dialogs ---------- */

type ConfirmOpts = { title: string; text?: ReactNode; confirmText?: string; danger?: boolean };
type PromptOpts = ConfirmOpts & { label?: string; placeholder?: string; required?: boolean; multiline?: boolean; defaultValue?: string; type?: 'text' | 'number' | 'password' };
type DialogState = (PromptOpts & { kind: 'confirm' | 'prompt'; resolve: (v: any) => void }) | null;
const DialogCtx = createContext<{ confirm: (o: ConfirmOpts) => Promise<boolean>; prompt: (o: PromptOpts) => Promise<string | null> }>({
  confirm: async () => false,
  prompt: async () => null,
});
export const useDialog = () => useContext(DialogCtx);

export function UIProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [dialog, setDialog] = useState<DialogState>(null);
  const push = useCallback((text: string, kind: ToastItem['kind']) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-3), { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 5200 : 3200);
  }, []);
  const toastApi = useRef({ ok: (t: string) => push(t, 'ok'), error: (e: unknown) => push(errorText(e), 'error') }).current;
  const dialogApi = useRef({
    confirm: (o: ConfirmOpts) => new Promise<boolean>((resolve) => setDialog({ ...o, kind: 'confirm', resolve })),
    prompt: (o: PromptOpts) => new Promise<string | null>((resolve) => setDialog({ ...o, kind: 'prompt', resolve })),
  }).current;

  return (
    <ToastCtx.Provider value={toastApi}>
      <DialogCtx.Provider value={dialogApi}>
        {children}
        {dialog && <DialogView d={dialog} close={() => setDialog(null)} />}
        {createPortal(
          <div className="toasts">
            {toasts.map((t) => (
              <div key={t.id} className={`toast ${t.kind === 'error' ? 'error' : ''}`} role="status">
                {t.kind === 'error' ? <XCircle size={18} /> : <CheckCircle2 size={18} color="#32D583" />}
                {t.text}
              </div>
            ))}
          </div>,
          document.body,
        )}
      </DialogCtx.Provider>
    </ToastCtx.Provider>
  );
}

function DialogView({ d, close }: { d: NonNullable<DialogState>; close: () => void }) {
  const [value, setValue] = useState(d.defaultValue ?? '');
  const finish = (v: any) => {
    d.resolve(v);
    close();
  };
  const cancel = () => finish(d.kind === 'confirm' ? false : null);
  const submit = () => {
    if (d.kind === 'prompt') {
      if (d.required && !value.trim()) return;
      finish(value.trim());
    } else finish(true);
  };
  return (
    <Modal
      title={d.title}
      onClose={cancel}
      footer={
        <>
          <button className="btn" onClick={cancel}>
            Отмена
          </button>
          <button className={`btn ${d.danger ? 'btn-danger' : 'btn-primary'}`} onClick={submit} disabled={d.kind === 'prompt' && d.required && !value.trim()} data-testid="dialog-confirm">
            {d.confirmText ?? 'Подтвердить'}
          </button>
        </>
      }
    >
      <div className="col gap-16">
        {d.danger && d.kind === 'confirm' && (
          <div className="callout danger">
            <AlertTriangle size={18} />
            <div>{d.text ?? 'Это действие нельзя отменить.'}</div>
          </div>
        )}
        {!(d.danger && d.kind === 'confirm') && d.text && <div className="muted">{d.text}</div>}
        {d.kind === 'prompt' && (
          <Field label={d.label ?? ''}>
            {d.multiline ? (
              <textarea className="textarea" autoFocus value={value} placeholder={d.placeholder} onChange={(e) => setValue(e.target.value)} data-testid="dialog-input" />
            ) : (
              <input
                className="input"
                autoFocus
                type={d.type ?? 'text'}
                value={value}
                placeholder={d.placeholder}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submit()}
                data-testid="dialog-input"
              />
            )}
          </Field>
        )}
      </div>
    </Modal>
  );
}

/* ---------- primitives ---------- */

type BtnProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> & {
  variant?: 'primary' | 'success' | 'danger' | 'soft' | 'soft-danger' | 'ghost' | 'default';
  size?: 'sm' | 'lg';
  icon?: ReactNode;
  loading?: boolean;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => unknown;
  /** Toast shown after a successful async onClick. */
  success?: string;
};

/** Button that shows a spinner while an async onClick runs and toasts its errors. */
export function Btn({ variant = 'default', size, icon, loading, onClick, success, children, className = '', disabled, ...rest }: BtnProps) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const mounted = useRef(true);
  useEffect(() => () => void (mounted.current = false), []);
  const handle = async (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!onClick) return;
    const r = onClick(e);
    if (r && typeof (r as Promise<unknown>).then === 'function') {
      setBusy(true);
      try {
        const v = await r;
        if (success && v !== false) toast.ok(success);
      } catch (err) {
        toast.error(err);
      } finally {
        if (mounted.current) setBusy(false);
      }
    }
  };
  const cls = ['btn', variant !== 'default' && `btn-${variant}`, size && `btn-${size}`, !children && 'btn-icon', className].filter(Boolean).join(' ');
  return (
    <button type="button" className={cls} onClick={handle} disabled={disabled || busy || loading} {...rest}>
      {busy || loading ? <Loader2 size={size === 'sm' ? 14 : 16} className="spin" /> : icon}
      {children}
    </button>
  );
}

export function Chip({ tone = 'neutral', children, plain }: { tone?: Tone; children: ReactNode; plain?: boolean }) {
  return <span className={`chip t-${tone} ${plain ? 'plain' : ''}`}>{children}</span>;
}

export function Modal({
  title,
  subtitle,
  onClose,
  children,
  footer,
  wide,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  useEscape(onClose);
  return createPortal(
    <div className="overlay modal-center" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true">
        <div className="modal-head">
          <div>
            <h3>{title}</h3>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={onClose} aria-label="Закрыть">
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function Drawer({ onClose, header, children }: { onClose: () => void; header: ReactNode; children: ReactNode }) {
  useEscape(onClose);
  return createPortal(
    <>
      <div className="overlay" onMouseDown={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true">
        <div className="drawer-head">
          <div className="grow">{header}</div>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={onClose} aria-label="Закрыть">
            <X size={18} />
          </button>
        </div>
        <div className="drawer-body">{children}</div>
      </aside>
    </>,
    document.body,
  );
}

function useEscape(fn: () => void) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && ref.current();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);
}

export function Field({ label, hint, children, className = '' }: { label?: ReactNode; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={`field ${className}`}>
      {label && <label>{label}</label>}
      {children}
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}

export function NumInput({ value, onChange, suffix, min, max, step, ...rest }: { value: number; onChange: (v: number) => void; suffix?: string; min?: number; max?: number; step?: number; 'data-testid'?: string }) {
  return (
    <div className={`input-wrap ${suffix ? 'has-suffix' : ''}`}>
      <input
        className="input num"
        type="number"
        value={Number.isFinite(value) ? value : ''}
        min={min}
        max={max}
        step={step ?? 1}
        onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
        {...rest}
      />
      {suffix && <span className="suffix">{suffix}</span>}
    </div>
  );
}

export function Switch({ on, onChange, disabled, label }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean; label?: string }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} className={`switch ${on ? 'on' : ''}`} disabled={disabled} onClick={() => onChange(!on)} />;
}

export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { id: T; label: ReactNode; count?: number }[] }) {
  return (
    <div className="tabs" role="tablist">
      {items.map((i) => (
        <button key={i.id} role="tab" aria-selected={value === i.id} className={value === i.id ? 'on' : ''} onClick={() => onChange(i.id)}>
          {i.label}
          {!!i.count && <span className="tab-count">{i.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function UTabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { id: T; label: ReactNode; count?: number }[] }) {
  return (
    <div className="utabs" role="tablist">
      {items.map((i) => (
        <button key={i.id} role="tab" aria-selected={value === i.id} className={value === i.id ? 'on' : ''} onClick={() => onChange(i.id)}>
          {i.label}
          {!!i.count && <span className="tabs"><span className="tab-count">{i.count}</span></span>}
        </button>
      ))}
    </div>
  );
}

export function PageHead({ title, subtitle, actions, back }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; back?: ReactNode }) {
  return (
    <div className="page-head">
      <div>
        {back}
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="row wrap">{actions}</div>}
    </div>
  );
}

export function Skeleton({ h = 16, w = '100%', r }: { h?: number; w?: number | string; r?: number }) {
  return <div className="skeleton" style={{ height: h, width: w, borderRadius: r }} />;
}

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div style={{ padding: 18 }} className="col gap-16">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="row gap-16">
          <Skeleton h={36} w={36} r={10} />
          {Array.from({ length: cols - 1 }).map((__, j) => (
            <Skeleton key={j} h={14} w={`${60 + ((i * 7 + j * 13) % 40)}%`} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function Empty({ icon, title, text, action }: { icon?: ReactNode; title: string; text?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="e-icon">{icon ?? <Inbox size={26} />}</div>
      <b>{title}</b>
      {text && <div>{text}</div>}
      {action && <div className="mt-16">{action}</div>}
    </div>
  );
}

export function ErrorBox({ error, retry }: { error: unknown; retry?: () => void }) {
  return (
    <div className="callout danger">
      <AlertTriangle size={18} />
      <div className="grow">{errorText(error)}</div>
      {retry && (
        <button className="btn btn-sm" onClick={retry}>
          Повторить
        </button>
      )}
    </div>
  );
}

export function Money({ v, signed, className = '' }: { v: number; signed?: boolean; className?: string }) {
  const cls = signed ? (v > 0 ? 'pos' : v < 0 ? 'neg' : '') : '';
  return <span className={`num nowrap ${cls} ${className}`}>{signed && v > 0 ? '+' : ''}{formatPrice(v)}</span>;
}

export function Tel({ phone }: { phone: string | null | undefined }) {
  if (!phone) return <span className="muted">—</span>;
  return (
    <a className="tel" href={`tel:${phone}`} onClick={(e) => e.stopPropagation()} title="Позвонить">
      <Phone size={13} />
      <span className="num">{formatPhone(phone)}</span>
    </a>
  );
}

export function Thumb({ emoji, color, image, sm }: { emoji?: string | null; color?: string | null; image?: string | null; sm?: boolean }) {
  return (
    <div className={`thumb ${sm ? 'sm' : ''}`} style={{ background: color ?? '#F1F2F6' }}>
      {image ? <img src={image} alt="" /> : (emoji ?? '📦')}
    </div>
  );
}

export const initials = (name: string) =>
  name
    .replace(/\(.*?\)/g, ' ')
    .replace(/[^\p{L}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join('') || '?';

export function relTime(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'только что';
  if (diff < 3600) return `${Math.floor(diff / 60)} мин назад`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ч назад`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} дн назад`;
  const d = new Date(iso);
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

export const plural = (n: number, one: string, few: string, many: string) => {
  const m10 = n % 10,
    m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
};
