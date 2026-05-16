// mobile/components/ChatSheet.tsx
import { useCallback, useMemo, useRef, useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetFlatList,
  BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { useQuery } from '@tanstack/react-query';
import { useChatStore, ChatMessage } from '../stores/useChatStore';
import { useCartStore } from '../stores/cartStore';
import { sendChat, fetchMenu } from '../lib/api';
import { MenuItem } from '../types';
import { ChatBubble } from './ChatBubble';
import { ChatInput } from './ChatInput';
import { ThinkingIndicator } from './ThinkingIndicator';

const SUGGESTED_PROMPTS = [
  "I'd like two spicy chicken sandwiches",
  'What do you recommend?',
  'Add a large lemonade and fries',
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function ChatSheet({ isOpen, onClose }: Props) {
  const messages = useChatStore((s) => s.messages);
  const isThinking = useChatStore((s) => s.isThinking);
  const addMessage = useChatStore((s) => s.addMessage);
  const setThinking = useChatStore((s) => s.setThinking);

  const cart = useCartStore((s) => s.items);
  const applyAction = useCartStore((s) => s.applyAction);

  const { data: menu = [] } = useQuery<MenuItem[]>({
    queryKey: ['menu'],
    queryFn: fetchMenu,
  });

  const snapPoints = useMemo(() => ['75%', '95%'], []);
  const sheetRef = useRef<BottomSheet>(null);

  useEffect(() => {
    if (isOpen) {
      sheetRef.current?.snapToIndex(0);
    } else {
      sheetRef.current?.close();
    }
  }, [isOpen]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={0.4}
        pressBehavior="close"
      />
    ),
    []
  );

  const listRef = useRef<any>(null);

  useEffect(() => {
    if (messages.length > 0 || isThinking) {
      setTimeout(() => listRef.current?.scrollToEnd?.({ animated: true }), 50);
    }
  }, [messages.length, isThinking]);

  const handleSend = async (text: string) => {
    addMessage('user', text);
    setThinking(true);

    try {
      const response = await sendChat(
        text,
        cart,
        useChatStore.getState().messages
      );

      for (const action of response.actions) {
        applyAction(action, menu);
      }

      if (response.reply) {
        addMessage('assistant', response.reply);
      }
    } catch (err) {
      addMessage(
        'assistant',
        "Sorry — I couldn't reach the kitchen just now. Try again in a moment?"
      );
    } finally {
      setThinking(false);
    }
  };

  const renderItem = useCallback(
    ({ item }: { item: ChatMessage }) => <ChatBubble message={item} />,
    []
  );

  return (
    <BottomSheet
      ref={sheetRef}
      index={-1}
      snapPoints={snapPoints}
      enablePanDownToClose
      onClose={onClose}
      backdropComponent={renderBackdrop}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      handleIndicatorStyle={{ backgroundColor: '#E8E0D5' }}
      backgroundStyle={{ backgroundColor: '#FAF7F2' }}
    >
      <View className="border-b border-border px-5 py-3">
        <Text className="font-serif text-xl text-charcoal">Remy</Text>
        <Text className="text-xs text-muted">Your host at Bistro Lumière</Text>
      </View>

      {messages.length === 0 ? (
        <View className="flex-1 px-5 py-6">
          <Text className="mb-1 text-sm text-muted">Try saying:</Text>
          <View className="gap-2">
            {SUGGESTED_PROMPTS.map((prompt) => (
              <Pressable
                key={prompt}
                onPress={() => handleSend(prompt)}
                className="self-start rounded-full border border-border bg-white px-4 py-2"
              >
                <Text className="text-sm text-charcoal">{prompt}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : (
        <BottomSheetFlatList
          ref={listRef}
          data={messages}
          renderItem={renderItem}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 16 }}
          ListFooterComponent={isThinking ? <ThinkingIndicator /> : null}
        />
      )}

      <ChatInput onSend={handleSend} disabled={isThinking} />
    </BottomSheet>
  );
}
