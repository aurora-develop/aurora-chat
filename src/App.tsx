import { useState, useEffect, lazy, Suspense } from 'react';
import { MessageSquare, Image, Mic, Settings, ChevronLeft, ChevronRight, Sun, Moon, Menu, X } from 'lucide-react';
import { useThemeStore } from './stores/themeStore';

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
  const { theme, resolved, setTheme } = useThemeStore();

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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

  const sidebarContent = (
    <>
      <div className="h-14 flex items-center justify-between px-4 border-b border-aurora-border-light dark:border-aurora-border-dark">
        {!collapsed && !isMobile && (
          <h1 className="text-lg font-semibold tracking-tight text-aurora-text-primary dark:text-aurora-text-dark-primary">
            Aurora Chat
          </h1>
        )}
        {isMobile && (
          <h1 className="text-lg font-semibold tracking-tight text-aurora-text-primary dark:text-aurora-text-dark-primary">
            Aurora Chat
          </h1>
        )}
        <button
          onClick={() => isMobile ? setMobileOpen(false) : setCollapsed(!collapsed)}
          className="p-1 rounded-md hover:bg-aurora-muted-light dark:hover:bg-aurora-muted-dark transition-colors ml-auto"
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
              } ${collapsed && !isMobile ? 'justify-center' : ''}`}
              title={collapsed && !isMobile ? tab.label : undefined}
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
            collapsed ? 'w-16' : 'w-60'
          }`}
        >
          {sidebarContent}
        </aside>
      )}

      {/* 移动端侧边栏遮罩 */}
      {isMobile && mobileOpen && (
        <>
          <aside className="absolute inset-y-0 left-0 z-50 w-60 flex flex-col bg-aurora-sidebar-light dark:bg-aurora-sidebar-dark border-r border-aurora-border-light dark:border-aurora-border-dark">
            {sidebarContent}
          </aside>
          <div
            className="absolute inset-0 z-40 bg-black/30"
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
              {tabs.find(t => t.id === activeTab)?.label}
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
    </div>
  );
}

export default App;
