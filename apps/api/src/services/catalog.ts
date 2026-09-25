import {
  CATEGORIES,
  indexDoc,
  searchDocs,
  tokenize,
  type IndexedDoc,
  type Offer,
  type ProductCard,
  type ProductDetail,
  type Review,
  type SupplierPublic,
} from '@taptym/shared';
import { all, get, json } from '../db.ts';
import { getSettings } from '../settings.ts';

export function supplierPublic(s: any): SupplierPublic {
  const created = new Date(s.created_at).getTime();
  return {
    id: s.id,
    name: s.name,
    logoEmoji: s.logo_emoji,
    color: s.color,
    address: s.address,
    rating: Math.round(s.rating * 10) / 10,
    ordersCount: s.orders_count ?? 0,
    ownDelivery: !!s.own_delivery,
    isNew: Date.now() - created < 30 * 86400_000,
  };
}

const CARD_SQL = `
SELECT p.*,
  MIN(CASE WHEN o.stock > 0 THEN o.price END) AS min_in_stock,
  MIN(o.price) AS min_price,
  MAX(o.price) AS max_price,
  MAX(o.old_price) AS old_price_max,
  COUNT(o.id) AS offers_count,
  SUM(CASE WHEN o.stock > 0 THEN 1 ELSE 0 END) AS in_stock_count,
  MAX(CASE WHEN ss.id IS NOT NULL THEN 1 ELSE 0 END) AS promoted,
  (SELECT AVG(r.rating) FROM reviews r WHERE r.product_id = p.id AND r.hidden = 0) AS rating,
  (SELECT COUNT(*) FROM reviews r WHERE r.product_id = p.id AND r.hidden = 0) AS reviews_count,
  (SELECT COALESCE(SUM(oi.qty), 0) FROM order_items oi WHERE oi.product_id = p.id) AS sold
FROM products p
JOIN offers o ON o.product_id = p.id AND o.active = 1
JOIN suppliers s ON s.id = o.supplier_id AND s.status = 'active'
LEFT JOIN supplier_services ss ON ss.supplier_id = s.id AND ss.type IN ('top_search','featured') AND ss.status = 'active'
WHERE p.hidden = 0 AND p.moderation = 'approved'
`;

export function toCard(r: any): ProductCard {
  const minPrice = r.min_in_stock ?? r.min_price;
  const oldPrice = r.old_price_max && r.old_price_max > minPrice ? r.old_price_max : null;
  return {
    id: r.id,
    title: r.title,
    brand: r.brand,
    categoryId: r.category_id,
    emoji: r.emoji,
    color: r.color,
    images: json<string[]>(r.images, []),
    minPrice,
    maxPrice: r.max_price,
    oldPrice,
    offersCount: r.offers_count,
    rating: r.rating ? Math.round(r.rating * 10) / 10 : 0,
    reviewsCount: r.reviews_count,
    inStock: r.in_stock_count > 0,
    promoted: !!r.promoted,
    savings: Math.max(0, r.max_price - minPrice),
  };
}

export function cardsByIds(ids: number[]): ProductCard[] {
  if (!ids.length) return [];
  const rows = all(`${CARD_SQL} AND p.id IN (${ids.map(() => '?').join(',')}) GROUP BY p.id`, ...ids);
  const byId = new Map(rows.map((r) => [r.id, toCard(r)]));
  return ids.map((id) => byId.get(id)).filter(Boolean) as ProductCard[];
}

// ---------- search index (rebuilt lazily after catalog changes) ----------

let indexCache: { docs: IndexedDoc[]; vocab: string[]; stems: Map<string, string> } | null = null;
export function invalidateCatalog() {
  indexCache = null;
}

