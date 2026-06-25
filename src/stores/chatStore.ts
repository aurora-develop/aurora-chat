import { create } from 'zustand';
import type { Message } from '../types/api';

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
}

interface ChatState {
  conversations: Conversation[];
  currentConversationId: string | null;
  addConversation: () => void;
  setCurrentConversation: (id: string) => void;
  addMessage: (message: Message) => void;
  updateLastMessage: (content: string) => void;
  deleteConversation: (id: string) => void;
}

export const useChatStore = create<ChatState>()((set, get) => ({
  conversations: [],
  currentConversationId: null,

  addConversation: () => {
    const id = Date.now().toString();
    const newConversation: Conversation = {
      id,
      title: '新对话',
      messages: [],
      createdAt: Date.now(),
    };

    set((state) => ({
      conversations: [...state.conversations, newConversation],
      currentConversationId: id,
    }));
  },

  setCurrentConversation: (id) => {
    set({ currentConversationId: id });
  },

  addMessage: (message) => {
    const { currentConversationId } = get();
    if (!currentConversationId) return;

    set((state) => ({
      conversations: state.conversations.map((conv) =>
        conv.id === currentConversationId
          ? {
              ...conv,
              messages: [...conv.messages, message],
              title: conv.messages.length === 0 && message.role === 'user'
                ? String(message.content).slice(0, 30)
                : conv.title,
            }
          : conv
      ),
    }));
  },

  updateLastMessage: (content) => {
    const { currentConversationId } = get();
    if (!currentConversationId) return;

    set((state) => ({
      conversations: state.conversations.map((conv) => {
        if (conv.id !== currentConversationId) return conv;
        const messages = [...conv.messages];
        const lastMsg = messages[messages.length - 1];
        if (lastMsg && lastMsg.role === 'assistant') {
          messages[messages.length - 1] = { ...lastMsg, content };
        }
        return { ...conv, messages };
      }),
    }));
  },

  deleteConversation: (id) => {
    set((state) => ({
      conversations: state.conversations.filter((conv) => conv.id !== id),
      currentConversationId:
        state.currentConversationId === id ? null : state.currentConversationId,
    }));
  },
}));
