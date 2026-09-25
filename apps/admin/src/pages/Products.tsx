import { useState } from 'react';
import { Eye, EyeOff, Info, Package, Pencil, Search, Star } from 'lucide-react';
import { CATEGORIES, categoryName, formatDate, formatPrice } from '@taptym/shared';
import { patch } from '../api';
import { useApi, useDebounced } from '../hooks';
import { Btn, Chip, Empty, ErrorBox, Field, Modal, PageHead, Switch, TableSkeleton, Tabs, Thumb, UTabs, useToast } from '../ui';

type Product = {
  id: number;
  title: string;
  brand: string | null;
  categoryId: string;
  emoji: string;
  color: string;
  images: string[];
  barcode: string | null;
  hidden: boolean;
  moderation: string;
  offers: number;
  minPrice: number | null;
  maxPrice: number | null;
  creator: string | null;
  keywords: string | null;
  createdAt: string;
};

type Review = { id: number; productId: number; userName: string; rating: number; text: string; createdAt: string; supplierName: string | null; productTitle: string; hidden: boolean };

export default function Products() {
  const [tab, setTab] = useState<'products' | 'reviews'>('products');
  return (
    <>
      <PageHead title="Товары и отзывы" subtitle="Модерация каталога: скрывайте лишнее, правьте названия и ключевые слова для поиска" />
      <UTabs value={tab} onChange={setTab} items={[{ id: 'products', label: 'Товары' }, { id: 'reviews', label: 'Отзывы' }]} />
      <div className="mt-24">{tab === 'products' ? <ProductsTab /> : <ReviewsTab />}</div>
    </>
  );
}

