// src/menu.ts
import { MenuItem } from './types';

const sizeModifier = {
  id: 'size',
  name: 'Size',
  required: true,
  options: [
    { id: 'small', name: 'Small', priceDelta: 0 },
    { id: 'medium', name: 'Medium', priceDelta: 1.5 },
    { id: 'large', name: 'Large', priceDelta: 3 },
  ],
};

const spiceModifier = {
  id: 'spice',
  name: 'Spice Level',
  required: true,
  options: [
    { id: 'mild', name: 'Mild', priceDelta: 0 },
    { id: 'medium-spice', name: 'Medium', priceDelta: 0 },
    { id: 'spicy', name: 'Spicy', priceDelta: 0 },
    { id: 'extra-spicy', name: 'Extra Spicy', priceDelta: 0.5 },
  ],
};

export const MENU: MenuItem[] = [
  {
    id: 'sandwich-spicy-chicken',
    name: 'Spicy Chicken Sandwich',
    description: 'Buttermilk-brined chicken, pickled jalapeños, chipotle aioli, brioche bun.',
    price: 13.5,
    category: 'Sandwiches',
    imageUrl: 'https://images.unsplash.com/photo-1606755962773-d324e0a13086?w=800',
    modifierGroups: [spiceModifier],
  },
  {
    id: 'sandwich-grilled-cheese',
    name: 'Truffle Grilled Cheese',
    description: 'Gruyère, fontina, black truffle butter on sourdough.',
    price: 12,
    category: 'Sandwiches',
    imageUrl: 'https://images.unsplash.com/photo-1528736235302-52922df5c122?w=800',
    modifierGroups: [],
  },
  {
    id: 'sandwich-blta',
    name: 'BLTA',
    description: 'Heritage bacon, heirloom tomato, butter lettuce, avocado, herb mayo.',
    price: 14,
    category: 'Sandwiches',
    imageUrl: 'https://images.unsplash.com/photo-1539252554453-80ab65ce3586?w=800',
    modifierGroups: [],
  },
  {
    id: 'side-fries',
    name: 'Duck Fat Fries',
    description: 'Twice-cooked, rosemary salt, garlic aioli.',
    price: 7,
    category: 'Sides',
    imageUrl: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=800',
    modifierGroups: [],
  },
  {
    id: 'side-salad',
    name: 'Little Gem Caesar',
    description: 'Little gem lettuce, parmesan crisp, white anchovy, lemon dressing.',
    price: 9,
    category: 'Sides',
    imageUrl: 'https://images.unsplash.com/photo-1546793665-c74683f339c1?w=800',
    modifierGroups: [],
  },
  {
    id: 'side-soup',
    name: 'Tomato Bisque',
    description: 'Roasted San Marzano tomatoes, crème fraîche, basil oil.',
    price: 8,
    category: 'Sides',
    imageUrl: 'https://images.unsplash.com/photo-1547592180-85f173990554?w=800',
    modifierGroups: [],
  },
  {
    id: 'drink-water',
    name: 'Sparkling Water',
    description: 'House-made, lightly carbonated, with a twist of lemon.',
    price: 3,
    category: 'Drinks',
    imageUrl: 'https://images.unsplash.com/photo-1523362628745-0c100150b504?w=800',
    modifierGroups: [sizeModifier],
  },
  {
    id: 'drink-lemonade',
    name: 'Lavender Lemonade',
    description: 'Fresh-squeezed lemon, lavender syrup, soda water.',
    price: 5,
    category: 'Drinks',
    imageUrl: 'https://images.unsplash.com/photo-1621263764928-df1444c5e859?w=800',
    modifierGroups: [sizeModifier],
  },
  {
    id: 'drink-coffee',
    name: 'Cold Brew',
    description: '18-hour cold brew, single origin Ethiopian.',
    price: 4.5,
    category: 'Drinks',
    imageUrl: 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=800',
    modifierGroups: [sizeModifier],
  },
  {
    id: 'dessert-tart',
    name: 'Lemon Tart',
    description: 'Meyer lemon curd, brown butter crust, torched meringue.',
    price: 8,
    category: 'Desserts',
    imageUrl: 'https://images.unsplash.com/photo-1519915028121-7d3463d20b13?w=800',
    modifierGroups: [],
  },
  {
    id: 'dessert-cookie',
    name: 'Brown Butter Cookie',
    description: 'Brown butter, dark chocolate, flaky salt. Warm.',
    price: 4,
    category: 'Desserts',
    imageUrl: 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=800',
    modifierGroups: [],
  },
  {
    id: 'dessert-affogato',
    name: 'Affogato',
    description: 'Vanilla bean gelato drowned in fresh espresso.',
    price: 7,
    category: 'Desserts',
    imageUrl: 'https://images.unsplash.com/photo-1517578239113-b03992dcdd25?w=800',
    modifierGroups: [],
  },
];

export function getMenuItemById(id: string): MenuItem | undefined {
  return MENU.find((item) => item.id === id);
}