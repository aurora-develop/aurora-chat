import React from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  level?: 'global' | 'view' | 'message';
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * P0-5: 三层 ErrorBoundary 策略
 * - global: 兜底白屏防护，显示刷新按钮
 * - view: 单个视图独立 boundary（ChatView/ImagesView 等）
 * - message: 单条消息渲染失败只显示错误占位
 */
export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(`[ErrorBoundary:${this.props.level || 'global'}]`, error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const { level = 'global' } = this.props;

      if (level === 'message') {
        return (
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>消息渲染失败</span>
            <button onClick={this.handleReset} className="ml-auto text-xs underline hover:no-underline">重试</button>
          </div>
        );
      }

      if (level === 'view') {
        return (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-6">
            <div className="p-3 rounded-full bg-aurora-muted-light dark:bg-aurora-muted-dark">
              <AlertTriangle className="w-8 h-8 text-aurora-text-secondary dark:text-aurora-text-dark-secondary" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-aurora-text-primary dark:text-aurora-text-dark-primary mb-1">
                页面加载出错
              </h3>
              <p className="text-sm text-aurora-text-secondary dark:text-aurora-text-dark-secondary">
                {this.state.error?.message || '未知错误'}
              </p>
            </div>
            <button
              onClick={this.handleReset}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-aurora-accent text-white dark:bg-aurora-accent-dark dark:text-black hover:bg-aurora-accent-hover dark:hover:bg-aurora-accent-dark-hover transition-colors"
            >
              <RotateCw className="w-4 h-4" />
              重试
            </button>
          </div>
        );
      }

      // global level
      return (
        <div className="flex flex-col items-center justify-center min-h-screen gap-4 text-center p-6 bg-aurora-bg-light dark:bg-aurora-bg-dark">
          <div className="p-4 rounded-full bg-aurora-muted-light dark:bg-aurora-muted-dark">
            <AlertTriangle className="w-12 h-12 text-aurora-error dark:text-aurora-error-dark" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-aurora-text-primary dark:text-aurora-text-dark-primary mb-2">
              应用发生错误
            </h1>
            <p className="text-sm text-aurora-text-secondary dark:text-aurora-text-dark-secondary max-w-md">
              {this.state.error?.message || '未知错误导致页面无法正常显示'}
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={this.handleReset}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-aurora-border-light dark:border-aurora-border-dark text-aurora-text-primary dark:text-aurora-text-dark-primary hover:bg-aurora-muted-light dark:hover:bg-aurora-muted-dark transition-colors"
            >
              重试
            </button>
            <button
              onClick={this.handleReload}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-aurora-accent text-white dark:bg-aurora-accent-dark dark:text-black hover:bg-aurora-accent-hover dark:hover:bg-aurora-accent-dark-hover transition-colors"
            >
              刷新页面
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
