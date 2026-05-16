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
    <View className="flex-row items-end gap-2 border-t border-border bg-white px-4 py-3">
      <View className="flex-1 rounded-2xl border border-border bg-cream px-4 py-2">
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Ask Remy anything..."
          placeholderTextColor="#7A7268"
          multiline
          maxLength={500}
          className="max-h-24 text-base text-charcoal"
          style={{ minHeight: 24, paddingTop: 4, paddingBottom: 4 }}
          editable={!disabled}
          onSubmitEditing={handleSend}
          blurOnSubmit={false}
          returnKeyType="send"
        />
      </View>
      <Pressable
        onPress={handleSend}
        disabled={!canSend}
        className={`h-11 w-11 items-center justify-center rounded-full ${
          canSend ? 'bg-terracotta' : 'bg-border'
        }`}
      >
        <Text className="text-lg font-semibold text-white">→</Text>
      </Pressable>
    </View>
  );
}