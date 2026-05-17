// components/CategoryChips.tsx
import { ScrollView, Pressable, Text } from 'react-native';
import { Category } from '../types';

interface Props {
  categories: (Category | 'All')[];
  selected: Category | 'All';
  onSelect: (cat: Category | 'All') => void;
}

export function CategoryChips({ categories, selected, onSelect }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{
        paddingHorizontal: 20,
        paddingVertical: 12,
        gap: 8,
        alignItems: 'center',
      }}
      style={{ flexGrow: 0 }}
    >
      {categories.map((cat) => {
        const active = cat === selected;
        return (
          <Pressable
            key={cat}
            onPress={() => onSelect(cat)}
            style={{
              height: 36,
              paddingHorizontal: 16,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: active ? '#2A2A2A' : '#E8E0D5',
              backgroundColor: active ? '#2A2A2A' : '#FFFFFF',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Text
              numberOfLines={1}
              style={{
                fontSize: 14,
                color: active ? '#FAF7F2' : '#2A2A2A',
                fontWeight: active ? '600' : '400',
                textAlign: 'center',
                textAlignVertical: 'center',
              }}
            >
              {cat}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
