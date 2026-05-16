// mobile/components/ThinkingIndicator.tsx
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
} from 'react-native-reanimated';

function Dot({ delay }: { delay: number }) {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 400 }),
          withTiming(0.3, { duration: 400 })
        ),
        -1,
        false
      )
    );
  }, [delay, opacity]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={style}
      className="h-2 w-2 rounded-full bg-charcoal"
    />
  );
}

export function ThinkingIndicator() {
  return (
    <View className="mb-2 max-w-[80%] self-start">
      <View
        className="flex-row items-center gap-1.5 rounded-2xl border border-border bg-white px-4 py-3"
        style={{ borderBottomLeftRadius: 4 }}
      >
        <Dot delay={0} />
        <Dot delay={150} />
        <Dot delay={300} />
      </View>
    </View>
  );
}