'use client';

import { useEffect, useState } from 'react';
import { documentFromMarkdown } from '@/lib/artifacts/core';
import { uploadFileKind, type ConversationAttachment } from '@/lib/chat/conversation-attachments';

export default function FileAttachmentPreview({ file, locale, onCancel, onAttach }: {
  file: File; locale: string; onCancel: () => void; onAttach: (attachment: ConversationAttachment) => void;
}) {
  const [attachment, setAttachment] = useState<ConversationAttachment | null>(null);
  const [preview, setPreview] = useState('');
  const [error, setError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const kind = uploadFileKind(file);
    if (!kind || kind === 'spreadsheet') return;
    void (async () => {
      try {
        if (kind === 'document') {
          if (file.size > 300_000) throw new Error('FILE_TOO_LARGE');
          const text = await file.text();
          if (!text.trim()) throw new Error('EMPTY_FILE');
          if (!cancelled) {
            setPreview(text.slice(0, 4_000));
            setAttachment({ kind, name: file.name, artifact: documentFromMarkdown(crypto.randomUUID(), text, locale) });
          }
        } else {
          if (file.size === 0 || file.size > 300_000) throw new Error('FILE_SIZE_UNSUPPORTED');
          const url = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(file);
          });
          const fallbackType = /\.pdf$/i.test(file.name) ? 'application/pdf'
            : /\.docx$/i.test(file.name) ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
              : /\.doc$/i.test(file.name) ? 'application/msword'
                : /\.jpe?g$/i.test(file.name) ? 'image/jpeg'
                  : /\.gif$/i.test(file.name) ? 'image/gif'
                    : /\.webp$/i.test(file.name) ? 'image/webp'
                      : kind === 'image' ? 'image/png' : 'application/octet-stream';
          if (!cancelled) setAttachment({ kind, name: file.name, contentType: file.type || fallbackType, url });
        }
      } catch { if (!cancelled) setError(true); }
    })();
    return () => { cancelled = true; };
  }, [file, locale]);
  return <div role="dialog" aria-modal="true" aria-label={file.name} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 text-white">
    <div className="w-full max-w-xl space-y-4 rounded-xl border border-white/15 bg-neutral-950 p-5">
      <h2 className="truncate text-sm font-semibold">{file.name}</h2>
      <p className="text-xs text-white/50">{uploadFileKind(file)} · {Math.ceil(file.size / 1024)} KB</p>
      {preview && <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-lg border border-white/10 p-3 text-xs" dir="auto">{preview}</pre>}
      {attachment?.kind === 'image' && <img src={attachment.url} alt={file.name} className="max-h-72 max-w-full object-contain" />}
      {attachment?.kind === 'file' && attachment.contentType === 'application/pdf' && <object data={attachment.url} type="application/pdf" aria-label={file.name} className="h-72 w-full rounded-lg border border-white/10"><p className="p-3 text-xs text-white/60">PDF preview unavailable in this browser.</p></object>}
      {error && <p role="alert" className="text-sm text-red-300">{locale === 'fr' ? 'Je n’ai pas pu lire ce fichier.' : locale === 'ar' ? 'تعذرت قراءة هذا الملف.' : "I couldn't read this file."}</p>}
      <div className="flex justify-end gap-2"><button type="button" onClick={onCancel} className="rounded-lg border border-white/20 px-3 py-2 text-xs">{locale === 'fr' ? 'Annuler' : locale === 'ar' ? 'إلغاء' : 'Cancel'}</button><button type="button" disabled={!attachment} onClick={() => { if (attachment) onAttach(attachment); }} className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-black disabled:opacity-40">{locale === 'fr' ? 'Joindre au chat' : locale === 'ar' ? 'إرفاق بالمحادثة' : 'Attach to chat'}</button></div>
    </div>
  </div>;
}
