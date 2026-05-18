// components/MenuItemCard.tsx
import { View, Text, Image, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { MenuItem } from '../types';

interface Props {
  item: MenuItem;
  onPress: () => void;
}

export function MenuItemCard({ item, onPress }: Props) {
  const scale = useSharedValue(1);

  const animatedAddButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <View
      className="mb-4 flex-row overflow-hidden rounded-2xl bg-white"
      style={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 2,
      }}
    >
      <Image source={{ uri: item.imageUrl }} className="h-28 w-28" resizeMode="cover" />
      <View className="flex-1 justify-between p-4 pr-14">
        <View>
          <Text className="font-serif text-lg text-charcoal" numberOfLines={1}>
            {item.name}
          </Text>
          <Text className="mt-1 text-xs leading-4 text-muted" numberOfLines={2}>
            {item.description}
          </Text>
        </View>
        <Text className="text-base font-semibold text-terracotta">
          ${item.price.toFixed(2)}
        </Text>
      </View>

      {/* "+" button. Absolutely positioned so card layout is unaffected.
          The card body itself is no longer interactive — only this button
          adds to cart (or opens customize for items with modifiers).
          Scales down on pressIn and back on pressOut for ~150ms of tactile
          feedback. */}
      <Animated.View
        style={[
          { position: 'absolute', bottom: 10, right: 10 },
          animatedAddButtonStyle,
        ]}
      >
        <Pressable
          onPress={onPress}
          onPressIn={() => {
            scale.value = withTiming(0.9, { duration: 75 });
          }}
          onPressOut={() => {
            scale.value = withTiming(1, { duration: 75 });
          }}
          hitSlop={8}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: '#C65D3F',
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.2,
            shadowRadius: 4,
            elevation: 4,
          }}
        >
          <Text
            style={{
              color: '#FFFFFF',
              fontSize: 22,
              fontWeight: '600',
              lineHeight: 24,
              textAlign: 'center',
              includeFontPadding: false,
            }}
          >
            +
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}
