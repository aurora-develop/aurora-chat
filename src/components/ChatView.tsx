import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { Send, Paperclip, Bot, User, Code, Lightbulb, Image, Copy, Check } from 'lucide-react';
import { useChatStore } from '../stores/chatStore';
import { useSettingsStore } from '../stores/settingsStore';
import { chatCompletionStream, chatCompletion } from '../api/chat';
import { uploadFileToServer } from '../api/files';
import type { Message } from '../types/api';

function CodeBlock({ className, children }: { className?: string; children: React.ReactNode }) {
  const [copied, setCopied] = useState(false);
  const match = /language-(\w+)/.exec(className || '');

  const handleCopy = () => {
    const code = String(children).replace(/\n$/, '');
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group my-4">
      <div className="flex items-center justify-between px-4 py-2 bg-[#0d0d0d] text-slate-400 text-xs rounded-t-xl border-b border-slate-700">
        <span>{match ? match[1] : 'code'}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 hover:text-white transition-colors"
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? '已复制' : '复制'}</span>
        </button>
      </div>
      <pre className="!mt-0 rounded-t-none rounded-b-xl">{children}</pre>
    </div>
  );
}

export default function ChatView() {
  const { conversations, currentConversationId, addConversation, addMessage, updateLastMessage } = useChatStore();
  const { model, streamEnabled } = useSettingsStore();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const currentConversation = conversations.find(c => c.id === currentConversationId);
  const messages = currentConversation?.messages || [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  const handleSend = async () => {
    if (!input.trim() && uploadedFiles.length === 0) return;
    if (!currentConversationId) addConversation();

    const contentParts = [];
    if (input.trim()) contentParts.push({ type: 'text' as const, text: input });
    for (const fileId of uploadedFiles) contentParts.push({ type: 'input_file' as const, file_id: fileId });

    const userMessage: Message = {
      role: 'user',
      content: contentParts.length === 1 && contentParts[0].type === 'text' ? input : contentParts,
    };

    addMessage(userMessage);
    setInput('');
    setUploadedFiles([]);
    setLoading(true);

    try {
      const requestMessages = [...messages, userMessage];

      if (streamEnabled) {
        addMessage({ role: 'assistant', content: '' });
        let fullContent = '';
        const stream = chatCompletionStream({ model, messages: requestMessages, stream: true });
        for await (const chunk of stream) {
          const delta = chunk.choices?.[0]?.delta?.content || '';
          if (delta) {
            fullContent += delta;
            updateLastMessage(fullContent);
          }
        }
      } else {
        const response = await chatCompletion({ model, messages: requestMessages, stream: false });
        const assistantMessage = response.choices?.[0]?.message;
        if (assistantMessage) addMessage(assistantMessage);
      }
    } catch (error) {
      addMessage({ role: 'assistant', content: `错误: ${error instanceof Error ? error.message : '未知错误'}` });
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (const file of Array.from(files)) {
      try {
        const response = await uploadFileToServer(file);
        setUploadedFiles(prev => [...prev, response.id]);
      } catch (error) {
        alert(`上传失败: ${error instanceof Error ? error.message : '未知错误'}`);
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCopyMessage = (index: number) => {
    const msg = messages[index];
    const text = typeof msg.content === 'string' ? msg.content : '';
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const suggestions = [
    { icon: Code, text: '帮我写一段代码' },
    { icon: Lightbulb, text: '解释一个概念' },
    { icon: Image, text: '生成一张图片' },
  ];

  return (
    <div className="flex flex-col h-full bg-aurora-bg-light dark:bg-aurora-bg-dark transition-colors duration-150">
      <header className="h-14 flex items-center justify-between px-6 border-b border-aurora-border-light dark:border-aurora-border-dark">
        <h2 className="text-base font-medium text-aurora-text-primary dark:text-aurora-text-dark-primary">聊天</h2>
        <span className="text-xs text-aurora-text-secondary dark:text-aurora-text-dark-secondary">
          {model === 'auto' ? '自动模型' : model}
        </span>
      </header>

      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full px-6 empty-state-gradient">
            <h1 className="text-[32px] font-semibold tracking-tight text-aurora-text-primary dark:text-aurora-text-dark-primary mb-8">
              今天想做点什么？
            </h1>
            <div className="flex flex-wrap justify-center gap-3 max-w-lg">
              {suggestions.map((s, idx) => {
                const Icon = s.icon;
                return (
                  <button
                    key={idx}
                    onClick={() => setInput(s.text)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-aurora-border-light dark:border-aurora-border-dark text-sm text-aurora-text-secondary dark:text-aurora-text-dark-secondary hover:bg-aurora-muted-light dark:hover:bg-aurora-muted-dark hover:border-aurora-text-secondary dark:hover:border-aurora-text-dark-secondary transition-all"
                  >
                    <Icon className="w-4 h-4" />
                    <span>{s.text}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto py-8 px-6 space-y-6">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`group flex gap-4 animate-fade-in ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
              >
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                  msg.role === 'user'
                    ? 'bg-aurora-text-secondary dark:bg-aurora-text-dark-secondary'
                    : 'bg-aurora-accent dark:bg-aurora-accent-dark'
                }`}>
                  {msg.role === 'user' ? (
                    <User className="w-4 h-4 text-white dark:text-black" />
                  ) : (
                    <Bot className="w-4 h-4 text-white dark:text-black" />
                  )}
                </div>
                <div className={`relative max-w-[85%] rounded-3xl px-5 py-3.5 ${
                  msg.role === 'user'
                    ? 'bg-aurora-user-bubble-light dark:bg-aurora-user-bubble-dark text-aurora-text-primary dark:text-aurora-text-dark-primary'
                    : 'text-aurora-text-primary dark:text-aurora-text-dark-primary'
                }`}>
                  {typeof msg.content === 'string' && msg.content && (
                    <button
                      onClick={() => handleCopyMessage(idx)}
                      className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 p-1.5 bg-aurora-surface-light dark:bg-aurora-surface-dark border border-aurora-border-light dark:border-aurora-border-dark rounded-lg transition-all hover:scale-105"
                      title="复制消息"
                    >
                      {copiedIndex === idx ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  )}
                  {msg.role === 'assistant' ? (
                    <div className="markdown-body">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        rehypePlugins={[rehypeHighlight]}
                        components={{
                          pre: ({ children }) => <>{children}</>,
                          code: ({ className, children }) => (
                            <CodeBlock className={className}>{children}</CodeBlock>
                          ),
                        }}
                      >
                        {String(msg.content)}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <div>
                      {typeof msg.content === 'string' ? (
                        <div className="whitespace-pre-wrap">{msg.content}</div>
                      ) : (
                        <div>
                          {msg.content.map((part, i) => {
                            if (part.type === 'text') return <div key={i} className="whitespace-pre-wrap">{part.text}</div>;
                            if (part.type === 'input_file') return <div key={i} className="text-sm opacity-75">文件: {part.file_id}</div>;
                            return null;
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <div className="p-4 border-t border-aurora-border-light dark:border-aurora-border-dark">
        <div className="max-w-3xl mx-auto">
          {uploadedFiles.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {uploadedFiles.map((fileId, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-aurora-muted-light dark:bg-aurora-muted-dark rounded-lg px-3 py-1.5 text-sm animate-fade-in">
                  <Paperclip className="w-3.5 h-3.5" />
                  <span>{fileId}</span>
                  <button
                    onClick={() => setUploadedFiles(prev => prev.filter((_, i) => i !== idx))}
                    className="text-aurora-text-secondary dark:text-aurora-text-dark-secondary hover:text-aurora-text-primary dark:hover:text-aurora-text-dark-primary"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="relative flex items-end gap-2 bg-aurora-surface-light dark:bg-aurora-surface-dark border border-aurora-border-light dark:border-aurora-border-dark rounded-2xl p-2 shadow-sm transition-all focus-within:shadow-md focus-within:border-aurora-text-primary/20 dark:focus-within:border-aurora-text-dark-primary/20">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              className="hidden"
              multiple
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-2 rounded-lg text-aurora-text-secondary dark:text-aurora-text-dark-secondary hover:bg-aurora-muted-light dark:hover:bg-aurora-muted-dark transition-colors"
              title="上传文件"
            >
              <Paperclip className="w-5 h-5" />
            </button>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="发送消息..."
              className="flex-1 bg-transparent px-2 py-2.5 max-h-[200px] focus:outline-none resize-none text-aurora-text-primary dark:text-aurora-text-dark-primary placeholder:text-aurora-text-secondary dark:placeholder:text-aurora-text-dark-secondary"
              rows={1}
              disabled={loading}
              style={{ minHeight: '24px', height: 'auto' }}
            />
            <button
              onClick={handleSend}
              disabled={loading || (!input.trim() && uploadedFiles.length === 0)}
              className="p-2 rounded-lg bg-aurora-accent text-white dark:bg-aurora-accent-dark dark:text-black disabled:opacity-30 disabled:cursor-not-allowed hover:bg-aurora-accent-hover dark:hover:bg-aurora-accent-dark-hover active:scale-95 transition-all"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
          <p className="text-center text-xs text-aurora-text-secondary dark:text-aurora-text-dark-secondary mt-2">
            AI 生成内容可能不准确，请自行核实。
          </p>
        </div>
      </div>
    </div>
  );
}