function ProductsTab() {
  const [q, setQ] = useState('');
  const dq = useDebounced(q);
  const [filter, setFilter] = useState<'' | 'hidden' | 'supplier_created'>('');
  const [editing, setEditing] = useState<Product | null>(null);
  const { data, error, loading, reload, setData } = useApi<Product[]>(`/products?q=${encodeURIComponent(dq)}&filter=${filter}`);
  const toast = useToast();

  const toggle = async (p: Product) => {
    setData((l) => l?.map((x) => (x.id === p.id ? { ...x, hidden: !p.hidden } : x)) ?? null);
    try {
      await patch(`/products/${p.id}`, { hidden: !p.hidden });
      toast.ok(p.hidden ? 'Товар снова виден покупателям' : 'Товар скрыт из каталога');
    } catch (e) {
      toast.error(e);
      reload();
    }
  };

  return (
    <>
      <div className="toolbar">
        <Tabs
          value={filter}
          onChange={setFilter}
          items={[
            { id: '', label: 'Все' },
            { id: 'supplier_created', label: 'Созданы магазинами' },
            { id: 'hidden', label: 'Скрытые' },
          ]}
        />
        <div className="search-box">
          <Search size={17} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Название или штрихкод" data-testid="products-search" />
        </div>
      </div>
      <div className="card">
        {error && !data && <div className="card-pad"><ErrorBox error={error} retry={reload} /></div>}
        {!data && loading && <TableSkeleton rows={8} cols={6} />}
        {data?.length === 0 && <Empty icon={<Package size={26} />} title="Товаров не найдено" />}
        {data && data.length > 0 && (
          <div className="table-wrap">
            <table className="table" data-testid="products-table">
              <thead>
                <tr>
                  <th>Товар</th>
                  <th className="hide-md">Категория</th>
                  <th className="r">Предложений</th>
                  <th className="r">Цены</th>
                  <th className="hide-md">Создал</th>
                  <th>Виден</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.map((p) => (
                  <tr key={p.id} className={p.hidden ? 'row-muted' : ''}>
                    <td>
                      <div className="row gap-16">
                        <Thumb emoji={p.emoji} color={p.color} image={p.images[0]} />
                        <div style={{ minWidth: 0 }}>
                          <div className="cell-title ellipsis" style={{ maxWidth: 340 }}>{p.title}</div>
                          <div className="cell-sub">
                            {p.brand ?? 'Без бренда'}
                            {p.barcode && <span className="num"> · {p.barcode}</span>}
                            {p.keywords && <span title={p.keywords}> · 🔎 {p.keywords.split(/[,\s]+/).filter(Boolean).length} слов</span>}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="hide-md">{categoryName(p.categoryId)}</td>
                    <td className="r num">{p.offers}</td>
                    <td className="r num nowrap">
                      {p.minPrice == null ? '—' : p.minPrice === p.maxPrice ? formatPrice(p.minPrice) : `${formatPrice(p.minPrice, false)}–${formatPrice(p.maxPrice ?? 0)}`}
                    </td>
                    <td className="hide-md">{p.creator ? <Chip plain tone="info">{p.creator}</Chip> : <span className="muted small">Площадка</span>}</td>
                    <td><Switch on={!p.hidden} onChange={() => toggle(p)} label="Виден покупателям" /></td>
                    <td className="r"><Btn size="sm" variant="ghost" icon={<Pencil size={15} />} onClick={() => setEditing(p)} title="Редактировать" data-testid={`edit-product-${p.id}`} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {editing && (
        <EditProduct
          p={editing}
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

function EditProduct({ p, onClose, onDone }: { p: Product; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ title: p.title, brand: p.brand ?? '', categoryId: p.categoryId, keywords: p.keywords ?? '', emoji: p.emoji });
  const toast = useToast();
  const submit = async () => {
    await patch(`/products/${p.id}`, { ...f, brand: f.brand || null });
    toast.ok('Товар обновлён');
    onDone();
  };
  return (
    <Modal
      title="Редактировать товар"
      onClose={onClose}
      wide
      footer={
        <>
          <button className="btn" onClick={onClose}>Отмена</button>
          <Btn variant="primary" disabled={!f.title.trim()} onClick={submit} data-testid="product-save">Сохранить</Btn>
        </>
      }
    >
      <div className="grid g-2 gap-16">
        <Field label="Название" className="span-2">
          <input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} data-testid="product-title" />
        </Field>
        <Field label="Бренд">
          <input className="input" value={f.brand} onChange={(e) => setF({ ...f, brand: e.target.value })} placeholder="Erich Krause" />
        </Field>
        <Field label="Эмодзи (если нет фото)">
          <input className="input" value={f.emoji} onChange={(e) => setF({ ...f, emoji: e.target.value })} maxLength={4} />
        </Field>
        <Field label="Категория" className="span-2">
          <div className="cat-pick">
            {CATEGORIES.map((c) => (
              <button key={c.id} type="button" className={f.categoryId === c.id ? 'on' : ''} onClick={() => setF({ ...f, categoryId: c.id })} style={{ ['--c' as string]: c.color }}>
                <span>{c.emoji}</span> {c.name.ru}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Ключевые слова для поиска" className="span-2" hint="Через запятую. Добавьте варианты на кыргызском, узбекском, казахском и частые ошибки — поиск найдёт товар по любому из них.">
          <textarea className="textarea" value={f.keywords} onChange={(e) => setF({ ...f, keywords: e.target.value })} placeholder="ручка, калем, ruchka, qalam, шариковая, синяя" data-testid="product-keywords" />
        </Field>
        <div className="callout primary span-2">
          <Info size={18} />
          <div>Покупатели пишут на разных языках и с ошибками: «тетрадь», «дептер», «daftar». Ключевые слова помогают мультиязычному поиску находить этот товар.</div>
        </div>
      </div>
    </Modal>
  );
}

function ReviewsTab() {
  const { data, error, loading, reload, setData } = useApi<Review[]>('/reviews');
  const toast = useToast();
  const toggle = async (r: Review) => {
    setData((l) => l?.map((x) => (x.id === r.id ? { ...x, hidden: !r.hidden } : x)) ?? null);
    try {
      await patch(`/reviews/${r.id}`, { hidden: !r.hidden });
      toast.ok(r.hidden ? 'Отзыв опубликован' : 'Отзыв скрыт');
    } catch (e) {
      toast.error(e);
      reload();
    }
  };
  if (error && !data) return <ErrorBox error={error} retry={reload} />;
  if (!data && loading) return <div className="card"><TableSkeleton rows={5} cols={3} /></div>;
  if (!data?.length) return <div className="card"><Empty icon={<Star size={26} />} title="Отзывов пока нет" /></div>;
  return (
    <div className="grid g-2">
      {data.map((r) => (
        <div key={r.id} className={`card card-pad review ${r.hidden ? 'row-muted' : ''}`}>
          <div className="row between top">
            <div>
              <b>{r.userName}</b>
              <div className="small muted">{r.productTitle}{r.supplierName ? ` · ${r.supplierName}` : ''}</div>
            </div>
            <span className="stars-sm">{'★'.repeat(Math.round(r.rating))}<span>{'★'.repeat(5 - Math.round(r.rating))}</span></span>
          </div>
          <p className="mt-8">{r.text || <span className="muted">Без текста</span>}</p>
          <div className="row between mt-8">
            <span className="small muted">{formatDate(r.createdAt)}</span>
            <Btn size="sm" variant={r.hidden ? 'soft' : 'ghost'} icon={r.hidden ? <Eye size={14} /> : <EyeOff size={14} />} onClick={() => toggle(r)}>
              {r.hidden ? 'Показать' : 'Скрыть'}
            </Btn>
          </div>
        </div>
      ))}
    </div>
  );
}
