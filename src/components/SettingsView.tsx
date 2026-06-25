import { useState, useEffect } from 'react';
import { useSettingsStore } from '../stores/settingsStore';
import { refreshToken, sessionToToken } from '../api/auth';
import { getModels } from '../api/models';
import { Key, RefreshCw, Cookie, Trash2, CheckCircle, XCircle, Cpu, Eye, EyeOff, Globe, ToggleLeft, ToggleRight } from 'lucide-react';

export default function SettingsView() {
  const {
    token, setToken,
    model, setModel,
    useCustomApi, setUseCustomApi,
    customApiUrl, setCustomApiUrl,
    customApiKey, setCustomApiKey,
  } = useSettingsStore();
  const [refreshTokenInput, setRefreshTokenInput] = useState('');
  const [sessionTokenInput, setSessionTokenInput] = useState('');
  const [accessTokenInput, setAccessTokenInput] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');

  useEffect(() => {
    if (useCustomApi && customApiUrl) {
      loadModels();
    } else if (token) {
      loadModels();
    }
  }, [token, useCustomApi, customApiUrl]);

  const loadModels = async () => {
    try {
      const response = await getModels();
      setModels(response.data.map((m: any) => m.id));
    } catch (err) {
      console.error('Failed to load models:', err);
    }
  };

  const showMessage = (text: string, type: 'success' | 'error') => {
    setMessage(text);
    setMessageType(type);
    setTimeout(() => setMessage(''), 3000);
  };

  const handleRefreshToken = async () => {
    if (!refreshTokenInput.trim()) {
      showMessage('请输入 Refresh Token', 'error');
      return;
    }
    setLoading(true);
    setMessage('');
    try {
      const response = await refreshToken(refreshTokenInput);
      setToken(response.access_token);
      showMessage('Token 刷新成功', 'success');
      setRefreshTokenInput('');
    } catch (err) {
      showMessage(`刷新失败: ${err instanceof Error ? err.message : '未知错误'}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSessionToken = async () => {
    if (!sessionTokenInput.trim()) {
      showMessage('请输入 Session Token', 'error');
      return;
    }
    setLoading(true);
    setMessage('');
    try {
      const response = await sessionToToken(sessionTokenInput);
      setToken(response.access_token);
      showMessage('Session Token 转换成功', 'success');
      setSessionTokenInput('');
    } catch (err) {
      showMessage(`转换失败: ${err instanceof Error ? err.message : '未知错误'}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleClearToken = () => {
    setToken('');
    showMessage('Token 已清除', 'success');
  };

  return (
    <div className="h-full overflow-y-auto bg-aurora-bg-light dark:bg-aurora-bg-dark transition-colors duration-150">
      <header className="h-14 flex items-center justify-between px-6 border-b border-aurora-border-light dark:border-aurora-border-dark">
        <h2 className="text-base font-medium text-aurora-text-primary dark:text-aurora-text-dark-primary">设置</h2>
      </header>

      <div className="max-w-2xl mx-auto p-6 space-y-6">
        {message && (
          <div className={`p-4 rounded-xl flex items-center gap-3 animate-fade-in ${
            messageType === 'success'
              ? 'bg-aurora-surface-light dark:bg-aurora-surface-dark border border-aurora-border-light dark:border-aurora-border-dark text-aurora-text-primary dark:text-aurora-text-dark-primary'
              : 'bg-aurora-error/10 border border-aurora-error/20 text-aurora-error dark:text-aurora-error-dark'
          }`}>
            {messageType === 'success' ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
            <span className="text-sm font-medium">{message}</span>
          </div>
        )}

        <div className="bg-aurora-surface-light dark:bg-aurora-surface-dark border border-aurora-border-light dark:border-aurora-border-dark rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Key className="w-5 h-5 text-aurora-text-secondary dark:text-aurora-text-dark-secondary" />
            <h3 className="text-base font-medium text-aurora-text-primary dark:text-aurora-text-dark-primary">当前 Token</h3>
          </div>
          <p className="text-xs text-aurora-text-secondary dark:text-aurora-text-dark-secondary mb-3">
            可在 <a href="https://chatgpt.com/api/auth/session" target="_blank" rel="noreferrer" className="text-aurora-accent dark:text-aurora-accent-dark underline hover:no-underline">https://chatgpt.com/api/auth/session</a> 中获取 access_token
          </p>
          <div className="flex items-center gap-3">
            <div className="flex-1 px-4 py-3 bg-aurora-bg-light dark:bg-aurora-bg-dark border border-aurora-border-light dark:border-aurora-border-dark rounded-lg font-mono text-sm text-aurora-text-secondary dark:text-aurora-text-dark-secondary truncate">
              {token ? `${token.substring(0, 35)}...` : '未设置'}
            </div>
            {token && (
              <button
                onClick={handleClearToken}
                className="flex items-center gap-2 px-4 py-3 border border-aurora-border-light dark:border-aurora-border-dark rounded-lg hover:bg-aurora-muted-light dark:hover:bg-aurora-muted-dark transition-colors text-sm font-medium"
              >
                <Trash2 className="w-4 h-4" />
                <span>清除</span>
              </button>
            )}
          </div>

          {/* 直接输入 access_token */}
          <div className="mt-4 pt-4 border-t border-aurora-border-light dark:border-aurora-border-dark">
            <label className="block text-sm text-aurora-text-secondary dark:text-aurora-text-dark-secondary mb-2">
              直接输入 Access Token
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type={showToken ? 'text' : 'password'}
                  value={accessTokenInput}
                  onChange={(e) => setAccessTokenInput(e.target.value)}
                  placeholder="eyJhbGciOiJSUzI1NiI..."
                  className="w-full px-4 py-2.5 pr-10 bg-aurora-bg-light dark:bg-aurora-bg-dark border border-aurora-border-light dark:border-aurora-border-dark rounded-lg focus:outline-none focus:border-aurora-text-primary dark:focus:border-aurora-text-dark-primary transition-colors text-aurora-text-primary dark:text-aurora-text-dark-primary text-sm"
                />
                <button
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-aurora-text-secondary dark:text-aurora-text-dark-secondary hover:text-aurora-text-primary dark:hover:text-aurora-text-dark-primary"
                  type="button"
                >
                  {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <button
                onClick={() => {
                  if (accessTokenInput.trim()) {
                    setToken(accessTokenInput.trim());
                    showMessage('Access Token 已保存', 'success');
                    setAccessTokenInput('');
                  }
                }}
                disabled={!accessTokenInput.trim()}
                className="px-4 py-2.5 bg-aurora-accent text-white dark:bg-aurora-accent-dark dark:text-black rounded-lg hover:bg-aurora-accent-hover dark:hover:bg-aurora-accent-dark-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-sm font-medium"
              >
                保存
              </button>
            </div>
            <p className="text-xs text-aurora-text-secondary dark:text-aurora-text-dark-secondary mt-1.5">
              支持服务 key、ChatGPT access_token 或免费 device id
            </p>
          </div>

          {token && (
            <div className="mt-3 flex items-center gap-2 text-sm text-aurora-text-secondary dark:text-aurora-text-dark-secondary">
              <div className="w-1.5 h-1.5 rounded-full bg-aurora-accent dark:bg-aurora-accent-dark"></div>
              <span>已连接</span>
            </div>
          )}
        </div>

        <div className="bg-aurora-surface-light dark:bg-aurora-surface-dark border border-aurora-border-light dark:border-aurora-border-dark rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <RefreshCw className="w-5 h-5 text-aurora-text-secondary dark:text-aurora-text-dark-secondary" />
            <h3 className="text-base font-medium text-aurora-text-primary dark:text-aurora-text-dark-primary">Refresh Token</h3>
          </div>
          <p className="text-sm text-aurora-text-secondary dark:text-aurora-text-dark-secondary mb-4">使用 refresh_token 换取 access_token</p>
          <div className="space-y-3">
            <input
              type="password"
              value={refreshTokenInput}
              onChange={(e) => setRefreshTokenInput(e.target.value)}
              placeholder="输入 Refresh Token"
              className="w-full px-4 py-3 bg-aurora-bg-light dark:bg-aurora-bg-dark border border-aurora-border-light dark:border-aurora-border-dark rounded-lg focus:outline-none focus:border-aurora-text-primary dark:focus:border-aurora-text-dark-primary transition-colors text-aurora-text-primary dark:text-aurora-text-dark-primary"
            />
            <button
              onClick={handleRefreshToken}
              disabled={loading}
              className="w-full px-6 py-3 bg-aurora-accent text-white dark:bg-aurora-accent-dark dark:text-black rounded-lg hover:bg-aurora-accent-hover dark:hover:bg-aurora-accent-dark-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>处理中...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-5 h-5" />
                  <span>刷新 Token</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div className="bg-aurora-surface-light dark:bg-aurora-surface-dark border border-aurora-border-light dark:border-aurora-border-dark rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Cookie className="w-5 h-5 text-aurora-text-secondary dark:text-aurora-text-dark-secondary" />
            <h3 className="text-base font-medium text-aurora-text-primary dark:text-aurora-text-dark-primary">Session Token</h3>
          </div>
          <p className="text-sm text-aurora-text-secondary dark:text-aurora-text-dark-secondary mb-4">使用 __Secure-next-auth.session-token 换取 access_token</p>
          <div className="space-y-3">
            <input
              type="password"
              value={sessionTokenInput}
              onChange={(e) => setSessionTokenInput(e.target.value)}
              placeholder="输入 Session Token"
              className="w-full px-4 py-3 bg-aurora-bg-light dark:bg-aurora-bg-dark border border-aurora-border-light dark:border-aurora-border-dark rounded-lg focus:outline-none focus:border-aurora-text-primary dark:focus:border-aurora-text-dark-primary transition-colors text-aurora-text-primary dark:text-aurora-text-dark-primary"
            />
            <button
              onClick={handleSessionToken}
              disabled={loading}
              className="w-full px-6 py-3 bg-aurora-accent text-white dark:bg-aurora-accent-dark dark:text-black rounded-lg hover:bg-aurora-accent-hover dark:hover:bg-aurora-accent-dark-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>处理中...</span>
                </>
              ) : (
                <>
                  <Cookie className="w-5 h-5" />
                  <span>转换 Token</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div className="bg-aurora-surface-light dark:bg-aurora-surface-dark border border-aurora-border-light dark:border-aurora-border-dark rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-aurora-text-secondary dark:text-aurora-text-dark-secondary" />
              <h3 className="text-base font-medium text-aurora-text-primary dark:text-aurora-text-dark-primary">自定义 API</h3>
            </div>
            <button
              onClick={() => setUseCustomApi(!useCustomApi)}
              className="flex items-center gap-1.5 text-sm font-medium transition-colors"
            >
              {useCustomApi ? (
                <>
                  <ToggleRight className="w-5 h-5 text-aurora-accent dark:text-aurora-accent-dark" />
                  <span className="text-aurora-accent dark:text-aurora-accent-dark">已启用</span>
                </>
              ) : (
                <>
                  <ToggleLeft className="w-5 h-5 text-aurora-text-secondary dark:text-aurora-text-dark-secondary" />
                  <span className="text-aurora-text-secondary dark:text-aurora-text-dark-secondary">已禁用</span>
                </>
              )}
            </button>
          </div>
          <p className="text-sm text-aurora-text-secondary dark:text-aurora-text-dark-secondary mb-4">
            使用自定义的 OpenAI 兼容 API 地址（如 http://api.openai.com/v1/chat/completions 格式）
          </p>
          {useCustomApi && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-aurora-text-secondary dark:text-aurora-text-dark-secondary mb-1.5">
                  API 基础地址（Base URL）
                </label>
                <input
                  type="text"
                  value={customApiUrl}
                  onChange={(e) => setCustomApiUrl(e.target.value)}
                  placeholder="https://api.openai.com"
                  className="w-full px-4 py-2.5 bg-aurora-bg-light dark:bg-aurora-bg-dark border border-aurora-border-light dark:border-aurora-border-dark rounded-lg focus:outline-none focus:border-aurora-text-primary dark:focus:border-aurora-text-dark-primary transition-colors text-aurora-text-primary dark:text-aurora-text-dark-primary text-sm"
                />
                <p className="text-xs text-aurora-text-secondary dark:text-aurora-text-dark-secondary mt-1">
                  只需提供域名，程序会自动追加 /v1/chat/completions 等路径
                </p>
              </div>
              <div>
                <label className="block text-sm text-aurora-text-secondary dark:text-aurora-text-dark-secondary mb-1.5">
                  API 密钥（API Key）
                </label>
                <div className="relative">
                  <input
                    type={showToken ? 'text' : 'password'}
                    value={customApiKey}
                    onChange={(e) => setCustomApiKey(e.target.value)}
                    placeholder="sk-..."
                    className="w-full px-4 py-2.5 pr-10 bg-aurora-bg-light dark:bg-aurora-bg-dark border border-aurora-border-light dark:border-aurora-border-dark rounded-lg focus:outline-none focus:border-aurora-text-primary dark:focus:border-aurora-text-dark-primary transition-colors text-aurora-text-primary dark:text-aurora-text-dark-primary text-sm"
                  />
                  <button
                    onClick={() => setShowToken(!showToken)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-aurora-text-secondary dark:text-aurora-text-dark-secondary hover:text-aurora-text-primary dark:hover:text-aurora-text-dark-primary"
                    type="button"
                  >
                    {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <button
                onClick={() => {
                  if (customApiUrl.trim()) {
                    loadModels();
                    showMessage('自定义 API 配置已生效', 'success');
                  }
                }}
                disabled={!customApiUrl.trim()}
                className="w-full px-6 py-2.5 bg-aurora-accent text-white dark:bg-aurora-accent-dark dark:text-black rounded-lg hover:bg-aurora-accent-hover dark:hover:bg-aurora-accent-dark-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors font-medium text-sm"
              >
                测试连接并加载模型
              </button>
            </div>
          )}
          {!useCustomApi && (
            <p className="text-sm text-aurora-text-secondary dark:text-aurora-text-dark-secondary flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5" />
              当前使用默认 API 服务器
            </p>
          )}
        </div>

        <div className="bg-aurora-surface-light dark:bg-aurora-surface-dark border border-aurora-border-light dark:border-aurora-border-dark rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Cpu className="w-5 h-5 text-aurora-text-secondary dark:text-aurora-text-dark-secondary" />
            <h3 className="text-base font-medium text-aurora-text-primary dark:text-aurora-text-dark-primary">模型选择</h3>
          </div>
          <div className="space-y-3">
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full px-4 py-3 bg-aurora-bg-light dark:bg-aurora-bg-dark border border-aurora-border-light dark:border-aurora-border-dark rounded-lg focus:outline-none focus:border-aurora-text-primary dark:focus:border-aurora-text-dark-primary transition-colors text-aurora-text-primary dark:text-aurora-text-dark-primary"
              disabled={!token && !(useCustomApi && customApiUrl)}
            >
              <option value="auto">自动选择</option>
              {models.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            {!token && !(useCustomApi && customApiUrl) && (
              <p className="text-sm text-aurora-text-secondary dark:text-aurora-text-dark-secondary flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5" />
                请先设置 Token 或启用自定义 API 以加载模型列表
              </p>
            )}
            {useCustomApi && customApiUrl && models.length === 0 && (
              <p className="text-sm text-aurora-text-secondary dark:text-aurora-text-dark-secondary flex items-center gap-1.5">
                点击"测试连接并加载模型"获取模型列表
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
