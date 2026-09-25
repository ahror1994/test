import { useState } from 'react';
import { ArrowDown, ArrowUp, GripVertical, Megaphone, Pencil, Plus, Trash2 } from 'lucide-react';
import { CATEGORIES, formatDate, formatPrice, type Banner, type BannerPlacement, type PromoCode } from '@taptym/shared';
import { del, patch, post } from '../api';
import { useAuth } from '../auth';
import { useApi } from '../hooks';
import { PLACEMENT } from '../labels';
import type { AdminSupplier } from '../types';
import { Btn, Chip, ErrorBox, Field, Modal, NumInput, PageHead, Skeleton, Switch, useDialog, useToast } from '../ui';

type AdminBanner = Banner & { supplierName: string | null };
const PLACEMENTS = Object.keys(PLACEMENT) as BannerPlacement[];

export function BannerPreview({ b, small }: { b: Pick<Banner, 'title' | 'subtitle' | 'emoji' | 'color' | 'textColor'> & { isAd?: boolean }; small?: boolean }) {
  return (
    <div className={`bn-preview ${small ? 'sm' : ''}`} style={{ background: b.color, color: b.textColor }}>
      <div className="bn-text">
        {b.isAd && <span className="bn-ad">Реклама</span>}
        <div className="bn-title">{b.title || 'Заголовок баннера'}</div>
        {(b.subtitle || !small) && <div className="bn-sub">{b.subtitle || 'Подзаголовок'}</div>}
      </div>
      <div className="bn-emoji">{b.emoji || '✨'}</div>
    </div>
  );
}

export function linkLabel(link: string, suppliers?: AdminSupplier[]) {
  if (!link) return 'Без перехода';
  if (link === 'school') return '🎒 Подборка «В школу»';
  if (link === 'coins') return '🪙 Экран монет';
  const [k, v] = link.split(':');
  if (k === 'promo') return `🎟 Промокод ${v}`;
  if (k === 'supplier') return `🏪 ${suppliers?.find((s) => String(s.id) === v)?.name ?? `Магазин #${v}`}`;
  if (k === 'category') return `📂 ${CATEGORIES.find((c) => c.id === v)?.name.ru ?? v}`;
  return link;
}

