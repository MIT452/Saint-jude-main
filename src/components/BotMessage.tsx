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

// "disponible" seul devient pastille uniquement s'il désigne un état (après ":", "(", "-" ou "–").
// Dans une phrase ("une date disponible"), il reste du texte normal.
const STATE_WORDS = Object.keys(BADGES).filter((k) => k !== 'disponible').join('|');
const BADGE_RE = new RegExp(
  `((?<![\\p{L}])(?:${STATE_WORDS})(?![\\p{L}])|(?<=[:(–-]\\s*)disponible(?![\\p{L}]))`,
  'giu',
);

function decorate(node: React.ReactNode): React.ReactNode {
  if (typeof node === 'string') {
    // Pas de pastille dans une phrase de négation : "pas de voyage disponible"
    if (/\b(pas de|aucun|aucune|n[’']y a pas|indisponible)\b/i.test(node)) return node;
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