import type { Root, PhrasingContent, Link } from 'mdast';
import type { ChatWebSource } from './web-sources';

type Block = { type: string; children?: Block[]; value?: string; url?: string; title?: string };
const textOf = (node: Block): string => node.value ?? (node.children ?? []).map(textOf).join('');
const citationIds = (node: Block): string[] => node.title?.startsWith('vantra-citations:')
  ? node.title.slice('vantra-citations:'.length).split(',') : (node.children ?? []).flatMap(citationIds);

/** Render-only projection: citations stay with their cited block, never in copied text. */
export function remarkCitationGroups({ sources = [] }: { sources?: readonly ChatWebSource[] }) {
  const takeTail = (children: PhrasingContent[], length: number): PhrasingContent[] => {
    const tail: PhrasingContent[] = [];
    while (length > 0 && children.length) {
      const last = children.at(-1)!;
      const size = textOf(last as Block).length;
      if (size <= length) { tail.unshift(children.pop()!); length -= size; }
      else if (last.type === 'text') {
        tail.unshift({ type: 'text', value: last.value.slice(-length) });
        last.value = last.value.slice(0, -length); length = 0;
      } else if ('children' in last) {
        tail.unshift({ ...last, children: takeTail(last.children as PhrasingContent[], length) } as PhrasingContent); length = 0;
      } else { tail.unshift(children.pop()!); length = 0; }
    }
    return tail;
  };
  const addBubble = (children: PhrasingContent[], ids: string[]): PhrasingContent[] => {
    const unique = [...new Set(ids)];
    if (!unique.length || /[:：]\s*$/u.test(children.map((child) => textOf(child as Block)).join(''))) return children;
    // Include the last word/punctuation in the render-only link so they wrap together.
    const match = children.map((child) => textOf(child as Block)).join('').match(/\S+(?:\s+[.!?؟。][)\]"”’]*)?\s*$/u);
    const tail = match ? takeTail(children, match[0].length) : [];
    children.push({ type: 'link', url: sources.find((source) => source.id === unique[0])!.url,
      title: `vantra-citations:${unique.join(',')}`, children: tail } as Link);
    return children;
  };
  const project = (block: Block, bubbles: boolean): Block[] => {
    const fragments: Array<PhrasingContent | { ids: string[] }> = [];
    const flatten = (children: PhrasingContent[], wrappers: PhrasingContent[] = []) => {
      for (const child of children) {
        const source = child.type === 'link' ? sources.find((source) => source.url === child.url) : undefined;
        if (source) { fragments.push({ ids: [source.id] }); continue; }
        if ('children' in child && child.type !== 'link') {
          flatten(child.children as PhrasingContent[], [...wrappers, child]);
        } else {
          let wrapped: PhrasingContent = child;
          for (const wrapper of [...wrappers].reverse()) wrapped = { ...wrapper, children: [wrapped] } as PhrasingContent;
          fragments.push(wrapped);
        }
      }
    };
    flatten((block.children ?? []) as PhrasingContent[]);
    const result: Block[] = []; let children: PhrasingContent[] = []; let ids: string[] = [];
    const flush = () => {
      if (!children.length) return;
      const plain = children.map((child) => textOf(child as Block)).join('');
      // Bound very long blocks at sentence boundaries, keeping their shared source set.
      if (bubbles && block.type === 'paragraph' && plain.length > 500 && children.every((child) => child.type === 'text')) {
        const sentences = plain.split(/(?<=[.!?؟。])(?=\s)/u);
        let chunk = '';
        for (const sentence of sentences) {
          chunk += sentence;
          if (chunk.length > 300) { result.push({ ...block, children: addBubble([{ type: 'text', value: chunk.trim() }], ids) as Block[] }); chunk = ''; }
        }
        if (chunk.trim()) result.push({ ...block, children: addBubble([{ type: 'text', value: chunk.trim() }], ids) as Block[] });
      } else result.push({ ...block, children: (bubbles ? addBubble(children, ids) : children) as Block[] });
      children = []; ids = [];
    };
    for (const fragment of fragments) {
      if ('ids' in fragment) { ids.push(...fragment.ids); continue; }
      if (bubbles && block.type === 'paragraph' && ids.length && fragment.type === 'text') {
        const ending = fragment.value.match(/^(\s*[.!?؟。][)\]"”’]*(?:\s+|$))([\s\S]+)$/u);
        if (ending) { children.push({ type: 'text', value: ending[1] }); flush(); children.push({ type: 'text', value: ending[2] }); continue; }
      }
      const previous = children.map((child) => textOf(child as Block)).join('');
      // A new sentence after a completed citation starts a separate source block.
      if (bubbles && block.type === 'paragraph' && ids.length && /[.!?؟。]\s*$/u.test(previous)
        && textOf(fragment as Block).trim()) flush();
      children.push(fragment);
    }
    flush(); return result;
  };
  const removeBubbles = (node: Block) => {
    node.children = node.children?.flatMap((child) => child.title?.startsWith('vantra-citations:')
      ? child.children ?? [] : (removeBubbles(child), [child]));
  };
  const visit = (node: Block) => {
    node.children = node.children?.flatMap((child) => {
      if (['paragraph', 'heading', 'tableCell'].includes(child.type)) return project(child, child.type !== 'heading');
      visit(child);
      if (child.type === 'table') {
        const rows = child.children?.slice(1) ?? [];
        const signatures = rows.map((row) => [...new Set(citationIds(row))].sort().join(','));
        if (signatures[0] && signatures.every((signature) => signature === signatures[0])) {
          rows.forEach(removeBubbles);
          return [child, { type: 'paragraph', children: addBubble([], signatures[0].split(',')) as Block[] }];
        }
        for (const row of rows) {
          const ids = citationIds(row); removeBubbles(row);
          const last = row.children?.at(-1);
          if (last) last.children = addBubble((last.children ?? []) as PhrasingContent[], ids) as Block[];
        }
      }
      return [child];
    });
    if (node.type === 'list') {
      const units = node.children;
      if (units && units.length > 1) {
        const signatures = units.map((unit) => [...new Set(citationIds(unit))].sort().join(','));
        if (signatures[0] && signatures.every((signature) => signature === signatures[0])) units.slice(0, -1).forEach(removeBubbles);
      }
    }
    if (node.type === 'table' && node.children?.[0]) removeBubbles(node.children[0]);
  };
  return (tree: Root) => visit(tree as unknown as Block);
}

export function referencedSources(text: string, sources: readonly ChatWebSource[]) {
  const prose = text.replace(/```[\s\S]*?```|`[^`]*`/gu, '');
  return sources.filter((source) => [...prose.matchAll(/\[\[source:(S\d+)\]\]|\[(S?\d+)\](?!\()|\[[^\]]*\]\((https?:\/\/[^\s)]+)\)/gu)]
    .some((match) => match[3] === source.url || match[1] === source.id || `S${match[2]?.replace(/^S/u, '')}` === source.id));
}
