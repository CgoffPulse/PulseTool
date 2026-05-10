/**
 * Tiny, dependency-free markdown renderer for AI insight bodies.
 *
 * Supports headings, paragraphs, **bold**, *italic*, `code`, and bullet lists.
 * Anything richer than that is rare in our prompts and can be added later.
 */

interface InlineToken {
  type: 'text' | 'bold' | 'italic' | 'code';
  value: string;
}

function tokenize(line: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  let i = 0;
  while (i < line.length) {
    if (line.startsWith('**', i)) {
      const end = line.indexOf('**', i + 2);
      if (end > -1) {
        tokens.push({ type: 'bold', value: line.slice(i + 2, end) });
        i = end + 2;
        continue;
      }
    }
    if (line[i] === '`') {
      const end = line.indexOf('`', i + 1);
      if (end > -1) {
        tokens.push({ type: 'code', value: line.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }
    if (line[i] === '_') {
      const end = line.indexOf('_', i + 1);
      if (end > -1) {
        tokens.push({ type: 'italic', value: line.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }
    if (line[i] === '*' && line[i + 1] !== '*') {
      const end = line.indexOf('*', i + 1);
      if (end > -1) {
        tokens.push({ type: 'italic', value: line.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }
    // Accumulate plain text up to the next inline marker.
    let j = i;
    while (
      j < line.length &&
      !line.startsWith('**', j) &&
      line[j] !== '`' &&
      line[j] !== '_' &&
      !(line[j] === '*' && line[j + 1] !== '*')
    ) {
      j++;
    }
    if (j > i) {
      tokens.push({ type: 'text', value: line.slice(i, j) });
      i = j;
    } else {
      tokens.push({ type: 'text', value: line[i] ?? '' });
      i++;
    }
  }
  return tokens;
}

function renderInline(line: string, key: string): React.ReactNode {
  return tokenize(line).map((t, i) => {
    const k = `${key}-${i}`;
    if (t.type === 'bold') return <strong key={k}>{t.value}</strong>;
    if (t.type === 'italic') return <em key={k}>{t.value}</em>;
    if (t.type === 'code') {
      return (
        <code
          key={k}
          className="rounded bg-cream/60 px-1.5 py-0.5 font-mono text-[12px] text-green-deep"
        >
          {t.value}
        </code>
      );
    }
    return <span key={k}>{t.value}</span>;
  });
}

export function Markdown({
  text,
  className = '',
}: {
  text: string;
  className?: string;
}) {
  const blocks: React.ReactNode[] = [];
  const lines = text.split(/\r?\n/);
  let listBuf: string[] = [];

  const flushList = (key: string) => {
    if (listBuf.length === 0) return;
    blocks.push(
      <ul key={`ul-${key}`} className="my-3 list-disc space-y-1 pl-5 text-charcoal/85">
        {listBuf.map((item, j) => (
          <li key={`li-${key}-${j}`}>{renderInline(item, `li-${key}-${j}`)}</li>
        ))}
      </ul>
    );
    listBuf = [];
  };

  lines.forEach((raw, i) => {
    const line = raw.trimEnd();
    const key = String(i);
    if (/^\s*$/.test(line)) {
      flushList(key);
      return;
    }
    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    if (bullet) {
      listBuf.push(bullet[1]);
      return;
    }
    flushList(key);
    const h2 = line.match(/^##\s+(.*)$/);
    const h3 = line.match(/^###\s+(.*)$/);
    if (h2) {
      blocks.push(
        <h2
          key={`h2-${key}`}
          className="mt-5 font-display text-xl font-bold text-green-deep"
        >
          {renderInline(h2[1], `h2-${key}`)}
        </h2>
      );
      return;
    }
    if (h3) {
      blocks.push(
        <h3
          key={`h3-${key}`}
          className="mt-4 font-display text-base font-bold text-green-deep"
        >
          {renderInline(h3[1], `h3-${key}`)}
        </h3>
      );
      return;
    }
    blocks.push(
      <p key={`p-${key}`} className="my-2 text-charcoal/85">
        {renderInline(line, `p-${key}`)}
      </p>
    );
  });
  flushList('end');

  return (
    <div className={`max-w-none text-sm leading-body ${className}`}>{blocks}</div>
  );
}
