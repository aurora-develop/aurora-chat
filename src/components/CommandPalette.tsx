import { useState, useRef, useEffect, useCallback } from 'react';
import { Search, MessageSquare, Plus, Sun, Settings, Hash } from 'lucide-react';
import { useChatStore } from '../stores/chatStore';

interface CommandItem {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description?: string;
  action: () => void;
}

export default function CommandPalette({
  open,
  onClose,
  onNavigate,
}: {
  open: boolean;
  onClose: () => void;
  onNavigate: (tab: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const { conversations, messages, setCurrentConversation } = useChatStore();

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // 构建命令列表
  const getItems = useCallback((): CommandItem[] => {
    const items: CommandItem[] = [];
    const q = query.toLowerCase();

    // 快速操作
    items.push({
      id: 'new-chat',
      icon: Plus,
      label: '新建对话',
      description: '创建一个新的聊天会话',
      action: () => {
        const store = useChatStore.getState();
        const id = store.createConversation();
        setCurrentConversation(id);
        onNavigate('chat');
        onClose();
      },
    });

    items.push({
      id: 'theme-toggle',
      icon: Sun,
      label: '切换主题',
      description: '在浅色/深色/跟随系统之间切换',
      action: () => {
        const themeEl = document.documentElement;
        themeEl.classList.toggle('dark');
        onClose();
      },
    });

    items.push({
      id: 'settings',
      icon: Settings,
      label: '打开设置',
      description: '进入设置页面',
      action: () => { onNavigate('settings'); onClose(); },
    });

    // 搜索会话标题
    for (const conv of conversations.slice(0, 20)) {
      if (q && !conv.title.toLowerCase().includes(q)) continue;
      items.push({
        id: `conv-${conv.id}`,
        icon: MessageSquare,
        label: conv.title,
        description: new Date(conv.updatedAt).toLocaleDateString(),
        action: () => { setCurrentConversation(conv.id); onNavigate('chat'); onClose(); },
      });
    }

    // 搜索消息内容（限制搜索量防止阻塞）
    if (q.length >= 2) {
      const msgEntries = Object.entries(messages);
      const matches: { convId: string; text: string }[] = [];
      for (const [id, msg] of msgEntries) {
        if (matches.length >= 5) break;
        if (msg.role !== 'user') continue;
        const text = typeof msg.content === 'string' ? msg.content : '';
        if (text.toLowerCase().includes(q)) {
          const conv = conversations.find((c) => {
            const state = useChatStore.getState();
            const path = state.getMessagePath(c.id);
            return path.some((p) => p.id === id);
          });
          if (conv) {
            matches.push({ convId: conv.id, text: text.slice(0, 80) });
          }
        }
      }
      for (const match of matches) {
        items.push({
          id: `msg-${match.convId}-${match.text.slice(0, 10)}`,
          icon: Hash,
          label: match.text,
          description: '消息搜索结果',
          action: () => { setCurrentConversation(match.convId); onNavigate('chat'); onClose(); },
        });
      }
    }

    return items;
  }, [query, conversations, messages, setCurrentConversation, onNavigate, onClose]);

  const items = getItems();

  // 键盘导航
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (items[selectedIndex]) items[selectedIndex].action();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  // 滚动选中项到可见范围
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const selected = list.children[selectedIndex] as HTMLElement;
    if (selected) {
      selected.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-aurora-surface-light dark:bg-aurora-surface-dark border border-aurora-border-light dark:border-aurora-border-dark rounded-xl shadow-2xl overflow-hidden animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 搜索输入 */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-aurora-border-light dark:border-aurora-border-dark">
          <Search className="w-4 h-4 text-aurora-text-secondary dark:text-aurora-text-dark-secondary flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }}
            onKeyDown={handleKeyDown}
            placeholder="搜索会话、消息或执行操作..."
            className="flex-1 bg-transparent text-sm focus:outline-none text-aurora-text-primary dark:text-aurora-text-dark-primary placeholder:text-aurora-text-secondary dark:placeholder:text-aurora-text-dark-secondary"
          />
          <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-aurora-muted-light dark:bg-aurora-muted-dark text-aurora-text-secondary dark:text-aurora-text-dark-secondary">ESC</kbd>
        </div>

        {/* 结果列表 */}
        <div ref={listRef} className="max-h-80 overflow-y-auto py-1">
          {items.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-aurora-text-secondary dark:text-aurora-text-dark-secondary">
              没有找到匹配项
            </div>
          ) : (
            items.map((item, i) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={item.action}
                  onMouseEnter={() => setSelectedIndex(i)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors ${
                    i === selectedIndex
                      ? 'bg-aurora-muted-light dark:bg-aurora-muted-dark'
                      : 'hover:bg-aurora-muted-light/50 dark:hover:bg-aurora-muted-dark/50'
                  }`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0 text-aurora-text-secondary dark:text-aurora-text-dark-secondary" />
                  <div className="flex-1 min-w-0">
                    <div className="truncate text-aurora-text-primary dark:text-aurora-text-dark-primary">{item.label}</div>
                    {item.description && (
                      <div className="text-xs text-aurora-text-secondary dark:text-aurora-text-dark-secondary truncate">{item.description}</div>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* 底部提示 */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-aurora-border-light dark:border-aurora-border-dark text-[10px] text-aurora-text-secondary dark:text-aurora-text-dark-secondary">
          <div className="flex items-center gap-2">
            <kbd className="px-1 py-0.5 rounded bg-aurora-muted-light dark:bg-aurora-muted-dark">↑↓</kbd>
            <span>导航</span>
            <kbd className="px-1 py-0.5 rounded bg-aurora-muted-light dark:bg-aurora-muted-dark">↵</kbd>
            <span>确认</span>
          </div>
          <span>{items.length} 项结果</span>
        </div>
      </div>
    </div>
  );
}
