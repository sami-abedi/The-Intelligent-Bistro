// app/item-detail.tsx
import { useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  Image,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { useQuery } from '@tanstack/react-query';
import { fetchMenu } from '../lib/api';
import { useCartStore } from '../stores/cartStore';
import { MenuItem } from '../types';

export default function ItemDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const { itemId } = useLocalSearchParams<{ itemId: string }>();

  const sheetHeight = Math.round(screenHeight * 0.75);

  const { data: menu = [] } = useQuery<MenuItem[]>({
    queryKey: ['menu'],
    queryFn: fetchMenu,
  });
  const item = menu.find((m) => m.id === itemId);

  const addItem = useCartStore((s) => s.addItem);

  const translateY = useSharedValue(0);

  const closeSheet = useCallback(() => {
    router.back();
  }, [router]);

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      'worklet';
      if (e.translationY > 0) {
        translateY.value = e.translationY;
      }
    })
    .onEnd((e) => {
      'worklet';
      if (e.translationY > 100 || e.velocityY > 500) {
        translateY.value = withTiming(sheetHeight, { duration: 200 }, () => {
          runOnJS(closeSheet)();
        });
      } else {
        translateY.value = withTiming(0, { duration: 200 });
      }
    });

  const animatedSheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const handleAction = () => {
    if (!item) return;
    if (item.modifierGroups.length === 0) {
      addItem(item, 1, []);
      router.back();
    } else {
      // Swap this sheet for /customize. router.replace pops item-detail and
      // pushes customize in one stack mutation, so "back" from customize
      // returns to the menu, not to this detail sheet.
      router.replace({ pathname: '/customize', params: { itemId: item.id } });
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: 'transparent' }}>
      {/* Backdrop — tap to dismiss */}
      <Pressable
        onPress={closeSheet}
        style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.25)' }}
      />

      {/* Sheet — fixed 75% height; no keyboard handling needed here */}
      <Animated.View
        style={[
          {
            height: sheetHeight,
            backgroundColor: '#FAF7F2',
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            overflow: 'hidden',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.1,
            shadowRadius: 8,
            elevation: 8,
          },
          animatedSheetStyle,
        ]}
      >
        {/* Drag handle — gesture-active zone */}
        <GestureDetector gesture={panGesture}>
          <View
            style={{
              alignItems: 'center',
              paddingTop: 8,
              paddingBottom: 4,
              backgroundColor: '#FAF7F2',
            }}
          >
            <View
              style={{
                width: 40,
                height: 4,
                borderRadius: 2,
                backgroundColor: '#D4CCBF',
              }}
            />
          </View>
        </GestureDetector>

        {item ? (
          <>
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingBottom: 24 }}
              showsVerticalScrollIndicator={false}
            >
              <Image
                source={{ uri: item.imageUrl }}
                style={{ width: '100%', height: 200 }}
                resizeMode="cover"
              />

              <Text className="font-serif text-2xl text-charcoal px-5 pt-4">
                {item.name}
              </Text>

              <Text className="text-base text-muted px-5 pt-2">
                {item.description}
              </Text>

              <Text className="text-xs uppercase tracking-wider text-muted px-5 pt-4">
                Ingredients
              </Text>
              <Text className="text-base text-charcoal px-5 pt-1">
                {item.ingredients.join(', ')}
              </Text>

              <Text className="text-xs uppercase tracking-wider text-muted px-5 pt-4">
                Nutrition
              </Text>
              <View className="flex-row px-5 pt-2">
                <View className="flex-1">
                  <Text className="text-xs text-muted">Cal</Text>
                  <Text className="text-base text-charcoal">{item.calories}</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-xs text-muted">Protein</Text>
                  <Text className="text-base text-charcoal">{item.protein}g</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-xs text-muted">Carbs</Text>
                  <Text className="text-base text-charcoal">{item.carbs}g</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-xs text-muted">Fiber</Text>
                  <Text className="text-base text-charcoal">{item.fiber}g</Text>
                </View>
              </View>
            </ScrollView>

            <View
              className="border-t border-border bg-cream px-5 pt-4"
              style={{ paddingBottom: insets.bottom + 16 }}
            >
              <Pressable
                onPress={handleAction}
                className="items-center rounded-2xl bg-terracotta px-5 py-4"
                style={{
                  shadowColor: '#000',
                  shadowOpacity: 0.15,
                  shadowRadius: 6,
                  shadowOffset: { width: 0, height: 2 },
                  elevation: 4,
                }}
              >
                <Text className="font-semibold text-cream">
                  {item.modifierGroups.length === 0
                    ? `Add to cart — $${item.price.toFixed(2)}`
                    : 'Customize'}
                </Text>
              </Pressable>
            </View>
          </>
        ) : (
          <View className="flex-1 items-center justify-center px-6">
            <Text className="text-muted">Item not found.</Text>
          </View>
        )}
      </Animated.View>
    </View>
  );
}
