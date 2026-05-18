// app/customize.tsx
import { useState, useMemo } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { fetchMenu } from '../lib/api';
import { useCartStore } from '../stores/cartStore';
import { CartItemModifier } from '../types';

export default function CustomizeScreen() {
  const { itemId } = useLocalSearchParams<{ itemId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: menu } = useQuery({ queryKey: ['menu'], queryFn: fetchMenu });
  const addItem = useCartStore((s) => s.addItem);

  const item = menu?.find((m) => m.id === itemId);

  const [quantity, setQuantity] = useState(1);
  const [selections, setSelections] = useState<Record<string, string>>(() => {
    // Default to first option for each required group
    const defaults: Record<string, string> = {};
    item?.modifierGroups.forEach((g) => {
      if (g.required && g.options.length > 0) defaults[g.id] = g.options[0].id;
    });
    return defaults;
  });

  const total = useMemo(() => {
    if (!item) return 0;
    let price = item.price;
    for (const g of item.modifierGroups) {
      const optId = selections[g.id];
      const opt = g.options.find((o) => o.id === optId);
      if (opt) price += opt.priceDelta;
    }
    return price * quantity;
  }, [item, selections, quantity]);

  if (!item) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-cream">
        <Text className="text-muted">Item not found.</Text>
      </SafeAreaView>
    );
  }

  const handleAdd = () => {
    const modifiers: CartItemModifier[] = Object.entries(selections).map(
      ([groupId, optionId]) => ({ groupId, optionId })
    );
    addItem(item, quantity, modifiers);
    router.back();
  };

  return (
    <SafeAreaView className="flex-1 bg-cream">
      <View className="flex-row items-center justify-between px-5 py-3">
        <Pressable onPress={() => router.back()}>
          <Text className="text-base text-charcoal">Cancel</Text>
        </Pressable>
        <Text className="font-serif text-base text-charcoal">Customize</Text>
        <View className="w-12" />
      </View>

      <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingBottom: 120 }}>
        <Text className="font-serif text-2xl text-charcoal">{item.name}</Text>
        <Text className="mt-1 text-sm text-muted">{item.description}</Text>

        {item.modifierGroups.map((group) => (
          <View key={group.id} className="mt-6">
            <Text className="mb-2 text-xs uppercase tracking-widest text-muted">
              {group.name}
            </Text>
            {group.options.map((opt) => {
              const selected = selections[group.id] === opt.id;
              return (
                <Pressable
                  key={opt.id}
                  onPress={() => setSelections((s) => ({ ...s, [group.id]: opt.id }))}
                  className={`mb-2 flex-row items-center justify-between rounded-xl border px-4 py-3 ${selected ? 'border-terracotta bg-white' : 'border-border bg-white'}`}
                >
                  <Text className="text-charcoal">{opt.name}</Text>
                  <View className="flex-row items-center">
                    {opt.priceDelta > 0 && (
                      <Text className="mr-2 text-xs text-muted">
                        +${opt.priceDelta.toFixed(2)}
                      </Text>
                    )}
                    <View
                      className={`h-5 w-5 rounded-full border-2 ${selected ? 'border-terracotta' : 'border-border'}`}
                    >
                      {selected && <View className="m-auto h-2.5 w-2.5 rounded-full bg-terracotta" />}
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}

        <View className="mt-8">
          <Text className="mb-2 text-xs uppercase tracking-widest text-muted">Quantity</Text>
          <View className="flex-row items-center">
            <Pressable
              onPress={() => setQuantity((q) => Math.max(1, q - 1))}
              className="h-10 w-10 items-center justify-center rounded-full bg-white border border-border"
            >
              <Text className="text-lg text-charcoal">−</Text>
            </Pressable>
            <Text className="mx-6 text-lg text-charcoal">{quantity}</Text>
            <Pressable
              onPress={() => setQuantity((q) => q + 1)}
              className="h-10 w-10 items-center justify-center rounded-full bg-white border border-border"
            >
              <Text className="text-lg text-charcoal">+</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      <View
        className="absolute bottom-0 left-0 right-0 border-t border-border bg-cream px-5 pt-4"
        style={{ paddingBottom: insets.bottom + 16 }}
      >
        <Pressable
          onPress={handleAdd}
          className="flex-row items-center justify-between rounded-2xl bg-terracotta px-5 py-4"
          style={{
            shadowColor: '#000',
            shadowOpacity: 0.15,
            shadowRadius: 6,
            shadowOffset: { width: 0, height: 2 },
            elevation: 4,
          }}
        >
          <Text className="text-cream font-semibold">Add to cart</Text>
          <Text className="text-cream font-semibold">${total.toFixed(2)}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}