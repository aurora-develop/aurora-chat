import { useState, useRef, useEffect } from 'react';
import { RefreshCw, ChevronDown } from 'lucide-react';

/** 重新生成时选择模型的弹出组件 */
export default function RegenerateWithModel({
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
