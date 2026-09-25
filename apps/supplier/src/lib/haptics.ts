import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

const native = Platform.OS !== 'web';

export const haptic = {
  tap: () => native && void Haptics.selectionAsync().catch(() => {}),
  success: () => native && void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}),
  error: () => native && void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {}),
};