function getIndex() {
  if (indexCache) return indexCache;
  const rows = all<any>(`
    SELECT p.id, p.title, p.brand, p.category_id, p.keywords,
      GROUP_CONCAT(DISTINCT s.name) AS suppliers
    FROM products p
    JOIN offers o ON o.product_id = p.id AND o.active = 1
    JOIN suppliers s ON s.id = o.supplier_id AND s.status = 'active'
    WHERE p.hidden = 0 AND p.moderation = 'approved'
    GROUP BY p.id`);
  const docs = rows.map((r) => {
    const cat = CATEGORIES.find((c) => c.id === r.category_id);
    const catNames = cat ? Object.values(cat.name).join(' ') : '';
    return indexDoc({ id: r.id, title: r.title, extra: [r.brand, catNames, r.keywords, r.suppliers].filter(Boolean).join(' ') });
  });
  const vocab: string[] = [...new Set<string>(rows.flatMap((r) => r.title.toLowerCase().split(/[\s,().]+/)).filter((w: string) => w.length > 2))];
  const stems = new Map<string, string>();
  for (const w of vocab) {
    const st = tokenize(w)[0];
    if (st && !stems.has(st)) stems.set(st, w);
  }
  indexCache = { docs, vocab, stems };
  return indexCache;
}

export interface ListParams {
  q?: string;
  category?: string;
  sort?: 'popular' | 'price_asc' | 'price_desc' | 'rating' | 'new' | 'savings';
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  supplierId?: number;
  deals?: boolean;
  page?: number;
  limit?: number;
}

export function listProducts(p: ListParams) {
  const where: string[] = [];
  const args: any[] = [];
  let scores: Map<number, number> | null = null;
  let correctedQuery: string | null = null;
  if (p.q && p.q.trim()) {
    const idx = getIndex();
    const res = searchDocs(p.q, idx.docs, idx.stems);
    correctedQuery = res.correctedQuery;
    scores = new Map(res.hits.map((h) => [h.id, h.score]));
    if (!scores.size) return { items: [] as ProductCard[], total: 0, correctedQuery, priceRange: null };
    where.push(`p.id IN (${[...scores.keys()].join(',')})`);
  }
  if (p.category) {
    where.push('p.category_id = ?');
    args.push(p.category);
  }
  if (p.supplierId) {
    where.push('p.id IN (SELECT product_id FROM offers WHERE supplier_id = ? AND active = 1)');
    args.push(p.supplierId);
  }
  const sql = `${CARD_SQL}${where.length ? ' AND ' + where.join(' AND ') : ''} GROUP BY p.id`;
  let rows = all<any>(sql, ...args);
  let items = rows.map((r) => ({ card: toCard(r), sold: r.sold as number, created: r.created_at as string }));
  const prices = items.map((i) => i.card.minPrice);
  const priceRange = prices.length ? { min: Math.min(...prices), max: Math.max(...prices) } : null;
  if (p.inStock) items = items.filter((i) => i.card.inStock);
  if (p.minPrice != null) items = items.filter((i) => i.card.minPrice >= p.minPrice!);
  if (p.maxPrice != null) items = items.filter((i) => i.card.minPrice <= p.maxPrice!);
  if (p.deals) items = items.filter((i) => i.card.oldPrice || i.card.savings > 0);

  const sort = p.sort ?? (scores ? undefined : 'popular');
  items.sort((a, b) => {
    switch (sort) {
      case 'price_asc':
        return a.card.minPrice - b.card.minPrice;
      case 'price_desc':
        return b.card.minPrice - a.card.minPrice;
      case 'rating':
        return b.card.rating - a.card.rating || b.card.reviewsCount - a.card.reviewsCount;
      case 'new':
        return b.created.localeCompare(a.created);
      case 'savings':
        return b.card.savings - a.card.savings;
      case 'popular':
        return Number(b.card.promoted) - Number(a.card.promoted) || b.sold - a.sold;
      default: {
        const sa = (scores?.get(a.card.id) ?? 0) + (a.card.promoted ? 0.3 : 0) + (a.card.inStock ? 0.2 : 0);
        const sb = (scores?.get(b.card.id) ?? 0) + (b.card.promoted ? 0.3 : 0) + (b.card.inStock ? 0.2 : 0);
        return sb - sa;
      }
    }
  });
  const limit = p.limit ?? 40;
  const page = Math.max(1, p.page ?? 1);
  const total = items.length;
  return {
    items: items.slice((page - 1) * limit, page * limit).map((i) => i.card),
    total,
    correctedQuery,
    priceRange,
  };
}

