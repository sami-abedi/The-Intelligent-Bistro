// app/chat.tsx
import { useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useChatStore, ChatMessage } from '../stores/useChatStore';
import { useCartStore } from '../stores/cartStore';
import { sendChat, fetchMenu } from '../lib/api';
import { MenuItem } from '../types';
import { ChatBubble } from '../components/ChatBubble';
import { ChatInput } from '../components/ChatInput';
import { ThinkingIndicator } from '../components/ThinkingIndicator';

const SUGGESTED_PROMPTS = [
  "I'd like two spicy chicken sandwiches",
  'What do you recommend?',
  'Add a large lemonade and fries',
];

export default function ChatScreen() {
  const router = useRouter();

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

  const listRef = useRef<FlatList<ChatMessage>>(null);

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
    <SafeAreaView className="flex-1 bg-cream">
      <View className="flex-row items-center justify-between border-b border-border px-5 py-3">
        <Pressable onPress={() => router.back()}>
          <Text className="text-base text-charcoal">Close</Text>
        </Pressable>
        <View className="items-center">
          <Text className="font-serif text-base text-charcoal">Remy</Text>
          <Text className="text-xs text-muted">Your host at Bistro Lumière</Text>
        </View>
        <View className="w-12" />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {messages.length === 0 ? (
          <View className="flex-1 px-5 py-6">
            <Text className="mb-2 text-sm text-muted">Try saying:</Text>
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
          <FlatList
            ref={listRef}
            data={messages}
            renderItem={renderItem}
            keyExtractor={(m) => m.id}
            contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 16 }}
            ListFooterComponent={isThinking ? <ThinkingIndicator /> : null}
          />
        )}

        <ChatInput onSend={handleSend} disabled={isThinking} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
