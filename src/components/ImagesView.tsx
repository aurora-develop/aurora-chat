import { useState } from 'react';
import { generateImage, editImage } from '../api/images';
import { useSettingsStore } from '../stores/settingsStore';
import { useImagesStore, type ImageHistoryItem } from '../stores/imagesStore';
import { useChatStore } from '../stores/chatStore';
import {
  Wand2, Upload, Sparkles, History, Download, Trash2, X, Check, Send
} from 'lucide-react';

export default function ImagesView() {
  const { model } = useSettingsStore();
  const { history, addToHistory, deleteFromHistory, clearHistory } = useImagesStore();

  const [mode, setMode] = useState<'generate' | 'edit'>('generate');
  const [prompt, setPrompt] = useState('');
  const [size, setSize] = useState('1024x1024');
  const [n, setN] = useState(1);
  const [responseFormat, setResponseFormat] = useState<'url' | 'b64_json'>('url');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState('');
  const [imagePreview, setImagePreview] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Array<{ url?: string; b64_json?: string; revised_prompt?: string }>>([]);
  const [error, setError] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('请输入提示词');
      return;
    }
    setLoading(true);
    setError('');
    setResults([]);
    try {
      const response = await generateImage({
        model: model === 'auto' ? 'gpt-image-2' : model,
        prompt,
        n,
        size,
        response_format: responseFormat,
      });
      const data = response.data || [];
      setResults(data);

      // 保存到历史
      addToHistory({
        prompt,
        mode: 'generate',
        size,
        n,
        responseFormat,
        results: data,
        model: model === 'auto' ? 'gpt-image-2' : model,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成失败');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = async () => {
    if (!imageFile && !imageUrl) {
      setError('请上传图片或输入图片 URL');
      return;
    }
    setLoading(true);
    setError('');
    setResults([]);
    try {
      const response = await editImage({
        model: model === 'auto' ? 'gpt-image-2' : model,
        prompt: prompt || undefined,
        image: imageFile || imageUrl,
        n,
        response_format: responseFormat,
      });
      const data = response.data || [];
      setResults(data);

      addToHistory({
        prompt,
        mode: 'edit',
        size,
        n,
        responseFormat,
        results: data,
        model: model === 'auto' ? 'gpt-image-2' : model,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : '编辑失败');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImageUrl('');
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const loadFromHistory = (item: ImageHistoryItem) => {
    setMode(item.mode as 'generate' | 'edit');
    setPrompt(item.prompt || '');
    setSize(item.size);
    setN(item.n);
    setResponseFormat(item.responseFormat);
    setResults(item.results);
    setShowHistory(false);
  };

  const downloadImage = (result: { url?: string; b64_json?: string }, index: number) => {
    const a = document.createElement('a');
    if (result.url) {
      a.href = result.url;
      a.download = `aurora-image-${index + 1}.png`;
    } else if (result.b64_json) {
      a.href = `data:image/png;base64,${result.b64_json}`;
      a.download = `aurora-image-${index + 1}.png`;
    }
    a.click();
  };

  const copyImageUrl = async (url: string | undefined, index: number) => {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const renderResult = (result: { url?: string; b64_json?: string; revised_prompt?: string }, idx: number) => {
    const src = result.url || (result.b64_json ? `data:image/png;base64,${result.b64_json}` : '');
    if (!src) return null;

    return (
      <div key={idx} className="rounded-xl overflow-hidden border border-aurora-border-light dark:border-aurora-border-dark animate-fade-in">
        <img src={src} alt={`Generated ${idx + 1}`} className="w-full" />
        {result.revised_prompt && (
          <div className="px-3 py-2 text-xs text-aurora-text-secondary dark:text-aurora-text-dark-secondary bg-aurora-muted-light dark:bg-aurora-muted-dark border-t border-aurora-border-light dark:border-aurora-border-dark">
            {result.revised_prompt}
          </div>
        )}
        <div className="flex items-center gap-1 px-3 py-2 border-t border-aurora-border-light dark:border-aurora-border-dark bg-aurora-surface-light dark:bg-aurora-surface-dark">
          <button
            onClick={() => downloadImage(result, idx)}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-aurora-border-light dark:border-aurora-border-dark hover:bg-aurora-muted-light dark:hover:bg-aurora-muted-dark transition-colors"
            title="下载"
          >
            <Download className="w-3.5 h-3.5" />
            <span>下载</span>
          </button>
          <button
            onClick={() => copyImageUrl(result.url || result.b64_json, idx)}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-aurora-border-light dark:border-aurora-border-dark hover:bg-aurora-muted-light dark:hover:bg-aurora-muted-dark transition-colors"
            title={result.url ? '复制 URL' : '复制 Base64'}
          >
            {copiedIndex === idx ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
            <span>{copiedIndex === idx ? '已复制' : (result.url ? '复制链接' : '复制')}</span>
          </button>
          <button
            onClick={() => {
              const imageUrl = result.url || `data:image/png;base64,${result.b64_json}`;
              const store = useChatStore.getState();
              let convId = store.currentConversationId;
              if (!convId) convId = store.createConversation();
              const conv = store.conversations.find(c => c.id === convId);
              const leafId = conv?.currentLeafId || null;
              const userMsgId = store.addMessage(convId, leafId, {
                role: 'user',
                content: [{ type: 'input_image', image_url: imageUrl }],
              });
              store.addMessage(convId, userMsgId, {
                role: 'assistant',
                content: '图片已发送到对话。',
              });
              alert('图片已发送到聊天');
            }}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-aurora-border-light dark:border-aurora-border-dark hover:bg-aurora-muted-light dark:hover:bg-aurora-muted-dark transition-colors"
            title="发送到聊天"
          >
            <Send className="w-3.5 h-3.5" />
            <span>发到聊天</span>
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-aurora-bg-light dark:bg-aurora-bg-dark transition-colors duration-150">
      <header className="h-14 flex items-center justify-between px-6 border-b border-aurora-border-light dark:border-aurora-border-dark">
        <h2 className="text-base font-medium text-aurora-text-primary dark:text-aurora-text-dark-primary">图片生成</h2>
        <button
          onClick={() => setShowHistory((v) => !v)}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
            showHistory
              ? 'bg-aurora-accent text-white dark:bg-aurora-accent-dark dark:text-black border-aurora-accent dark:border-aurora-accent-dark'
              : 'border-aurora-border-light dark:border-aurora-border-dark text-aurora-text-secondary dark:text-aurora-text-dark-secondary hover:bg-aurora-muted-light dark:hover:bg-aurora-muted-dark'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>历史</span>
          {history.length > 0 && (
            <span className="ml-0.5 opacity-70">({history.length})</span>
          )}
        </button>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* 主内容 */}
        <div className={`flex-1 overflow-y-auto ${showHistory ? 'border-r border-aurora-border-light dark:border-aurora-border-dark' : ''}`}>
          <div className="max-w-3xl mx-auto py-8 px-6 space-y-6">
            <div className="flex gap-2">
              {[
                { id: 'generate' as const, label: '文生图', icon: Wand2 },
                { id: 'edit' as const, label: '改图', icon: Upload },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => setMode(item.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      mode === item.id
                        ? 'bg-aurora-accent text-white dark:bg-aurora-accent-dark dark:text-black'
                        : 'text-aurora-text-secondary dark:text-aurora-text-dark-secondary hover:bg-aurora-muted-light dark:hover:bg-aurora-muted-dark'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-aurora-text-secondary dark:text-aurora-text-dark-secondary mb-2">
                  提示词 {mode === 'edit' && '(可选)'}
                </label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={mode === 'generate' ? '描述你想生成的图片...' : '描述你想如何修改图片...'}
                  className="w-full px-4 py-3 bg-aurora-surface-light dark:bg-aurora-surface-dark border border-aurora-border-light dark:border-aurora-border-dark rounded-xl focus:outline-none focus:border-aurora-text-primary dark:focus:border-aurora-text-dark-primary transition-colors resize-none text-aurora-text-primary dark:text-aurora-text-dark-primary placeholder:text-aurora-text-secondary dark:placeholder:text-aurora-text-dark-secondary"
                  rows={3}
                />
              </div>

              {mode === 'edit' && (
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-aurora-text-secondary dark:text-aurora-text-dark-secondary">
                    上传图片
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="w-full px-4 py-3 bg-aurora-surface-light dark:bg-aurora-surface-dark border border-aurora-border-light dark:border-aurora-border-dark rounded-xl focus:outline-none focus:border-aurora-text-primary dark:focus:border-aurora-text-dark-primary transition-colors file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-aurora-accent file:text-white dark:file:bg-aurora-accent-dark dark:file:text-black hover:file:bg-aurora-accent-hover dark:hover:file:bg-aurora-accent-dark-hover"
                  />
                  {imagePreview && (
                    <img src={imagePreview} alt="Preview" className="max-w-xs rounded-xl border border-aurora-border-light dark:border-aurora-border-dark" />
                  )}
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-aurora-border-light dark:bg-aurora-border-dark" />
                    <span className="text-xs text-aurora-text-secondary dark:text-aurora-text-dark-secondary">或</span>
                    <div className="flex-1 h-px bg-aurora-border-light dark:bg-aurora-border-dark" />
                  </div>
                  <input
                    type="text"
                    value={imageUrl}
                    onChange={(e) => { setImageUrl(e.target.value); setImageFile(null); setImagePreview(e.target.value); }}
                    placeholder="输入图片 URL"
                    className="w-full px-4 py-3 bg-aurora-surface-light dark:bg-aurora-surface-dark border border-aurora-border-light dark:border-aurora-border-dark rounded-xl focus:outline-none focus:border-aurora-text-primary dark:focus:border-aurora-text-dark-primary transition-colors text-aurora-text-primary dark:text-aurora-text-dark-primary placeholder:text-aurora-text-secondary dark:placeholder:text-aurora-text-dark-secondary"
                  />
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-aurora-text-secondary dark:text-aurora-text-dark-secondary mb-1.5">尺寸</label>
                  <select
                    value={size}
                    onChange={(e) => setSize(e.target.value)}
                    className="w-full px-3 py-2.5 bg-aurora-surface-light dark:bg-aurora-surface-dark border border-aurora-border-light dark:border-aurora-border-dark rounded-lg focus:outline-none focus:border-aurora-text-primary dark:focus:border-aurora-text-dark-primary transition-colors text-sm text-aurora-text-primary dark:text-aurora-text-dark-primary"
                  >
                    <option value="1024x1024">1024x1024</option>
                    <option value="1024x1792">1024x1792</option>
                    <option value="1792x1024">1792x1024</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-aurora-text-secondary dark:text-aurora-text-dark-secondary mb-1.5">数量</label>
                  <select
                    value={n}
                    onChange={(e) => setN(Number(e.target.value))}
                    className="w-full px-3 py-2.5 bg-aurora-surface-light dark:bg-aurora-surface-dark border border-aurora-border-light dark:border-aurora-border-dark rounded-lg focus:outline-none focus:border-aurora-text-primary dark:focus:border-aurora-text-dark-primary transition-colors text-sm text-aurora-text-primary dark:text-aurora-text-dark-primary"
                  >
                    {[1, 2, 3, 4].map((i) => <option key={i} value={i}>{i}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-aurora-text-secondary dark:text-aurora-text-dark-secondary mb-1.5">格式</label>
                  <select
                    value={responseFormat}
                    onChange={(e) => setResponseFormat(e.target.value as 'url' | 'b64_json')}
                    className="w-full px-3 py-2.5 bg-aurora-surface-light dark:bg-aurora-surface-dark border border-aurora-border-light dark:border-aurora-border-dark rounded-lg focus:outline-none focus:border-aurora-text-primary dark:focus:border-aurora-text-dark-primary transition-colors text-sm text-aurora-text-primary dark:text-aurora-text-dark-primary"
                  >
                    <option value="url">URL</option>
                    <option value="b64_json">Base64</option>
                  </select>
                </div>
              </div>

              {error && (
                <div className="p-3 bg-aurora-error/10 border border-aurora-error/20 rounded-lg text-aurora-error dark:text-aurora-error-dark text-sm">
                  {error}
                </div>
              )}

              <button
                onClick={mode === 'generate' ? handleGenerate : handleEdit}
                disabled={loading}
                className="w-full px-6 py-3 bg-aurora-accent text-white dark:bg-aurora-accent-dark dark:text-black rounded-lg hover:bg-aurora-accent-hover dark:hover:bg-aurora-accent-dark-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>生成中...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    <span>{mode === 'generate' ? '生成图片' : '编辑图片'}</span>
                  </>
                )}
              </button>
            </div>

            {results.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                {results.map((result, idx) => renderResult(result, idx))}
              </div>
            )}
          </div>
        </div>

        {/* 历史侧边栏 */}
        {showHistory && (
          <div className="w-80 flex-shrink-0 overflow-y-auto bg-aurora-sidebar-light dark:bg-aurora-sidebar-dark">
            <div className="flex items-center justify-between px-4 py-3 border-b border-aurora-border-light dark:border-aurora-border-dark">
              <span className="text-sm font-medium text-aurora-text-primary dark:text-aurora-text-dark-primary">
                生成历史
              </span>
              {history.length > 0 && (
                <button
                  onClick={() => { if (confirm('确定清空所有图片生成历史？')) clearHistory(); }}
                  className="text-xs text-aurora-text-secondary dark:text-aurora-text-dark-secondary hover:text-aurora-error dark:hover:text-aurora-error-dark"
                >
                  清空
                </button>
              )}
            </div>
            <div className="space-y-2 p-3">
              {history.length === 0 && (
                <div className="text-center py-8 text-sm text-aurora-text-secondary dark:text-aurora-text-dark-secondary">
                  暂无历史记录
                </div>
              )}
              {history.map((item) => (
                <div
                  key={item.id}
                  className="group flex gap-3 p-3 rounded-lg cursor-pointer hover:bg-aurora-muted-light/50 dark:hover:bg-aurora-muted-dark/50 transition-colors border border-transparent hover:border-aurora-border-light dark:hover:border-aurora-border-dark"
                  onClick={() => loadFromHistory(item)}
                >
                  <div className="w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden bg-aurora-muted-light dark:bg-aurora-muted-dark">
                    {item.results[0]?.url ? (
                      <img src={item.results[0].url} alt={item.prompt} className="w-full h-full object-cover" />
                    ) : item.results[0]?.b64_json ? (
                      <img src={`data:image/png;base64,${item.results[0].b64_json}`} alt={item.prompt} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-aurora-text-secondary dark:text-aurora-text-dark-secondary text-xs">
                        无预览
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate text-aurora-text-primary dark:text-aurora-text-dark-primary">
                      {item.prompt || '(无提示词)'}
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-aurora-text-secondary dark:text-aurora-text-dark-secondary">
                      <span>{item.mode === 'generate' ? '生成' : '编辑'}</span>
                      <span>·</span>
                      <span>{item.size}</span>
                    </div>
                    <div className="text-xs text-aurora-text-secondary dark:text-aurora-text-dark-secondary">
                      {new Date(item.createdAt).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteFromHistory(item.id); }}
                    className="p-1 rounded opacity-0 group-hover:opacity-100 text-aurora-text-secondary dark:text-aurora-text-dark-secondary hover:text-aurora-error dark:hover:text-aurora-error-dark transition-all"
                    title="删除"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
