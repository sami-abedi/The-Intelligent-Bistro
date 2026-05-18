// app/chat.tsx
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  FlatList,
  ScrollView,
  useWindowDimensions,
  Keyboard,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  runOnJS,
  useAnimatedKeyboard,
  useAnimatedReaction,
} from 'react-native-reanimated';
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

// Tappable backdrop area BELOW the top safe-area inset, in pixels.
// Must stay non-trivial on iOS: anything inside `insets.top` (notch / Dynamic
// Island) is a system gesture zone where touches don't reach the app, so the
// sheet's max height is capped at `screenHeight - insets.top - this`.
const BACKDROP_MIN_TAP_AREA = 40;
// Clearance between the input bar and the keyboard top.
const INPUT_KEYBOARD_GAP = 8;

export default function ChatScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();

  // 75% of the screen, in pixels. Static — keyboard handling shifts/grows
  // the sheet via animated style instead of recomputing this.
  const baseSheetHeight = Math.round(screenHeight * 0.75);

  // Absolute ceiling for the sheet's grown height when the keyboard is up.
  // Subtracting `insets.top` keeps the backdrop's tappable region clear of the
  // iOS notch/Dynamic Island, where touches are reserved for system gestures.
  const maxSheetHeight = screenHeight - insets.top - BACKDROP_MIN_TAP_AREA;

  // Reanimated's keyboard hook — hooks the native IME callbacks directly
  // (UIKit notifications on iOS, WindowInsetsAnimation on Android), so it
  // doesn't rely on the JS Keyboard module that misreports height on MIUI.
  const keyboard = useAnimatedKeyboard();

  // JS-side mirror of keyboard open/closed, for use in onPress handlers and
  // non-animated style props. Updated only on transitions to avoid render churn.
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  useAnimatedReaction(
    () => keyboard.height.value > 0,
    (open, prev) => {
      if (open !== prev) {
        runOnJS(setIsKeyboardOpen)(open);
      }
    }
  );

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

  // Drag-to-dismiss animation state
  const translateY = useSharedValue(0);

  const closeSheet = useCallback(() => {
    router.back();
  }, [router]);

  const dismissKeyboard = useCallback(() => {
    Keyboard.dismiss();
  }, []);

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      'worklet';
      if (e.translationY > 0) {
        translateY.value = e.translationY;
      }
    })
    .onEnd((e) => {
      'worklet';
      if (e.translationY > 100 || e.velocityY > 500) {
        const kb = keyboard.height.value;
        const currentHeight =
          kb > 0 ? Math.min(maxSheetHeight, baseSheetHeight + kb) : baseSheetHeight;
        translateY.value = withTiming(currentHeight, { duration: 200 }, () => {
          runOnJS(closeSheet)();
        });
      } else {
        translateY.value = withTiming(0, { duration: 200 });
      }
    });

  // The sheet stays bottom-anchored. When the keyboard is up we GROW it by
  // the keyboard height (capped so a backdrop sliver remains visible) and add
  // matching bottom padding so the input bar lands `INPUT_KEYBOARD_GAP` px
  // above the keyboard. Driven by a shared value so it co-animates smoothly
  // with the drag gesture.
  const animatedSheetStyle = useAnimatedStyle(() => {
    const kb = keyboard.height.value;
    const grownHeight =
      kb > 0 ? Math.min(maxSheetHeight, baseSheetHeight + kb) : baseSheetHeight;
    return {
      height: grownHeight,
      paddingBottom: kb > 0 ? kb + INPUT_KEYBOARD_GAP : 0,
      transform: [{ translateY: translateY.value }],
    };
  });

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
    <View style={{ flex: 1, backgroundColor: 'transparent' }}>
      {/* Backdrop — tap to dismiss keyboard first, then close on second tap */}
      <Pressable
        onPress={isKeyboardOpen ? dismissKeyboard : closeSheet}
        style={{
          flex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.25)',
        }}
      />

      {/* Sheet — bottom-anchored. Height + paddingBottom live in animatedSheetStyle
          so they co-animate with the keyboard and the drag gesture. */}
      <Animated.View
        style={[
          {
            backgroundColor: '#FAF7F2',
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            overflow: 'hidden',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.1,
            shadowRadius: 8,
            elevation: 8,
          },
          animatedSheetStyle,
        ]}
      >
        {/* Tap-to-dismiss-keyboard wrapper. Child Pressables (close button,
            chips, suggested prompts) and the TextInput claim the responder
            first via RN's bubbling model, so this only fires on "empty" taps
            (header, message background, chip row gaps). Keyboard.dismiss is a
            no-op when the keyboard is closed, so no conditional needed. */}
        <Pressable onPress={dismissKeyboard} style={{ flex: 1 }}>
        {/* Drag handle + header — entire zone is gesture-active */}
        <GestureDetector gesture={panGesture}>
          <View>
            {/* Drag handle */}
            <View style={{ alignItems: 'center', paddingTop: 8, paddingBottom: 4 }}>
              <View
                style={{
                  width: 40,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: '#D4CCBF',
                }}
              />
            </View>

            {/* Header row */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 20,
                paddingVertical: 12,
                borderBottomWidth: 1,
                borderBottomColor: '#E5DFD5',
              }}
            >
              <View style={{ width: 32 }} />
              <View style={{ alignItems: 'center', flex: 1 }}>
                <Text className="font-serif text-base text-charcoal">Remy</Text>
                <Text className="text-xs text-muted">
                  Your host at Bistro Lumière
                </Text>
              </View>
              <Pressable
                onPress={closeSheet}
                hitSlop={10}
                style={{
                  width: 32,
                  height: 32,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontSize: 20, color: '#9B9183', lineHeight: 22 }}>
                  ×
                </Text>
              </Pressable>
            </View>
          </View>
        </GestureDetector>

        {/* Body */}
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
            keyboardDismissMode="interactive"
          />
        )}

        {/* Suggestion chips */}
        {lastSuggestions.length > 0 && !isThinking && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              paddingLeft: 16,
              paddingRight: 24,
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

        {/* Input — bottom safe-area padding only when keyboard is closed.
            When open, the sheet's animated paddingBottom places the input
            INPUT_KEYBOARD_GAP px above the keyboard. */}
        <View style={{ paddingBottom: isKeyboardOpen ? 0 : insets.bottom }}>
          <ChatInput onSend={handleSend} disabled={isThinking} />
        </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}