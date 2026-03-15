'use client';

import Markdown from 'react-markdown';

type MarkdownTextProps = {
  children: string;
  className?: string;
};

export default function MarkdownText({ children, className }: MarkdownTextProps) {
  return <div className={className ?? 'markdown-content'}><Markdown>{children}</Markdown></div>;
}
