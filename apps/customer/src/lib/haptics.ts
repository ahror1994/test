import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

const native = Platform.OS !== 'web';

export const haptic = {
  tap: () => native && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}),
  select: () => native && Haptics.selectionAsync().catch(() => {}),
  success: () => native && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}),
  error: () => native && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {}),
};
