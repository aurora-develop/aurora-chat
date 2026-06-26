import { useState, useEffect, lazy, Suspense } from 'react';
import {
  MessageSquare, Image, Mic, Settings, ChevronLeft, ChevronRight,
  Sun, Moon, Menu, X, Plus, Search, Edit3, Trash2, Pin, Archive,
  MoreHorizontal, AlertTriangle
} from 'lucide-react';
import { useChatStore } from './stores/chatStore';
import { useThemeStore } from './stores/themeStore';
import CommandPalette from './components/CommandPalette';

const ChatView = lazy(() => import('./components/ChatView'));
const ImagesView = lazy(() => import('./components/ImagesView'));
const AudioView = lazy(() => import('./components/AudioView'));
const SettingsView = lazy(() => import('./components/SettingsView'));

type Tab = 'chat' | 'images' | 'audio' | 'settings';
type Theme = 'light' | 'dark' | 'system';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('chat');
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const {
    conversations,
    currentConversationId,
    pinnedIds,
    archivedIds,
    createConversation,
    setCurrentConversation,
    deleteConversation,
    renameConversation,
    clearAllConversations,
    togglePinConversation,
    toggleArchiveConversation,
  } = useChatStore();

  const { theme, resolved, setTheme } = useThemeStore();

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // 默认创建一个新会话
  useEffect(() => {
    if (conversations.length === 0) {
      createConversation();
    }
  }, [conversations.length, createConversation]);

  const tabs = [
    { id: 'chat' as Tab, label: '聊天', icon: MessageSquare },
    { id: 'images' as Tab, label: '图片', icon: Image },
    { id: 'audio' as Tab, label: '语音', icon: Mic },
    { id: 'settings' as Tab, label: '设置', icon: Settings },
  ];

  const cycleTheme = () => {
    const order: Theme[] = ['light', 'dark', 'system'];
    const next = order[(order.indexOf(theme) + 1) % order.length];
    setTheme(next);
  };

  const ThemeIcon = theme === 'dark' || (theme === 'system' && resolved === 'dark')
    ? Moon
    : Sun;

  const handleTabClick = (tabId: Tab) => {
    setActiveTab(tabId);
    if (isMobile) setMobileOpen(false);
  };

  const handleNewChat = () => {
    const id = createConversation();
    setActiveTab('chat');
    setCurrentConversation(id);
  };

  const startRename = (conv: { id: string; title: string }) => {
    setRenamingId(conv.id);
    setRenameValue(conv.title);
  };

  const confirmRename = () => {
    if (renamingId && renameValue.trim()) {
      renameConversation(renamingId, renameValue.trim());
    }
    setRenamingId(null);
    setRenameValue('');
  };

  const isPinned = (id: string) => pinnedIds.includes(id);
  const isArchived = (id: string) => archivedIds.includes(id);

  const handleTogglePin = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    togglePinConversation(id);
    setMenuOpenId(null);
  };

  const handleToggleArchive = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    toggleArchiveConversation(id);
    setMenuOpenId(null);
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    deleteConversation(id);
    setMenuOpenId(null);
  };

  const handleStartRename = (e: React.MouseEvent, conv: { id: string; title: string }) => {
    e.stopPropagation();
    startRename(conv);
    setMenuOpenId(null);
  };

  const groupedConversations = (() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterday = today - 24 * 60 * 60 * 1000;
    const weekAgo = today - 7 * 24 * 60 * 60 * 1000;

    return {
      today: conversations.filter((c) => c.updatedAt >= today && !isArchived(c.id)),
      yesterday: conversations.filter((c) => c.updatedAt >= yesterday && c.updatedAt < today && !isArchived(c.id)),
      last7Days: conversations.filter((c) => c.updatedAt >= weekAgo && c.updatedAt < yesterday && !isArchived(c.id)),
      older: conversations.filter((c) => c.updatedAt < weekAgo && !isArchived(c.id)),
      archived: conversations.filter((c) => isArchived(c.id)),
    };
  })();

  const pinnedConversations = conversations
    .filter((c) => isPinned(c.id) && !isArchived(c.id))
    .filter((c) => c.title.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => b.updatedAt - a.updatedAt);

  const renderConversationGroup = (title: string, items: typeof conversations) => {
    const filtered = items
      .filter((c) => c.title.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => b.updatedAt - a.updatedAt);

    if (filtered.length === 0) return null;

    return (
      <div key={title} className="mb-2">
        <div className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-aurora-text-secondary dark:text-aurora-text-dark-secondary">
          <div className="w-0.5 h-3 rounded-full bg-aurora-accent dark:bg-aurora-accent-dark" />
          {title}
        </div>
        <div className="space-y-0.5">
          {filtered.map((conv) => renderConversationItem(conv))}
        </div>
      </div>
    );
  };

  const renderConversationItem = (conv: typeof conversations[0]) => {
    const active = currentConversationId === conv.id && activeTab === 'chat';
    const showMenu = menuOpenId === conv.id;

    return (
      <div
        key={conv.id}
        className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
          active
            ? 'bg-aurora-muted-light dark:bg-aurora-muted-dark border-l-2 border-aurora-accent dark:border-aurora-accent-dark'
            : 'border-l-2 border-transparent hover:bg-aurora-muted-light/50 dark:hover:bg-aurora-muted-dark/50'
        }`}
        onClick={() => {
          setCurrentConversation(conv.id);
          setActiveTab('chat');
          if (isMobile) setMobileOpen(false);
        }}
      >
        <MessageSquare className="w-4 h-4 flex-shrink-0 text-aurora-text-secondary dark:text-aurora-text-dark-secondary" />
        {renamingId === conv.id ? (
          <input
            type="text"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && confirmRename()}
            onBlur={confirmRename}
            autoFocus
            className="flex-1 min-w-0 bg-transparent text-sm focus:outline-none"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="flex-1 min-w-0 truncate text-sm">{conv.title}</span>
        )}

        {renamingId !== conv.id && (
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
            {isPinned(conv.id) && (
              <Pin className="w-3 h-3 text-aurora-accent dark:text-aurora-accent-dark fill-current" />
            )}
            <div className="relative">
              <button
                onClick={(e) => { e.stopPropagation(); setMenuOpenId(showMenu ? null : conv.id); }}
                className="p-1 rounded hover:bg-aurora-bg-light dark:hover:bg-aurora-bg-dark"
              >
                <MoreHorizontal className="w-3.5 h-3.5" />
              </button>
              {showMenu && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={(e) => { e.stopPropagation(); setMenuOpenId(null); }}
                  />
                  <div className="absolute right-0 top-full mt-1 w-36 bg-aurora-surface-light dark:bg-aurora-surface-dark border border-aurora-border-light dark:border-aurora-border-dark rounded-lg shadow-lg py-1 z-20">
                    <button
                      onClick={(e) => handleStartRename(e, conv)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-aurora-muted-light dark:hover:bg-aurora-muted-dark"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>重命名</span>
                    </button>
                    <button
                      onClick={(e) => handleTogglePin(e, conv.id)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-aurora-muted-light dark:hover:bg-aurora-muted-dark"
                    >
                      <Pin className={`w-3.5 h-3.5 ${isPinned(conv.id) ? 'fill-current' : ''}`} />
                      <span>{isPinned(conv.id) ? '取消置顶' : '置顶'}</span>
                    </button>
                    <button
                      onClick={(e) => handleToggleArchive(e, conv.id)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-aurora-muted-light dark:hover:bg-aurora-muted-dark"
                    >
                      <Archive className="w-3.5 h-3.5" />
                      <span>{isArchived(conv.id) ? '取消归档' : '归档'}</span>
                    </button>
                    <div className="my-1 border-t border-aurora-border-light dark:border-aurora-border-dark" />
                    <button
                      onClick={(e) => handleDelete(e, conv.id)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-aurora-error dark:text-aurora-error-dark hover:bg-aurora-muted-light dark:hover:bg-aurora-muted-dark"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>删除</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const [showArchived, setShowArchived] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  // P0-3: 全局键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+K: 命令面板
      if (e.ctrlKey && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((v) => !v);
        return;
      }
      // Ctrl+N: 新建对话
      if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        handleNewChat();
        return;
      }
      // Escape: 关闭弹窗
      if (e.key === 'Escape') {
        if (showClearConfirm) { setShowClearConfirm(false); return; }
        if (menuOpenId) { setMenuOpenId(null); return; }
        if (renamingId) { setRenamingId(null); return; }
        return;
      }
      // Ctrl+Shift+O: 切换侧边栏
      if (e.ctrlKey && e.shiftKey && e.key === 'O') {
        e.preventDefault();
        if (isMobile) setMobileOpen((v) => !v);
        else setCollapsed((v) => !v);
        return;
      }
      // Ctrl+1/2/3/4: 切换标签页
      if (e.ctrlKey && ['1', '2', '3', '4'].includes(e.key)) {
        e.preventDefault();
        const tabMap: Tab[] = ['chat', 'images', 'audio', 'settings'];
        handleTabClick(tabMap[parseInt(e.key) - 1]);
        return;
      }
      // Alt+Up/Down: 切换会话
      if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault();
        const visibleConvs = conversations
          .filter((c) => !isArchived(c.id) && !isPinned(c.id))
          .sort((a, b) => b.updatedAt - a.updatedAt);
        const pinnedConvs = conversations
          .filter((c) => isPinned(c.id) && !isArchived(c.id))
          .sort((a, b) => b.updatedAt - a.updatedAt);
        const allVisible = [...pinnedConvs, ...visibleConvs];
        if (allVisible.length === 0) return;
        const currentIdx = allVisible.findIndex((c) => c.id === currentConversationId);
        const nextIdx = e.key === 'ArrowDown'
          ? Math.min(currentIdx + 1, allVisible.length - 1)
          : Math.max(currentIdx - 1, 0);
        if (nextIdx >= 0 && nextIdx < allVisible.length) {
          setCurrentConversation(allVisible[nextIdx].id);
          setActiveTab('chat');
        }
        return;
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showClearConfirm, menuOpenId, renamingId, conversations, currentConversationId, isMobile]);

  const conversationList = (
    <div className="flex flex-col h-full">
      <button
        onClick={handleNewChat}
        className="flex items-center gap-3 px-4 py-3 mx-3 mt-3 mb-2 border border-aurora-border-light dark:border-aurora-border-dark rounded-lg hover:bg-aurora-muted-light dark:hover:bg-aurora-muted-dark transition-colors"
        title="新对话 (Ctrl+N)"
      >
        <Plus className="w-5 h-5" />
        <span className="font-medium">新对话</span>
      </button>

      <div className="px-3 mb-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-aurora-text-secondary dark:text-aurora-text-dark-secondary" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索会话"
            className="w-full pl-9 pr-3 py-2 bg-aurora-bg-light dark:bg-aurora-bg-dark border border-aurora-border-light dark:border-aurora-border-dark rounded-lg text-sm focus:outline-none focus:border-aurora-text-primary dark:focus:border-aurora-text-dark-primary"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3">
        {pinnedConversations.length > 0 && (
          <div className="mb-2">
            <div className="px-3 py-1.5 text-xs font-medium text-aurora-text-secondary dark:text-aurora-text-dark-secondary">
              置顶
            </div>
            <div className="space-y-0.5">
              {pinnedConversations.map((conv) => renderConversationItem(conv))}
            </div>
          </div>
        )}

        {renderConversationGroup('今天', groupedConversations.today)}
        {renderConversationGroup('昨天', groupedConversations.yesterday)}
        {renderConversationGroup('过去 7 天', groupedConversations.last7Days)}
        {renderConversationGroup('更早', groupedConversations.older)}

        {groupedConversations.archived.length > 0 && (
          <div className="mb-2">
            <button
              onClick={() => setShowArchived((v) => !v)}
              className="w-full flex items-center justify-between px-3 py-1.5 text-xs font-medium text-aurora-text-secondary dark:text-aurora-text-dark-secondary hover:text-aurora-text-primary dark:hover:text-aurora-text-dark-primary"
            >
              <span>已归档 ({groupedConversations.archived.length})</span>
              <ChevronRight className={`w-3.5 h-3.5 transition-transform ${showArchived ? 'rotate-90' : ''}`} />
            </button>
            {showArchived && (
              <div className="space-y-0.5 mt-1">
                {groupedConversations.archived
                  .filter((c) => c.title.toLowerCase().includes(searchQuery.toLowerCase()))
                  .sort((a, b) => b.updatedAt - a.updatedAt)
                  .map((conv) => renderConversationItem(conv))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="px-3 py-2 border-t border-aurora-border-light dark:border-aurora-border-dark">
        <button
          onClick={() => setShowClearConfirm(true)}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-aurora-text-secondary dark:text-aurora-text-dark-secondary hover:text-aurora-error dark:hover:text-aurora-error-dark hover:bg-aurora-muted-light dark:hover:bg-aurora-muted-dark rounded-lg transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>清空历史</span>
        </button>
      </div>

      {showClearConfirm && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm bg-aurora-surface-light dark:bg-aurora-surface-dark border border-aurora-border-light dark:border-aurora-border-dark rounded-xl shadow-xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-full bg-aurora-error/10 text-aurora-error dark:text-aurora-error-dark">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold text-aurora-text-primary dark:text-aurora-text-dark-primary">
                清空所有历史？
              </h3>
            </div>
            <p className="text-sm text-aurora-text-secondary dark:text-aurora-text-dark-secondary mb-5">
              此操作将删除所有会话和消息，且无法撤销。
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 text-sm border border-aurora-border-light dark:border-aurora-border-dark rounded-lg hover:bg-aurora-muted-light dark:hover:bg-aurora-muted-dark"
              >
                取消
              </button>
              <button
                onClick={() => { clearAllConversations(); setShowClearConfirm(false); }}
                className="px-4 py-2 text-sm bg-aurora-error text-white rounded-lg hover:bg-aurora-error-hover dark:bg-aurora-error-dark dark:hover:bg-aurora-error-dark-hover"
              >
                确认清空
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const sidebarContent = (
    <>
      <div className="h-14 flex items-center justify-between px-4 border-b border-aurora-border-light dark:border-aurora-border-dark">
        <h1 className="text-lg font-semibold tracking-tight text-aurora-text-primary dark:text-aurora-text-dark-primary">
          Aurora Chat
        </h1>
        <button
          onClick={() => isMobile ? setMobileOpen(false) : setCollapsed(!collapsed)}
          className="p-1 rounded-md hover:bg-aurora-muted-light dark:hover:bg-aurora-muted-dark transition-colors"
        >
          {isMobile ? (
            <X className="w-5 h-5 text-aurora-text-secondary dark:text-aurora-text-dark-secondary" />
          ) : collapsed ? (
            <ChevronRight className="w-4 h-4 text-aurora-text-secondary dark:text-aurora-text-dark-secondary" />
          ) : (
            <ChevronLeft className="w-4 h-4 text-aurora-text-secondary dark:text-aurora-text-dark-secondary" />
          )}
        </button>
      </div>

      {activeTab === 'chat' && !collapsed && !isMobile && (
        <div className="h-72 border-b border-aurora-border-light dark:border-aurora-border-dark relative">
          {conversationList}
        </div>
      )}

      <nav className="flex-1 p-2 space-y-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 ${
                isActive
                  ? 'bg-aurora-accent text-white dark:bg-aurora-accent-dark dark:text-black'
                  : 'text-aurora-text-secondary dark:text-aurora-text-dark-secondary hover:bg-aurora-muted-light dark:hover:bg-aurora-muted-dark'
              }`}
              title={collapsed ? tab.label : undefined}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {(!collapsed || isMobile) && <span className="text-sm font-medium">{tab.label}</span>}
            </button>
          );
        })}
      </nav>

      <div className="p-2 border-t border-aurora-border-light dark:border-aurora-border-dark">
        <button
          onClick={cycleTheme}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-aurora-text-secondary dark:text-aurora-text-dark-secondary hover:bg-aurora-muted-light dark:hover:bg-aurora-muted-dark transition-colors ${
            collapsed && !isMobile ? 'justify-center' : ''
          }`}
          title={collapsed && !isMobile ? `主题: ${theme}` : undefined}
        >
          <ThemeIcon className="w-5 h-5 flex-shrink-0" />
          {(!collapsed || isMobile) && (
            <span className="text-sm font-medium capitalize">
              {theme === 'system' ? '跟随系统' : theme === 'light' ? '浅色' : '深色'}
            </span>
          )}
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-aurora-bg-light dark:bg-aurora-bg-dark transition-colors duration-150 overflow-hidden">
      {/* 桌面端侧边栏 */}
      {!isMobile && (
        <aside
          className={`flex flex-col border-r border-aurora-border-light dark:border-aurora-border-dark bg-aurora-sidebar-light dark:bg-aurora-sidebar-dark transition-all duration-200 ${
            collapsed ? 'w-16' : 'w-72'
          }`}
        >
          {sidebarContent}
        </aside>
      )}

      {/* 移动端侧边栏遮罩 */}
      {isMobile && mobileOpen && (
        <>
          <aside className="absolute inset-y-0 left-0 z-50 w-72 flex flex-col bg-aurora-sidebar-light dark:bg-aurora-sidebar-dark border-r border-aurora-border-light dark:border-aurora-border-dark transform transition-transform duration-300 ease-in-out translate-x-0">
            {sidebarContent}
          </aside>
          <div
            className="absolute inset-0 z-40 bg-black/30 transition-opacity duration-300 opacity-100"
            onClick={() => setMobileOpen(false)}
          />
        </>
      )}

      {/* 主内容区 */}
      <main className="flex-1 overflow-hidden relative flex flex-col">
        {/* 移动端顶部栏 */}
        {isMobile && (
          <div className="h-14 flex items-center px-4 border-b border-aurora-border-light dark:border-aurora-border-dark bg-aurora-bg-light dark:bg-aurora-bg-dark">
            <button
              onClick={() => setMobileOpen(true)}
              className="p-2 -ml-2 rounded-lg hover:bg-aurora-muted-light dark:hover:bg-aurora-muted-dark transition-colors"
            >
              <Menu className="w-5 h-5 text-aurora-text-primary dark:text-aurora-text-dark-primary" />
            </button>
            <span className="ml-3 text-base font-medium text-aurora-text-primary dark:text-aurora-text-dark-primary">
              {tabs.find((t) => t.id === activeTab)?.label}
            </span>
          </div>
        )}

        <div className="flex-1 overflow-hidden">
          <Suspense fallback={
            <div className="flex items-center justify-center h-full text-aurora-text-secondary dark:text-aurora-text-dark-secondary">
              <svg className="animate-spin h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
          }>
            {activeTab === 'chat' && <ChatView />}
            {activeTab === 'images' && <ImagesView />}
            {activeTab === 'audio' && <AudioView />}
            {activeTab === 'settings' && <SettingsView />}
          </Suspense>
        </div>
      </main>

      {/* P2-5: Ctrl+K 命令面板 */}
      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onNavigate={(tab) => handleTabClick(tab as Tab)}
      />
    </div>
  );
}

export default App;
