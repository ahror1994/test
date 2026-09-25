import { test } from 'node:test';
import assert from 'node:assert/strict';
import { indexDoc, searchDocs, tokenize, transliterate } from './search.ts';

const docs = [
  { id: 1, title: 'Ручка шариковая синяя', extra: 'Erich Krause Ручки и карандаши' },
  { id: 2, title: 'Тетрадь 48 листов клетка', extra: 'Hatber Тетради' },
  { id: 3, title: 'Бумага А4 500 листов', extra: 'SvetoCopy' },
  { id: 4, title: 'Ластик белый', extra: 'Koh-i-Noor' },
  { id: 5, title: 'Карандаш чернографитный HB', extra: '' },
].map(indexDoc);

const top = (q: string) => searchDocs(q, docs).hits[0]?.id;

test('transliterates Uzbek/Latin to Cyrillic', () => {
  assert.equal(transliterate("qog'oz"), 'когоз');
  assert.equal(transliterate('ruchka'), 'ручка');
});

test('normalizes Kyrgyz/Kazakh letters', () => {
  assert.deepEqual(tokenize('қағаз'), tokenize('кагаз'));
  assert.deepEqual(tokenize('өчүргүч'), tokenize('очургуч'));
});

test('finds products by words in all four languages', () => {
  assert.equal(top('ручка'), 1);
  assert.equal(top('калем'), 1); // ky
  assert.equal(top('дептер'), 2); // ky
  assert.equal(top('дәптер'), 2); // kk
  assert.equal(top('daftar'), 2); // uz
  assert.equal(top("qog'oz"), 3); // uz
  assert.equal(top('өчүргүч'), 4); // ky
  // Ambiguous: uz «qalam» = pencil, kk «қалам» = pen — both must be found.
  const qalam = searchDocs('qalam', docs).hits.map((h) => h.id);
  assert.ok(qalam.includes(5) && qalam.includes(1));
});

test('tolerates typos and reports the correction', () => {
  const r = searchDocs('тетрать', docs);
  assert.equal(r.hits[0]?.id, 2);
  const r2 = searchDocs('карандж', docs);
  assert.equal(r2.hits[0]?.id, 5);
  assert.ok(r2.correctedQuery);
});

test('fixes wrong keyboard layout', () => {
  const r = searchDocs('ntnhflm', docs);
  assert.equal(r.hits[0]?.id, 2);
  assert.equal(r.correctedQuery, 'тетрадь');
});

test('does not "correct" an exact word', () => {
  assert.equal(searchDocs('ручка', docs).correctedQuery, null);
});

test('correction keeps correctly typed words whole', () => {
  const vocab = new Map<string, string>();
  for (const w of ['ручка', 'шариковая', 'синяя', 'тетрадь', 'листов', 'клетка']) vocab.set(tokenize(w)[0], w);
  const r = searchDocs('ручка шариковоя', docs, vocab);
  assert.equal(r.hits[0]?.id, 1);
  assert.equal(r.correctedQuery, 'ручка шариковая');
});
