const TOKEN_KEY = 'taptym_admin_token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t: string | null) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY));

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}

let onUnauthorized: () => void = () => {};
export const setUnauthorizedHandler = (fn: () => void) => {
  onUnauthorized = fn;
};

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`/api/a${path}`, {
    method: opts.method ?? (opts.body !== undefined ? 'POST' : 'GET'),
    headers: {
      ...(opts.body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  if (res.status === 401 && !path.startsWith('/auth/')) {
    setToken(null);
    onUnauthorized();
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new HttpError(res.status, data.error ?? `http_${res.status}`);
  return data as T;
}

export const post = <T = any>(path: string, body: unknown = {}) => api<T>(path, { method: 'POST', body });
export const patch = <T = any>(path: string, body: unknown) => api<T>(path, { method: 'PATCH', body });
export const put = <T = any>(path: string, body: unknown) => api<T>(path, { method: 'PUT', body });
export const del = <T = any>(path: string) => api<T>(path, { method: 'DELETE' });

export const downloadUrl = (path: string) => `/api/a${path}${path.includes('?') ? '&' : '?'}token=${encodeURIComponent(getToken() ?? '')}`;

const ERRORS: Record<string, string> = {
  bad_credentials: 'Неверный email или пароль',
  forbidden: 'Недостаточно прав для этого действия',
  insufficient_balance: 'Недостаточно средств на балансе поставщика',
  code_exists: 'Такой промокод уже существует',
  bad_code: 'Код должен содержать минимум 3 латинские буквы или цифры',
  email_exists: 'Сотрудник с таким email уже есть',
  email_password_required: 'Укажите email и пароль (минимум 6 символов)',
  name_phone_required: 'Укажите название и телефон',
  title_required: 'Укажите заголовок',
  bad_amount: 'Укажите сумму',
  bad_action: 'Действие недоступно для текущего статуса',
  cannot_edit_owner: 'Владельца нельзя деактивировать или сменить роль',
  cannot_create_owner: 'Второго владельца создать нельзя',
  text_required: 'Введите сообщение',
  order_not_found: 'Заказ не найден',
  server_error: 'Ошибка сервера. Попробуйте ещё раз',
};

export function errorText(e: unknown): string {
  if (e instanceof HttpError) {
    if (e.code.startsWith('bad_transition')) return 'Такой переход статуса невозможен. Используйте «Принудительно».';
    return ERRORS[e.code] ?? `Ошибка: ${e.code}`;
  }
  if (e instanceof TypeError) return 'Нет связи с сервером';
  return String((e as Error)?.message ?? e);
}
