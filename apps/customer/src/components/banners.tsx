import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import type { Banner } from '@taptym/shared';
import { openBannerLink } from '@/lib/actions';
import { C, gradient, R } from '@/lib/theme';
import { useT } from '@/i18n';

export function BannerCard({ b, width, height = 156 }: { b: Banner; width: number; height?: number }) {
  const t = useT();
  // Titles that would not fit two lines at full size get a third line and a smaller font.
  const long = height >= 150 && b.title.length > (width - 130) / 9;
  return (
    <Pressable
      onPress={() => openBannerLink(b.link)}
      style={({ pressed }) => [
        s.banner,
        { width, height },
        gradient(`linear-gradient(135deg, ${b.color} 0%, ${shade(b.color, -28)} 100%)`, b.color),
        pressed && { opacity: 0.92 },
      ]}
      accessibilityRole="button"
      accessibilityLabel={b.title}
    >
      <View style={s.bubble} />
      <View style={[s.bubble, { right: -10, top: 70, width: 90, height: 90, opacity: 0.1 }]} />
      <View style={{ flex: 1, paddingRight: 90, justifyContent: 'center', gap: 6 }}>
        <Text style={[s.title, long && s.titleLong, { color: b.textColor || '#fff' }]} numberOfLines={long ? 3 : 2}>
          {b.title}
        </Text>
        <Text style={[s.sub, { color: b.textColor || '#fff' }]} numberOfLines={long ? 2 : 3}>
          {b.subtitle}
        </Text>
      </View>
      <Text style={s.emoji}>{b.emoji}</Text>
      {b.isAd ? (
        <View style={s.ad}>
          <Text style={s.adText}>{t('ad')}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export function BannerCarousel({ banners, width }: { banners: Banner[]; width: number }) {
  const ref = useRef<ScrollView>(null);
  const [idx, setIdx] = useState(0);
  const gap = 12;
  const step = width + gap;
  const dragging = useRef(false);

  useEffect(() => {
    if (banners.length < 2) return;
    const h = setInterval(() => {
      if (dragging.current) return;
      setIdx((i) => {
        const n = (i + 1) % banners.length;
        ref.current?.scrollTo({ x: n * step, animated: true });
        return n;
      });
    }, 4500);
    return () => clearInterval(h);
  }, [banners.length, step]);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / step);
    if (i !== idx && i >= 0 && i < banners.length) setIdx(i);
  };

  if (!banners.length) return null;
  return (
    <View>
      <ScrollView
        ref={ref}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={step}
        decelerationRate="fast"
        disableIntervalMomentum
        onScroll={onScroll}
        scrollEventThrottle={32}
        onScrollBeginDrag={() => (dragging.current = true)}
        onScrollEndDrag={() => (dragging.current = false)}
        contentContainerStyle={{ gap }}
      >
        {banners.map((b) => (
          <BannerCard key={b.id} b={b} width={width} />
        ))}
      </ScrollView>
      {banners.length > 1 ? (
        <View style={s.dots}>
          {banners.map((b, i) => (
            <Pressable
              key={b.id}
              hitSlop={6}
              onPress={() => {
                setIdx(i);
                ref.current?.scrollTo({ x: i * step, animated: true });
              }}
              style={[s.dot, i === idx && s.dotOn]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** Darkens (negative) or lightens a hex colour by `pct` percent. */
function shade(hex: string, pct: number) {
  const m = hex.replace('#', '');
  if (m.length !== 6) return hex;
  const n = parseInt(m, 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(c + (pct / 100) * (pct < 0 ? c : 255 - c))));
  const r = f((n >> 16) & 255);
  const g = f((n >> 8) & 255);
  const b = f(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

const s = StyleSheet.create({
  banner: { borderRadius: R.xxl, padding: 20, overflow: 'hidden', flexDirection: 'row' },
  bubble: { position: 'absolute', right: 30, top: -40, width: 140, height: 140, borderRadius: 70, backgroundColor: '#fff', opacity: 0.12 },
  title: { fontSize: 21, lineHeight: 25, fontWeight: '800', letterSpacing: -0.5 },
  titleLong: { fontSize: 19, lineHeight: 23 },
  sub: { fontSize: 13, lineHeight: 18, fontWeight: '600', opacity: 0.9 },
  emoji: { position: 'absolute', right: 18, bottom: 16, fontSize: 64 },
  ad: { position: 'absolute', right: 12, top: 12, backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: R.pill, paddingHorizontal: 8, paddingVertical: 2 },
  adText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 10 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#D5D7E0' },
  dotOn: { width: 20, backgroundColor: C.primary },
});
