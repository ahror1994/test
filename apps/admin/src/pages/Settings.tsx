import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Bike, Car, Coins, Gift, Headphones, Percent, RotateCcw, Save, ShieldAlert, Sparkles, Truck, type LucideIcon } from 'lucide-react';
import { formatPrice, type PlatformSettings } from '@taptym/shared';
import { put } from '../api';
import { useApi } from '../hooks';
import { SEASON } from '../labels';
import { Btn, ErrorBox, Field, NumInput, PageHead, Skeleton, Switch, useToast } from '../ui';

const SECTIONS = [
  { id: 'commission', label: 'Комиссия и тарифы', icon: Percent },
  { id: 'delivery', label: 'Доставка', icon: Truck },
  { id: 'coins', label: 'Монеты и рефералы', icon: Coins },
  { id: 'risk', label: 'Риски', icon: ShieldAlert },
  { id: 'first', label: 'Первый заказ', icon: Gift },
  { id: 'contacts', label: 'Контакты поддержки', icon: Headphones },
  { id: 'season', label: 'Сезон', icon: Sparkles },
] as const;

export default function Settings() {
  const { data, error, reload, setData } = useApi<PlatformSettings>('/settings');
  const [f, setF] = useState<PlatformSettings | null>(null);
  const toast = useToast();
  useEffect(() => {
    if (data) setF(data);
  }, [data]);

  const changed = useMemo(() => {
    if (!f || !data) return [] as string[];
    return (Object.keys(f) as (keyof PlatformSettings)[]).filter((k) => JSON.stringify(f[k]) !== JSON.stringify(data[k]));
  }, [f, data]);

  if (error && !data) return <ErrorBox error={error} retry={reload} />;
  if (!f || !data)
    return (
      <div className="col gap-20">
        <Skeleton h={40} w={300} />
        <Skeleton h={260} r={20} />
        <Skeleton h={360} r={20} />
      </div>
    );

  const set = <K extends keyof PlatformSettings>(k: K, v: PlatformSettings[K]) => setF({ ...f, [k]: v });
  const save = async () => {
    const patch = Object.fromEntries(changed.map((k) => [k, f[k as keyof PlatformSettings]]));
    const next = await put<PlatformSettings>('/settings', patch);
    setData(next);
    toast.ok(`Сохранено: ${changed.length} ${changed.length === 1 ? 'изменение' : 'изменений'}`);
  };
  const example = 1000;

  return (
    <>
      <PageHead title="Настройки площадки" subtitle="Изменения применяются сразу для новых заказов" />
      <div className="settings-layout">
        <nav className="settings-nav">
          {SECTIONS.map((s) => (
            <a key={s.id} href={`#${s.id}`} onClick={(e) => { e.preventDefault(); document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>
              <s.icon size={16} /> {s.label}
            </a>
          ))}
        </nav>
        <div className="col gap-20">
          <Section id="commission" icon={Percent} title="Комиссия и тарифы" sub="Сколько площадка зарабатывает с магазинов">
            <div className="grid g-2 gap-16">
              <Field label="Комиссия с продаж" hint={`Рекомендуем от 5 до 10%. С заказа на ${formatPrice(example)} площадка получит ${formatPrice((example * f.commissionPercent) / 100)}.`}>
                <NumInput value={f.commissionPercent} min={0} max={30} step={0.5} onChange={(v) => set('commissionPercent', v)} suffix="%" data-testid="commission-input" />
              </Field>
              <Field label="Пробный период для новых магазинов" hint="Без комиссии">
                <NumInput value={f.trialDays} min={0} onChange={(v) => set('trialDays', v)} suffix="дней" />
              </Field>
              <Field label="Загрузка каталога — цена за час" hint="Когда ваш сотрудник заводит товары за магазин">
                <NumInput value={f.catalogUploadHourlyRate} min={0} onChange={(v) => set('catalogUploadHourlyRate', v)} suffix="сом/ч" />
              </Field>
              <Toggle label="Бесплатный баннер в первый месяц" hint="Новым магазинам — один баннер в подарок" on={f.freeBannerFirstMonth} onChange={(v) => set('freeBannerFirstMonth', v)} />
            </div>
            {(f.commissionPercent < 5 || f.commissionPercent > 10) && <div className="callout warn mt-16">Комиссия вне рекомендуемого диапазона 5–10%.</div>}
          </Section>

          <Section id="delivery" icon={Truck} title="Доставка" sub="Курьер Taptym, Яндекс и условия бесплатной доставки">
            <div className="col gap-16">
              <Toggle label="Курьер Taptym" hint="Собственный курьер площадки (мопед / авто)" on={f.courierEnabled} onChange={(v) => set('courierEnabled', v)} />
              <div className="grid g-2 gap-16">
                <Tariff icon={Bike} title="Мопед" t={f.courierMoped} onChange={(t) => set('courierMoped', t)} disabled={!f.courierEnabled} />
                <Tariff icon={Car} title="Автомобиль" t={f.courierCar} onChange={(t) => set('courierCar', t)} disabled={!f.courierEnabled} />
              </div>
              <div className="grid g-3 gap-16">
                <Field label="Автомобиль, если заказ от" hint="Крупные заказы едут на машине">
                  <NumInput value={f.carFromSubtotal} min={0} onChange={(v) => set('carFromSubtotal', v)} suffix="сом" />
                </Field>
                <Field label="Бесплатная доставка от" hint="За счёт площадки; 0 — выключено">
                  <NumInput value={f.freeDeliveryFrom} min={0} onChange={(v) => set('freeDeliveryFrom', v)} suffix="сом" />
                </Field>
                <Field label="Доставка сегодня, если заказ до" hint="Позже — на завтра">
                  <NumInput value={f.sameDayCutoffHour} min={0} max={23} onChange={(v) => set('sameDayCutoffHour', Math.min(23, Math.max(0, v)))} suffix=":00" />
                </Field>
              </div>
              <div className="divider" />
              <Toggle label="Яндекс Доставка" hint="Без ключа API используется оценка по тарифу ниже" on={f.yandexEnabled} onChange={(v) => set('yandexEnabled', v)} />
              <div className="grid g-2 gap-16">
                <Field label="Оценка Яндекса — посадка">
                  <NumInput value={f.yandexEstimate.base} min={0} onChange={(v) => set('yandexEstimate', { ...f.yandexEstimate, base: v })} suffix="сом" />
                </Field>
                <Field label="Оценка Яндекса — за км">
                  <NumInput value={f.yandexEstimate.perKm} min={0} onChange={(v) => set('yandexEstimate', { ...f.yandexEstimate, perKm: v })} suffix="сом/км" />
                </Field>
              </div>
            </div>
          </Section>

          <Section id="coins" icon={Coins} title="Монеты и рефералы" sub="Кешбэк покупателям и бонусы за приглашённых друзей">
            <div className="grid g-3 gap-16">
              <Field label="Монет за каждые 100 сом" hint={`Заказ на 500 сом → ${Math.floor(5 * f.coinsPer100)} монет`}>
                <NumInput value={f.coinsPer100} min={0} step={0.5} onChange={(v) => set('coinsPer100', v)} suffix="🪙" />
              </Field>
              <Field label="Стоимость 1 монеты">
                <NumInput value={f.coinValue} min={0} step={0.1} onChange={(v) => set('coinValue', v)} suffix="сом" />
              </Field>
              <Field label="Монетами можно оплатить до">
                <NumInput value={f.coinsMaxPercent} min={0} max={100} onChange={(v) => set('coinsMaxPercent', v)} suffix="% заказа" />
              </Field>
              <Field label="Бонус пригласившему">
                <NumInput value={f.referralBonusCoins} min={0} onChange={(v) => set('referralBonusCoins', v)} suffix="🪙" />
              </Field>
              <Field label="Бонус приглашённому другу">
                <NumInput value={f.referralFriendCoins} min={0} onChange={(v) => set('referralFriendCoins', v)} suffix="🪙" />
              </Field>
            </div>
          </Section>

          <Section id="risk" icon={ShieldAlert} title="Риски" sub="Защита от долгов магазинов по наличным">
            <Field label="Лимит долга по наличным" hint="Если магазин собрал наличными больше этой суммы комиссии и не рассчитался — оплата наличными для него отключится">
              <div style={{ maxWidth: 280 }}><NumInput value={f.cashDebtLimit} min={0} onChange={(v) => set('cashDebtLimit', v)} suffix="сом" /></div>
            </Field>
          </Section>

          <Section id="first" icon={Gift} title="Первый заказ" sub="Подарок новым покупателям">
            <Toggle label="Бесплатная доставка курьером на первый заказ" hint="Стоимость доставки оплачивает площадка" on={f.freeFirstCourierDelivery} onChange={(v) => set('freeFirstCourierDelivery', v)} />
          </Section>

          <Section id="contacts" icon={Headphones} title="Контакты поддержки" sub="Показываются в приложениях покупателя и магазина">
            <div className="grid g-2 gap-16">
              <Field label="Телефон">
                <input className="input" value={f.supportPhone} onChange={(e) => set('supportPhone', e.target.value)} />
              </Field>
              <Field label="Telegram">
                <input className="input" value={f.supportTelegram} onChange={(e) => set('supportTelegram', e.target.value)} />
              </Field>
            </div>
          </Section>

          <Section id="season" icon={Sparkles} title="Сезон" sub="Оформление главной и подборки в приложении">
            <div className="season-pick">
              {(Object.keys(SEASON) as PlatformSettings['seasonalTheme'][]).map((k) => (
                <button key={k} className={f.seasonalTheme === k ? 'on' : ''} onClick={() => set('seasonalTheme', k)}>
                  {SEASON[k]}
                </button>
              ))}
            </div>
          </Section>
        </div>
      </div>
      <div className={`save-bar ${changed.length ? 'show' : ''}`}>
        <span>
          Несохранённых изменений: <b>{changed.length}</b>
        </span>
        <span className="grow" />
        <Btn variant="ghost" icon={<RotateCcw size={15} />} onClick={() => setF(data)}>Отменить</Btn>
        <Btn variant="primary" icon={<Save size={16} />} onClick={save} disabled={!changed.length} data-testid="settings-save">Сохранить</Btn>
      </div>
    </>
  );
}

function Section({ id, icon: Icon, title, sub, children }: { id: string; icon: LucideIcon; title: string; sub: string; children: ReactNode }) {
  return (
    <section id={id} className="card card-pad settings-section">
      <div className="row gap-16 mb-20">
        <span className="sec-icon"><Icon size={18} /></span>
        <div>
          <h3 className="h3">{title}</h3>
          <div className="small muted">{sub}</div>
        </div>
      </div>
      {children}
    </section>
  );
}

function Toggle({ label, hint, on, onChange }: { label: string; hint?: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="toggle-row">
      <div>
        <b>{label}</b>
        {hint && <div className="small muted">{hint}</div>}
      </div>
      <Switch on={on} onChange={onChange} label={label} />
    </div>
  );
}

function Tariff({ icon: Icon, title, t, onChange, disabled }: { icon: LucideIcon; title: string; t: PlatformSettings['courierMoped']; onChange: (t: PlatformSettings['courierMoped']) => void; disabled?: boolean }) {
  const km5 = t.base + Math.max(0, 5 - t.includedKm) * t.perKm;
  return (
    <div className={`panel ${disabled ? 'row-muted' : ''}`}>
      <div className="row between">
        <b className="row gap-6"><Icon size={17} /> {title}</b>
        <span className="small muted">5 км = {formatPrice(km5)}</span>
      </div>
      <div className="grid g-3 gap-6 mt-8">
        <Field label="Посадка"><NumInput value={t.base} min={0} onChange={(v) => onChange({ ...t, base: v })} suffix="сом" /></Field>
        <Field label="За км"><NumInput value={t.perKm} min={0} onChange={(v) => onChange({ ...t, perKm: v })} suffix="сом" /></Field>
        <Field label="Включено"><NumInput value={t.includedKm} min={0} step={0.5} onChange={(v) => onChange({ ...t, includedKm: v })} suffix="км" /></Field>
      </div>
    </div>
  );
}
