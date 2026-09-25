/**
 * Multilingual fuzzy search for RU / KY / UZ / KK queries.
 * Pipeline: normalize letters → transliterate Latin to Cyrillic → light stemming →
 * synonym expansion to canonical Russian stems → exact / prefix / typo-tolerant matching.
 */

const CHAR_MAP: Record<string, string> = {
  ё: 'е', й: 'и', ъ: '', ь: '',
  ң: 'н', ө: 'о', ү: 'у', // kyrgyz
  қ: 'к', ғ: 'г', ә: 'а', і: 'и', ұ: 'у', һ: 'х', // kazakh
  ў: 'у', ҳ: 'х', // uzbek cyrillic
};

const LATIN_DIGRAPHS: [string, string][] = [
  ["o'", 'о'], ['o‘', 'о'], ['oʻ', 'о'], ["g'", 'г'], ['g‘', 'г'], ['gʻ', 'г'],
  ['shch', 'щ'], ['sch', 'щ'], ['sh', 'ш'], ['ch', 'ч'], ['zh', 'ж'], ['kh', 'х'], ['ts', 'ц'],
  ['yo', 'е'], ['yu', 'ю'], ['ya', 'я'], ['ye', 'е'],
];

const LATIN_SINGLE: Record<string, string> = {
  a: 'а', b: 'б', c: 'к', d: 'д', e: 'е', f: 'ф', g: 'г', h: 'х', i: 'и', j: 'ж', k: 'к', l: 'л',
  m: 'м', n: 'н', o: 'о', p: 'п', q: 'к', r: 'р', s: 'с', t: 'т', u: 'у', v: 'в', w: 'в', x: 'х',
  y: 'и', z: 'з',
};

// Common keyboard-layout mistake: Russian typed on an English layout ("ntnhflm" → "тетрадь").
const EN_TO_RU_LAYOUT: Record<string, string> = {
  q: 'й', w: 'ц', e: 'у', r: 'к', t: 'е', y: 'н', u: 'г', i: 'ш', o: 'щ', p: 'з', '[': 'х', ']': 'ъ',
  a: 'ф', s: 'ы', d: 'в', f: 'а', g: 'п', h: 'р', j: 'о', k: 'л', l: 'д', ';': 'ж', "'": 'э',
  z: 'я', x: 'ч', c: 'с', v: 'м', b: 'и', n: 'т', m: 'ь', ',': 'б', '.': 'ю',
};

export function transliterate(latin: string): string {
  let s = latin.toLowerCase();
  for (const [from, to] of LATIN_DIGRAPHS) s = s.split(from).join(to);
  let out = '';
  for (const ch of s) out += LATIN_SINGLE[ch] ?? ch;
  return out;
}

function fromWrongLayout(s: string): string {
  let out = '';
  for (const ch of s.toLowerCase()) out += EN_TO_RU_LAYOUT[ch] ?? ch;
  return out;
}

