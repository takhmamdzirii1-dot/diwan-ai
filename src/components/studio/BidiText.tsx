import React from 'react';
import { bidiRuns, type TextDirection } from '@/lib/chat/bidi';

export function isolateText(children: React.ReactNode, direction: TextDirection): React.ReactNode {
  return React.Children.map(children, (child) => {
    if (typeof child === 'string') return bidiRuns(child, direction).map((run, index) => run.direction
      ? <bdi dir={run.direction} key={index}>{run.text}</bdi> : run.text);
    if (!React.isValidElement<{ children?: React.ReactNode; node?: { tagName?: string } }>(child)
      || ['code', 'pre', 'bdi', 'a', 'sup'].includes(child.props.node?.tagName ?? String(child.type))) return child;
    return React.cloneElement(child, {}, isolateText(child.props.children, direction));
  });
}
