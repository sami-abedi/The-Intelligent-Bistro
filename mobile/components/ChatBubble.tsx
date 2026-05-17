// mobile/components/ChatBubble.tsx
import { View, Text } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { ChatMessage } from '../stores/useChatStore';

interface Props {
  message: ChatMessage;
}

// Styles for the Markdown renderer on assistant bubbles.
// These mirror the typography of the rest of the app:
// - charcoal text on cream/white surfaces
// - 16px base, 22px line-height for comfortable reading
// - asymmetric corner radii are handled by the parent View, not here
const assistantMarkdownStyles = {
  body: {
    color: '#2A2A2A',
    fontSize: 16,
    lineHeight: 22,
  },
  paragraph: {
    marginTop: 0,
    marginBottom: 6,
    color: '#2A2A2A',
    fontSize: 16,
    lineHeight: 22,
  },
  strong: {
    fontWeight: '600' as const,
    color: '#2A2A2A',
  },
  em: {
    fontStyle: 'italic' as const,
    color: '#2A2A2A',
  },
  bullet_list: {
    marginTop: 4,
    marginBottom: 4,
  },
  ordered_list: {
    marginTop: 4,
    marginBottom: 4,
  },
  list_item: {
    marginBottom: 2,
    color: '#2A2A2A',
    fontSize: 16,
    lineHeight: 22,
  },
  bullet_list_icon: {
    color: '#C65D3F', // terracotta — gives lists a hint of brand color
    marginLeft: 0,
    marginRight: 8,
  },
  ordered_list_icon: {
    color: '#C65D3F',
    marginLeft: 0,
    marginRight: 8,
  },
  link: {
    color: '#C65D3F',
    textDecorationLine: 'underline' as const,
  },
  code_inline: {
    backgroundColor: '#F0EAE0',
    color: '#2A2A2A',
    paddingHorizontal: 4,
    borderRadius: 4,
    fontFamily: 'Menlo',
  },
  // Remove default top margin on the very first element so the bubble
  // doesn't have weird whitespace above the first line of text.
  hr: { backgroundColor: '#E8E0D5', height: 1, marginVertical: 8 },
};

export function ChatBubble({ message }: Props) {
  const isUser = message.role === 'user';

  return (
    <View className={`mb-2 max-w-[80%] ${isUser ? 'self-end' : 'self-start'}`}>
      <View
        className={`rounded-2xl px-4 py-2.5 ${
          isUser ? 'bg-terracotta' : 'bg-white border border-border'
        }`}
        style={{
          borderBottomRightRadius: isUser ? 4 : 16,
          borderBottomLeftRadius: isUser ? 16 : 4,
        }}
      >
        {isUser ? (
          <Text className="text-base leading-5 text-white">{message.content}</Text>
        ) : (
          <Markdown style={assistantMarkdownStyles}>{message.content}</Markdown>
        )}
      </View>
    </View>
  );
}