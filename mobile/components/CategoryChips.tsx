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
      contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
      className="py-3"
    >
      {categories.map((cat) => {
        const active = cat === selected;
        return (
          <Pressable
            key={cat}
            onPress={() => onSelect(cat)}
            className={`rounded-full px-4 py-2 ${active ? 'bg-charcoal' : 'bg-white border border-border'}`}
          >
            <Text className={`text-sm ${active ? 'text-cream font-semibold' : 'text-charcoal'}`}>
              {cat}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
