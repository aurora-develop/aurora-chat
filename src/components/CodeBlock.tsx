import { useState } from 'react';
import { Check, Copy, ExternalLink } from 'lucide-react';

// P2-1: 支持在 CodePen 打开的语言
const CODEPEN_LANGUAGES = new Set(['html', 'css', 'javascript', 'js', 'jsx', 'ts', 'tsx', 'typescript']);

export default function CodeBlock({ className, children }: { className?: string; children: React.ReactNode }) {
  const [copied, setCopied] = useState(false);
  const match = /language-(\w+)/.exec(className || '');
  const lang = match ? match[1] : '';
  const code = String(children).replace(/\n$/, '');

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenCodePen = () => {
    // CodePen POST API: https://codepen.io/pen/define
    const data: Record<string, string> = {};
    if (lang === 'html') data.html = code;
    else if (lang === 'css') data.css = code;
    else data.js = code; // JS/TS/JSX/TSX

    const form = document.createElement('form');
    form.method = 'POST';
    form.action = 'https://codepen.io/pen/define';
    form.target = '_blank';
    form.style.display = 'none';

    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = 'data';
    input.value = JSON.stringify(data);
    form.appendChild(input);

    document.body.appendChild(form);
    form.submit();
    document.body.removeChild(form);
  };

  return (
    <div className="relative group my-4">
      <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-[#0d0d0d] to-[#151518] text-slate-400 text-xs rounded-t-xl border-b border-slate-700/50">
        <span className="flex items-center gap-2">
          <div className="w-1 h-4 rounded-full bg-aurora-violet dark:bg-aurora-violet-dark" />
          <span className="px-2 py-0.5 rounded-md bg-white/5 font-medium tracking-wide uppercase">
            {lang || 'code'}
          </span>
        </span>
        <div className="flex items-center gap-1">
          {CODEPEN_LANGUAGES.has(lang) && (
            <button
              onClick={handleOpenCodePen}
              className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-white/10 active:scale-95 transition-all"
              aria-label="在 CodePen 中打开"
              title="在 CodePen 中打开"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>CodePen</span>
            </button>
          )}
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-white/10 active:scale-95 transition-all"
            aria-label={copied ? '已复制' : '复制代码'}
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? '已复制' : '复制'}</span>
          </button>
        </div>
      </div>
      <pre className="!mt-0 rounded-t-none rounded-b-xl">{children}</pre>
    </div>
  );
}
