import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CATEGORIES, type ProductCard } from '@taptym/shared';
import { CatalogBlock, emptyFilters, type Sort } from '@/components/catalog';
import { Thumb } from '@/components/product';
import { Chip, price, Row, Screen, styles as ui, Txt } from '@/components/ui';
import { useT } from '@/i18n';
import { api } from '@/lib/api';
import { haptic } from '@/lib/haptics';
import { useApp } from '@/lib/store';
import { C, R, shadow } from '@/lib/theme';

type Suggest = { products: ProductCard[]; words: string[]; categories: string[]; correctedQuery: string | null };

const TRY = ['дептер', 'qalam', 'карандш', 'ручка гелевая', 'рюкзак', 'kalkulyator', 'степлр'];

export default function SearchScreen() {
  const t = useT();
  const lang = useApp((s) => s.lang);
  const params = useLocalSearchParams<{ q?: string; focus?: string; deals?: string; sort?: string; all?: string }>();
  const insets = useSafeAreaInsets();
  const input = useRef<TextInput>(null);
  const [text, setText] = useState(params.q ?? '');
  const [query, setQuery] = useState<string | null>(params.q ?? (params.deals || params.all ? '' : null));
  const [browse, setBrowse] = useState({ deals: params.deals === '1', sort: (params.sort as Sort) || 'popular', nonce: 0 });
  const [sugg, setSugg] = useState<Suggest | null>(null);
  const recent = useApp((s) => s.recent);
  const pushRecent = useApp((s) => s.pushRecent);
  const clearRecent = useApp((s) => s.clearRecent);

  // Deep links from home: focus the field / open a browse list.
  useEffect(() => {
    if (params.focus) {
      setQuery(null);
      setText('');
      setTimeout(() => input.current?.focus(), 250);
    }
  }, [params.focus]);
  useEffect(() => {
    if (params.deals || params.all) {
      setText('');
      setQuery('');
      setBrowse((b) => ({ deals: params.deals === '1', sort: (params.sort as Sort) || 'popular', nonce: b.nonce + 1 }));
    }
  }, [params.deals, params.all, params.sort]);
  useEffect(() => {
    if (params.q) {
      setText(params.q);
      setQuery(params.q);
    }
  }, [params.q]);

  const typing = text.trim().length > 0 && text.trim() !== (query ?? '');
  useEffect(() => {
    if (!typing) return setSugg(null);
    const q = text.trim();
    const h = setTimeout(() => {
      api<Suggest>(`/search/suggest?q=${encodeURIComponent(q)}`)
        .then((r) => setSugg(r))
        .catch(() => {});
    }, 250);
    return () => clearTimeout(h);
  }, [text, typing]);

  const submit = (q: string) => {
    const v = q.trim();
    if (!v) return;
    haptic.tap();
    input.current?.blur();
    setText(v);
    setQuery(v);
    setBrowse((b) => ({ ...b, deals: false, sort: 'popular', nonce: b.nonce + 1 }));
    pushRecent(v);
  };

  const reset = () => {
    setText('');
    setQuery(null);
    input.current?.focus();
  };

  return (
    <Screen
      header={
        <View style={{ paddingTop: insets.top + 10, backgroundColor: C.bg }}>
          <View style={[ui.page, ui.pagePad, { paddingBottom: 10 }]}>
            <View style={s.bar}>
              <Ionicons name="search" size={22} color={C.primary} />
              <TextInput
                ref={input}
                value={text}
                onChangeText={setText}
                onSubmitEditing={() => submit(text)}
                placeholder={t('search_placeholder')}
                placeholderTextColor={C.faint}
                returnKeyType="search"
                autoFocus={!params.q && !params.deals && !params.all}
                autoCorrect={false}
                style={s.input}
                accessibilityLabel={t('tab_search')}
              />
              {text ? (
                <Pressable onPress={reset} hitSlop={10} accessibilityLabel={t('clear')} style={s.clearBtn}>
                  <Ionicons name="close" size={18} color={C.muted} />
                </Pressable>
              ) : null}
              <Pressable onPress={() => submit(text)} style={s.go} accessibilityLabel={t('tab_search')}>
                <Text style={{ color: C.white, fontWeight: '800', fontSize: 14 }}>{t('tab_search')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      }
    >
      {typing ? (
        <Suggestions s={sugg} onWord={submit} lang={lang} />
      ) : query !== null ? (
        <CatalogBlock
          key={`${query}|${browse.nonce}`}
          base={{ q: query || undefined }}
          initialSort={browse.sort}
          initialFilters={{ ...emptyFilters, deals: browse.deals }}
          header={(m) =>
            m ? (
              <View style={{ marginTop: 12, gap: 8 }}>
                {m.correctedQuery ? (
                  <View style={s.corrected}>
                    <Ionicons name="sparkles" size={18} color={C.primary} />
                    <Txt v="body" style={{ flex: 1 }}>
                      {t('corrected', { q: m.correctedQuery })}
                    </Txt>
                  </View>
                ) : null}
                <Txt v="small">{t('found_n', { n: m.total })}</Txt>
              </View>
            ) : null
          }
        />
      ) : (
        <View style={{ gap: 26, marginTop: 6 }}>
          {recent.length ? (
            <View>
              <Row style={{ justifyContent: 'space-between', marginBottom: 10 }}>
                <Txt v="h3">{t('recent')}</Txt>
                <Pressable onPress={clearRecent} hitSlop={10}>
                  <Txt v="bodyBold" color={C.primary}>
                    {t('clear')}
                  </Txt>
                </Pressable>
              </Row>
              <Row wrap gap={8}>
                {recent.map((r) => (
                  <Chip key={r} label={r} icon="time-outline" onPress={() => submit(r)} />
                ))}
              </Row>
            </View>
          ) : null}
          <View style={s.hint}>
            <Text style={{ fontSize: 28 }}>🗣️</Text>
            <Txt v="body" style={{ flex: 1, color: '#3D2A9E' }}>
              {t('multilang_hint')}
            </Txt>
          </View>
          <View>
            <Txt v="h3" style={{ marginBottom: 10 }}>
              {t('try_these')}
            </Txt>
            <Row wrap gap={8}>
              {TRY.map((r) => (
                <Chip key={r} label={r} icon="search" onPress={() => submit(r)} />
              ))}
            </Row>
          </View>
          <View>
            <Txt v="h3" style={{ marginBottom: 10 }}>
              {t('categories')}
            </Txt>
            <View style={{ gap: 8 }}>
              {CATEGORIES.map((c) => (
                <Pressable key={c.id} onPress={() => router.push(`/category/${c.id}`)} style={({ pressed }) => [s.catRow, pressed && { opacity: 0.8 }]}>
                  <View style={[s.catIcon, { backgroundColor: c.color }]}>
                    <Text style={{ fontSize: 22 }}>{c.emoji}</Text>
                  </View>
                  <Txt v="bodyBold" style={{ flex: 1 }}>
                    {c.name[lang] ?? c.name.ru}
                  </Txt>
                  <Ionicons name="chevron-forward" size={18} color={C.faint} />
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      )}
    </Screen>
  );
}

function Suggestions({ s: sg, onWord, lang }: { s: Suggest | null; onWord: (w: string) => void; lang: 'ru' | 'ky' | 'uz' | 'kk' }) {
  const t = useT();
  if (!sg) return <View style={{ height: 200 }} />;
  const cats = CATEGORIES.filter((c) => sg.categories.includes(c.id));
  return (
    <View style={{ gap: 18 }}>
      {sg.correctedQuery ? (
        <Pressable onPress={() => onWord(sg.correctedQuery!)} style={s.corrected}>
          <Ionicons name="sparkles" size={18} color={C.primary} />
          <Txt v="body" style={{ flex: 1 }}>
            {t('corrected', { q: sg.correctedQuery })}
          </Txt>
        </Pressable>
      ) : null}
      {sg.words.length ? (
        <View style={s.box}>
          {sg.words.slice(0, 6).map((w) => (
            <Pressable key={w} onPress={() => onWord(w)} style={({ pressed }) => [s.wordRow, pressed && { backgroundColor: C.surface }]}>
              <Ionicons name="search" size={18} color={C.muted} />
              <Txt v="bodyBold" style={{ flex: 1 }}>
                {w}
              </Txt>
              <Ionicons name="arrow-up-outline" size={18} color={C.faint} style={{ transform: [{ rotate: '-45deg' }] }} />
            </Pressable>
          ))}
        </View>
      ) : null}
      {cats.length ? (
        <Row wrap gap={8}>
          {cats.map((c) => (
            <Pressable key={c.id} onPress={() => router.push(`/category/${c.id}`)} style={[s.catPill, { backgroundColor: c.color }]}>
              <Text style={{ fontSize: 16 }}>{c.emoji}</Text>
              <Txt v="bodyBold" style={{ fontSize: 14 }}>
                {c.name[lang] ?? c.name.ru}
              </Txt>
            </Pressable>
          ))}
        </Row>
      ) : null}
      {sg.products.length ? (
        <View>
          <Txt v="h3" style={{ marginBottom: 8 }}>
            {t('products')}
          </Txt>
          <View style={s.box}>
            {sg.products.slice(0, 6).map((p) => (
              <Pressable key={p.id} onPress={() => router.push(`/product/${p.id}`)} style={({ pressed }) => [s.prodRow, pressed && { backgroundColor: C.surface }]}>
                <Thumb image={p.images[0]} emoji={p.emoji} color={p.color} size={48} radius={14} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Txt v="bodyBold" lines={1}>
                    {p.title}
                  </Txt>
                  <Txt v="small">
                    {t('from_price', { p: price(p.minPrice) })} · {t('offers_n', { n: p.offersCount })}
                  </Txt>
                </View>
                <Ionicons name="chevron-forward" size={18} color={C.faint} />
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
      {!sg.words.length && !sg.products.length && !cats.length ? (
        <Txt v="body" color={C.muted} center style={{ marginTop: 30 }}>
          {t('nothing_found')}
        </Txt>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 58, borderRadius: R.xl, backgroundColor: C.white, paddingLeft: 16, paddingRight: 7, borderWidth: 2, borderColor: C.primary, ...shadow.md },
  input: { flex: 1, fontSize: 17, fontWeight: '600', color: C.ink, height: '100%', minWidth: 0, outlineStyle: 'none' } as object,
  clearBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' },
  go: { height: 44, paddingHorizontal: 14, borderRadius: 16, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },
  hint: { flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: C.primarySoft, borderRadius: R.xl, padding: 16 },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.white, borderRadius: R.lg, padding: 10, paddingRight: 14, minHeight: 60 },
  catIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  corrected: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.accentSoft, borderRadius: R.lg, padding: 14 },
  box: { backgroundColor: C.white, borderRadius: R.xl, overflow: 'hidden', ...shadow.sm },
  wordRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, minHeight: 52 },
  catPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, height: 40, borderRadius: R.pill },
  prodRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, paddingRight: 14 },
});
