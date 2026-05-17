// app/chat.tsx
import { useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  FlatList,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
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
  const insets = useSafeAreaInsets();

  const messages = useChatStore((s) => s.messages);
  const isThinking = useChatStore((s) => s.isThinking);
  const lastSuggestions = useChatStore((s) => s.lastSuggestions);
  const addMessage = useChatStore((s) => s.addMessage);
  const setThinking = useChatStore((s) => s.setThinking);
  const setLastSuggestions = useChatStore((s) => s.setLastSuggestions);

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
    setLastSuggestions([]);
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

      setLastSuggestions(response.suggestions ?? []);
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
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#FAF7F2' }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 10 : 0}
    >
      <SafeAreaView className="flex-1 bg-cream" edges={['bottom']}>
        <View className="flex-row items-center justify-between border-b border-border px-5 py-3">
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Text className="text-base text-charcoal">Close</Text>
          </Pressable>
          <View className="items-center">
            <Text className="font-serif text-base text-charcoal">Remy</Text>
            <Text className="text-xs text-muted">Your host at Bistro Lumière</Text>
          </View>
          <View className="w-12" />
        </View>

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
            keyboardShouldPersistTaps="handled"
          />
        )}

        {lastSuggestions.length > 0 && !isThinking && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingVertical: 8,
              gap: 8,
              alignItems: 'center',
            }}
            style={{ flexGrow: 0 }}
          >
            {lastSuggestions.map((suggestion) => (
              <Pressable
                key={suggestion}
                onPress={() => handleSend(suggestion)}
                style={{
                  height: 40,
                  paddingHorizontal: 14,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: '#C65D3F',
                  backgroundColor: '#FFFFFF',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Text
                  numberOfLines={1}
                  style={{
                    fontSize: 13,
                    color: '#C65D3F',
                    fontWeight: '500',
                    textAlign: 'center',
                    textAlignVertical: 'center',
                    includeFontPadding: false,
                  }}
                >
                  {suggestion}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        <ChatInput onSend={handleSend} disabled={isThinking} />
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}