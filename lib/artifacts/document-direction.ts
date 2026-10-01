import type { DocumentArtifact } from './core';
import { documentToText } from './core';
import { messageDirection } from '@/lib/chat/web-sources';

/** Use actual document prose, with persisted direction/language as the fallback.
 * A Latin heading does not determine the direction of an entire Arabic document.
 */
export function documentDirection(document: DocumentArtifact) {
  return messageDirection(documentToText(document), /^(ar|fa|he|ur)(-|$)/iu.test(document.language)
    ? 'rtl' : document.direction);
}
