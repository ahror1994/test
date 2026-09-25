import { useState } from 'react';
import { ArrowRight, BadgePercent, Lock, Mail, ShieldCheck, Truck, Wallet } from 'lucide-react';
import { BRAND } from '@taptym/shared';
import { useAuth } from '../auth';
import { errorText } from '../api';

const DEMO_USERS = [
  { email: 'admin@taptym.kg', password: 'admin123', role: 'Владелец — все права' },
  { email: 'operator@taptym.kg', password: 'operator123', role: 'Оператор' },
  { email: 'accountant@taptym.kg', password: 'account123', role: 'Бухгалтер' },
];

// Demo passwords are hinted only on the server computer itself, not to other devices in the network.
const SHOW_DEMO_USERS = ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);

export function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setErr('');
    setBusy(true);
    try {
      await login(email, password);
    } catch (x) {
      setErr(errorText(x));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login">
      <section className="login-brand">
        <div className="logo">
          <div className="logo-mark">T</div>
          <div className="logo-text">
            <b>{BRAND.adminName}</b>
            <span>Панель управления площадкой</span>
          </div>
        </div>
        <div className="login-hero">
          <h1>Все магазины канцтоваров Оша — в одном окне</h1>
          <p>Заказы, поставщики, выплаты, реклама и настройки площадки. Деньги считаются автоматически.</p>
          <div className="login-feats">
            <div><Wallet size={18} /> Выплаты с автоматическим расчётом</div>
            <div><Truck size={18} /> Курьер, Яндекс и доставка магазинов</div>
            <div><BadgePercent size={18} /> Промокоды, баннеры и платная реклама</div>
            <div><ShieldCheck size={18} /> Права сотрудников: оператор, бухгалтер</div>
          </div>
        </div>
        <div className="login-foot">© {new Date().getFullYear()} {BRAND.name}</div>
      </section>
      <section className="login-form-wrap">
        <form className="login-form" onSubmit={submit}>
          <h2>Вход в админку</h2>
          <p className="muted">Введите рабочий email и пароль</p>
          <div className="field">
            <label>Email</label>
            <div className="input-wrap has-icon">
              <Mail size={17} className="prefix-icon" />
              <input className="input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@taptym.kg" data-testid="login-email" required />
            </div>
          </div>
          <div className="field">
            <label>Пароль</label>
            <div className="input-wrap has-icon">
              <Lock size={17} className="prefix-icon" />
              <input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" data-testid="login-password" required />
            </div>
          </div>
          {err && <div className="callout danger">{err}</div>}
          <button className="btn btn-primary btn-lg" type="submit" disabled={busy} data-testid="login-submit">
            {busy ? 'Входим…' : 'Войти'} <ArrowRight size={18} />
          </button>
          {SHOW_DEMO_USERS && (
          <div className="demo-creds">
            <b>Демо-доступы — нажмите, чтобы подставить</b>
            {DEMO_USERS.map((u) => (
              <button
                type="button"
                key={u.email}
                onClick={() => {
                  setEmail(u.email);
                  setPassword(u.password);
                }}
              >
                <span>
                  <b>{u.email}</b> · {u.password}
                </span>
                <span className="muted">{u.role}</span>
              </button>
            ))}
          </div>
          )}
        </form>
      </section>
    </div>
  );
}
