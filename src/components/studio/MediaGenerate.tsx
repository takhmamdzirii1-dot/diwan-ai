'use client';

import { useId } from 'react';
import { useLocale } from 'next-intl';
import { Coins, LoaderCircle } from 'lucide-react';
import { generationAction, type GenerationQuote } from './media-generation-quote';
import styles from './MediaGenerate.module.css';

const copy = {
  en: { credits: 'credits', included: 'Included', add: 'Add credits', balance: 'Balance', prompt: 'Write a prompt to start', model: 'Select a model', source: 'Add a source image to start', loading: 'Checking price…', unknown: 'Price unavailable', unavailable: 'Generation unavailable', generating: 'Generating…', needs: (n: number, m: number) => `Needs ${n}, you have ${m}` },
  fr: { credits: 'crédits', included: 'Inclus', add: 'Ajouter des crédits', balance: 'Solde', prompt: 'Écrivez un prompt pour commencer', model: 'Choisissez un modèle', source: 'Ajoutez une image source', loading: 'Vérification du prix…', unknown: 'Prix indisponible', unavailable: 'Génération indisponible', generating: 'Génération…', needs: (n: number, m: number) => `Il faut ${n}, vous avez ${m}` },
  ar: { credits: 'رصيد', included: 'مشمول', add: 'إضافة رصيد', balance: 'الرصيد', prompt: 'اكتب وصفًا للبدء', model: 'اختر نموذجًا', source: 'أضف صورة البداية', loading: 'جارٍ التحقق من التكلفة…', unknown: 'التكلفة غير متاحة', unavailable: 'التوليد غير متاح', generating: 'جارٍ التوليد…', needs: (n: number, m: number) => `تحتاج ${n}، لديك ${m}` },
};

export default function MediaGenerate(props: {
  label: string; prompt: string; modelId?: string; available: boolean; generating: boolean;
  sourceMissing?: boolean; quote: GenerationQuote; onAddCredits?: () => void;
}) {
  const locale = useLocale(); const c = copy[locale === 'ar' || locale === 'fr' ? locale : 'en'];
  const id = useId(); const { reason, insufficient } = generationAction(props);
  const add = insufficient && !reason;
  const disabled = Boolean(reason) || (add && !props.onAddCredits);
  const helper = reason ? c[reason] : add && props.quote.status === 'ready' ? c.needs(props.quote.credits, props.quote.balance) : '';
  return <div className={styles.root} dir={locale === 'ar' ? 'rtl' : 'ltr'}>
    <div className={styles.balance} aria-live="polite"><span>{c.balance}</span><span><bdi>{props.quote.status === 'ready' ? props.quote.balance.toLocaleString(locale) : '—'}</bdi> {c.credits}</span></div>
    <button type={add ? 'button' : 'submit'} disabled={disabled} aria-disabled={disabled} aria-describedby={id}
      aria-busy={props.generating || props.quote.status === 'loading'} className={styles.button}
      onClick={add && !disabled ? props.onAddCredits : undefined}>
      {props.generating && <LoaderCircle aria-hidden="true" className={styles.spinner} />}
      <span>{props.generating ? c.generating : add ? c.add : props.label}</span>
      {!props.generating && !add && <span className={styles.cost}>
        {props.quote.status === 'loading' ? <span aria-label={c.loading} className={styles.skeleton} />
          : props.quote.status === 'ready' ? <><span aria-hidden="true">·</span><Coins aria-hidden="true" size={13} />{props.quote.included ? c.included : <><bdi>{props.quote.credits.toLocaleString(locale)}</bdi> {c.credits}</>}</> : null}
      </span>}
    </button>
    <p id={id} className={styles.helper} role="status">{helper || '\u00a0'}</p>
  </div>;
}