export function suggest(q: string) {
  const res = listProducts({ q, limit: 6 });
  const tokens = tokenize(q);
  const words = getIndex()
    .vocab.filter((w) => {
      const wt = tokenize(w)[0];
      return wt && tokens.some((t) => wt.startsWith(t.slice(0, Math.max(2, t.length - 1))));
    })
    .slice(0, 5)
    .map((w) => w.toLowerCase());
  const categories = CATEGORIES.filter((c) =>
    Object.values(c.name).some((n) => tokenize(n).some((nt) => tokens.some((t) => nt.startsWith(t) || t.startsWith(nt)))),
  ).map((c) => c.id);
  return { products: res.items, words, categories, correctedQuery: res.correctedQuery };
}

export function offerRow(r: any): Offer {
  const settings = getSettings();
  const beforeCutoff = new Date().getHours() < settings.sameDayCutoffHour;
  return {
    id: r.id,
    productId: r.product_id,
    supplier: supplierPublic({
      id: r.supplier_id,
      name: r.s_name,
      logo_emoji: r.s_logo,
      color: r.s_color,
      address: r.s_address,
      rating: r.s_rating,
      own_delivery: r.s_own_delivery,
      created_at: r.s_created,
      orders_count: r.s_orders,
    }),
    price: r.price,
    oldPrice: r.old_price,
    stock: r.stock,
    wholesalePrice: r.wholesale_price,
    wholesaleFrom: r.wholesale_from,
    deliveryToday: beforeCutoff && r.stock > 0,
  };
}

export const OFFER_SQL = `
SELECT o.*, s.name AS s_name, s.logo_emoji AS s_logo, s.color AS s_color, s.address AS s_address,
  s.rating AS s_rating, s.own_delivery AS s_own_delivery, s.created_at AS s_created,
  (SELECT COUNT(*) FROM sub_orders so WHERE so.supplier_id = s.id AND so.status = 'delivered') AS s_orders
FROM offers o JOIN suppliers s ON s.id = o.supplier_id AND s.status = 'active'
WHERE o.active = 1`;

export function reviewRow(r: any): Review {
  return {
    id: r.id,
    productId: r.product_id,
    userName: r.user_name,
    rating: r.rating,
    text: r.text,
    photos: json<string[]>(r.photos, []),
    videoUrl: r.video_url,
    createdAt: r.created_at,
    supplierName: r.supplier_name ?? null,
  };
}

export function productDetail(id: number): ProductDetail | null {
  const [card] = cardsByIds([id]);
  const p = get<any>('SELECT * FROM products WHERE id = ?', id);
  if (!card || !p) return null;
  const offers = all(`${OFFER_SQL} AND o.product_id = ? ORDER BY (o.stock > 0) DESC, o.price ASC`, id).map(offerRow);
  const reviews = all(
    `SELECT r.*, s.name AS supplier_name FROM reviews r LEFT JOIN suppliers s ON s.id = r.supplier_id
     WHERE r.product_id = ? AND r.hidden = 0 ORDER BY r.created_at DESC LIMIT 30`,
    id,
  ).map(reviewRow);
  const similarIds = all<{ id: number }>(
    'SELECT id FROM products WHERE category_id = ? AND id != ? AND hidden = 0 ORDER BY RANDOM() LIMIT 10',
    p.category_id,
    id,
  ).map((r) => r.id);
  return {
    ...card,
    description: p.description,
    barcode: p.barcode,
    specs: json<Record<string, string>>(p.specs, {}),
    videoUrl: p.video_url,
    offers,
    reviews,
    similar: cardsByIds(similarIds),
  };
}
