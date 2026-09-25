import { CATEGORIES, DEMO } from '@taptym/shared';
import { db, get, nowIso, run, tx } from './db.ts';
import { hashPassword } from './http.ts';
import { OSH_LOCATIONS, PRODUCTS, SUPPLIERS } from './seed-data.ts';
import { saveSettings, DEFAULT_SETTINGS } from './settings.ts';

// Deterministic pseudo-random so every reset gives the same demo.
let seed = 42;
const rnd = () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};
const pick = <T>(arr: T[]) => arr[Math.floor(rnd() * arr.length)];
const roundPrice = (v: number) => (v < 100 ? Math.max(5, Math.round(v)) : Math.round(v / 5) * 5);

const REVIEW_TEXTS = [
  'Отличное качество, привезли в тот же день! Рекомендую.',
  'Цена ниже, чем на базаре. Буду заказывать ещё.',
  'Ребёнку понравилось, всё как на фото.',
  'Нормально, но упаковка была немного помята.',
  'Абдан жакшы! Тез жеткирип беришти.',
  'Juda yaxshi, arzon va sifatli.',
  'Өте жақсы, рахмет!',
  'Заказывали для офиса целую коробку — всё чётко, закрывающие документы дали.',
  'Курьер позвонил заранее, очень удобно.',
];
const NAMES = ['Айгерим', 'Бекзат', 'Нургуль', 'Азамат', 'Дилноза', 'Тимур', 'Жылдыз', 'Санжар', 'Мээрим', 'Улан', 'Гульнара', 'Эрлан'];