export default function Banners() {
  const { data, error, loading, reload, setData } = useApi<AdminBanner[]>('/banners');
  const { can } = useAuth();
  const suppliers = useApi<AdminSupplier[]>(can('suppliers') ? '/suppliers' : null);
  const [editing, setEditing] = useState<Partial<AdminBanner> | null>(null);
  const [drag, setDrag] = useState<number | null>(null);
  const toast = useToast();
  const dialog = useDialog();

  const group = (pl: BannerPlacement) => (data ?? []).filter((b) => b.placement === pl).sort((a, b) => a.position - b.position);

  const reorder = async (pl: BannerPlacement, ids: number[]) => {
    setData((l) => l?.map((b) => (b.placement === pl ? { ...b, position: ids.indexOf(b.id) + 1 } : b)) ?? null);
    try {
      await post('/banners/reorder', { ids });
      toast.ok('Порядок сохранён');
    } catch (e) {
      toast.error(e);
      reload();
    }
  };
  const move = (pl: BannerPlacement, id: number, dir: -1 | 1) => {
    const ids = group(pl).map((b) => b.id);
    const i = ids.indexOf(id);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    reorder(pl, ids);
  };
  const drop = (pl: BannerPlacement, targetId: number) => {
    if (drag == null || drag === targetId) return;
    const ids = group(pl).map((b) => b.id);
    if (!ids.includes(drag)) return;
    const from = ids.indexOf(drag);
    ids.splice(from, 1);
    ids.splice(ids.indexOf(targetId) + (from <= ids.indexOf(targetId) ? 1 : 0), 0, drag);
    setDrag(null);
    reorder(pl, ids);
  };
  const toggle = async (b: AdminBanner) => {
    setData((l) => l?.map((x) => (x.id === b.id ? { ...x, active: !b.active } : x)) ?? null);
    await patch(`/banners/${b.id}`, { active: !b.active }).catch((e) => {
      toast.error(e);
      reload();
    });
  };
  const remove = async (b: AdminBanner) => {
    const ok = await dialog.confirm({ title: `Удалить баннер «${b.title}»?`, confirmText: 'Удалить', danger: true, text: b.isAd ? 'Это платная реклама магазина. Деньги автоматически не вернутся — при необходимости сделайте корректировку баланса.' : undefined });
    if (!ok) return false;
    await del(`/banners/${b.id}`);
    toast.ok('Баннер удалён');
    reload();
  };

  return (
    <>
      <PageHead
        title="Баннеры и реклама"
        subtitle="Что видят покупатели на главной, в поиске и категориях. Перетаскивайте карточки или используйте стрелки."
        actions={<Btn variant="primary" icon={<Plus size={17} />} onClick={() => setEditing({ placement: 'home_top' })} data-testid="banner-create">Новый баннер</Btn>}
      />
      {error && !data && <ErrorBox error={error} retry={reload} />}
      {!data && loading && <div className="col gap-20"><Skeleton h={220} r={20} /><Skeleton h={220} r={20} /></div>}
      {data && (
        <div className="col gap-20">
          {PLACEMENTS.map((pl) => {
            const items = group(pl);
            return (
              <div key={pl} className="card card-pad" data-testid={`placement-${pl}`}>
                <div className="row between">
                  <div>
                    <h3 className="h3">{PLACEMENT[pl].label}</h3>
                    <div className="small muted">{PLACEMENT[pl].hint} · {items.length} шт.</div>
                  </div>
                  <Btn size="sm" variant="soft" icon={<Plus size={15} />} onClick={() => setEditing({ placement: pl })}>Добавить сюда</Btn>
                </div>
                {items.length === 0 ? (
                  <div className="bn-empty mt-16">
                    <Megaphone size={20} /> В этом месте баннеров нет
                  </div>
                ) : (
                  <div className="bn-grid mt-16">
                    {items.map((b, i) => (
                      <div
                        key={b.id}
                        className={`bn-item ${!b.active ? 'off' : ''} ${drag === b.id ? 'dragging' : ''}`}
                        draggable
                        onDragStart={() => setDrag(b.id)}
                        onDragEnd={() => setDrag(null)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => drop(pl, b.id)}
                        data-testid={`banner-${b.id}`}
                      >
                        <div className="bn-pos"><GripVertical size={14} /> {i + 1}</div>
                        <BannerPreview b={b} small />
                        <div className="bn-meta">
                          <div className="row gap-4 wrap">
                            {b.isAd ? <Chip tone="warning" plain>Реклама · {formatPrice(b.price)}</Chip> : <Chip plain tone="primary">Площадка</Chip>}
                            {!b.active && <Chip>Выключен</Chip>}
                          </div>
                          <div className="small muted mt-4 ellipsis">{linkLabel(b.link, suppliers.data ?? undefined)}{b.supplierName && !linkLabel(b.link, suppliers.data ?? undefined).includes(b.supplierName) ? ` · ${b.supplierName}` : ''}</div>
                          {(b.startsAt || b.endsAt) && <div className="small muted">{b.startsAt ? formatDate(b.startsAt) : '…'} — {b.endsAt ? formatDate(b.endsAt) : '∞'}</div>}
                        </div>
                        <div className="bn-actions">
                          <Btn size="sm" variant="ghost" icon={<ArrowUp size={15} />} disabled={i === 0} onClick={() => move(pl, b.id, -1)} title="Выше" data-testid={`banner-up-${b.id}`} />
                          <Btn size="sm" variant="ghost" icon={<ArrowDown size={15} />} disabled={i === items.length - 1} onClick={() => move(pl, b.id, 1)} title="Ниже" data-testid={`banner-down-${b.id}`} />
                          <span className="grow" />
                          <Switch on={b.active} onChange={() => toggle(b)} label="Активен" />
                          <Btn size="sm" variant="ghost" icon={<Pencil size={15} />} onClick={() => setEditing(b)} title="Изменить" data-testid={`banner-edit-${b.id}`} />
                          <Btn size="sm" variant="ghost" icon={<Trash2 size={15} />} onClick={() => remove(b)} title="Удалить" data-testid={`banner-del-${b.id}`} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {editing && (
        <BannerModal
          initial={editing}
          suppliers={suppliers.data ?? []}
          onClose={() => setEditing(null)}
          onDone={() => {
            setEditing(null);
            reload();
          }}
        />
      )}
    </>
  );
}

const COLORS = ['#5B3CF5', '#12B76A', '#F79009', '#F04438', '#1D7AFC', '#0F1222', '#FFCC00', '#EE46BC', '#E8E3FF', '#DDF4E8', '#FFE9D6', '#FFF4CC'];
const EMOJIS = ['🎒', '✏️', '📚', '🖍️', '🎨', '📎', '🗂️', '🧮', '🎁', '🔥', '⚡', '🪙', '🚚', '🎄', '🏷️', '✨'];
type LinkKind = '' | 'school' | 'coins' | 'promo' | 'supplier' | 'category';

function parseLink(link: string): { kind: LinkKind; value: string } {
  if (!link) return { kind: '', value: '' };
  if (link === 'school' || link === 'coins') return { kind: link, value: '' };
  const [k, ...v] = link.split(':');
  if (k === 'promo' || k === 'supplier' || k === 'category') return { kind: k, value: v.join(':') };
  return { kind: '', value: '' };
}

const toDateInput = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : '');

function BannerModal({ initial, suppliers, onClose, onDone }: { initial: Partial<AdminBanner>; suppliers: AdminSupplier[]; onClose: () => void; onDone: () => void }) {
  const isNew = !initial.id;
  const l0 = parseLink(initial.link ?? '');
  const [f, setF] = useState({
    title: initial.title ?? '',
    subtitle: initial.subtitle ?? '',
    emoji: initial.emoji ?? '🎒',
    color: initial.color ?? '#5B3CF5',
    textColor: initial.textColor ?? '#FFFFFF',
    placement: (initial.placement ?? 'home_top') as BannerPlacement,
    supplierId: initial.supplierId ?? 0,
    price: initial.price ?? 0,
    chargeSupplier: true,
    startsAt: toDateInput(initial.startsAt),
    endsAt: toDateInput(initial.endsAt),
    active: initial.active ?? true,
  });
  const [linkKind, setLinkKind] = useState<LinkKind>(l0.kind);
  const [linkValue, setLinkValue] = useState(l0.value);
  const promos = useApi<PromoCode[]>(linkKind === 'promo' ? '/promos' : null);
  const toast = useToast();
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const link = linkKind === 'school' || linkKind === 'coins' ? linkKind : linkKind && linkValue ? `${linkKind}:${linkValue}` : '';
  const supplier = suppliers.find((s) => s.id === f.supplierId);

  const submit = async () => {
    const payload = {
      title: f.title.trim(),
      subtitle: f.subtitle,
      emoji: f.emoji,
      color: f.color,
      textColor: f.textColor,
      placement: f.placement,
      link,
      supplierId: f.supplierId || null,
      price: f.supplierId ? Math.round(f.price) : 0,
      startsAt: f.startsAt ? new Date(f.startsAt).toISOString() : '',
      endsAt: f.endsAt ? new Date(f.endsAt + 'T23:59:59').toISOString() : '',
      active: f.active,
    };
    if (isNew) {
      await post('/banners', { ...payload, startsAt: payload.startsAt || null, endsAt: payload.endsAt || null, chargeSupplier: !!f.supplierId && f.chargeSupplier && f.price > 0 });
      toast.ok(f.supplierId && f.chargeSupplier && f.price > 0 ? `Баннер создан, с магазина списано ${formatPrice(f.price)}` : 'Баннер создан');
    } else {
      await patch(`/banners/${initial.id}`, payload);
      toast.ok('Баннер сохранён');
    }
    onDone();
  };

  return (
    <Modal
      title={isNew ? 'Новый баннер' : 'Редактировать баннер'}
      onClose={onClose}
      wide
      footer={
        <>
          <button className="btn" onClick={onClose}>Отмена</button>
          <Btn variant="primary" disabled={!f.title.trim()} onClick={submit} data-testid="banner-save">{isNew ? 'Создать' : 'Сохранить'}</Btn>
        </>
      }
    >
      <div className="bn-editor">
        <div className="col gap-16">
          <Field label="Заголовок">
            <input className="input" value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="Всё для школы со скидкой" autoFocus data-testid="banner-title" />
          </Field>
          <Field label="Подзаголовок">
            <input className="input" value={f.subtitle} onChange={(e) => set('subtitle', e.target.value)} placeholder="До −30% на рюкзаки и тетради" data-testid="banner-subtitle" />
          </Field>
          <Field label="Эмодзи">
            <div className="emoji-pick">
              {EMOJIS.map((e) => (
                <button key={e} type="button" className={f.emoji === e ? 'on' : ''} onClick={() => set('emoji', e)}>{e}</button>
              ))}
            </div>
          </Field>
          <div className="grid g-2 gap-16">
            <Field label="Цвет фона">
              <div className="color-pick">
                {COLORS.map((c) => (
                  <button key={c} type="button" className={f.color.toLowerCase() === c.toLowerCase() ? 'on' : ''} style={{ background: c }} onClick={() => set('color', c)} aria-label={c} />
                ))}
                <input type="color" value={f.color} onChange={(e) => set('color', e.target.value)} title="Свой цвет" />
              </div>
            </Field>
            <Field label="Цвет текста">
              <div className="seg">
                <button className={f.textColor.toUpperCase() === '#FFFFFF' ? 'on' : ''} onClick={() => set('textColor', '#FFFFFF')}>Белый</button>
                <button className={f.textColor.toUpperCase() === '#0F1222' ? 'on' : ''} onClick={() => set('textColor', '#0F1222')}>Тёмный</button>
              </div>
            </Field>
          </div>
          <Field label="Место показа">
            <select className="select" value={f.placement} onChange={(e) => set('placement', e.target.value as BannerPlacement)} data-testid="banner-placement">
              {PLACEMENTS.map((p) => <option key={p} value={p}>{PLACEMENT[p].label}</option>)}
            </select>
          </Field>
          <Field label="Куда ведёт нажатие">
            <div className="row gap-6">
              <select
                className="select"
                value={linkKind}
                onChange={(e) => {
                  setLinkKind(e.target.value as LinkKind);
                  setLinkValue('');
                }}
                style={{ maxWidth: 210 }}
              >
                <option value="">Никуда</option>
                <option value="school">Подборка «В школу»</option>
                <option value="coins">Экран монет</option>
                <option value="promo">Промокод</option>
                <option value="supplier">Магазин</option>
                <option value="category">Категория</option>
              </select>
              {linkKind === 'promo' && (
                promos.data ? (
                  <select className="select" value={linkValue} onChange={(e) => setLinkValue(e.target.value)}>
                    <option value="">выберите…</option>
                    {promos.data.filter((p) => p.status === 'active').map((p) => <option key={p.id} value={p.code}>{p.code}</option>)}
                  </select>
                ) : (
                  <input className="input" value={linkValue} onChange={(e) => setLinkValue(e.target.value.toUpperCase())} placeholder="КОД" />
                )
              )}
              {linkKind === 'supplier' && (
                <select className="select" value={linkValue} onChange={(e) => setLinkValue(e.target.value)}>
                  <option value="">выберите магазин…</option>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              )}
              {linkKind === 'category' && (
                <select className="select" value={linkValue} onChange={(e) => setLinkValue(e.target.value)}>
                  <option value="">выберите категорию…</option>
                  {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.name.ru}</option>)}
                </select>
              )}
            </div>
            <div className="hint">Ссылка: <code>{link || '—'}</code></div>
          </Field>
          <div className="panel">
            <div className="row between">
              <div>
                <b>Платная реклама магазина</b>
                <div className="small muted">Баннер будет помечен «Реклама»</div>
              </div>
              <Switch on={!!f.supplierId} onChange={(v) => set('supplierId', v ? (suppliers[0]?.id ?? 0) : 0)} label="Реклама магазина" />
            </div>
            {!!f.supplierId && (
              <div className="grid g-2 gap-16 mt-16">
                <Field label="Магазин">
                  <select className="select" value={f.supplierId} onChange={(e) => set('supplierId', Number(e.target.value))} data-testid="banner-supplier">
                    {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </Field>
                <Field label="Стоимость">
                  <NumInput value={f.price} min={0} onChange={(v) => set('price', v)} suffix="сом" data-testid="banner-price" />
                </Field>
                {isNew && (
                  <label className="check span-2">
                    <input type="checkbox" checked={f.chargeSupplier} onChange={(e) => set('chargeSupplier', e.target.checked)} />
                    <div>
                      <b>Списать с баланса поставщика</b>
                      <span>{supplier ? `Баланс ${supplier.name}: ${formatPrice(supplier.balance)}` : 'Сумма удержится при следующей выплате'}</span>
                    </div>
                  </label>
                )}
              </div>
            )}
          </div>
          <div className="grid g-2 gap-16">
            <Field label="Показывать с">
              <input className="input" type="date" value={f.startsAt} onChange={(e) => set('startsAt', e.target.value)} />
            </Field>
            <Field label="по">
              <input className="input" type="date" value={f.endsAt} onChange={(e) => set('endsAt', e.target.value)} />
            </Field>
          </div>
          <div className="row between">
            <b>Активен</b>
            <Switch on={f.active} onChange={(v) => set('active', v)} label="Активен" />
          </div>
        </div>
        <div className="bn-live">
          <div className="panel-label">Живой предпросмотр</div>
          <div className="phone">
            <div className="phone-notch" />
            <div className="phone-top">
              <span className="phone-logo">Taptym</span>
              <span className="phone-search">Найти ручку, тетрадь…</span>
            </div>
            <BannerPreview b={{ ...f, isAd: !!f.supplierId }} />
            <div className="phone-cats">
              {CATEGORIES.slice(0, 4).map((c) => (
                <div key={c.id} style={{ background: c.color }}>{c.emoji}</div>
              ))}
            </div>
            <div className="phone-lines"><span /><span /><span /></div>
          </div>
          <div className="small muted mt-8" style={{ textAlign: 'center' }}>{PLACEMENT[f.placement].label} · {linkLabel(link, suppliers)}</div>
        </div>
      </div>
    </Modal>
  );
}
