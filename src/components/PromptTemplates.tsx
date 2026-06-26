import { useState, useRef, useEffect } from 'react';
import { BookOpen, Code, Languages, PenTool, BarChart3, Lightbulb, Search, FileText, Sparkles, Bug } from 'lucide-react';

interface Template {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  content: string;
  category: string;
}

const TEMPLATES: Template[] = [
  { id: 'code', icon: Code, title: '代码助手', content: '请帮我写一段代码，需求如下：\n\n', category: '开发' },
  { id: 'explain', icon: Lightbulb, title: '概念解释', content: '请用简单易懂的语言解释以下概念：\n\n', category: '学习' },
  { id: 'translate', icon: Languages, title: '翻译', content: '请将以下内容翻译为英文：\n\n', category: '语言' },
  { id: 'review', icon: Search, title: '代码审查', content: '请审查以下代码，指出潜在问题和改进建议：\n\n```\n\n```', category: '开发' },
  { id: 'write', icon: PenTool, title: '写作助手', content: '请帮我撰写以下内容：\n\n主题：\n风格：\n字数要求：', category: '写作' },
  { id: 'data', icon: BarChart3, title: '数据分析', content: '请分析以下数据并给出见解：\n\n', category: '分析' },
  { id: 'summarize', icon: FileText, title: '内容总结', content: '请总结以下内容的要点：\n\n', category: '学习' },
  { id: 'creative', icon: Sparkles, title: '创意生成', content: '请帮我头脑风暴以下主题的创意：\n\n主题：\n目标受众：\n数量：5个', category: '创意' },
  { id: 'debug', icon: Bug, title: '调试帮助', content: '我遇到了一个问题：\n\n现象：\n预期行为：\n已尝试的方案：\n\n错误信息或日志：\n```\n\n```', category: '开发' },
  { id: 'optimize', icon: Code, title: '性能优化', content: '请分析以下代码的性能瓶颈并给出优化建议：\n\n```\n\n```', category: '开发' },
];

export default function PromptTemplates({ onSelect }: { onSelect: (content: string) => void }) {
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
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="p-2 rounded-lg text-aurora-text-secondary dark:text-aurora-text-dark-secondary hover:bg-aurora-muted-light dark:hover:bg-aurora-muted-dark transition-colors"
        title="提示词模板"
        aria-label="提示词模板"
      >
        <BookOpen className="w-5 h-5" />
      </button>
      {open && (
        <div className="absolute bottom-full left-0 mb-2 w-80 bg-aurora-surface-light dark:bg-aurora-surface-dark border border-aurora-border-light dark:border-aurora-border-dark rounded-xl shadow-xl py-2 z-30 max-h-96 overflow-y-auto">
          <div className="px-3 py-1.5 text-xs font-medium text-aurora-text-secondary dark:text-aurora-text-dark-secondary">
            提示词模板
          </div>
          <div className="space-y-0.5">
            {TEMPLATES.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => { onSelect(t.content); setOpen(false); }}
                  className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-aurora-muted-light dark:hover:bg-aurora-muted-dark text-left transition-colors"
                >
                  <Icon className="w-4 h-4 flex-shrink-0 text-aurora-text-secondary dark:text-aurora-text-dark-secondary" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-aurora-text-primary dark:text-aurora-text-dark-primary">{t.title}</div>
                    <div className="text-xs text-aurora-text-secondary dark:text-aurora-text-dark-secondary truncate">{t.content.slice(0, 40)}...</div>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-aurora-muted-light dark:bg-aurora-muted-dark text-aurora-text-secondary dark:text-aurora-text-dark-secondary">{t.category}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
