import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import '../hljs-config';
import CodeBlock from './CodeBlock';

/** 使用 useMemo 缓存的 Markdown 渲染，避免已完成消息的重复解析 */
const MemoizedMarkdown = React.memo(function MemoizedMarkdown({ content }: { content: string }) {
  const rendered = useMemo(() => (
    <div className="markdown-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          pre: ({ children }) => <>{children}</>,
          code: ({ className, children }) => <CodeBlock className={className}>{children}</CodeBlock>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  ), [content]);
  return rendered;
});

export default MemoizedMarkdown;
