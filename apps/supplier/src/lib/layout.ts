import { useWindowDimensions } from 'react-native';
import { WIDE } from './theme';

export function useLayout() {
  const { width, height } = useWindowDimensions();
  const wide = width >= WIDE;
  return { width, height, wide, cols: width >= 1180 ? 3 : width >= 680 ? 2 : 1 };
}
