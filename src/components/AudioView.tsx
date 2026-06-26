import { useState, useRef, useEffect } from 'react';
import { textToSpeech, transcribeAudio, translateAudio } from '../api/audio';
import { Volume2, Mic, Languages, Download, Copy, Check, StopCircle } from 'lucide-react';

type AudioMode = 'tts' | 'stt' | 'translate';

export default function AudioView() {
  const [mode, setMode] = useState<AudioMode>('tts');
  const [text, setText] = useState('');
  const [voice, setVoice] = useState('alloy');
  const [ttsFormat, setTtsFormat] = useState<'mp3' | 'opus' | 'aac' | 'flac' | 'wav' | 'pcm' | 'ogg'>('mp3');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [language, setLanguage] = useState('zh');
  const [loading, setLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState('');
  const [transcription, setTranscription] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 录音状态
  const [isRecording, setIsRecording] = useState(false);
  const [recordTime, setRecordTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);

  const voices = ['alloy', 'ash', 'coral', 'echo', 'fable', 'onyx', 'nova', 'sage', 'shimmer'];

  // 录音计时器
  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => setRecordTime(t => t + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isRecording]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // 开始录音
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const file = new File([blob], `recording-${Date.now()}.webm`, { type: 'audio/webm' });
        setAudioFile(file);
        setRecordedUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach(t => t.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordTime(0);
      setRecordedUrl(null);
      setAudioFile(null);
      setError('');
    } catch {
      setError('无法访问麦克风，请检查浏览器权限');
    }
  };

  // 停止录音
  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const handleTTS = async () => {
    if (!text.trim()) {
      setError('请输入要转换的文本');
      return;
    }
    setLoading(true);
    setError('');
    setAudioUrl('');
    try {
      const blob = await textToSpeech({ model: 'tts-1', input: text, voice, response_format: ttsFormat });
      setAudioUrl(URL.createObjectURL(blob));
    } catch (err) {
      setError(err instanceof Error ? err.message : '转换失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSTT = async () => {
    if (!audioFile) {
      setError('请上传音频文件或录制音频');
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
      setError('请上传音频文件或录制音频');
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
    if (file) {
      setAudioFile(file);
      setRecordedUrl(null);
    }
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
                  onClick={() => { setMode(item.id); setError(''); }}
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
                    className="w-full px-4 py-3 bg-aurora-surface-light dark:bg-aurora-surface-dark border border-aurora-border-light dark:border-aurora-border-dark rounded-xl focus:outline-none focus:ring-2 focus:ring-aurora-accent/20 dark:focus:ring-aurora-accent-dark/20 focus:border-aurora-accent dark:focus:border-aurora-accent-dark transition-colors resize-none text-aurora-text-primary dark:text-aurora-text-dark-primary placeholder:text-aurora-text-secondary dark:placeholder:text-aurora-text-dark-secondary"
                    rows={5}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-aurora-text-secondary dark:text-aurora-text-dark-secondary mb-2">语音角色</label>
                  <select
                    value={voice}
                    onChange={(e) => setVoice(e.target.value)}
                    className="w-full px-4 py-2.5 bg-aurora-surface-light dark:bg-aurora-surface-dark border border-aurora-border-light dark:border-aurora-border-dark rounded-lg focus:outline-none focus:ring-2 focus:ring-aurora-accent/20 dark:focus:ring-aurora-accent-dark/20 focus:border-aurora-accent dark:focus:border-aurora-accent-dark transition-colors text-aurora-text-primary dark:text-aurora-text-dark-primary"
                  >
                    {voices.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-aurora-text-secondary dark:text-aurora-text-dark-secondary mb-2">输出格式</label>
                  <select
                    value={ttsFormat}
                    onChange={(e) => setTtsFormat(e.target.value as any)}
                    className="w-full px-4 py-2.5 bg-aurora-surface-light dark:bg-aurora-surface-dark border border-aurora-border-light dark:border-aurora-border-dark rounded-lg focus:outline-none focus:ring-2 focus:ring-aurora-accent/20 dark:focus:ring-aurora-accent-dark/20 focus:border-aurora-accent dark:focus:border-aurora-accent-dark transition-colors text-aurora-text-primary dark:text-aurora-text-dark-primary"
                  >
                    <option value="mp3">MP3</option>
                    <option value="opus">Opus</option>
                    <option value="aac">AAC</option>
                    <option value="flac">FLAC</option>
                    <option value="wav">WAV</option>
                    <option value="pcm">PCM</option>
                    <option value="ogg">OGG</option>
                  </select>
                </div>
              </>
            )}

            {(mode === 'stt' || mode === 'translate') && (
              <>
                {/* 浏览器录音 */}
                <div>
                  <label className="block text-sm font-medium text-aurora-text-secondary dark:text-aurora-text-dark-secondary mb-2">录音</label>
                  <div className="flex items-center gap-4 p-4 bg-aurora-surface-light dark:bg-aurora-surface-dark border border-aurora-border-light dark:border-aurora-border-dark rounded-xl">
                    {!isRecording ? (
                      <button
                        onClick={startRecording}
                        className="flex items-center gap-2 px-4 py-2.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium text-sm"
                      >
                        <Mic className="w-4 h-4" />
                        开始录音
                      </button>
                    ) : (
                      <button
                        onClick={stopRecording}
                        className="flex items-center gap-2 px-4 py-2.5 bg-aurora-accent text-white dark:bg-aurora-accent-dark dark:text-black rounded-lg hover:bg-aurora-accent-hover dark:hover:bg-aurora-accent-dark-hover transition-colors font-medium text-sm animate-pulse"
                      >
                        <StopCircle className="w-4 h-4" />
                        停止录音
                      </button>
                    )}
                    {isRecording && (
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                        <span className="text-sm font-mono text-aurora-text-primary dark:text-aurora-text-dark-primary">{formatTime(recordTime)}</span>
                        <span className="text-xs text-aurora-text-secondary dark:text-aurora-text-dark-secondary">录音中...</span>
                      </div>
                    )}
                    {!isRecording && audioFile && recordedUrl && (
                      <div className="flex-1 flex items-center gap-3">
                        <audio controls src={recordedUrl} className="flex-1 h-8" />
                        <span className="text-xs text-aurora-text-secondary dark:text-aurora-text-dark-secondary whitespace-nowrap">
                          录制完成 ({formatTime(recordTime)})
                        </span>
                      </div>
                    )}
                    {!isRecording && !audioFile && (
                      <span className="text-sm text-aurora-text-secondary dark:text-aurora-text-dark-secondary">
                        点击录音，或上传文件 ↓
                      </span>
                    )}
                  </div>
                </div>

                {/* 文件上传 */}
                <div>
                  <label className="block text-sm font-medium text-aurora-text-secondary dark:text-aurora-text-dark-secondary mb-2">或上传音频文件</label>
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="audio/*"
                    onChange={handleFileChange}
                    className="w-full px-4 py-3 bg-aurora-surface-light dark:bg-aurora-surface-dark border border-aurora-border-light dark:border-aurora-border-dark rounded-xl focus:outline-none focus:ring-2 focus:ring-aurora-accent/20 dark:focus:ring-aurora-accent-dark/20 focus:border-aurora-accent dark:focus:border-aurora-accent-dark transition-colors file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-aurora-accent file:text-white dark:file:bg-aurora-accent-dark dark:file:text-black hover:file:bg-aurora-accent-hover dark:hover:file:bg-aurora-accent-dark-hover"
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
                      className="w-full px-4 py-2.5 bg-aurora-surface-light dark:bg-aurora-surface-dark border border-aurora-border-light dark:border-aurora-border-dark rounded-lg focus:outline-none focus:ring-2 focus:ring-aurora-accent/20 dark:focus:ring-aurora-accent-dark/20 focus:border-aurora-accent dark:focus:border-aurora-accent-dark transition-colors text-aurora-text-primary dark:text-aurora-text-dark-primary"
                    />
                    <p className="text-xs text-aurora-text-secondary dark:text-aurora-text-dark-secondary mt-1.5">ISO 语言代码，如 zh、en</p>
                  </div>
                )}
              </>
            )}

            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm">
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
                  onClick={() => { const a = document.createElement('a'); a.href = audioUrl; a.download = `speech.${ttsFormat}`; a.click(); }}
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
