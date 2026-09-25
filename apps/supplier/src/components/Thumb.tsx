import { Text, View } from 'react-native';
import { Image } from 'expo-image';
import { mediaUrl } from '@/lib/api';

export function Thumb({ image, emoji, color = '#EEEAFF', size = 56, radius = 16 }: { image?: string | null; emoji?: string; color?: string; size?: number; radius?: number }) {
  const uri = mediaUrl(image);
  return (
    <View style={{ width: size, height: size, borderRadius: radius, backgroundColor: color, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      {uri ? <Image source={{ uri }} style={{ width: size, height: size }} contentFit="cover" transition={150} /> : <Text style={{ fontSize: size * 0.48 }}>{emoji ?? '📦'}</Text>}
    </View>
  );
}
