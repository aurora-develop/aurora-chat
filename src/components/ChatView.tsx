import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Send, Paperclip, Bot, User, Code, Lightbulb, Image as ImageIcon,
  Copy, Check, Square, Pencil, ChevronLeft, ChevronRight,
  ThumbsUp, ThumbsDown, ChevronDown, Trash2, Globe, WifiOff, Download
} from 'lucide-react';
import { useChatStore, type MessageNode } from '../stores/chatStore';
import { useSettingsStore } from '../stores/settingsStore';
import { uploadFileToServer } from '../api/files';
import { getModels } from '../api/models';
import { useChatCompletion } from '../hooks/useChatCompletion';
import MemoizedMarkdown from './MemoizedMarkdown';
import RegenerateWithModel from './RegenerateWithModel';
import PromptTemplates from './PromptTemplates';

export default function ChatView() {
  const {
    conversations,
    messages,
    currentConversationId,
    streamingMessageId,
    createConversation,
    addMessage,
    updateMessage,
    getMessagePath,
    deleteBranch,
    getSiblingInfo,
    switchSibling,
    setConversationModel,
  } = useChatStore();

  const { useCustomApi, customApiUrl } = useSettingsStore();
  const { generateResponse, handleRegenerate, handleStop } = useChatCompletion();

  const [input, setInput] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const modelMenuRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  const currentConversation = conversations.find((c) => c.id === currentConversationId);
  const messagePath = currentConversationId ? getMessagePath(currentConversationId) : [];

  // 网络状态监听
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // 智能滚动
  const checkIfNearBottom = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return true;
    const threshold = 150;
    return container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
  }, []);

  const handleScroll = useCallback(() => {
    const nearBottom = checkIfNearBottom();
    autoScrollRef.current = nearBottom;
    setShowScrollBtn(!nearBottom && streamingMessageId !== null);
  }, [checkIfNearBottom, streamingMessageId]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    autoScrollRef.current = true;
    setShowScrollBtn(false);
  }, []);

  useEffect(() => {
    if (autoScrollRef.current || streamingMessageId === null) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    } else if (streamingMessageId !== null) {
      setShowScrollBtn(true);
    }
  }, [messagePath, streamingMessageId]);

  // 输入框自适应高度
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  // 模型菜单点击外部关闭
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modelMenuRef.current && !modelMenuRef.current.contains(e.target as Node)) {
        setModelMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 获取可用模型列表
  useEffect(() => {
    if (!modelMenuOpen) return;
    getModels()
      .then((res) => {
        const ids = (res.data || []).map((m: { id: string }) => m.id).filter(Boolean);
        setAvailableModels(ids.length ? ids : ['auto', 'gpt-4o', 'gpt-4o-mini', 'gpt-image-2']);
      })
      .catch(() => {
        setAvailableModels(['auto', 'gpt-4o', 'gpt-4o-mini', 'gpt-image-2']);
      });
  }, [modelMenuOpen]);

  const sendMessage = async (content: string, parentId: string | null) => {
    if (!content.trim() && uploadedFiles.length === 0) return;

    let conversationId = currentConversationId;
    if (!conversationId) {
      conversationId = createConversation();
    }

    const contentParts = [];
    if (content.trim()) contentParts.push({ type: 'text' as const, text: content });
    for (const fileId of uploadedFiles) {
      contentParts.push({ type: 'input_file' as const, file_id: fileId });
    }

    const userContent = contentParts.length === 1 && contentParts[0].type === 'text'
      ? content
      : contentParts;

    const userMessageId = addMessage(conversationId, parentId, {
      role: 'user',
      content: userContent,
    });

    setInput('');
    setUploadedFiles([]);
    await generateResponse(userMessageId, conversationId);
  };

  const handleSend = () => sendMessage(input, currentConversation?.currentLeafId || null);

  const handleEdit = (messageId: string) => {
    const msg = messages[messageId];
    if (!msg || msg.role !== 'user') return;
    setEditingId(messageId);
    setEditContent(typeof msg.content === 'string' ? msg.content : '');
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editContent.trim()) return;
    const msg = messages[editingId];
    if (!msg) return;
    setEditingId(null);
    await sendMessage(editContent, msg.parentId);
  };

  // 文件上传
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (const file of Array.from(files)) {
      try {
        const response = await uploadFileToServer(file);
        setUploadedFiles((prev) => [...prev, response.id]);
      } catch (error) {
        alert(`上传失败: ${error instanceof Error ? error.message : '未知错误'}`);
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const uploadDroppedFiles = async (files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files)) {
      try {
        const response = await uploadFileToServer(file);
        setUploadedFiles((prev) => [...prev, response.id]);
      } catch (error) {
        alert(`上传失败: ${error instanceof Error ? error.message : '未知错误'}`);
      }
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    await uploadDroppedFiles(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setDragOver(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setDragOver(false); };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    const files: File[] = [];
    for (const item of Array.from(items)) {
      const file = item.getAsFile();
      if (file) files.push(file);
    }
    if (files.length > 0) {
      e.preventDefault();
      await uploadDroppedFiles(files as unknown as FileList);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (editingId) handleSaveEdit();
      else handleSend();
    }
  };

  const handleCopy = (messageId: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(messageId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // P1-5: 导出会话为 Markdown
  const handleExport = useCallback(() => {
    if (!currentConversation || messagePath.length === 0) return;
    const lines: string[] = [];
    lines.push(`# ${currentConversation.title}`);
    lines.push(`\n> 导出时间: ${new Date().toLocaleString()}`);
    lines.push(`> 模型: ${currentConversation.model || 'auto'}\n`);
    lines.push('---\n');

    for (const msg of messagePath) {
      const roleLabel = msg.role === 'user' ? '**🧑 用户**' : '**🤖 助手**';
      const time = new Date(msg.createdAt).toLocaleTimeString();
      lines.push(`${roleLabel} _(${time})_\n`);
      const content = typeof msg.content === 'string' ? msg.content : '';
      lines.push(content);
      if (msg.model) lines.push(`\n> 模型: ${msg.model}`);
      lines.push('\n---\n');
    }

    const md = lines.join('\n');
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentConversation.title.slice(0, 30)}-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [currentConversation, messagePath]);

  const suggestions = [
    { icon: Code, text: '帮我写一段代码' },
    { icon: Lightbulb, text: '解释一个概念' },
    { icon: ImageIcon, text: '生成一张图片' },
  ];

  // 渲染消息内容
  const renderMessageContent = (msg: MessageNode) => {
    if (msg.role === 'assistant') {
      if (streamingMessageId === msg.id) {
        return <div className="whitespace-pre-wrap break-words leading-relaxed">{String(msg.content)}</div>;
      }
      return <MemoizedMarkdown content={String(msg.content)} />;
    }
    if (typeof msg.content === 'string') {
      return <div className="whitespace-pre-wrap">{msg.content}</div>;
    }
    return (
      <div className="space-y-2">
        {msg.content.map((part, i) => {
          if (part.type === 'text') return <div key={i} className="whitespace-pre-wrap">{part.text}</div>;
          if (part.type === 'input_file') {
            return (
              <div key={i} className="flex items-center gap-2 text-sm bg-aurora-muted-light dark:bg-aurora-muted-dark rounded-lg px-3 py-2 opacity-80">
                <Paperclip className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">{part.file_id}</span>
              </div>
            );
          }
          if (part.type === 'input_image') {
            const src = typeof part.image_url === 'string' ? part.image_url : part.image_url?.url;
            return (
              <div key={i} className="my-2">
                <img src={src} alt="image" loading="lazy" decoding="async" className="max-w-sm rounded-xl border border-aurora-border-light dark:border-aurora-border-dark" />
              </div>
            );
          }
          return null;
        })}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-aurora-bg-light dark:bg-aurora-bg-dark transition-colors duration-150">
      {/* 顶部栏 */}
      <header className="h-14 flex items-center justify-between px-6 border-b border-aurora-border-light dark:border-aurora-border-dark">
        <div className="flex items-center gap-2">
          {useCustomApi && customApiUrl && (
            <span className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full bg-aurora-accent/10 text-aurora-accent dark:bg-aurora-accent-dark/10 dark:text-aurora-accent-dark border border-aurora-accent/20 dark:border-aurora-accent-dark/20" title={`自定义 API: ${customApiUrl}`}>
              <Globe className="w-2.5 h-2.5" />自定义 API
            </span>
          )}
          <h2 className="text-base font-medium text-aurora-text-primary dark:text-aurora-text-dark-primary">聊天</h2>
        </div>
        {/* 模型选择器 + 导出 */}
        <div className="flex items-center gap-2">
          {messagePath.length > 0 && (
            <button onClick={handleExport} className="flex items-center gap-1 px-2 py-1.5 text-xs rounded-lg border border-aurora-border-light dark:border-aurora-border-dark text-aurora-text-secondary dark:text-aurora-text-dark-secondary hover:bg-aurora-muted-light dark:hover:bg-aurora-muted-dark transition-colors" title="导出为 Markdown">
              <Download className="w-3.5 h-3.5" />
            </button>
          )}
          <div className="relative" ref={modelMenuRef}>
          <button onClick={() => setModelMenuOpen((v) => !v)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-aurora-border-light dark:border-aurora-border-dark text-aurora-text-secondary dark:text-aurora-text-dark-secondary hover:bg-aurora-muted-light dark:hover:bg-aurora-muted-dark transition-colors">
            {currentConversation?.model && currentConversation.model !== 'auto' ? currentConversation.model : '自动模型'}
            <ChevronDown className="w-3 h-3" />
          </button>
          {modelMenuOpen && (
            <div className="absolute right-0 top-full mt-1 w-56 bg-aurora-surface-light dark:bg-aurora-surface-dark border border-aurora-border-light dark:border-aurora-border-dark rounded-lg shadow-xl py-1 z-30 max-h-80 overflow-y-auto">
              {availableModels.length === 0 ? (
                <div className="px-3 py-2 text-sm text-aurora-text-secondary dark:text-aurora-text-dark-secondary">加载中...</div>
              ) : availableModels.map((m) => (
                <button key={m} onClick={() => { if (currentConversation) setConversationModel(currentConversation.id, m); setModelMenuOpen(false); }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-aurora-muted-light dark:hover:bg-aurora-muted-dark ${(currentConversation?.model) === m ? 'text-aurora-text-primary dark:text-aurora-text-dark-primary font-medium' : 'text-aurora-text-secondary dark:text-aurora-text-dark-secondary'}`}>
                  <span className="flex-1 text-left truncate">{m}</span>
                  {currentConversation?.model === m && <Check className="w-3.5 h-3.5 flex-shrink-0" />}
                </button>
              ))}
            </div>
          )}
          </div>
        </div>
      </header>

      {/* 消息区域 */}
      <div className="flex-1 overflow-y-auto" ref={scrollContainerRef} onScroll={handleScroll}>
        {messagePath.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full px-6 empty-state-gradient">
            <h1 className="text-[32px] font-semibold tracking-tight mb-8 bg-gradient-to-r from-aurora-text-primary via-aurora-violet to-aurora-text-primary dark:from-aurora-text-dark-primary dark:via-aurora-violet-dark dark:to-aurora-text-dark-primary bg-clip-text text-transparent">
              今天想做点什么？
            </h1>
            <div className="flex flex-wrap justify-center gap-3 max-w-lg">
              {suggestions.map((s, idx) => { const Icon = s.icon; return (
                <button key={idx} onClick={() => setInput(s.text)} className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-aurora-border-light dark:border-aurora-border-dark text-sm text-aurora-text-secondary dark:text-aurora-text-dark-secondary hover:bg-aurora-muted-light dark:hover:bg-aurora-muted-dark hover:border-aurora-text-secondary dark:hover:border-aurora-text-dark-secondary transition-all">
                  <Icon className="w-4 h-4" /><span>{s.text}</span>
                </button>
              ); })}
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto py-8 px-6 space-y-6">
            {messagePath.map((msg) => {
              const isUser = msg.role === 'user';
              const isAssistant = msg.role === 'assistant';
              const isStreaming = streamingMessageId === msg.id;
              const { index: siblingIndex, total: siblingTotal } = getSiblingInfo(msg.id);
              const hasSiblings = siblingTotal > 1;
              const textContent = typeof msg.content === 'string' ? msg.content : '';

              return (
                <div key={msg.id} className="group flex gap-4 animate-fade-in">
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${isUser ? 'bg-aurora-text-secondary dark:bg-aurora-text-dark-secondary' : 'bg-aurora-accent dark:bg-aurora-accent-dark'}`}>
                    {isUser ? <User className="w-4 h-4 text-white dark:text-black" /> : <Bot className="w-4 h-4 text-white dark:text-black" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`relative inline-block max-w-[85%] rounded-3xl px-5 py-3.5 ${isUser ? 'bg-aurora-user-bubble-light dark:bg-aurora-user-bubble-dark text-aurora-text-primary dark:text-aurora-text-dark-primary' : msg.isError ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300' : 'text-aurora-text-primary dark:text-aurora-text-dark-primary'}`}>
                      {editingId === msg.id ? (
                        <div className="min-w-[300px]">
                          <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} onKeyDown={handleKeyDown}
                            className="w-full bg-transparent border border-aurora-border-light dark:border-aurora-border-dark rounded-lg px-3 py-2 focus:outline-none resize-none text-aurora-text-primary dark:text-aurora-text-dark-primary" rows={3} autoFocus />
                          <div className="flex justify-end gap-2 mt-2">
                            <button onClick={() => setEditingId(null)} className="px-3 py-1.5 text-sm border border-aurora-border-light dark:border-aurora-border-dark rounded-lg hover:bg-aurora-muted-light dark:hover:bg-aurora-muted-dark">取消</button>
                            <button onClick={handleSaveEdit} className="px-3 py-1.5 text-sm bg-aurora-accent text-white dark:bg-aurora-accent-dark dark:text-black rounded-lg">保存</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {renderMessageContent(msg)}
                          {isStreaming && <span className="inline-block w-2 h-4 ml-1 bg-aurora-text-secondary dark:bg-aurora-text-dark-secondary animate-typing-cursor" />}
                        </>
                      )}
                    </div>
                    {/* 消息操作栏 */}
                    {editingId !== msg.id && (
                      <div className="flex items-center gap-1 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        {isAssistant && (
                          <>
                            <button onClick={() => handleCopy(msg.id, textContent)} className="p-1.5 rounded-md text-aurora-text-secondary dark:text-aurora-text-dark-secondary hover:bg-aurora-muted-light dark:hover:bg-aurora-muted-dark" title="复制">
                              {copiedId === msg.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                            {!isStreaming && <RegenerateWithModel messageId={msg.id} streamingMessageId={streamingMessageId} onRegenerate={handleRegenerate} availableModels={availableModels} />}
                            <button onClick={() => updateMessage(msg.id, { feedback: msg.feedback === 'up' ? undefined : 'up' })} className={`p-1.5 rounded-md hover:bg-aurora-muted-light dark:hover:bg-aurora-muted-dark ${msg.feedback === 'up' ? 'text-blue-500' : 'text-aurora-text-secondary dark:text-aurora-text-dark-secondary'}`} title="有用">
                              <ThumbsUp className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => updateMessage(msg.id, { feedback: msg.feedback === 'down' ? undefined : 'down' })} className={`p-1.5 rounded-md hover:bg-aurora-muted-light dark:hover:bg-aurora-muted-dark ${msg.feedback === 'down' ? 'text-red-500' : 'text-aurora-text-secondary dark:text-aurora-text-dark-secondary'}`} title="不太有用">
                              <ThumbsDown className="w-3.5 h-3.5" />
                            </button>
                            {!isStreaming && msg.childrenIds.length === 0 && (
                              <button onClick={() => deleteBranch(msg.id)} className="p-1.5 rounded-md text-aurora-text-secondary dark:text-aurora-text-dark-secondary hover:bg-aurora-muted-light dark:hover:bg-aurora-muted-dark" title="删除回复">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </>
                        )}
                        {isUser && (
                          <button onClick={() => handleEdit(msg.id)} className="p-1.5 rounded-md text-aurora-text-secondary dark:text-aurora-text-dark-secondary hover:bg-aurora-muted-light dark:hover:bg-aurora-muted-dark" title="编辑">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                    {/* 分支切换 */}
                    {isAssistant && hasSiblings && (
                      <div className="flex items-center gap-2 mt-1.5 text-xs text-aurora-text-secondary dark:text-aurora-text-dark-secondary">
                        <button onClick={() => switchSibling(msg.id, -1)} disabled={siblingIndex === 0} className="p-1 rounded hover:bg-aurora-muted-light dark:hover:bg-aurora-muted-dark disabled:opacity-30"><ChevronLeft className="w-3.5 h-3.5" /></button>
                        <span>{siblingIndex + 1} / {siblingTotal}</span>
                        <button onClick={() => switchSibling(msg.id, 1)} disabled={siblingIndex === siblingTotal - 1} className="p-1 rounded hover:bg-aurora-muted-light dark:hover:bg-aurora-muted-dark disabled:opacity-30"><ChevronRight className="w-3.5 h-3.5" /></button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* 智能滚动按钮 */}
      {showScrollBtn && (
        <div className="absolute bottom-32 left-1/2 -translate-x-1/2 z-20">
          <button onClick={scrollToBottom} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-aurora-surface-light dark:bg-aurora-surface-dark border border-aurora-border-light dark:border-aurora-border-dark shadow-lg text-sm text-aurora-text-secondary dark:text-aurora-text-dark-secondary hover:bg-aurora-muted-light dark:hover:bg-aurora-muted-dark transition-colors">
            <ChevronDown className="w-3.5 h-3.5" /><span>有新消息</span>
          </button>
        </div>
      )}

      {/* 断网横幅 */}
      {isOffline && (
        <div className="flex items-center justify-center gap-2 py-2 px-4 bg-yellow-50 dark:bg-yellow-900/20 border-t border-yellow-200 dark:border-yellow-800 text-sm text-yellow-800 dark:text-yellow-200">
          <WifiOff className="w-4 h-4" /><span>网络已断开，消息发送将失败</span>
        </div>
      )}

      {/* 输入区域 */}
      <div className="p-4 border-t border-aurora-border-light dark:border-aurora-border-dark">
        <div className="max-w-3xl mx-auto">
          {uploadedFiles.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {uploadedFiles.map((fileId, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-aurora-muted-light dark:bg-aurora-muted-dark rounded-lg px-3 py-1.5 text-sm animate-fade-in">
                  <Paperclip className="w-3.5 h-3.5" /><span>{fileId}</span>
                  <button onClick={() => setUploadedFiles((prev) => prev.filter((_, i) => i !== idx))} className="text-aurora-text-secondary dark:text-aurora-text-dark-secondary hover:text-aurora-text-primary dark:hover:text-aurora-text-dark-primary">×</button>
                </div>
              ))}
            </div>
          )}
          <div className={`relative flex items-end gap-2 bg-aurora-surface-light dark:bg-aurora-surface-dark border rounded-2xl p-2 shadow-sm transition-all focus-within:shadow-lg focus-within:ring-1 focus-within:ring-aurora-accent/10 dark:focus-within:ring-aurora-accent-dark/10 ${dragOver ? 'border-blue-500 dark:border-blue-400 ring-2 ring-blue-500/20' : 'border-aurora-border-light dark:border-aurora-border-dark focus-within:border-aurora-text-primary/20 dark:focus-within:border-aurora-text-dark-primary/20'}`}
            onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave}>
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" multiple />
            <button onClick={() => fileInputRef.current?.click()} className="p-2 rounded-lg text-aurora-text-secondary dark:text-aurora-text-dark-secondary hover:bg-aurora-muted-light dark:hover:bg-aurora-muted-dark transition-colors" title="上传文件">
              <Paperclip className="w-5 h-5" />
            </button>
            <PromptTemplates onSelect={(content) => setInput(content)} />
            <textarea ref={textareaRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown} onPaste={handlePaste}
              placeholder={dragOver ? "拖放文件到此处..." : "发送消息...（拖拽或粘贴文件）"}
              className="flex-1 bg-transparent px-2 py-2.5 max-h-[200px] focus:outline-none resize-none text-aurora-text-primary dark:text-aurora-text-dark-primary placeholder:text-aurora-text-secondary dark:placeholder:text-aurora-text-dark-secondary"
              rows={1} disabled={!!streamingMessageId} style={{ minHeight: '24px', height: 'auto' }} />
            {streamingMessageId ? (
              <button onClick={handleStop} className="p-2 rounded-lg bg-aurora-accent text-white dark:bg-aurora-accent-dark dark:text-black hover:bg-aurora-accent-hover dark:hover:bg-aurora-accent-dark-hover active:scale-95 transition-all">
                <Square className="w-5 h-5 fill-current" />
              </button>
            ) : (
              <button onClick={handleSend} disabled={!input.trim() && uploadedFiles.length === 0}
                className="p-2 rounded-lg bg-aurora-accent text-white dark:bg-aurora-accent-dark dark:text-black disabled:opacity-30 disabled:cursor-not-allowed hover:bg-aurora-accent-hover dark:hover:bg-aurora-accent-dark-hover hover:scale-105 active:scale-95 transition-all">
                <Send className="w-5 h-5" />
              </button>
            )}
          </div>
          <p className="text-center text-xs text-aurora-text-secondary dark:text-aurora-text-dark-secondary mt-2">AI 生成内容可能不准确，请自行核实。</p>
        </div>
      </div>
    </div>
  );
}
