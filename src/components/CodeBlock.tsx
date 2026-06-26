import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

export default function CodeBlock({ className, children }: { className?: string; children: React.ReactNode }) {
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
