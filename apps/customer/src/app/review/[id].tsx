import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import type { ProductDetail } from '@taptym/shared';
import { AuthGate } from '@/components/auth-gate';
import { Thumb } from '@/components/product';
import { BottomBar, Button, Card, Field, Header, Row, Screen, Stars, Txt } from '@/components/ui';
import { errorText, useT } from '@/i18n';
import { api, img, uploadImage, useQuery } from '@/lib/api';
import { haptic } from '@/lib/haptics';
import { toast } from '@/lib/store';
import { C, R } from '@/lib/theme';

export default function ReviewScreen() {
  const t = useT();
  return (
    <AuthGate title={t('write_review')}>
      <Inner />
    </AuthGate>
  );
}

function Inner() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useT();
  const p = useQuery<ProductDetail>(`/products/${id}`).data;
  const [rating, setRating] = useState(5);
  const [text, setText] = useState('');
  const [video, setVideo] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);

  const pick = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7, allowsMultipleSelection: true, selectionLimit: 6 - photos.length });
    if (r.canceled) return;
    setUploading(true);
    try {
      for (const a of r.assets.slice(0, 6 - photos.length)) {
        const up = await uploadImage(a);
        setPhotos((ps) => [...ps, up.url]);
      }
    } catch (e) {
      toast(errorText(e), 'error');
    } finally {
      setUploading(false);
    }
  };

  const send = async () => {
    setBusy(true);
    try {
      await api('/reviews', { body: { productId: Number(id), rating, text: text.trim(), photos, videoUrl: video.trim() || undefined } });
      haptic.success();
      toast(t('review_thanks'), 'success');
      if (router.canGoBack()) router.back();
      else router.replace(`/product/${id}`);
    } catch (e) {
      toast(errorText(e), 'error');
      setBusy(false);
    }
  };

  return (
    <Screen
      header={<Header title={t('write_review')} />}
      footer={
        <BottomBar>
          <Button title={t('send')} icon="send" onPress={send} loading={busy} disabled={uploading || rating < 1} style={{ flex: 1 }} />
        </BottomBar>
      }
    >
      <View style={{ maxWidth: 640, width: '100%', alignSelf: 'center', gap: 16 }}>
        {p ? (
          <Card>
            <Row gap={12}>
              <Thumb image={p.images[0]} emoji={p.emoji} color={p.color} size={56} radius={16} />
              <Txt v="bodyBold" lines={2} style={{ flex: 1 }}>
                {p.title}
              </Txt>
            </Row>
          </Card>
        ) : null}
        <Card style={{ alignItems: 'center', gap: 10 }}>
          <Txt v="h3">{t('your_rating')}</Txt>
          <Stars value={rating} onChange={setRating} size={40} />
        </Card>
        <Field value={text} onChangeText={setText} placeholder={t('review_placeholder')} multiline maxLength={2000} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingTop: 8, paddingRight: 8 }}>
          {photos.map((u) => (
            <View key={u}>
              <Image source={{ uri: img(u)! }} style={{ width: 88, height: 88, borderRadius: 18, backgroundColor: C.surface }} contentFit="cover" />
              <Pressable
                onPress={() => setPhotos((ps) => ps.filter((x) => x !== u))}
                style={{ position: 'absolute', top: -6, right: -6, width: 28, height: 28, borderRadius: 14, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' }}
                accessibilityLabel={t('delete')}
              >
                <Ionicons name="close" size={16} color={C.white} />
              </Pressable>
            </View>
          ))}
          {photos.length < 6 ? (
            <Pressable
              onPress={pick}
              disabled={uploading}
              style={{ width: 88, height: 88, borderRadius: 18, borderWidth: 2, borderStyle: 'dashed', borderColor: C.primary, alignItems: 'center', justifyContent: 'center', backgroundColor: C.primarySoft, gap: 4 }}
            >
              {uploading ? <ActivityIndicator color={C.primary} /> : <Ionicons name="camera" size={26} color={C.primary} />}
              <Txt v="tiny" color={C.primary}>
                {uploading ? t('uploading').replace('…', '') : t('add_photo')}
              </Txt>
            </Pressable>
          ) : null}
        </ScrollView>
        <Field value={video} onChangeText={setVideo} placeholder="https://youtube.com/…" label={t('video_link')} icon="videocam-outline" autoCapitalize="none" keyboardType="url" />
        <View style={{ height: R.sm }} />
      </View>
    </Screen>
  );
}
