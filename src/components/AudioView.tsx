import { useState, useRef } from 'react';
import { textToSpeech, transcribeAudio, translateAudio } from '../api/audio';
import { Volume2, Mic, Languages, Download, Copy, Check } from 'lucide-react';

type AudioMode = 'tts' | 'stt' | 'translate';

export default function AudioView() {
  const [mode, setMode] = useState<AudioMode>('tts');
  const [text, setText] = useState('');
  const [voice, setVoice] = useState('alloy');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [language, setLanguage] = useState('zh');
  const [loading, setLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState('');
  const [transcription, setTranscription] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const voices = ['alloy', 'ash', 'coral', 'echo', 'fable', 'onyx', 'nova', 'sage', 'shimmer'];

  const handleTTS = async () => {
    if (!text.trim()) {
      setError('请输入要转换的文本');
      return;
    }
    setLoading(true);
    setError('');
    setAudioUrl('');
    try {
      const blob = await textToSpeech({ model: 'tts-1', input: text, voice, response_format: 'mp3' });
      setAudioUrl(URL.createObjectURL(blob));
    } catch (err) {
      setError(err instanceof Error ? err.message : '转换失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSTT = async () => {
    if (!audioFile) {
      setError('请选择音频文件');
      return;
    }
    setLoading(true);
    setError('');
    setTranscription('');
    try {
      const response = await transcribeAudio({ file: audioFile, model: 'whisper-1', language, response_format: 'json' });
      setTranscription(response.text);
    } catch (err) {
      setError(err instanceof Error ? err.message : '转写失败');
    } finally {
      setLoading(false);
    }
  };

  const handleTranslate = async () => {
    if (!audioFile) {
      setError('请选择音频文件');
      return;
    }
    setLoading(true);
    setError('');
    setTranscription('');
    try {
      const response = await translateAudio({ file: audioFile, model: 'whisper-1', response_format: 'json' });
      setTranscription(response.text);
    } catch (err) {
      setError(err instanceof Error ? err.message : '翻译失败');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setAudioFile(file);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(transcription);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="h-full flex flex-col bg-aurora-bg-light dark:bg-aurora-bg-dark transition-colors duration-150">
      <header className="h-14 flex items-center justify-between px-6 border-b border-aurora-border-light dark:border-aurora-border-dark">
        <h2 className="text-base font-medium text-aurora-text-primary dark:text-aurora-text-dark-primary">语音功能</h2>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto py-8 px-6 space-y-6">
          <div className="flex gap-2">
            {[
              { id: 'tts' as AudioMode, label: '文字转语音', icon: Volume2 },
              { id: 'stt' as AudioMode, label: '语音转文字', icon: Mic },
              { id: 'translate' as AudioMode, label: '音频翻译', icon: Languages },
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
            {mode === 'tts' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-aurora-text-secondary dark:text-aurora-text-dark-secondary mb-2">文本内容</label>
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="输入要转换为语音的文本..."
                    className="w-full px-4 py-3 bg-aurora-surface-light dark:bg-aurora-surface-dark border border-aurora-border-light dark:border-aurora-border-dark rounded-xl focus:outline-none focus:border-aurora-text-primary dark:focus:border-aurora-text-dark-primary transition-colors resize-none text-aurora-text-primary dark:text-aurora-text-dark-primary placeholder:text-aurora-text-secondary dark:placeholder:text-aurora-text-dark-secondary"
                    rows={5}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-aurora-text-secondary dark:text-aurora-text-dark-secondary mb-2">语音角色</label>
                  <select
                    value={voice}
                    onChange={(e) => setVoice(e.target.value)}
                    className="w-full px-4 py-2.5 bg-aurora-surface-light dark:bg-aurora-surface-dark border border-aurora-border-light dark:border-aurora-border-dark rounded-lg focus:outline-none focus:border-aurora-text-primary dark:focus:border-aurora-text-dark-primary transition-colors text-aurora-text-primary dark:text-aurora-text-dark-primary"
                  >
                    {voices.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
              </>
            )}

            {(mode === 'stt' || mode === 'translate') && (
              <>
                <div>
                  <label className="block text-sm font-medium text-aurora-text-secondary dark:text-aurora-text-dark-secondary mb-2">音频文件</label>
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="audio/*"
                    onChange={handleFileChange}
                    className="w-full px-4 py-3 bg-aurora-surface-light dark:bg-aurora-surface-dark border border-aurora-border-light dark:border-aurora-border-dark rounded-xl focus:outline-none focus:border-aurora-text-primary dark:focus:border-aurora-text-dark-primary transition-colors file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-aurora-accent file:text-white dark:file:bg-aurora-accent-dark dark:file:text-black hover:file:bg-aurora-accent-hover dark:hover:file:bg-aurora-accent-dark-hover"
                  />
                </div>
                {mode === 'stt' && (
                  <div>
                    <label className="block text-sm font-medium text-aurora-text-secondary dark:text-aurora-text-dark-secondary mb-2">语言</label>
                    <input
                      type="text"
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                      placeholder="zh"
                      className="w-full px-4 py-2.5 bg-aurora-surface-light dark:bg-aurora-surface-dark border border-aurora-border-light dark:border-aurora-border-dark rounded-lg focus:outline-none focus:border-aurora-text-primary dark:focus:border-aurora-text-dark-primary transition-colors text-aurora-text-primary dark:text-aurora-text-dark-primary"
                    />
                    <p className="text-xs text-aurora-text-secondary dark:text-aurora-text-dark-secondary mt-1.5">ISO 语言代码，如 zh、en</p>
                  </div>
                )}
              </>
            )}

            {error && (
              <div className="p-3 bg-aurora-error/10 border border-aurora-error/20 rounded-lg text-aurora-error dark:text-aurora-error-dark text-sm">
                {error}
              </div>
            )}

            <button
              onClick={mode === 'tts' ? handleTTS : mode === 'stt' ? handleSTT : handleTranslate}
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
                  {mode === 'tts' ? <Volume2 className="w-5 h-5" /> : mode === 'stt' ? <Mic className="w-5 h-5" /> : <Languages className="w-5 h-5" />}
                  <span>{mode === 'tts' ? '转换为语音' : mode === 'stt' ? '转写音频' : '翻译音频'}</span>
                </>
              )}
            </button>

            {audioUrl && (
              <div className="p-4 bg-aurora-surface-light dark:bg-aurora-surface-dark border border-aurora-border-light dark:border-aurora-border-dark rounded-xl space-y-3">
                <audio controls src={audioUrl} className="w-full" />
                <button
                  onClick={() => { const a = document.createElement('a'); a.href = audioUrl; a.download = 'speech.mp3'; a.click(); }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-aurora-border-light dark:border-aurora-border-dark rounded-lg hover:bg-aurora-muted-light dark:hover:bg-aurora-muted-dark transition-colors text-sm font-medium"
                >
                  <Download className="w-4 h-4" />
                  <span>下载音频</span>
                </button>
              </div>
            )}

            {transcription && (
              <div className="p-4 bg-aurora-surface-light dark:bg-aurora-surface-dark border border-aurora-border-light dark:border-aurora-border-dark rounded-xl space-y-3">
                <label className="block text-sm font-medium text-aurora-text-secondary dark:text-aurora-text-dark-secondary">转写结果</label>
                <div className="p-3 bg-aurora-bg-light dark:bg-aurora-bg-dark border border-aurora-border-light dark:border-aurora-border-dark rounded-lg">
                  <p className="whitespace-pre-wrap text-aurora-text-primary dark:text-aurora-text-dark-primary">{transcription}</p>
                </div>
                <button
                  onClick={handleCopy}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-aurora-accent text-white dark:bg-aurora-accent-dark dark:text-black rounded-lg hover:bg-aurora-accent-hover dark:hover:bg-aurora-accent-dark-hover transition-colors text-sm font-medium"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copied ? '已复制' : '复制文本'}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
