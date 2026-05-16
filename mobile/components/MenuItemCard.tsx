// components/MenuItemCard.tsx
import { View, Text, Image, Pressable } from 'react-native';
import { MenuItem } from '../types';

interface Props {
  item: MenuItem;
  onPress: () => void;
}

export function MenuItemCard({ item, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
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
      <View className="flex-1 justify-between p-4">
        <View>
          <Text className="font-serif text-lg text-charcoal" numberOfLines={1}>
            {item.name}
          </Text>
          <Text className="mt-1 text-xs leading-4 text-muted" numberOfLines={2}>
            {item.description}
          </Text>
        </View>
        <View className="flex-row items-center justify-between">
          <Text className="text-base font-semibold text-terracotta">
            ${item.price.toFixed(2)}
          </Text>
          {item.modifierGroups.length > 0 && (
            <Text className="text-xs text-muted">Customize →</Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}