export function normalizeText(input: string): string {
  let s = input.toLowerCase();
  let out = '';
  for (const ch of s) out += CHAR_MAP[ch] ?? ch;
  return out.replace(/[^a-zа-я0-9'‘ʻ\s-]/g, ' ').replace(/\s+/g, ' ').trim();
}

const SUFFIXES = [
  'ами', 'ями', 'ого', 'его', 'ому', 'ему', 'ыми', 'ими', 'лар', 'лер', 'дар', 'дер', 'тар', 'тер',
  'ах', 'ях', 'ов', 'ев', 'еи', 'ои', 'ыи', 'ии', 'ая', 'яя', 'ое', 'ее', 'ые', 'ие', 'ую', 'юю', 'ом', 'ем',
  'а', 'я', 'ы', 'и', 'о', 'е', 'у', 'ю',
];

export function stem(token: string): string {
  if (token.length <= 4 || /^\d/.test(token)) return token;
  for (const suf of SUFFIXES) {
    if (token.endsWith(suf) && token.length - suf.length >= 3) return token.slice(0, -suf.length);
  }
  return token;
}

function toCyrTokens(raw: string): string[] {
  const norm = normalizeText(raw);
  if (!norm) return [];
  return norm
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((t) => (/[a-z]/.test(t) ? normalizeText(transliterate(t)) : t))
    .map((t) => t.replace(/['‘ʻ]/g, ''))
    .filter(Boolean);
}

export function tokenize(raw: string): string[] {
  return toCyrTokens(raw).map(stem);
}

// Word groups in RU / KY / KK / UZ (Latin and Cyrillic) + English + frequent misspellings.
// The first word of every group is the canonical Russian term.
const SYNONYM_GROUPS: string[][] = [
  ['ручка', 'ручки', 'калем', 'калемсап', 'калем сап', 'қаламсап', 'қалам', 'ruchka', 'pen', 'авторучка', 'гелевая', 'шариковая', 'ручк'],
  ['карандаш', 'карандаштар', 'қарындаш', 'qalam', 'qalamcha', 'pencil', 'каранлаш', 'карандош'],
  ['тетрадь', 'тетради', 'дептер', 'дәптер', 'daftar', 'дафтар', 'notebook', 'тетрать', 'тетрадка'],
  ['блокнот', 'блокноттор', 'bloknot', 'ежедневник', 'kundalik', 'күндөлүк', 'күнделік', 'planner'],
  ['бумага', 'кагаз', 'қағаз', "qog'oz", 'когоз', 'paper', 'а4', 'a4', 'бумаги'],
  ['ластик', 'резинка', 'өчүргүч', 'өшіргіш', "o'chirg'ich", 'очиргич', 'eraser', 'стерка'],
  ['линейка', 'сызгыч', 'сызғыш', "chizg'ich", 'чизгич', 'ruler', 'лейнейка'],
  ['ножницы', 'кайчы', 'қайшы', 'qaychi', 'scissors', 'ножници'],
  ['клей', 'желим', 'желім', 'yelim', 'елим', 'glue', 'клеи'],
  ['краски', 'краска', 'боёк', 'бояу', "bo'yoq", 'боек', 'paint', 'акварель', 'гуашь'],
  ['фломастер', 'фломастеры', 'flomaster', 'marker', 'маркер', 'фламастер'],
  ['рюкзак', 'ранец', 'сумка', 'портфель', 'ryukzak', 'рукзак', 'backpack', 'баштык'],
  ['пенал', 'penal', 'pencil case', 'пинал'],
  ['степлер', 'stapler', 'степлер', 'степлр'],
  ['скрепки', 'скрепка', 'skrepka', 'clip', 'кыскыч'],
  ['папка', 'папкалар', 'papka', 'folder', 'файл', 'файлы', 'fayl'],
  ['калькулятор', 'kalkulyator', 'calculator', 'калкулятор', 'эсептегич', 'есептегіш'],
  ['точилка', 'учтагыч', 'ұштағыш', "o'tkirlagich", 'sharpener', 'тачилка'],
  ['альбом', 'albom', 'album', 'рисования', 'сурот', 'сурет', 'rasm'],
  ['пластилин', 'plastilin', 'plasticine', 'пластелин'],
  ['школа', 'мектеп', 'maktab', 'school', 'школьный', 'школьные'],
  ['офис', 'кеңсе', 'кенсе', 'ofis', 'office', 'idora'],
  ['детский', 'балдар', 'балалар', 'bolalar', 'kids', 'дети'],
  ['синий', 'көк', 'кок', "ko'k", 'blue', 'синяя', 'синие'],
  ['красный', 'кызыл', 'қызыл', 'qizil', 'red', 'красная'],
  ['черный', 'кара', 'қара', 'qora', 'black', 'чёрный', 'черная'],
  ['зеленый', 'жашыл', 'жасыл', 'yashil', 'green', 'зеленая'],
  ['цветной', 'цветные', 'түстүү', 'түрлі-түсті', 'rangli', 'color', 'colored'],
  ['дешево', 'дешевый', 'арзан', 'arzon', 'cheap', 'дешевые'],
  ['мел', 'бор', "bo'r", 'chalk'],
  ['доска', 'такта', 'тақта', 'doska', 'board'],
  ['глобус', 'globus', 'globe'],
  ['скотч', 'лента', 'skotch', 'tape'],
  ['конверт', 'konvert', 'envelope'],
  ['стикеры', 'стикер', 'стикерлер', 'stiker', 'sticky', 'закладки'],
];

const synonymIndex = new Map<string, Set<string>>();
(function buildSynonyms() {
  for (const group of SYNONYM_GROUPS) {
    const stems = new Set<string>();
    for (const w of group) for (const t of tokenize(w)) stems.add(t);
    for (const s of stems) {
      const existing = synonymIndex.get(s) ?? new Set<string>();
      for (const x of stems) existing.add(x);
      synonymIndex.set(s, existing);
    }
  }
})();

export function expandToken(token: string): string[] {
  const out = new Set<string>([token]);
  const syn = synonymIndex.get(token);
  if (syn) for (const s of syn) out.add(s);
  return [...out];
}

export function damerauLevenshtein(a: string, b: string, max = 3): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const d: number[][] = [];
  for (let i = 0; i <= a.length; i++) d[i] = [i];
  for (let j = 0; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    let rowMin = Infinity;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
      rowMin = Math.min(rowMin, d[i][j]);
    }
    if (rowMin > max) return max + 1;
  }
  return d[a.length][b.length];
}

function allowedTypos(len: number): number {
  if (len <= 3) return 0;
  if (len <= 5) return 1;
  return 2;
}

export interface SearchDoc {
  id: number;
  /** Most important text: product title. */
  title: string;
  /** Brand, category names in all languages, keywords, supplier names. */
  extra: string;
}

export interface IndexedDoc {
  id: number;
  titleTokens: string[];
  extraTokens: string[];
}

export function indexDoc(doc: SearchDoc): IndexedDoc {
  return { id: doc.id, titleTokens: tokenize(doc.title), extraTokens: tokenize(doc.extra) };
}

interface TokenMatch {
  score: number;
  fuzzy: boolean;
  matched: string;
}

function matchToken(q: string, candidates: string[], tokens: string[]): TokenMatch | null {
  let best: TokenMatch | null = null;
  const consider = (m: TokenMatch) => {
    if (!best || m.score > best.score) best = m;
  };
  for (const t of tokens) {
    for (const c of candidates) {
      const synonym = c !== q;
      const penalty = synonym ? 0.05 : 0;
      if (t === c) consider({ score: 1 - penalty, fuzzy: false, matched: t });
      else if (c.length >= 2 && t.startsWith(c)) consider({ score: 0.85 - penalty, fuzzy: false, matched: t });
      else if (c.length >= 4 && t.includes(c)) consider({ score: 0.6 - penalty, fuzzy: false, matched: t });
    }
    if (!best || (best as TokenMatch).score < 0.8) {
      const maxD = allowedTypos(q.length);
      if (maxD > 0) {
        const cmp = t.length > q.length + 1 ? t.slice(0, q.length + 1) : t;
        const d = Math.min(damerauLevenshtein(q, t, maxD), damerauLevenshtein(q, cmp, maxD));
        if (d <= maxD) consider({ score: 0.75 - d * 0.1, fuzzy: true, matched: t });
      }
    }
  }
  return best;
}

export interface SearchHit {
  id: number;
  score: number;
}

export interface SearchResult {
  hits: SearchHit[];
  /** Set when results come from typo correction or keyboard-layout fix. */
  correctedQuery: string | null;
}

function runSearch(query: string, docs: IndexedDoc[]): { hits: SearchHit[]; fuzzyWords: Map<string, string> } {
  const qTokens = tokenize(query);
  const fuzzyWords = new Map<string, string>();
  const exactTokens = new Set<string>();
  if (!qTokens.length) return { hits: [], fuzzyWords };
  const expanded = qTokens.map((q) => ({ q, candidates: expandToken(q) }));
  const hits: SearchHit[] = [];
  for (const doc of docs) {
    let total = 0;
    let matched = 0;
    for (const { q, candidates } of expanded) {
      const inTitle = matchToken(q, candidates, doc.titleTokens);
      const inExtra = matchToken(q, candidates, doc.extraTokens);
      const titleScore = inTitle ? inTitle.score * 1.5 : 0;
      const extraScore = inExtra ? inExtra.score : 0;
      const s = Math.max(titleScore, extraScore);
      if (s > 0) {
        matched++;
        total += s;
        const m = titleScore >= extraScore ? inTitle : inExtra;
        if (m?.fuzzy) {
          if (!fuzzyWords.has(q) || titleScore > 0) fuzzyWords.set(q, m.matched);
        } else exactTokens.add(q);
      }
    }
    if (matched === 0) continue;
    const coverage = matched / expanded.length;
    if (expanded.length > 1 && coverage < 0.5) continue;
    hits.push({ id: doc.id, score: total * coverage * coverage });
  }
  hits.sort((a, b) => b.score - a.score);
  // A word found exactly somewhere was not a typo.
  for (const q of exactTokens) fuzzyWords.delete(q);
  return { hits, fuzzyWords };
}

/** `vocabulary` maps a stem back to a readable word for the "showing results for…" hint. */
export function searchDocs(query: string, docs: IndexedDoc[], vocabulary?: Map<string, string>): SearchResult {
  const direct = runSearch(query, docs);
  const strong = direct.hits.filter((h) => h.score >= 1);
  if (strong.length === 0 && /[a-z]/i.test(query)) {
    const relaid = fromWrongLayout(query);
    const alt = runSearch(relaid, docs);
    if (alt.hits.length && (alt.hits[0]?.score ?? 0) > (direct.hits[0]?.score ?? 0)) {
      return { hits: alt.hits, correctedQuery: relaid.toLowerCase() };
    }
  }
  let corrected: string | null = null;
  if (direct.fuzzyWords.size && direct.hits.length) {
    corrected = tokenize(query)
      .map((t) => {
        const fixed = direct.fuzzyWords.get(t);
        return fixed ? (vocabulary?.get(fixed) ?? fixed) : t;
      })
      .join(' ');
  }
  return { hits: direct.hits, correctedQuery: corrected };
}
