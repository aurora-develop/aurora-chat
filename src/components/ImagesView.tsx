import { useState } from 'react';
import { generateImage, editImage } from '../api/images';
import { useSettingsStore } from '../stores/settingsStore';
import { Wand2, Upload, Sparkles } from 'lucide-react';

export default function ImagesView() {
  const { model } = useSettingsStore();
  const [mode, setMode] = useState<'generate' | 'edit'>('generate');
  const [prompt, setPrompt] = useState('');
  const [size, setSize] = useState('1024x1024');
  const [n, setN] = useState(1);
  const [responseFormat, setResponseFormat] = useState<'url' | 'b64_json'>('url');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Array<{ url?: string; b64_json?: string }>>([]);
  const [error, setError] = useState('');

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
      setResults(response.data || []);
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
      setResults(response.data || []);
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
    }
  };

  return (
    <div className="h-full flex flex-col bg-aurora-bg-light dark:bg-aurora-bg-dark transition-colors duration-150">
      <header className="h-14 flex items-center justify-between px-6 border-b border-aurora-border-light dark:border-aurora-border-dark">
        <h2 className="text-base font-medium text-aurora-text-primary dark:text-aurora-text-dark-primary">图片生成</h2>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto py-8 px-6 space-y-6">
          <div className="flex gap-2">
            <button
              onClick={() => setMode('generate')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                mode === 'generate'
                  ? 'bg-aurora-accent text-white dark:bg-aurora-accent-dark dark:text-black'
                  : 'text-aurora-text-secondary dark:text-aurora-text-dark-secondary hover:bg-aurora-muted-light dark:hover:bg-aurora-muted-dark'
              }`}
            >
              <Wand2 className="w-4 h-4" />
              <span>文生图</span>
            </button>
            <button
              onClick={() => setMode('edit')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                mode === 'edit'
                  ? 'bg-aurora-accent text-white dark:bg-aurora-accent-dark dark:text-black'
                  : 'text-aurora-text-secondary dark:text-aurora-text-dark-secondary hover:bg-aurora-muted-light dark:hover:bg-aurora-muted-dark'
              }`}
            >
              <Upload className="w-4 h-4" />
              <span>改图</span>
            </button>
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
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-aurora-border-light dark:bg-aurora-border-dark"></div>
                  <span className="text-xs text-aurora-text-secondary dark:text-aurora-text-dark-secondary">或</span>
                  <div className="flex-1 h-px bg-aurora-border-light dark:bg-aurora-border-dark"></div>
                </div>
                <input
                  type="text"
                  value={imageUrl}
                  onChange={(e) => { setImageUrl(e.target.value); setImageFile(null); }}
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
                  <option value={1}>1</option>
                  <option value={2}>2</option>
                  <option value={3}>3</option>
                  <option value={4}>4</option>
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
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
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
              {results.map((result, idx) => (
                <div key={idx} className="rounded-xl overflow-hidden border border-aurora-border-light dark:border-aurora-border-dark animate-fade-in">
                  {result.url ? (
                    <img src={result.url} alt={`Generated ${idx + 1}`} className="w-full" />
                  ) : result.b64_json ? (
                    <img src={`data:image/png;base64,${result.b64_json}`} alt={`Generated ${idx + 1}`} className="w-full" />
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
