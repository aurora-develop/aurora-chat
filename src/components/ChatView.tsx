import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import {
  Send, Paperclip, Bot, User, Code, Lightbulb, Image as ImageIcon,
  Copy, Check, RefreshCw, Square, Pencil, ChevronLeft, ChevronRight,
  ThumbsUp, ThumbsDown, ChevronDown, Trash2
} from 'lucide-react';
import { useChatStore, type MessageNode } from '../stores/chatStore';
import { useSettingsStore } from '../stores/settingsStore';
import { chatCompletionStream, chatCompletion } from '../api/chat';
import { uploadFileToServer } from '../api/files';
import { getModels } from '../api/models';
import type { Message } from '../types/api';

/** 重新生成时选择模型的弹出组件 */
function RegenerateWithModel({
  messageId,
  streamingMessageId,
  onRegenerate,
  availableModels,
}: {
  messageId: string;
  streamingMessageId: string | null;
  onRegenerate: (id: string, model?: string) => void;
  availableModels: string[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="relative inline-flex" ref={ref}>
      <button
        onClick={() => onRegenerate(messageId)}
        disabled={!!streamingMessageId}
        className="px-1.5 rounded-l-md text-aurora-text-secondary dark:text-aurora-text-dark-secondary hover:bg-aurora-muted-light dark:hover:bg-aurora-muted-dark disabled:opacity-30"
        title="重新生成"
      >
        <RefreshCw className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={() => setOpen((v) => !v)}
        className="px-1.5 rounded-r-md text-aurora-text-secondary dark:text-aurora-text-dark-secondary hover:bg-aurora-muted-light dark:hover:bg-aurora-muted-dark disabled:opacity-30"
        title="选择模型重新生成"
      >
        <ChevronDown className="w-3 h-3" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-48 bg-aurora-surface-light dark:bg-aurora-surface-dark border border-aurora-border-light dark:border-aurora-border-dark rounded-lg shadow-xl py-1 z-30">
          <div className="px-3 py-1.5 text-xs text-aurora-text-secondary dark:text-aurora-text-dark-secondary">选择模型重新生成</div>
          {availableModels.slice(0, 8).map((m) => (
            <button
              key={m}
              onClick={() => { setOpen(false); onRegenerate(messageId, m); }}
              className="w-full text-left px-3 py-1.5 text-sm hover:bg-aurora-muted-light dark:hover:bg-aurora-muted-dark text-aurora-text-secondary dark:text-aurora-text-dark-secondary"
            >
              {m}
            </button>
          ))}
          <div className="border-t border-aurora-border-light dark:border-aurora-border-dark my-1" />
          <button
            onClick={() => {
              setOpen(false);
              const custom = prompt('输入模型名称：');
              if (custom && custom.trim()) onRegenerate(messageId, custom.trim());
            }}
            className="w-full text-left px-3 py-1.5 text-sm hover:bg-aurora-muted-light dark:hover:bg-aurora-muted-dark text-aurora-accent dark:text-aurora-accent-dark"
          >
            自定义模型...
          </button>
        </div>
      )}
    </div>
  );
}

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
  const {
    conversations,
    messages,
    currentConversationId,
    streamingMessageId,
    createConversation,
    addMessage,
    updateMessage,
    getMessagePath,
    setStreamingMessage,
    setAbortController,
    regenerateMessage,
    deleteBranch,
    getParentUserMessage,
    getSiblingInfo,
    switchSibling,
    setConversationModel,
  } = useChatStore();

  const { model, streamEnabled } = useSettingsStore();
  const [input, setInput] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const modelMenuRef = useRef<HTMLDivElement>(null);

  const currentConversation = conversations.find((c) => c.id === currentConversationId);
  const messagePath = currentConversationId ? getMessagePath(currentConversationId) : [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messagePath, streamingMessageId]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modelMenuRef.current && !modelMenuRef.current.contains(e.target as Node)) {
        setModelMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!modelMenuOpen) return;
    getModels()
      .then((res) => {
        const ids = (res.data || []).map((m) => m.id).filter(Boolean);
        setAvailableModels(ids.length ? ids : ['auto', 'gpt-4o', 'gpt-4o-mini', 'gpt-image-2']);
      })
      .catch(() => {
        setAvailableModels(['auto', 'gpt-4o', 'gpt-4o-mini', 'gpt-image-2']);
      });
  }, [modelMenuOpen]);

  const buildRequestMessages = (upToMessageId: string): Message[] => {
    const result: Message[] = [];
    const visited = new Set<string>();
    let currentId: string | null = upToMessageId;

    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);
      const currentMsg: MessageNode | undefined = messages[currentId];
      if (!currentMsg) break;
      result.unshift({
        role: currentMsg.role,
        content: currentMsg.content as string | Message['content'],
      });
      currentId = currentMsg.parentId;
    }

    return result;
  };

  const sendMessage = async (content: string, parentId: string | null) => {
    if (!content.trim() && uploadedFiles.length === 0) return;

    let conversationId = currentConversationId;
    if (!conversationId) {
      conversationId = createConversation();
    }

    // 构建用户消息内容
    const contentParts = [];
    if (content.trim()) contentParts.push({ type: 'text' as const, text: content });
    for (const fileId of uploadedFiles) {
      contentParts.push({ type: 'input_file' as const, file_id: fileId });
    }

    const userContent = contentParts.length === 1 && contentParts[0].type === 'text'
      ? content
      : contentParts;

    // 添加用户消息
    const userMessageId = addMessage(conversationId, parentId, {
      role: 'user',
      content: userContent,
    });

    setInput('');
    setUploadedFiles([]);

    // 发送请求
    await generateResponse(userMessageId, conversationId);
  };

  const generateResponse = async (userMessageId: string, conversationId: string) => {
    const requestMessages = buildRequestMessages(userMessageId);
    const conversation = conversations.find((c) => c.id === conversationId);
    const activeModel = conversation?.model && conversation.model !== 'auto'
      ? conversation.model
      : (model === 'auto' ? 'auto' : model);

    // 添加空的 assistant 消息
    const assistantMessageId = addMessage(conversationId, userMessageId, {
      role: 'assistant',
      content: '',
    });

    updateMessage(assistantMessageId, { model: activeModel });

    setStreamingMessage(assistantMessageId);
    const abortController = new AbortController();
    setAbortController(abortController);

    try {
      if (streamEnabled) {
        const stream = chatCompletionStream({
          model: activeModel,
          messages: requestMessages,
          stream: true,
        }, abortController.signal);

        let fullContent = '';
        for await (const chunk of stream) {
          if (abortController.signal.aborted) break;
          const delta = chunk.choices?.[0]?.delta?.content || '';
          if (delta) {
            fullContent += delta;
            updateMessage(assistantMessageId, { content: fullContent });
          }
        }
      } else {
        const response = await chatCompletion({
          model: activeModel,
          messages: requestMessages,
          stream: false,
        }, abortController.signal);

        const assistantMessage = response.choices?.[0]?.message;
        if (assistantMessage) {
          updateMessage(assistantMessageId, { content: assistantMessage.content });
        }
      }
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        // 用户主动中断，保留已生成内容
      } else {
        updateMessage(assistantMessageId, {
          content: `错误: ${(error as Error).message || '未知错误'}`,
          isError: true,
        });
      }
    } finally {
      setStreamingMessage(null);
      setAbortController(null);
    }
  };

  const handleSend = () => sendMessage(input, currentConversation?.currentLeafId || null);

  const handleRegenerate = async (assistantMessageId: string, customModel?: string) => {
    const newAssistantId = regenerateMessage(assistantMessageId);
    if (!newAssistantId) return;

    const parentUser = getParentUserMessage(assistantMessageId);
    if (!parentUser) return;

    const requestMessages = buildRequestMessages(parentUser.id);
    const activeModel = customModel
      ? customModel
      : (currentConversation?.model && currentConversation.model !== 'auto'
        ? currentConversation.model
        : (model === 'auto' ? 'auto' : model));

    updateMessage(newAssistantId, { model: activeModel });

    setStreamingMessage(newAssistantId);
    const abortController = new AbortController();
    setAbortController(abortController);

    try {
      if (streamEnabled) {
        const stream = chatCompletionStream({ model: activeModel, messages: requestMessages, stream: true }, abortController.signal);
        let fullContent = '';
        for await (const chunk of stream) {
          if (abortController.signal.aborted) break;
          const delta = chunk.choices?.[0]?.delta?.content || '';
          if (delta) {
            fullContent += delta;
            updateMessage(newAssistantId, { content: fullContent });
          }
        }
      } else {
        const response = await chatCompletion({ model: activeModel, messages: requestMessages, stream: false }, abortController.signal);
        const assistantMessage = response.choices?.[0]?.message;
        if (assistantMessage) {
          updateMessage(newAssistantId, { content: assistantMessage.content });
        }
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        updateMessage(newAssistantId, { content: `错误: ${(error as Error).message || '未知错误'}`, isError: true });
      }
    } finally {
      setStreamingMessage(null);
      setAbortController(null);
    }
  };

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

  const handleStop = () => {
    const { abortController } = useChatStore.getState();
    if (abortController) {
      abortController.abort();
    }
  };

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

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  };

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

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (editingId) {
        handleSaveEdit();
      } else {
        handleSend();
      }
    }
  };

  const handleCopy = (messageId: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(messageId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const suggestions = [
    { icon: Code, text: '帮我写一段代码' },
    { icon: Lightbulb, text: '解释一个概念' },
    { icon: ImageIcon, text: '生成一张图片' },
  ];

  const renderMessageContent = (msg: MessageNode) => {
    if (msg.role === 'assistant') {
      return (
        <div className="markdown-body">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeHighlight]}
            components={{
              pre: ({ children }) => <>{children}</>,
              code: ({ className, children }) => <CodeBlock className={className}>{children}</CodeBlock>,
            }}
          >
            {String(msg.content)}
          </ReactMarkdown>
        </div>
      );
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
                <img src={src} alt="image" className="max-w-sm rounded-xl border border-aurora-border-light dark:border-aurora-border-dark" />
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
      <header className="h-14 flex items-center justify-between px-6 border-b border-aurora-border-light dark:border-aurora-border-dark">
        <h2 className="text-base font-medium text-aurora-text-primary dark:text-aurora-text-dark-primary">聊天</h2>
        <div className="relative" ref={modelMenuRef}>
          <button
            onClick={() => setModelMenuOpen((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-aurora-border-light dark:border-aurora-border-dark text-aurora-text-secondary dark:text-aurora-text-dark-secondary hover:bg-aurora-muted-light dark:hover:bg-aurora-muted-dark transition-colors"
          >
            {currentConversation?.model && currentConversation.model !== 'auto'
              ? currentConversation.model
              : model === 'auto' ? '自动模型' : model}
            <ChevronDown className="w-3 h-3" />
          </button>
          {modelMenuOpen && (
            <div className="absolute right-0 top-full mt-1 w-56 bg-aurora-surface-light dark:bg-aurora-surface-dark border border-aurora-border-light dark:border-aurora-border-dark rounded-lg shadow-xl py-1 z-30 max-h-80 overflow-y-auto">
              {availableModels.length === 0 ? (
                <div className="px-3 py-2 text-sm text-aurora-text-secondary dark:text-aurora-text-dark-secondary">加载中...</div>
              ) : (
                availableModels.map((m) => (
                  <button
                    key={m}
                    onClick={() => {
                      if (currentConversation) {
                        setConversationModel(currentConversation.id, m);
                      }
                      setModelMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-aurora-muted-light dark:hover:bg-aurora-muted-dark ${
                      (currentConversation?.model || model) === m
                        ? 'text-aurora-text-primary dark:text-aurora-text-dark-primary font-medium'
                        : 'text-aurora-text-secondary dark:text-aurora-text-dark-secondary'
                    }`}
                  >
                    <span className="flex-1 text-left truncate">{m}</span>
                    {(currentConversation?.model || model) === m && (
                      <Check className="w-3.5 h-3.5 flex-shrink-0" />
                    )}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        {messagePath.length === 0 ? (
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
            {messagePath.map((msg) => {
              const isUser = msg.role === 'user';
              const isAssistant = msg.role === 'assistant';
              const isStreaming = streamingMessageId === msg.id;
              const { index: siblingIndex, total: siblingTotal } = getSiblingInfo(msg.id);
              const hasSiblings = siblingTotal > 1;
              const textContent = typeof msg.content === 'string' ? msg.content : '';

              return (
                <div key={msg.id} className="group flex gap-4 animate-fade-in">
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                    isUser
                      ? 'bg-aurora-text-secondary dark:bg-aurora-text-dark-secondary'
                      : 'bg-aurora-accent dark:bg-aurora-accent-dark'
                  }`}>
                    {isUser ? (
                      <User className="w-4 h-4 text-white dark:text-black" />
                    ) : (
                      <Bot className="w-4 h-4 text-white dark:text-black" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* 消息气泡 */}
                    <div className={`relative inline-block max-w-[85%] rounded-3xl px-5 py-3.5 ${
                      isUser
                        ? 'bg-aurora-user-bubble-light dark:bg-aurora-user-bubble-dark text-aurora-text-primary dark:text-aurora-text-dark-primary'
                        : 'text-aurora-text-primary dark:text-aurora-text-dark-primary'
                    }`}>
                      {editingId === msg.id ? (
                        <div className="min-w-[300px]">
                          <textarea
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            onKeyPress={handleKeyPress}
                            className="w-full bg-transparent border border-aurora-border-light dark:border-aurora-border-dark rounded-lg px-3 py-2 focus:outline-none resize-none text-aurora-text-primary dark:text-aurora-text-dark-primary"
                            rows={3}
                            autoFocus
                          />
                          <div className="flex justify-end gap-2 mt-2">
                            <button
                              onClick={() => setEditingId(null)}
                              className="px-3 py-1.5 text-sm border border-aurora-border-light dark:border-aurora-border-dark rounded-lg hover:bg-aurora-muted-light dark:hover:bg-aurora-muted-dark"
                            >
                              取消
                            </button>
                            <button
                              onClick={handleSaveEdit}
                              className="px-3 py-1.5 text-sm bg-aurora-accent text-white dark:bg-aurora-accent-dark dark:text-black rounded-lg"
                            >
                              保存
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {renderMessageContent(msg)}
                          {isStreaming && (
                            <span className="inline-block w-2 h-4 ml-1 bg-aurora-text-secondary dark:bg-aurora-text-dark-secondary animate-pulse" />
                          )}
                        </>
                      )}
                    </div>

                    {/* 消息操作栏 */}
                    {editingId !== msg.id && (
                      <div className="flex items-center gap-1 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        {isAssistant && (
                          <>
                            <button
                              onClick={() => handleCopy(msg.id, textContent)}
                              className="p-1.5 rounded-md text-aurora-text-secondary dark:text-aurora-text-dark-secondary hover:bg-aurora-muted-light dark:hover:bg-aurora-muted-dark"
                              title="复制"
                            >
                              {copiedId === msg.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                            {/* 重新生成 + 选择模型重新生成 */}
                            {!isStreaming && (
                              <RegenerateWithModel
                                messageId={msg.id}
                                streamingMessageId={streamingMessageId}
                                onRegenerate={handleRegenerate}
                                availableModels={availableModels}
                              />
                            )}
                            <button
                              onClick={() => {
                                const fb = msg.feedback === 'up' ? undefined : 'up' as const;
                                updateMessage(msg.id, { feedback: fb });
                              }}
                              className={`p-1.5 rounded-md hover:bg-aurora-muted-light dark:hover:bg-aurora-muted-dark ${
                                msg.feedback === 'up' ? 'text-blue-500' : 'text-aurora-text-secondary dark:text-aurora-text-dark-secondary'
                              }`}
                              title="有用"
                            >
                              <ThumbsUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                const fb = msg.feedback === 'down' ? undefined : 'down' as const;
                                updateMessage(msg.id, { feedback: fb });
                              }}
                              className={`p-1.5 rounded-md hover:bg-aurora-muted-light dark:hover:bg-aurora-muted-dark ${
                                msg.feedback === 'down' ? 'text-red-500' : 'text-aurora-text-secondary dark:text-aurora-text-dark-secondary'
                              }`}
                              title="不太有用"
                            >
                              <ThumbsDown className="w-3.5 h-3.5" />
                            </button>
                            {!isStreaming && msg.childrenIds.length === 0 && (
                              <button
                                onClick={() => deleteBranch(msg.id)}
                                className="p-1.5 rounded-md text-aurora-text-secondary dark:text-aurora-text-dark-secondary hover:bg-aurora-muted-light dark:hover:bg-aurora-muted-dark"
                                title="删除回复"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </>
                        )}
                        {isUser && (
                          <button
                            onClick={() => handleEdit(msg.id)}
                            className="p-1.5 rounded-md text-aurora-text-secondary dark:text-aurora-text-dark-secondary hover:bg-aurora-muted-light dark:hover:bg-aurora-muted-dark"
                            title="编辑"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}

                    {/* 分支切换 */}
                    {isAssistant && hasSiblings && (
                      <div className="flex items-center gap-2 mt-1.5 text-xs text-aurora-text-secondary dark:text-aurora-text-dark-secondary">
                        <button
                          onClick={() => switchSibling(msg.id, -1)}
                          disabled={siblingIndex === 0}
                          className="p-1 rounded hover:bg-aurora-muted-light dark:hover:bg-aurora-muted-dark disabled:opacity-30"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                        <span>{siblingIndex + 1} / {siblingTotal}</span>
                        <button
                          onClick={() => switchSibling(msg.id, 1)}
                          disabled={siblingIndex === siblingTotal - 1}
                          className="p-1 rounded hover:bg-aurora-muted-light dark:hover:bg-aurora-muted-dark disabled:opacity-30"
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
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

      <div className="p-4 border-t border-aurora-border-light dark:border-aurora-border-dark">
        <div className="max-w-3xl mx-auto">
          {uploadedFiles.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {uploadedFiles.map((fileId, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-aurora-muted-light dark:bg-aurora-muted-dark rounded-lg px-3 py-1.5 text-sm animate-fade-in">
                  <Paperclip className="w-3.5 h-3.5" />
                  <span>{fileId}</span>
                  <button
                    onClick={() => setUploadedFiles((prev) => prev.filter((_, i) => i !== idx))}
                    className="text-aurora-text-secondary dark:text-aurora-text-dark-secondary hover:text-aurora-text-primary dark:hover:text-aurora-text-dark-primary"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          <div
            className={`relative flex items-end gap-2 bg-aurora-surface-light dark:bg-aurora-surface-dark border rounded-2xl p-2 shadow-sm transition-all focus-within:shadow-md ${
              dragOver
                ? 'border-blue-500 dark:border-blue-400 ring-2 ring-blue-500/20'
                : 'border-aurora-border-light dark:border-aurora-border-dark focus-within:border-aurora-text-primary/20 dark:focus-within:border-aurora-text-dark-primary/20'
            }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
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
              onPaste={handlePaste}
              placeholder={dragOver ? "拖放文件到此处..." : "发送消息...（拖拽或粘贴文件）"}
              className="flex-1 bg-transparent px-2 py-2.5 max-h-[200px] focus:outline-none resize-none text-aurora-text-primary dark:text-aurora-text-dark-primary placeholder:text-aurora-text-secondary dark:placeholder:text-aurora-text-dark-secondary"
              rows={1}
              disabled={!!streamingMessageId}
              style={{ minHeight: '24px', height: 'auto' }}
            />
            {streamingMessageId ? (
              <button
                onClick={handleStop}
                className="p-2 rounded-lg bg-aurora-accent text-white dark:bg-aurora-accent-dark dark:text-black hover:bg-aurora-accent-hover dark:hover:bg-aurora-accent-dark-hover active:scale-95 transition-all"
              >
                <Square className="w-5 h-5 fill-current" />
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!input.trim() && uploadedFiles.length === 0}
                className="p-2 rounded-lg bg-aurora-accent text-white dark:bg-aurora-accent-dark dark:text-black disabled:opacity-30 disabled:cursor-not-allowed hover:bg-aurora-accent-hover dark:hover:bg-aurora-accent-dark-hover active:scale-95 transition-all"
              >
                <Send className="w-5 h-5" />
              </button>
            )}
          </div>
          <p className="text-center text-xs text-aurora-text-secondary dark:text-aurora-text-dark-secondary mt-2">
            AI 生成内容可能不准确，请自行核实。
          </p>
        </div>
      </div>
    </div>
  );
}
