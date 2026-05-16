// app/cart.tsx
import { View, Text, Pressable, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { fetchMenu } from '../lib/api';
import { useCartStore } from '../stores/cartStore';
import { CartItem, MenuItem } from '../types';

function CartLine({ line, menu }: { line: CartItem; menu: MenuItem[] }) {
  const item = menu.find((m) => m.id === line.menuItemId);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);

  if (!item) return null;

  const linePrice = (() => {
    let p = item.price;
    for (const m of line.modifiers) {
      const g = item.modifierGroups.find((g) => g.id === m.groupId);
      const o = g?.options.find((o) => o.id === m.optionId);
      if (o) p += o.priceDelta;
    }
    return p * line.quantity;
  })();

  const modifierLabels = line.modifiers
    .map((m) => {
      const g = item.modifierGroups.find((g) => g.id === m.groupId);
      const o = g?.options.find((o) => o.id === m.optionId);
      return o?.name;
    })
    .filter(Boolean)
    .join(' · ');

  return (
    <View className="mb-3 rounded-2xl bg-white p-4">
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-3">
          <Text className="font-serif text-base text-charcoal">{item.name}</Text>
          {modifierLabels.length > 0 && (
            <Text className="mt-1 text-xs text-muted">{modifierLabels}</Text>
          )}
        </View>
        <Text className="text-base font-semibold text-charcoal">${linePrice.toFixed(2)}</Text>
      </View>

      <View className="mt-3 flex-row items-center justify-between">
        <View className="flex-row items-center">
          <Pressable
            onPress={() => updateQuantity(line.cartItemId, line.quantity - 1)}
            className="h-8 w-8 items-center justify-center rounded-full bg-cream"
          >
            <Text className="text-charcoal">−</Text>
          </Pressable>
          <Text className="mx-4 text-charcoal">{line.quantity}</Text>
          <Pressable
            onPress={() => updateQuantity(line.cartItemId, line.quantity + 1)}
            className="h-8 w-8 items-center justify-center rounded-full bg-cream"
          >
            <Text className="text-charcoal">+</Text>
          </Pressable>
        </View>
        <Pressable onPress={() => removeItem(line.cartItemId)}>
          <Text className="text-xs text-muted">Remove</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function CartScreen() {
  const router = useRouter();
  const items = useCartStore((s) => s.items);
  const clear = useCartStore((s) => s.clear);
  const subtotal = useCartStore((s) => s.subtotal);
  const { data: menu } = useQuery({ queryKey: ['menu'], queryFn: fetchMenu });

  const total = menu ? subtotal(menu) : 0;

  return (
    <SafeAreaView className="flex-1 bg-cream">
      <View className="flex-row items-center justify-between px-5 py-3">
        <Pressable onPress={() => router.back()}>
          <Text className="text-base text-charcoal">Close</Text>
        </Pressable>
        <Text className="font-serif text-base text-charcoal">Your Order</Text>
        {items.length > 0 ? (
          <Pressable onPress={clear}>
            <Text className="text-xs text-muted">Clear</Text>
          </Pressable>
        ) : (
          <View className="w-10" />
        )}
      </View>

      {items.length === 0 ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="font-serif text-xl text-charcoal">Your table is set.</Text>
          <Text className="mt-2 text-center text-sm text-muted">
            Add something from the menu to get started.
          </Text>
        </View>
      ) : (
        <>
          <FlatList
            data={items}
            keyExtractor={(it) => it.cartItemId}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 140 }}
            renderItem={({ item }) => (menu ? <CartLine line={item} menu={menu} /> : null)}
          />
          <View className="absolute bottom-0 left-0 right-0 border-t border-border bg-cream px-5 py-4">
            <View className="mb-3 flex-row justify-between">
              <Text className="text-muted">Subtotal</Text>
              <Text className="text-base font-semibold text-charcoal">
                ${total.toFixed(2)}
              </Text>
            </View>
            <Pressable className="items-center rounded-2xl bg-charcoal px-5 py-4">
              <Text className="font-semibold text-cream">Place order</Text>
            </Pressable>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}