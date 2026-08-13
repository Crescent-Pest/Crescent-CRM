import type { ReactNode } from "react";

/**
 * Tiny markdown renderer for Crescent Inspect's AI-generated treatment plans
 * (same renderer as that app's src/lib/markdown.tsx — keep in sync).
 * Handles headings, bullet/numbered lists, bold, and paragraphs — the only
 * constructs the plan prompt asks for. No dependency, no raw HTML injection.
 */

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  // split on **bold** spans
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={`${keyPrefix}-b${i}`}>{part.slice(2, -2)}</strong>
    ) : (
      part
    )
  );
}

export function Markdown({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  const lines = text.split(/\r?\n/);
  let list: { ordered: boolean; items: string[] } | null = null;
  let para: string[] = [];

  const flushList = () => {
    if (!list) return;
    const items = list.items;
    const key = `l${blocks.length}`;
    blocks.push(
      list.ordered ? (
        <ol key={key} className="ml-5 list-decimal space-y-1">
          {items.map((item, i) => (
            <li key={i}>{renderInline(item, `${key}-${i}`)}</li>
          ))}
        </ol>
      ) : (
        <ul key={key} className="ml-5 list-disc space-y-1">
          {items.map((item, i) => (
            <li key={i}>{renderInline(item, `${key}-${i}`)}</li>
          ))}
        </ul>
      )
    );
    list = null;
  };

  const flushPara = () => {
    if (para.length === 0) return;
    const key = `p${blocks.length}`;
    blocks.push(<p key={key}>{renderInline(para.join(" "), key)}</p>);
    para = [];
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    const bullet = line.match(/^[-*]\s+(.*)$/);
    const numbered = line.match(/^\d+[.)]\s+(.*)$/);

    if (heading) {
      flushPara();
      flushList();
      const level = heading[1].length;
      const key = `h${blocks.length}`;
      const content = renderInline(heading[2], key);
      blocks.push(
        level <= 2 ? (
          <h3
            key={key}
            className="mt-4 font-display text-sm font-bold uppercase tracking-[0.12em] text-denim first:mt-0"
          >
            {content}
          </h3>
        ) : (
          <h4 key={key} className="mt-3 text-sm font-semibold text-ink">
            {content}
          </h4>
        )
      );
    } else if (bullet || numbered) {
      flushPara();
      const ordered = Boolean(numbered);
      const item = (bullet ?? numbered)![1];
      if (!list || list.ordered !== ordered) {
        flushList();
        list = { ordered, items: [] };
      }
      list.items.push(item);
    } else if (line.trim() === "") {
      flushPara();
      flushList();
    } else {
      flushList();
      para.push(line.trim());
    }
  }
  flushPara();
  flushList();

  return <div className="space-y-2 text-sm leading-relaxed text-ink">{blocks}</div>;
}
