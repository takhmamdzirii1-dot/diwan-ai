import type { Root, Paragraph, Heading, PhrasingContent, Link } from 'mdast';
import type { ChatWebSource } from './web-sources';

/** Presentation-only projection. Original message/artifact citation positions stay intact. */
export function remarkCitationGroups({ sources = [] }: { sources?: readonly ChatWebSource[] }) {
  const visit = (node: { type: string; children?: unknown[] }) => {
    if (node.type === 'paragraph' || node.type === 'heading') {
      const block = node as Paragraph | Heading;
      const ids: string[] = [];
      const remove = (children: PhrasingContent[]): PhrasingContent[] => children.flatMap((child) => {
        if (child.type === 'link') {
          const source = sources.find((source) => source.url === child.url);
          if (source) { if (!ids.includes(source.id)) ids.push(source.id); return []; }
        }
        if ('children' in child && child.type !== 'link') {
          const parent = child as { children: PhrasingContent[] };
          parent.children = remove(parent.children);
        }
        return [child];
      });
      block.children = remove(block.children);
      if (ids.length) block.children.push({ type: 'text', value: ' ' }, { type: 'link',
        url: sources.find((source) => source.id === ids[0])!.url,
        title: `vantra-citations:${ids.join(',')}`, children: [{ type: 'text', value: ids.join(',') }] } as Link);
      return;
    }
    for (const child of node.children ?? []) if (child && typeof child === 'object' && 'type' in child)
      visit(child as { type: string; children?: unknown[] });
  };
  return (tree: Root) => visit(tree);
}

export function referencedSources(text: string, sources: readonly ChatWebSource[]) {
  const prose = text.replace(/```[\s\S]*?```|`[^`]*`/gu, '');
  return sources.filter((source) => [...prose.matchAll(/\[\[source:(S\d+)\]\]|\[(S?\d+)\](?!\()|\[[^\]]*\]\((https?:\/\/[^\s)]+)\)/gu)]
    .some((match) => match[3] === source.url || match[1] === source.id || `S${match[2]?.replace(/^S/u, '')}` === source.id));
}
