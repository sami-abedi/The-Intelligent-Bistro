// app/index.tsx
import { useState, useMemo } from 'react';
import { View, Text, FlatList, ActivityIndicator, Pressable } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fetchMenu } from '../lib/api';
import { useCartStore } from '../stores/cartStore';
import { Category, MenuItem } from '../types';
import { MenuItemCard } from '../components/MenuItemCard';
import { CategoryChips } from '../components/CategoryChips';
import { ChatFAB } from '../components/ChatFAB';

export default function MenuScreen() {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState<Category | 'All'>('All');

  const { data: menu, isLoading, error } = useQuery({
    queryKey: ['menu'],
    queryFn: fetchMenu,
  });

  const itemCount = useCartStore((s) => s.itemCount());

  const categories = useMemo<(Category | 'All')[]>(
    () => ['All', 'Sandwiches', 'Sides', 'Drinks', 'Desserts'],
    []
  );

  const filtered = useMemo(() => {
    if (!menu) return [];
    if (selectedCategory === 'All') return menu;
    return menu.filter((m) => m.category === selectedCategory);
  }, [menu, selectedCategory]);

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-cream">
        <ActivityIndicator color="#C65D3F" />
        <Text className="mt-3 text-muted">Setting the table...</Text>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-cream px-6">
        <Text className="text-center font-serif text-xl text-charcoal">
          We can't reach the kitchen right now.
        </Text>
        <Text className="mt-2 text-center text-sm text-muted">
          Make sure the backend is running.
        </Text>
      </SafeAreaView>
    );
  }

  const fabBottom = itemCount > 0 ? 96 : 24;

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={['top']}>
      <View className="px-5 pb-1 pt-2">
        <Text className="text-xs uppercase tracking-widest text-muted">Bistro Lumière</Text>
        <Text className="font-serif text-3xl text-charcoal">Today's Menu</Text>
      </View>

      <CategoryChips
        categories={categories}
        selected={selectedCategory}
        onSelect={setSelectedCategory}
      />

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 100 }}
        renderItem={({ item }) => (
          <MenuItemCard
            item={item}
            onPress={() => {
              if (item.modifierGroups.length === 0) {
                useCartStore.getState().addItem(item, 1, []);
              } else {
                router.push({ pathname: '/customize', params: { itemId: item.id } });
              }
            }}
          />
        )}
      />

      {itemCount > 0 && (
        <Pressable
          onPress={() => router.push('/cart')}
          className="absolute bottom-6 left-5 right-5 flex-row items-center justify-between rounded-2xl bg-charcoal px-5 py-4"
        >
          <View className="flex-row items-center">
            <View className="h-7 w-7 items-center justify-center rounded-full bg-terracotta">
              <Text className="text-sm font-bold text-cream">{itemCount}</Text>
            </View>
            <Text className="ml-3 text-cream">View cart</Text>
          </View>
          <Text className="text-cream">→</Text>
        </Pressable>
      )}

      <ChatFAB onPress={() => router.push('/chat')} bottom={fabBottom} />
    </SafeAreaView>
  );
}
