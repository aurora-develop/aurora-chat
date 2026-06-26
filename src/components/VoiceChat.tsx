import { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, MicOff, X, Volume2, Send, Keyboard } from 'lucide-react';
import { useChatStore } from '../stores/chatStore';
import { useSettingsStore } from '../stores/settingsStore';
import { chatCompletionStream } from '../api/chat';
import { textToSpeech } from '../api/audio';
import type { Message } from '../types/api';

type VoiceState = 'idle' | 'listening' | 'thinking' | 'speaking';

export default function VoiceChat({ onClose }: { onClose: () => void }) {
  const [state, setState] = useState<VoiceState>('idle');
  const [transcript, setTranscript] = useState(''); // 当前正在说的
  const [conversation, setConversation] = useState<{ role: 'user' | 'assistant'; text: string }[]>([]);
  const [textInput, setTextInput] = useState('');
  const [showTextInput, setShowTextInput] = useState(false);
  const [voice, setVoice] = useState('alloy');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recognitionRef = useRef<any>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pendingTextRef = useRef('');

  const { currentConversationId, addMessage, conversations, createConversation } = useChatStore();
  const { model } = useSettingsStore();

  // 滚动到底部
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation]);

  // 停止一切
  const stopAll = useCallback(() => {
    recognitionRef.current?.stop();
    audioRef.current?.pause();
    audioRef.current = null;
    abortRef.current?.abort();
    setState('idle');
    setTranscript('');
    pendingTextRef.current = '';
  }, []);

  // 发送文本到 AI 并获取语音回复
  const processUserInput = useCallback(async (userText: string) => {
    if (!userText.trim()) return;

    setConversation(prev => [...prev, { role: 'user', text: userText }]);
    setState('thinking');
    setTranscript('');

    // 构建消息上下文
    const messages: Message[] = [
      ...conversation.map(m => ({ role: m.role, content: m.text } as Message)),
      { role: 'user', content: userText },
    ];

    const abortController = new AbortController();
    abortRef.current = abortController;

    try {
      // 流式获取 AI 回复
      const stream = chatCompletionStream({
        model: model === 'auto' ? 'auto' : model,
        messages,
        stream: true,
      }, abortController.signal);

      let fullContent = '';
      for await (const chunk of stream) {
        if (abortController.signal.aborted) break;
        const delta = chunk.choices?.[0]?.delta?.content || '';
        if (delta) fullContent += delta;
      }

      if (!fullContent) return;

      setConversation(prev => [...prev, { role: 'assistant', text: fullContent }]);

      // 保存到 chatStore
      let convId = currentConversationId;
      if (!convId) convId = createConversation();
      const conv = conversations.find(c => c.id === convId);
      const leafId = conv?.currentLeafId || null;
      const userMsgId = addMessage(convId, leafId, { role: 'user', content: userText });
      addMessage(convId, userMsgId, { role: 'assistant', content: fullContent });

      // TTS 播放
      setState('speaking');
      try {
        const blob = await textToSpeech({ model: 'tts-1', input: fullContent, voice, response_format: 'mp3' });
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => {
          URL.revokeObjectURL(url);
          audioRef.current = null;
          // 自动恢复监听
          startListening();
        };
        audio.onerror = () => {
          URL.revokeObjectURL(url);
          audioRef.current = null;
          startListening();
        };
        await audio.play();
      } catch {
        // TTS 失败则跳过语音，恢复监听
        startListening();
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setConversation(prev => [...prev, { role: 'assistant', text: `错误: ${(err as Error).message}` }]);
      }
      setState('idle');
    }
  }, [conversation, model, voice, currentConversationId, conversations, addMessage, createConversation]);

  // 开始语音监听
  const startListening = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setShowTextInput(true);
      return;
    }

    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'zh-CN';
    recognition.interimResults = true;
    recognition.continuous = true;

    let finalText = '';
    let silenceTimer: ReturnType<typeof setTimeout> | null = null;

    recognition.onresult = (event: any) => {
      let interim = '';
      finalText = '';
      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalText += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      setTranscript(finalText || interim);
      pendingTextRef.current = finalText || interim;

      // 重置静默计时器
      if (silenceTimer) clearTimeout(silenceTimer);
      if (finalText) {
        silenceTimer = setTimeout(() => {
          // 静默 1.5 秒后自动发送
          recognition.stop();
        }, 1500);
      }
    };

    recognition.onend = () => {
      if (silenceTimer) clearTimeout(silenceTimer);
      const text = pendingTextRef.current.trim();
      if (text) {
        processUserInput(text);
      } else {
        // 没有检测到语音，重新开始监听
        if (state === 'listening') {
          startListening();
        }
      }
    };

    recognition.onerror = (e: any) => {
      if (silenceTimer) clearTimeout(silenceTimer);
      if (e.error === 'no-speech') {
        // 没有检测到语音，重新开始
        if (state === 'listening') startListening();
      } else if (e.error === 'not-allowed') {
        setShowTextInput(true);
      }
    };

    recognition.start();
    recognitionRef.current = recognition;
    setState('listening');
    setTranscript('');
    pendingTextRef.current = '';
  }, [state, processUserInput]);

  // 主按钮点击
  const handleMainClick = () => {
    if (state === 'idle') {
      startListening();
    } else if (state === 'listening') {
      recognitionRef.current?.stop();
      // onend 会自动处理发送
    } else if (state === 'thinking' || state === 'speaking') {
      stopAll();
    }
  };

  // 文本输入发送
  const handleTextSend = () => {
    if (!textInput.trim()) return;
    const text = textInput;
    setTextInput('');
    processUserInput(text);
  };

  // 组件卸载时清理
  useEffect(() => {
    return () => stopAll();
  }, [stopAll]);

  // 圆圈动画样式
  const getOrbClass = () => {
    switch (state) {
      case 'listening':
        return 'w-32 h-32 bg-gradient-to-br from-aurora-violet to-blue-500 animate-pulse shadow-[0_0_60px_rgba(129,140,248,0.4)]';
      case 'thinking':
        return 'w-28 h-28 bg-gradient-to-br from-aurora-violet to-indigo-500 animate-spin shadow-[0_0_40px_rgba(129,140,248,0.3)]';
      case 'speaking':
        return 'w-32 h-32 bg-gradient-to-br from-emerald-400 to-aurora-violet animate-pulse shadow-[0_0_80px_rgba(52,211,153,0.4)]';
      default:
        return 'w-24 h-24 bg-gradient-to-br from-aurora-violet/60 to-blue-500/60 shadow-[0_0_30px_rgba(129,140,248,0.2)]';
    }
  };

  const getStateLabel = () => {
    switch (state) {
      case 'listening': return '正在聆听...';
      case 'thinking': return '思考中...';
      case 'speaking': return '正在回答...';
      default: return '点击开始对话';
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-gradient-to-b from-[#0a0a0b] to-[#1a1a2e] text-white">
      {/* 顶部栏 */}
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Volume2 className="w-5 h-5 text-aurora-violet" />
            <span className="text-sm font-medium">语音对话</span>
          </div>
          <select
            value={voice}
            onChange={(e) => setVoice(e.target.value)}
            className="px-2 py-1 text-xs bg-white/10 border border-white/20 rounded-lg focus:outline-none text-white/80"
          >
            {['alloy', 'ash', 'coral', 'echo', 'fable', 'onyx', 'nova', 'sage', 'shimmer'].map(v => (
              <option key={v} value={v} className="bg-[#1a1a2e]">{v}</option>
            ))}
          </select>
        </div>
        <button onClick={() => { stopAll(); onClose(); }} className="p-2 rounded-full hover:bg-white/10 transition-colors" aria-label="关闭语音对话">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* 转录区域 */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {conversation.length === 0 && !transcript && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <p className="text-white/40 text-sm mb-2">Aurora 语音模式</p>
            <p className="text-white/20 text-xs">说出你的想法，AI 会用语音回答</p>
          </div>
        )}
        {conversation.map((msg, i) => (
          <div key={i} className={`mb-4 flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
              msg.role === 'user'
                ? 'bg-aurora-violet/30 text-white'
                : 'bg-white/10 text-white/90'
            }`}>
              {msg.text}
            </div>
          </div>
        ))}
        {/* 实时转录 */}
        {transcript && (
          <div className="mb-4 flex justify-end">
            <div className="max-w-[80%] px-4 py-2.5 rounded-2xl text-sm bg-aurora-violet/20 text-white/70 italic">
              {transcript}
            </div>
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      {/* 状态标签 */}
      <div className="text-center pb-4">
        <span className="text-xs text-white/40">{getStateLabel()}</span>
      </div>

      {/* 中央圆圈 + 操作区 */}
      <div className="flex flex-col items-center gap-6 pb-8">
        {/* 文本输入框 */}
        {showTextInput && (
          <div className="flex items-center gap-2 w-72 px-4 py-2 bg-white/10 border border-white/20 rounded-full">
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleTextSend()}
              placeholder="输入消息..."
              className="flex-1 bg-transparent text-sm focus:outline-none text-white placeholder:text-white/40"
              autoFocus
            />
            <button onClick={handleTextSend} className="p-1.5 hover:bg-white/10 rounded-full transition-colors">
              <Send className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* 中央圆圈按钮 */}
        <button
          onClick={handleMainClick}
          className={`rounded-full flex items-center justify-center transition-all duration-300 ${getOrbClass()}`}
          aria-label={state === 'idle' ? '开始对话' : state === 'listening' ? '停止录音' : '停止'}
        >
          {state === 'idle' && <Mic className="w-10 h-10 text-white" />}
          {state === 'listening' && <Mic className="w-10 h-10 text-white" />}
          {state === 'thinking' && (
            <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          )}
          {state === 'speaking' && <Volume2 className="w-10 h-10 text-white" />}
        </button>

        {/* 底部操作 */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowTextInput(v => !v)}
            className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            title="文本输入"
            aria-label="切换文本输入"
          >
            <Keyboard className="w-4 h-4" />
          </button>
          {state !== 'idle' && (
            <button
              onClick={stopAll}
              className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
              title="停止"
              aria-label="停止"
            >
              <MicOff className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
