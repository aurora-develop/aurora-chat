import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Message } from '../types/api';

export interface AddMessageInput {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string | Message['content'];
  isError?: boolean;
}

export interface MessageNode {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string | Message['content'];
  createdAt: number;
  parentId: string | null;
  childrenIds: string[];
  siblingIndex: number;
  model?: string;
  feedback?: 'up' | 'down';
  isError?: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  rootMessageId: string | null;
  currentLeafId: string | null;
  createdAt: number;
  updatedAt: number;
  model: string;
}

interface ChatState {
  conversations: Conversation[];
  messages: Record<string, MessageNode>;
  currentConversationId: string | null;
  streamingMessageId: string | null;
  abortController: AbortController | null;
  pinnedIds: string[];
  archivedIds: string[];

  createConversation: () => string;
  setCurrentConversation: (id: string | null) => void;
  setConversationModel: (id: string, model: string) => void;
  deleteConversation: (id: string) => void;
  renameConversation: (id: string, title: string) => void;
  clearAllConversations: () => void;
  togglePinConversation: (id: string) => void;
  toggleArchiveConversation: (id: string) => void;
  addMessage: (conversationId: string, parentId: string | null, message: AddMessageInput) => string;
  updateMessage: (messageId: string, updates: Partial<MessageNode>) => void;
  deleteMessage: (messageId: string) => void;
  getMessagePath: (conversationId: string) => MessageNode[];
  setStreamingMessage: (id: string | null) => void;
  setAbortController: (controller: AbortController | null) => void;
  regenerateMessage: (assistantMessageId: string) => string | null;
  deleteBranch: (messageId: string) => void;
  getParentUserMessage: (assistantMessageId: string) => MessageNode | null;
  getSiblingInfo: (messageId: string) => { index: number; total: number };
  switchSibling: (messageId: string, direction: -1 | 1) => void;
  generateTitle: (conversationId: string) => Promise<void>;
}

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function extractTitleFromContent(content: string | Message['content']): string {
  const maxLen = 30;
  if (typeof content === 'string') {
    const trimmed = content.trim();
    return trimmed.slice(0, maxLen) || '新对话';
  }

  let hasImage = false;
  let hasFile = false;
  let text = '';

  for (const part of content) {
    if (part.type === 'text') {
      text += part.text || '';
    } else if (part.type === 'input_image') {
      hasImage = true;
    } else if (part.type === 'input_file') {
      hasFile = true;
    }
  }

  const trimmed = text.trim().slice(0, maxLen);
  if (trimmed) return trimmed;
  if (hasImage) return '图片对话';
  if (hasFile) return '文件对话';
  return '新对话';
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      conversations: [],
      messages: {},
      currentConversationId: null,
      streamingMessageId: null,
      abortController: null,
      pinnedIds: [],
      archivedIds: [],

      createConversation: () => {
        const id = generateId();
        const newConversation: Conversation = {
          id,
          title: '新对话',
          rootMessageId: null,
          currentLeafId: null,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          model: 'auto',
        };

        set((state) => ({
          conversations: [newConversation, ...state.conversations],
          currentConversationId: id,
        }));

        return id;
      },

      setCurrentConversation: (id) => {
        set({ currentConversationId: id });
      },

      setConversationModel: (id, model) => {
        set((state) => ({
          conversations: state.conversations.map((conv) =>
            conv.id === id ? { ...conv, model } : conv
          ),
        }));
      },

      deleteConversation: (id) => {
        set((state) => {
          const conv = state.conversations.find((c) => c.id === id);
          if (!conv) return state;

          // 删除该会话关联的消息
          const messagesToDelete = new Set<string>();
          const collectMessages = (messageId: string | null) => {
            if (!messageId) return;
            messagesToDelete.add(messageId);
            const msg = state.messages[messageId];
            if (msg) {
              msg.childrenIds.forEach(collectMessages);
            }
          };
          collectMessages(conv.rootMessageId);

          const newMessages = { ...state.messages };
          messagesToDelete.forEach((mid) => delete newMessages[mid]);

          return {
            conversations: state.conversations.filter((c) => c.id !== id),
            messages: newMessages,
            currentConversationId:
              state.currentConversationId === id ? null : state.currentConversationId,
          };
        });
      },

      renameConversation: (id, title) => {
        set((state) => ({
          conversations: state.conversations.map((conv) =>
            conv.id === id ? { ...conv, title } : conv
          ),
        }));
      },

      clearAllConversations: () => {
        set({
          conversations: [],
          messages: {},
          currentConversationId: null,
          pinnedIds: [],
          archivedIds: [],
        });
      },

      togglePinConversation: (id) => {
        set((state) => {
          const pinned = new Set(state.pinnedIds);
          let archivedIds = state.archivedIds;
          if (pinned.has(id)) {
            pinned.delete(id);
          } else {
            pinned.add(id);
            // 置顶时自动取消归档
            archivedIds = archivedIds.filter((aid) => aid !== id);
          }
          return { pinnedIds: Array.from(pinned), archivedIds };
        });
      },

      toggleArchiveConversation: (id) => {
        set((state) => {
          const archived = new Set(state.archivedIds);
          let pinnedIds = state.pinnedIds;
          if (archived.has(id)) {
            archived.delete(id);
          } else {
            archived.add(id);
            // 归档时自动取消置顶
            pinnedIds = pinnedIds.filter((pid) => pid !== id);
          }
          return { archivedIds: Array.from(archived), pinnedIds };
        });
      },

      addMessage: (conversationId, parentId, message) => {
        const id = generateId();
        const conversation = get().conversations.find((c) => c.id === conversationId);
        if (!conversation) return id;

        // 计算 siblingIndex
        let siblingIndex = 0;
        if (parentId) {
          const parent = get().messages[parentId];
          if (parent) {
            siblingIndex = parent.childrenIds.length;
          }
        }

        const newMessage: MessageNode = {
          ...message,
          id,
          createdAt: Date.now(),
          parentId,
          childrenIds: [],
          siblingIndex,
        };

        set((state) => {
          const newMessages = { ...state.messages, [id]: newMessage };
          if (parentId && newMessages[parentId]) {
            newMessages[parentId] = {
              ...newMessages[parentId],
              childrenIds: [...newMessages[parentId].childrenIds, id],
            };
          }

          return {
            messages: newMessages,
            conversations: state.conversations.map((conv) => {
              if (conv.id !== conversationId) return conv;
              const isFirstMessage = !conv.rootMessageId;
              let title = conv.title;
              if (isFirstMessage && message.role === 'user') {
                title = extractTitleFromContent(message.content);
              }

              return {
                ...conv,
                rootMessageId: isFirstMessage ? id : conv.rootMessageId,
                currentLeafId: id,
                updatedAt: Date.now(),
                title,
              };
            }),
          };
        });

        return id;
      },

      updateMessage: (messageId, updates) => {
        set((state) => {
          const msg = state.messages[messageId];
          if (!msg) return state;
          return {
            messages: {
              ...state.messages,
              [messageId]: { ...msg, ...updates },
            },
          };
        });
      },

      deleteMessage: (messageId) => {
        set((state) => {
          const msg = state.messages[messageId];
          if (!msg) return state;

          const newMessages = { ...state.messages };
          delete newMessages[messageId];

          if (msg.parentId && newMessages[msg.parentId]) {
            newMessages[msg.parentId] = {
              ...newMessages[msg.parentId],
              childrenIds: newMessages[msg.parentId].childrenIds.filter((id) => id !== messageId),
            };
          }

          // 删除所有子消息
          const deleteChildren = (id: string) => {
            const child = newMessages[id];
            if (!child) return;
            const children = [...child.childrenIds];
            delete newMessages[id];
            children.forEach(deleteChildren);
          };
          msg.childrenIds.forEach(deleteChildren);

          return { messages: newMessages };
        });
      },

      getMessagePath: (conversationId) => {
        const conversation = get().conversations.find((c) => c.id === conversationId);
        if (!conversation || !conversation.currentLeafId) return [];

        const path: MessageNode[] = [];
        let currentId: string | null = conversation.currentLeafId;
        const visited = new Set<string>();

        while (currentId && !visited.has(currentId)) {
          visited.add(currentId);
          const currentMsg: MessageNode | undefined = get().messages[currentId];
          if (!currentMsg) break;
          path.unshift(currentMsg);
          currentId = currentMsg.parentId;
        }

        return path;
      },

      setStreamingMessage: (id) => {
        set({ streamingMessageId: id });
      },

      setAbortController: (controller) => {
        set({ abortController: controller });
      },

      regenerateMessage: (assistantMessageId) => {
        const msg = get().messages[assistantMessageId];
        if (!msg || msg.role !== 'assistant' || !msg.parentId) return null;

        const parent = get().messages[msg.parentId];
        if (!parent) return null;

        // 在 parent 下创建新的 assistant 兄弟节点
        return get().addMessage(
          get().currentConversationId!,
          msg.parentId,
          {
            role: 'assistant',
            content: '',
          }
        );
      },

      deleteBranch: (messageId) => {
        const msg = get().messages[messageId];
        if (!msg) return;

        set((state) => {
          const conversation = state.conversations.find((c) => c.id === state.currentConversationId);
          if (!conversation) return state;

          const newMessages = { ...state.messages };
          const messagesToDelete = new Set<string>();

          const collect = (id: string) => {
            if (messagesToDelete.has(id)) return;
            messagesToDelete.add(id);
            const node = newMessages[id];
            if (node) {
              node.childrenIds.forEach(collect);
            }
          };
          collect(messageId);

          messagesToDelete.forEach((id) => delete newMessages[id]);

          // 从父节点中移除引用
          if (msg.parentId && newMessages[msg.parentId]) {
            newMessages[msg.parentId] = {
              ...newMessages[msg.parentId],
              childrenIds: newMessages[msg.parentId].childrenIds.filter((id) => id !== messageId),
            };
          }

          // 重新计算 currentLeafId：从根消息找到最深的可见分支
          const findLeaf = (id: string | null): string | null => {
            if (!id || !newMessages[id]) return null;
            const node = newMessages[id];
            if (node.childrenIds.length === 0) return id;
            return findLeaf(node.childrenIds[node.childrenIds.length - 1]);
          };
          const newLeafId = findLeaf(conversation.rootMessageId);

          return {
            messages: newMessages,
            conversations: state.conversations.map((conv) =>
              conv.id === state.currentConversationId
                ? { ...conv, currentLeafId: newLeafId, updatedAt: Date.now() }
                : conv
            ),
          };
        });
      },

      getParentUserMessage: (assistantMessageId) => {
        const msg = get().messages[assistantMessageId];
        if (!msg || !msg.parentId) return null;
        const parent = get().messages[msg.parentId];
        return parent && parent.role === 'user' ? parent : null;
      },

      getSiblingInfo: (messageId) => {
        const msg = get().messages[messageId];
        if (!msg || !msg.parentId) return { index: 0, total: 1 };
        const parent = get().messages[msg.parentId];
        if (!parent) return { index: 0, total: 1 };
        const siblings = parent.childrenIds;
        const index = siblings.indexOf(messageId);
        return { index: index >= 0 ? index : 0, total: siblings.length };
      },

      switchSibling: (messageId, direction) => {
        const msg = get().messages[messageId];
        if (!msg || !msg.parentId) return;
        const parent = get().messages[msg.parentId];
        if (!parent) return;

        const siblings = parent.childrenIds;
        const currentIndex = siblings.indexOf(messageId);
        if (currentIndex < 0) return;

        const newIndex = currentIndex + direction;
        if (newIndex < 0 || newIndex >= siblings.length) return;

        const newCurrentId = siblings[newIndex];

        // 找到新兄弟节点的叶子
        const findLeaf = (id: string): string => {
          const node = get().messages[id];
          if (!node || node.childrenIds.length === 0) return id;
          return findLeaf(node.childrenIds[node.childrenIds.length - 1]);
        };

        const newLeafId = findLeaf(newCurrentId);

        set((state) => ({
          conversations: state.conversations.map((conv) =>
            conv.id === get().currentConversationId
              ? { ...conv, currentLeafId: newLeafId, updatedAt: Date.now() }
              : conv
          ),
        }));
      },

      generateTitle: async (conversationId) => {
        const state = get();
        const conversation = state.conversations.find((c) => c.id === conversationId);
        if (!conversation || conversation.title !== '新对话') return;

        const rootId = conversation.rootMessageId;
        if (!rootId) return;
        const rootMsg = state.messages[rootId];
        if (!rootMsg || rootMsg.role !== 'user') return;

        const title = extractTitleFromContent(rootMsg.content);
        get().renameConversation(conversationId, title);
      },
    }),
    {
      name: 'aurora-chat-storage',
      version: 1,
      partialize: (state) => ({
        conversations: state.conversations,
        messages: state.messages,
        currentConversationId: state.currentConversationId,
        pinnedIds: state.pinnedIds,
        archivedIds: state.archivedIds,
      }),
    }
  )
);
