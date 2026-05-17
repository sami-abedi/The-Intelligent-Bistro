// mobile/components/ChatInput.tsx
import { useState } from 'react';
import { View, TextInput, Pressable, Text } from 'react-native';

interface Props {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, disabled }: Props) {
  const [text, setText] = useState('');
  const trimmed = text.trim();
  const canSend = trimmed.length > 0 && !disabled;

  const handleSend = () => {
    if (!canSend) return;
    onSend(trimmed);
    setText('');
  };

  return (
    <View className="flex-row items-end gap-2 border-t border-border bg-white px-4 py-2.5">
      <View className="flex-1 rounded-2xl border border-border bg-cream px-4 py-2">
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Ask Remy anything..."
          placeholderTextColor="#7A7268"
          multiline
          maxLength={500}
          autoCapitalize="sentences"
          autoCorrect={false}
          autoComplete="off"
          spellCheck={false}
          keyboardAppearance="light"
          className="max-h-24 text-base text-charcoal"
          style={{ minHeight: 24, paddingTop: 4, paddingBottom: 4 }}
          editable={!disabled}
          onSubmitEditing={handleSend}
          submitBehavior="submit"
          returnKeyType="send"
          enablesReturnKeyAutomatically
        />
      </View>
      <Pressable
        onPress={handleSend}
        disabled={!canSend}
        hitSlop={8}
        className={`h-11 w-11 items-center justify-center rounded-full ${
          canSend ? 'bg-terracotta active:bg-terracottaDark' : 'bg-border'
        }`}
      >
        <Text className="text-lg font-semibold text-white" style={{ lineHeight: 20 }}>
          →
        </Text>
      </Pressable>
    </View>
  );
}