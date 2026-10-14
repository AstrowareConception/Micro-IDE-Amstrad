import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { memo } from 'react';
/** React nodes only: HTML and remote image loads are disabled. Links stay inside the reader. */
export const MarkdownView = memo(function MarkdownView({ source, onLink }: { source: string; onLink(href: string): void }) {
  return <article className="markdown-reading" aria-label="Lecture Markdown"><Markdown remarkPlugins={[remarkGfm]} skipHtml components={{
    a: ({href,children}) => <button className="markdown-link" onClick={() => onLink(href ?? '')}>{children}</button>,
    img: ({src,alt}) => <span className="markdown-image"><span>Image : {alt || 'sans légende'}</span><button onClick={() => onLink(typeof src === 'string' ? src : '')}>Ouvrir la ressource</button></span>,
    pre: ({children}) => <pre tabIndex={0}>{children}</pre>,
    table: ({children}) => <div className="markdown-table"><table>{children}</table></div>,
  }}>{source}</Markdown></article>;
});