export function seedDemo() {
  const hasData = get<{ n: number }>('SELECT COUNT(*) AS n FROM products')?.n ?? 0;
  if (hasData) return false;
  const now = Date.now();
  const iso = (msAgo: number) => new Date(now - msAgo).toISOString();
  const DAY = 86400_000;

  tx(() => {
    saveSettings(DEFAULT_SETTINGS);

    const addAdmin = (name: string, email: string, pw: string, role: string, perms: string[]) =>
      run(
        'INSERT INTO admin_users(name, email, password_hash, role, permissions, created_at) VALUES(?,?,?,?,?,?)',
        name,
        email,
        hashPassword(pw),
        role,
        JSON.stringify(perms),
        nowIso(),
      );
    addAdmin('Ахрор (владелец)', DEMO.adminEmail, DEMO.adminPassword, 'owner', []);
    addAdmin('Оператор Айжан', 'operator@taptym.kg', 'operator123', 'operator', ['dashboard', 'orders', 'customers', 'support', 'suppliers']);
    addAdmin('Бухгалтер Нурлан', 'accountant@taptym.kg', 'account123', 'accountant', ['dashboard', 'payouts', 'reports']);

    const supplierIds: number[] = [];
    SUPPLIERS.forEach((s, i) => {
      const phone = `+99655500000${i + 1}`;
      const { lastInsertRowid } = run(
        `INSERT INTO suppliers(name, legal_name, inn, phone, address, lat, lng, logo_emoji, color, description, status, trial_until,
          own_delivery, own_delivery_fee, own_free_from, rating, payout_details, api_token, created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        s.name,
        `ИП «${s.name}»`,
        `2${String(1000000000000 + i * 7919).slice(0, 13)}`,
        phone,
        s.address,
        s.lat,
        s.lng,
        s.emoji,
        s.color,
        s.desc,
        'active',
        new Date(now + s.trialDays * DAY).toISOString(),
        s.own,
        s.fee,
        s.freeFrom,
        s.rating,
        `MBank ${phone}`,
        i === 0 ? 'tk_demo_kanczland_0001' : null,
        iso((30 - s.trialDays) * DAY),
      );
      supplierIds.push(lastInsertRowid);
      run('INSERT INTO supplier_staff(supplier_id, name, phone, role) VALUES(?,?,?,?)', lastInsertRowid, i === 0 ? 'Руслан (владелец)' : 'Владелец', phone, 'owner');
    });
    run('INSERT INTO supplier_staff(supplier_id, name, phone, role) VALUES(?,?,?,?)', supplierIds[0], 'Кассир Гулира', '+996555100002', 'cashier');
    run('INSERT INTO supplier_staff(supplier_id, name, phone, role) VALUES(?,?,?,?)', supplierIds[0], 'Склад Бакыт', '+996555100003', 'warehouse');

    // Each product is sold by 2–5 suppliers at different prices.
    const offerIds: { id: number; productId: number; supplierId: number; price: number; title: string; emoji: string; color: string }[] = [];
    PRODUCTS.forEach((p, idx) => {
      const cat = CATEGORIES.find((c) => c.id === p.c)!;
      const { lastInsertRowid: pid } = run(
        'INSERT INTO products(title, brand, category_id, emoji, color, barcode, description, specs, keywords, created_at) VALUES(?,?,?,?,?,?,?,?,?,?)',
        p.t,
        p.b ?? null,
        p.c,
        p.e,
        cat.color,
        p.bc ?? null,
        p.d ?? `${p.t}${p.b ? ' от ' + p.b : ''}. Оригинальный товар от проверенного поставщика в Оше. Подходит для школы, дома и офиса.`,
        JSON.stringify({ Бренд: p.b ?? '—', ...(p.s ?? {}) }),
        p.k ?? '',
        iso((60 - (idx % 60)) * DAY),
      );
      const count = 2 + Math.floor(rnd() * 4);
      const chosen = new Set<number>();
      if (p.c === 'art') chosen.add(4);
      if (p.c === 'paper' || p.c === 'office' || p.c === 'folders') chosen.add(2);
      if (p.c === 'school' || p.c === 'notebooks') chosen.add(1);
      if (idx % 3 === 0) chosen.add(0);
      while (chosen.size < count) chosen.add(Math.floor(rnd() * SUPPLIERS.length));
      for (const si of chosen) {
        const s = SUPPLIERS[si];
        const price = roundPrice(p.p * s.priceK * (0.94 + rnd() * 0.14));
        const old = rnd() < 0.18 ? roundPrice(price * (1.15 + rnd() * 0.2)) : null;
        const stock = rnd() < 0.06 ? 0 : Math.floor(5 + rnd() * 400);
        const wholesale = p.p < 500 && rnd() < 0.4 ? { price: roundPrice(price * 0.85), from: pick([20, 50, 100]) } : null;
        const { lastInsertRowid } = run(
          'INSERT INTO offers(product_id, supplier_id, price, old_price, wholesale_price, wholesale_from, stock, sku, updated_at) VALUES(?,?,?,?,?,?,?,?,?)',
          pid,
          supplierIds[si],
          price,
          old,
          wholesale?.price ?? null,
          wholesale?.from ?? null,
          stock,
          `SKU-${si + 1}-${idx + 1}`,
          iso(Math.floor(rnd() * 5) * DAY),
        );
        offerIds.push({ id: lastInsertRowid, productId: pid, supplierId: supplierIds[si], price, title: p.t, emoji: p.e, color: cat.color });
      }
      const reviews = Math.floor(rnd() * 5);
      for (let r = 0; r < reviews; r++) {
        run(
          'INSERT INTO reviews(product_id, user_name, supplier_id, rating, text, photos, created_at) VALUES(?,?,?,?,?,?,?)',
          pid,
          pick(NAMES),
          supplierIds[Math.floor(rnd() * supplierIds.length)],
          rnd() < 0.8 ? 5 : 4,
          pick(REVIEW_TEXTS),
          '[]',
          iso(Math.floor(rnd() * 40) * DAY),
        );
      }
    });

    // Customers
    const customers: number[] = [];
    const demoUser = run(
      'INSERT INTO users(phone, name, lang, coins, referral_code, created_at) VALUES(?,?,?,?,?,?)',
      DEMO.customerPhone,
      'Ахрор',
      'ru',
      150,
      'AHROR1',
      iso(40 * DAY),
    ).lastInsertRowid;
    customers.push(demoUser);
    run('INSERT INTO addresses(user_id, label, line, lat, lng) VALUES(?,?,?,?,?)', demoUser, 'Дом', 'Ош, мкр. Черёмушки, 14, кв. 21', 40.5137, 72.8187);
    run('INSERT INTO addresses(user_id, label, line, lat, lng) VALUES(?,?,?,?,?)', demoUser, 'Работа', 'Ош, ул. Ленина, 205, офис 4', 40.5283, 72.7985);
    run('INSERT INTO coin_tx(user_id, amount, reason, created_at) VALUES(?,?,?,?)', demoUser, 150, 'welcome', iso(40 * DAY));
    const school = run(
      'INSERT INTO users(phone, name, lang, coins, referral_code, is_company, company_name, company_inn, created_at) VALUES(?,?,?,?,?,?,?,?,?)',
      '+996700333444',
      'Школа-гимназия №5',
      'ky',
      40,
      'SCHOOL5',
      1,
      'Школа-гимназия №5 им. Ю. Гагарина',
      '01234567890123',
      iso(25 * DAY),
    ).lastInsertRowid;
    customers.push(school);
    run('INSERT INTO addresses(user_id, label, line, lat, lng) VALUES(?,?,?,?,?)', school, 'Школа', 'Ош, ул. Гагарина, 12', 40.5421, 72.7893);
    for (let i = 0; i < 18; i++) {
      const id = run(
        'INSERT INTO users(phone, name, lang, coins, referral_code, created_at) VALUES(?,?,?,?,?,?)',
        `+99677${String(1000000 + i * 37)}`,
        NAMES[i % NAMES.length],
        pick(['ru', 'ky', 'uz', 'ru']),
        Math.floor(rnd() * 80),
        `U${1000 + i}`,
        iso(Math.floor(rnd() * 50) * DAY),
      ).lastInsertRowid;
      const loc = pick(OSH_LOCATIONS);
      run('INSERT INTO addresses(user_id, label, line, lat, lng) VALUES(?,?,?,?,?)', id, 'Дом', loc.line, loc.lat, loc.lng);
      customers.push(id);
    }

    // 30 days of order history (drives dashboards and finances).
    let orderNo = 10001;
    const commissionPct = DEFAULT_SETTINGS.commissionPercent;
    for (let i = 0; i < 140; i++) {
      const userId = i < 6 ? demoUser : pick(customers);
      const created = iso(Math.floor(rnd() * 30 * DAY) + (i < 6 ? 2 * DAY : 0));
      const addr = get<any>('SELECT * FROM addresses WHERE user_id = ? LIMIT 1', userId);
      const lines = Array.from({ length: 1 + Math.floor(rnd() * 3) }, () => pick(offerIds));
      const bySupplier = new Map<number, typeof lines>();
      for (const l of lines) {
        const cur = bySupplier.get(l.supplierId) ?? [];
        if (!cur.find((x) => x.id === l.id)) cur.push(l);
        bySupplier.set(l.supplierId, cur);
      }
      const method = pick(['qr', 'qr', 'qr', 'cash', 'cash', 'card']);
      const ageDays = (now - new Date(created).getTime()) / DAY;
      const status = ageDays > 1.5 ? (rnd() < 0.08 ? 'cancelled' : 'delivered') : pick(['new', 'confirmed', 'assembling', 'in_delivery', 'delivered']);
      let itemsTotal = 0;
      let deliveryTotal = 0;
      const subs: any[] = [];
      for (const [sid, ls] of bySupplier) {
        const qtys = ls.map(() => 1 + Math.floor(rnd() * 4));
        const subtotal = ls.reduce((a, l, k) => a + l.price * qtys[k], 0);
        const sup = get<any>('SELECT * FROM suppliers WHERE id = ?', sid);
        const dm = sup.own_delivery && rnd() < 0.5 ? 'supplier' : pick(['courier', 'courier', 'yandex', 'pickup']);
        const fee = dm === 'pickup' ? 0 : dm === 'supplier' ? sup.own_delivery_fee : 120 + Math.floor(rnd() * 80);
        const inTrial = sup.trial_until > created;
        subs.push({ sid, ls, qtys, subtotal, dm, fee, commission: inTrial ? 0 : Math.round((subtotal * commissionPct) / 100) });
        itemsTotal += subtotal;
        deliveryTotal += fee;
      }
      const orderStatus = status === 'delivered' ? 'completed' : status === 'cancelled' ? 'cancelled' : status === 'new' ? 'placed' : 'in_progress';
      const payStatus = method === 'cash' ? 'cash_on_delivery' : 'paid';
      const total = itemsTotal + deliveryTotal;
      const number = `T-${orderNo++}`;
      const oid = run(
        `INSERT INTO orders(number, user_id, status, payment_method, payment_status, items_total, delivery_total, coins_to_earn, coins_earned, total, address, lat, lng, created_at)
         VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        number,
        userId,
        orderStatus,
        method,
        payStatus,
        itemsTotal,
        deliveryTotal,
        Math.floor(itemsTotal / 100),
        orderStatus === 'completed' ? Math.floor(itemsTotal / 100) : 0,
        total,
        addr.line,
        addr.lat,
        addr.lng,
        created,
      ).lastInsertRowid;
      for (const s of subs) {
        const hist = [{ status: 'new', at: created, by: 'customer' }];
        if (status !== 'new') hist.push({ status, at: created, by: 'Поставщик' });
        const soid = run(
          `INSERT INTO sub_orders(order_id, supplier_id, status, delivery_method, delivery_fee, distance_km, subtotal, commission, history, settled, created_at, updated_at)
           VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,
          oid,
          s.sid,
          status,
          s.dm,
          s.fee,
          Math.round(rnd() * 80) / 10 + 1,
          s.subtotal,
          s.commission,
          JSON.stringify(hist),
          status === 'delivered' ? 1 : 0,
          created,
          created,
        ).lastInsertRowid;
        s.ls.forEach((l: any, k: number) => {
          run(
            'INSERT INTO order_items(sub_order_id, offer_id, product_id, title, emoji, color, price, qty) VALUES(?,?,?,?,?,?,?,?)',
            soid,
            l.id,
            l.productId,
            l.title,
            l.emoji,
            l.color,
            l.price,
            s.qtys[k],
          );
        });
        if (status === 'delivered') {
          const add = (type: string, amount: number, note: string) => {
            if (amount) run('INSERT INTO ledger(supplier_id, type, amount, note, sub_order_id, created_at) VALUES(?,?,?,?,?,?)', s.sid, type, amount, note, soid, created);
          };
          add('sale', s.subtotal, `Продажа · заказ ${number}`);
          if (s.dm === 'supplier') add('sale', s.fee, `Доставка · заказ ${number}`);
          add('commission', -s.commission, `Комиссия ${commissionPct}% · ${number}`);
          if (method === 'cash' && (s.dm === 'supplier' || s.dm === 'pickup')) {
            add('cash_collected', -(s.subtotal + (s.dm === 'supplier' ? s.fee : 0)), `Наличные получены поставщиком · ${number}`);
          }
        }
      }
    }

    // Past payout and a pending request for the payouts screen.
    const s1 = supplierIds[0];
    run('INSERT INTO ledger(supplier_id, type, amount, note, created_at) VALUES(?,?,?,?,?)', s1, 'payout', -5000, 'Выплата #1 · DEMO-A1B2C3', iso(10 * DAY));
    run(
      "INSERT INTO payouts(supplier_id, amount, method, details, status, breakdown, created_at, processed_at, comment) VALUES(?,?,?,?,'paid','{}',?,?,?)",
      s1,
      5000,
      'mbank',
      'MBank +996555000001',
      iso(10 * DAY),
      iso(10 * DAY),
      'Подтверждено по телефону',
    );
    run(
      'INSERT INTO supplier_services(supplier_id, type, title, price, status, starts_at, ends_at, created_at) VALUES(?,?,?,?,?,?,?,?)',
      supplierIds[2],
      'top_search',
      'Топ в поиске и каталоге (7 дней)',
      700,
      'active',
      iso(2 * DAY),
      new Date(now + 5 * DAY).toISOString(),
      iso(2 * DAY),
    );
    run('INSERT INTO ledger(supplier_id, type, amount, note, created_at) VALUES(?,?,?,?,?)', supplierIds[2], 'promotion', -700, 'Топ в поиске и каталоге (7 дней)', iso(2 * DAY));
    const bd = get<any>('SELECT COALESCE(SUM(amount),0) AS b FROM ledger WHERE supplier_id = ?', supplierIds[2]);
    run(
      "INSERT INTO payouts(supplier_id, amount, method, details, status, breakdown, services, created_at) VALUES(?,?,?,?,'requested',?,?,?)",
      supplierIds[2],
      Math.max(1000, Math.floor((bd.b * 0.6) / 100) * 100),
      'bank_account',
      'Р/с 1234 5678 9012 в MBank, ИП «Офис Плюс»',
      '{}',
      JSON.stringify([{ name: 'Топ в поиске и каталоге (7 дней)', amount: 700 }]),
      iso(3 * 3600_000),
    );

    const banner = (title: string, subtitle: string, emoji: string, color: string, placement: string, pos: number, link: string, supplierId: number | null, price = 0) =>
      run(
        'INSERT INTO banners(title, subtitle, emoji, color, text_color, placement, position, link, supplier_id, is_ad, price, created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',
        title,
        subtitle,
        emoji,
        color,
        '#FFFFFF',
        placement,
        pos,
        link,
        supplierId,
        supplierId ? 1 : 0,
        price,
        nowIso(),
      );
    banner('Снова в школу!', 'Соберите портфель дешевле — сравниваем цены всех магазинов Оша', '🎒', '#5B3CF5', 'home_top', 1, 'school', null);
    banner('Первая доставка — бесплатно', 'Курьер Taptym привезёт заказ сегодня', '🛵', '#12B76A', 'home_top', 2, 'promo:WELCOME', null);
    banner('Офис Плюс: бумага А4 от 450 сом', 'Опт для офисов и школ, безнал', '📄', '#1D7AFC', 'home_top', 3, `supplier:${supplierIds[2]}`, supplierIds[2], 2500);
    banner('Кешбэк монетами', '1 монета за каждые 100 сом. Оплачивайте до 30% заказа', '🪙', '#F79009', 'home_middle', 1, 'coins', null);

    const promo = (code: string, type: string, value: number, min: number, maxUses: number, desc: string, supplierId: number | null = null, funded = 'platform', status = 'active') =>
      run(
        'INSERT INTO promo_codes(code, type, value, min_total, max_uses, per_user, supplier_id, funded_by, status, description, created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
        code,
        type,
        value,
        min,
        maxUses,
        1,
        supplierId,
        funded,
        status,
        desc,
        nowIso(),
      );
    promo('WELCOME', 'fixed', 100, 500, 0, 'Скидка 100 сом на заказ от 500 сом');
    promo('SCHOOL2026', 'percent', 10, 1000, 500, 'Снова в школу: −10% от 1000 сом');
    promo('FREEDEL', 'free_delivery', 0, 800, 0, 'Бесплатная доставка от 800 сом');
    promo('KANC15', 'percent', 15, 700, 100, 'Канцлэнд: −15% на всё', supplierIds[0], 'supplier');
    promo('ARZAN50', 'fixed', 50, 400, 200, 'Арзан Канц: −50 сом', supplierIds[3], 'supplier', 'pending');

    const t = run(
      'INSERT INTO threads(kind, user_id, order_id, title, is_return, unread_operator, updated_at, created_at) VALUES(?,?,?,?,?,?,?,?)',
      'customer_support',
      customers[3],
      1,
      'Возврат товара',
      1,
      1,
      iso(3600_000),
      iso(3600_000),
    ).lastInsertRowid;
    run('INSERT INTO messages(thread_id, sender, sender_name, text, created_at) VALUES(?,?,?,?,?)', t, 'customer', NAMES[3], 'Здравствуйте! В наборе фломастеров два не пишут. Можно заменить?', iso(3600_000));
    const t2 = run(
      'INSERT INTO threads(kind, supplier_id, title, unread_operator, updated_at, created_at) VALUES(?,?,?,?,?,?)',
      'supplier_support',
      supplierIds[1],
      'Как загрузить Excel?',
      1,
      iso(7200_000),
      iso(7200_000),
    ).lastInsertRowid;
    run('INSERT INTO messages(thread_id, sender, sender_name, text, created_at) VALUES(?,?,?,?,?)', t2, 'supplier', 'Мектеп Маркет', 'Добрый день, у нас 1200 позиций в 1С. Можете помочь загрузить?', iso(7200_000));
    run(
      'INSERT INTO notifications(audience, target_id, title, body, link, created_at) VALUES(?,?,?,?,?,?)',
      'customer',
      demoUser,
      'Добро пожаловать в Taptym!',
      'Вам начислено 150 монет. Сравнивайте цены и экономьте.',
      '/coins',
      iso(40 * DAY),
    );
  });
  db.exec('PRAGMA optimize');
  return true;
}
