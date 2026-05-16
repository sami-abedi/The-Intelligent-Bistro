// mobile/components/ChatBubble.tsx
import { View, Text } from 'react-native';
import { ChatMessage } from '../stores/useChatStore';

interface Props {
  message: ChatMessage;
}

export function ChatBubble({ message }: Props) {
  const isUser = message.role === 'user';

  return (
    <View
      className={`mb-2 max-w-[80%] ${isUser ? 'self-end' : 'self-start'}`}
    >
      <View
        className={`rounded-2xl px-4 py-2.5 ${
          isUser ? 'bg-terracotta' : 'bg-white border border-border'
        }`}
        style={{
          borderBottomRightRadius: isUser ? 4 : 16,
          borderBottomLeftRadius: isUser ? 16 : 4,
        }}
      >
        <Text
          className={`text-base leading-5 ${isUser ? 'text-white' : 'text-charcoal'}`}
        >
          {message.content}
        </Text>
      </View>
    </View>
  );
}