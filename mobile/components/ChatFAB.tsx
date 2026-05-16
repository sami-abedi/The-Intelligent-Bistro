// mobile/components/ChatFAB.tsx
import { useEffect } from 'react';
import { Pressable, Text } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
} from 'react-native-reanimated';

interface Props {
  onPress: () => void;
  bottom?: number;
}

export function ChatFAB({ onPress, bottom = 24 }: Props) {
  const scale = useSharedValue(1);

  useEffect(() => {
    // Subtle "alive" pulse every few seconds.
    scale.value = withRepeat(
      withDelay(
        2000,
        withSequence(
          withTiming(1.08, { duration: 500 }),
          withTiming(1, { duration: 500 })
        )
      ),
      -1,
      false
    );
  }, [scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      style={[
        animatedStyle,
        {
          position: 'absolute',
          bottom,
          right: 20,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.18,
          shadowRadius: 10,
          elevation: 6,
        },
      ]}
    >
      <Pressable
        onPress={onPress}
        className="h-14 w-14 items-center justify-center rounded-full bg-terracotta active:bg-terracottaDark"
      >
        <Text className="text-xl text-white">✦</Text>
      </Pressable>
    </Animated.View>
  );
}