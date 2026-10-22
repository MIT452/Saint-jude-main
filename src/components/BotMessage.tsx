import React from 'react';
import ReactMarkdown from 'react-markdown';
import './BotMessage.css';

type WithChildren = { children?: React.ReactNode };

// Mots-clés transformés en pastilles colorées
const BADGES: Record<string, 'ok' | 'warn' | 'bad'> = {
  'disponible': 'ok',
  'en maintenance': 'warn',
  'hors service': 'bad',
  'en attente': 'warn',
  'confirmé': 'ok',
  'confirmée': 'ok',
  'payé': 'ok',
  'payée': 'ok',
  'impayé': 'bad',
  'impayée': 'bad',
};
const BADGE_RE = new RegExp(`(?<![\\p{L}])(${Object.keys(BADGES).join('|')})(?![\\p{L}])`, 'giu');

function decorate(node: React.ReactNode): React.ReactNode {
  if (typeof node === 'string') {
    return node.split(BADGE_RE).map((part, i) => {
      const kind = BADGES[part.toLowerCase()];
      return kind ? (
        <span key={i} className={`bm-badge ${kind}`}>
          {part}
        </span>
      ) : (
        part
      );
    });
  }
  if (Array.isArray(node)) {
    return node.map((n, i) => <React.Fragment key={i}>{decorate(n)}</React.Fragment>);
  }
  return node;
}

export default function BotMessage({ text }: { text: string }) {
  return (
    <div className="bm">
      <ReactMarkdown
        components={{
          p: ({ children }: WithChildren) => <p className="bm-p">{decorate(children)}</p>,
          strong: ({ children }: WithChildren) => <strong className="bm-strong">{children}</strong>,
          ul: ({ children }: WithChildren) => <ul className="bm-list">{children}</ul>,
          ol: ({ children }: WithChildren) => <ol className="bm-list">{children}</ol>,
          li: ({ children }: WithChildren) => <li className="bm-item">{decorate(children)}</li>,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}