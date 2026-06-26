import { useState, useRef, useEffect, useCallback } from 'react';
import { Search, ChevronUp, ChevronDown, X } from 'lucide-react';
import type { MessageNode } from '../stores/chatStore';

interface SearchResult {
  messageId: string;
  index: number;
  text: string;
}

export default function MessageSearch({
  messagePath,
  onJumpToMessage,
}: {
  messagePath: MessageNode[];
  onJumpToMessage: (messageId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [currentIdx, setCurrentIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Ctrl+F 打开搜索
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        // 只在没有其他输入框聚焦时触发
        const active = document.activeElement;
        if (active && (active.tagName === 'TEXTAREA' || active.tagName === 'INPUT')) return;
        e.preventDefault();
        setOpen(true);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 搜索逻辑
  const performSearch = useCallback((q: string) => {
    if (!q.trim()) { setResults([]); setCurrentIdx(-1); return; }
    const lower = q.toLowerCase();
    const found: SearchResult[] = [];
    for (const msg of messagePath) {
      const text = typeof msg.content === 'string' ? msg.content : '';
      if (!text) continue;
      const msgLower = text.toLowerCase();
      let startIdx = 0;
      while (true) {
        const idx = msgLower.indexOf(lower, startIdx);
        if (idx === -1) break;
        found.push({ messageId: msg.id, index: idx, text: text.slice(idx, idx + q.length) });
        startIdx = idx + 1;
      }
    }
    setResults(found);
    setCurrentIdx(found.length > 0 ? 0 : -1);
    if (found.length > 0) onJumpToMessage(found[0].messageId);
  }, [messagePath, onJumpToMessage]);

  // debounce 搜索
  const handleQueryChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => performSearch(value), 200);
  };

  const goToResult = (idx: number) => {
    if (idx < 0 || idx >= results.length) return;
    setCurrentIdx(idx);
    onJumpToMessage(results[idx].messageId);
  };

  const goNext = () => {
    if (results.length === 0) return;
    goToResult((currentIdx + 1) % results.length);
  };

  const goPrev = () => {
    if (results.length === 0) return;
    goToResult((currentIdx - 1 + results.length) % results.length);
  };

  const handleClose = () => {
    setOpen(false);
    setQuery('');
    setResults([]);
    setCurrentIdx(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { handleClose(); return; }
    if (e.key === 'Enter') { e.shiftKey ? goPrev() : goNext(); }
  };

  if (!open) return null;

  return (
    <div className="absolute top-14 right-4 z-30 flex items-center gap-2 px-3 py-2 bg-aurora-surface-light dark:bg-aurora-surface-dark border border-aurora-border-light dark:border-aurora-border-dark rounded-lg shadow-lg animate-fade-in">
      <Search className="w-4 h-4 text-aurora-text-secondary dark:text-aurora-text-dark-secondary flex-shrink-0" />
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => handleQueryChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="搜索消息..."
        className="w-48 bg-transparent text-sm focus:outline-none text-aurora-text-primary dark:text-aurora-text-dark-primary placeholder:text-aurora-text-secondary dark:placeholder:text-aurora-text-dark-secondary"
        autoFocus
      />
      {query && (
        <span className="text-xs text-aurora-text-secondary dark:text-aurora-text-dark-secondary whitespace-nowrap">
          {results.length > 0 ? `${currentIdx + 1}/${results.length}` : '无结果'}
        </span>
      )}
      <div className="flex items-center gap-0.5">
        <button onClick={goPrev} disabled={results.length === 0} className="p-1 rounded hover:bg-aurora-muted-light dark:hover:bg-aurora-muted-dark disabled:opacity-30" aria-label="上一个">
          <ChevronUp className="w-3.5 h-3.5" />
        </button>
        <button onClick={goNext} disabled={results.length === 0} className="p-1 rounded hover:bg-aurora-muted-light dark:hover:bg-aurora-muted-dark disabled:opacity-30" aria-label="下一个">
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      </div>
      <button onClick={handleClose} className="p-1 rounded hover:bg-aurora-muted-light dark:hover:bg-aurora-muted-dark" aria-label="关闭搜索">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
