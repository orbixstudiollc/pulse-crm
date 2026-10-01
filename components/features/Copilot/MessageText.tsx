import type { ReactNode } from "react";

// A small, safe Markdown subset for assistant replies: paragraphs, headings,
// bullet and numbered lists (one nesting level), **bold**, *italic* and `code`.
// Everything renders as React text nodes; no HTML from the model is ever parsed.

type ListItem = { text: string; children: string[] };
type Block =
  | { kind: "p"; text: string }
  | { kind: "h"; text: string }
  | { kind: "ul" | "ol"; items: ListItem[] };

const BULLET = /^[-*•]\s+/;
const NUMBERED = /^\d+[.)]\s+/;
const HEADING = /^#{1,6}\s+/;

function parse(text: string): Block[] {
  const blocks: Block[] = [];
  let list: Extract<Block, { kind: "ul" | "ol" }> | null = null;

  for (const raw of text.split("\n")) {
    const indented = /^\s{2,}/.test(raw);
    const line = raw.trim();
    if (!line) {
      list = null;
      continue;
    }
    const kind = BULLET.test(line) ? "ul" : NUMBERED.test(line) ? "ol" : null;
    if (kind) {
      const itemText = line.replace(kind === "ul" ? BULLET : NUMBERED, "");
      // An indented item, or a bullet under a numbered item, nests under the previous item.
      if (list && list.items.length > 0 && (indented || (kind === "ul" && list.kind === "ol"))) {
        list.items[list.items.length - 1].children.push(itemText);
        continue;
      }
      if (!list || list.kind !== kind) {
        list = { kind, items: [] };
        blocks.push(list);
      }
      list.items.push({ text: itemText, children: [] });
      continue;
    }
    list = null;
    if (HEADING.test(line)) blocks.push({ kind: "h", text: line.replace(HEADING, "") });
    else blocks.push({ kind: "p", text: line });
  }
  return blocks;
}

function Inline({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*)/g).filter(Boolean);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
          return (
            <strong key={i} className="font-semibold">
              {part.slice(2, -2)}
            </strong>
          );
        }
        if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
          return <em key={i}>{part.slice(1, -1)}</em>;
        }
        if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
          return (
            <code key={i} className="rounded bg-subtle px-1 py-0.5 font-mono text-[13px]">
              {part.slice(1, -1)}
            </code>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

export function MessageText({ text }: { text: string }) {
  const nodes: ReactNode[] = parse(text).map((block, i) => {
    if (block.kind === "p") {
      return (
        <p key={i} className="my-1.5">
          <Inline text={block.text} />
        </p>
      );
    }
    if (block.kind === "h") {
      return (
        <p key={i} className="mt-3 mb-1 font-semibold">
          <Inline text={block.text} />
        </p>
      );
    }
    const List = block.kind;
    return (
      <List key={i} className={`my-1.5 space-y-1 pl-5 ${block.kind === "ul" ? "list-disc" : "list-decimal"}`}>
        {block.items.map((item, j) => (
          <li key={j}>
            <Inline text={item.text} />
            {item.children.length > 0 && (
              <ul className="mt-0.5 list-disc space-y-0.5 pl-5 text-fg-secondary">
                {item.children.map((child, k) => (
                  <li key={k}>
                    <Inline text={child} />
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </List>
    );
  });
  return <div className="py-1.5 text-[14px] leading-6 text-fg">{nodes}</div>;
}
