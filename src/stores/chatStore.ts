import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
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

// P0-4: Debounced storage，减少流式期间 localStorage 写入频率
let _debounceTimer: ReturnType<typeof setTimeout> | null = null;
let _lastValue: string | null = null;
let _storageWarningShown = false;

const debouncedStorage = {
  getItem: (name: string): string | null => {
    return localStorage.getItem(name);
  },
  setItem: (name: string, value: string): void => {
    _lastValue = value;
    if (_debounceTimer) clearTimeout(_debounceTimer);
    _debounceTimer = setTimeout(() => {
      try {
        localStorage.setItem(name, _lastValue!);
      } catch (e) {
        if (e instanceof DOMException && e.name === 'QuotaExceededError') {
          // P1-6b: localStorage 容量预警
          if (!_storageWarningShown) {
            _storageWarningShown = true;
            console.warn('⚠️ localStorage 已满，部分数据可能无法保存。请在设置中清理旧会话。');
            // 尝试通知用户（如果在浏览器环境中）
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('aurora-storage-warning', {
                detail: { message: '存储空间已满，请清理旧会话' }
              }));
            }
          }
        }
      }
    }, 800);
  },
  removeItem: (name: string): void => {
    if (_debounceTimer) clearTimeout(_debounceTimer);
    localStorage.removeItem(name);
  },
};

/** 强制将待写入的数据持久化（stream 结束后调用） */
export function flushStorage(): void {
  if (_debounceTimer) {
    clearTimeout(_debounceTimer);
    _debounceTimer = null;
  }
  try {
    const data = localStorage.getItem('aurora-chat-storage');
    if (_lastValue && _lastValue !== data) {
      localStorage.setItem('aurora-chat-storage', _lastValue);
    }
  } catch (e) {
    console.warn('flushStorage 失败:', e);
  }
}

/** P0-4: 数据损坏检测与自动修复 */
function validateAndRepair(state: ChatState): void {
  const { conversations, messages } = state;
  let repaired = false;

  for (const conv of conversations) {
    // 检查 rootMessageId 是否存在
    if (conv.rootMessageId && !messages[conv.rootMessageId]) {
      console.warn(`[数据修复] 会话 "${conv.title}" 的 rootMessageId 无效，已清除`);
      conv.rootMessageId = null;
      conv.currentLeafId = null;
      repaired = true;
      continue;
    }

    // 检查 currentLeafId 是否存在
    if (conv.currentLeafId && !messages[conv.currentLeafId]) {
      console.warn(`[数据修复] 会话 "${conv.title}" 的 currentLeafId 无效，尝试重建`);
      // 尝试找到最深的可达叶子节点
      const leaf = findReachableLeaf(conv.rootMessageId, messages);
      conv.currentLeafId = leaf;
      if (!leaf) {
        conv.rootMessageId = null;
      }
      repaired = true;
    }

    // 如果 currentLeafId 存在，验证从它到根的路径完整性
    if (conv.currentLeafId) {
      const pathValid = validatePath(conv.currentLeafId, messages);
      if (!pathValid) {
        console.warn(`[数据修复] 会话 "${conv.title}" 的消息路径不完整，尝试重建`);
        const leaf = findReachableLeaf(conv.rootMessageId, messages);
        conv.currentLeafId = leaf;
        if (!leaf) {
          conv.rootMessageId = null;
        }
        repaired = true;
      }
    }
  }

  // 清理 messages 中的悬空引用
  const messageIds = new Set(Object.keys(messages));
  for (const [id, msg] of Object.entries(messages)) {
    // 清理无效的 parentId
    if (msg.parentId && !messageIds.has(msg.parentId)) {
      console.warn(`[数据修复] 消息 ${id} 的 parentId 无效，已清除`);
      msg.parentId = null;
      repaired = true;
    }
    // 清理无效的 childrenIds
    const validChildren = msg.childrenIds.filter(cid => messageIds.has(cid));
    if (validChildren.length !== msg.childrenIds.length) {
      console.warn(`[数据修复] 消息 ${id} 包含无效子节点，已清理`);
      msg.childrenIds = validChildren;
      repaired = true;
    }
  }

  if (repaired) {
    console.warn('[数据修复] 完成，部分数据已自动修复');
  }
}

function findReachableLeaf(rootId: string | null, messages: Record<string, MessageNode>): string | null {
  if (!rootId || !messages[rootId]) return null;
  let current = rootId;
  const visited = new Set<string>();
  while (current && !visited.has(current)) {
    visited.add(current);
    const msg = messages[current];
    if (!msg) break;
    if (msg.childrenIds.length === 0) return current;
    // 取最后一个子节点
    const lastChild = msg.childrenIds[msg.childrenIds.length - 1];
    if (!messages[lastChild]) return current;
    current = lastChild;
  }
  return current;
}

function validatePath(leafId: string, messages: Record<string, MessageNode>): boolean {
  let currentId: string | null = leafId;
  const visited = new Set<string>();
  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const msg: MessageNode | undefined = messages[currentId];
    if (!msg) return false;
    currentId = msg.parentId;
  }
  // 如果遍历到 null（根节点），路径完整
  return currentId === null;
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
      storage: createJSONStorage(() => debouncedStorage),
      partialize: (state) => ({
        conversations: state.conversations,
        messages: state.messages,
        currentConversationId: state.currentConversationId,
        pinnedIds: state.pinnedIds,
        archivedIds: state.archivedIds,
      }),
      // P0-4: 数据损坏检测与自动修复
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        validateAndRepair(state);
      },
    }
  )
);
