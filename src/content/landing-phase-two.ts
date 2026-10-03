/** Phase 2 marketing copy. Product/payment values remain in the existing catalog.
 * EN/FR/AR should receive owner language review before paid campaigns. */
export const LANDING_COPY = {
  en: {
    start: 'Start free', choosePro: 'Choose Pro', chooseMax: 'Choose MAX', compare: 'Compare plans', more: 'Show full comparison', less: 'Show less',
    rows: ['Best for', 'Models', 'Chat usage', 'Media credits', 'Access period'],
    best: ['Getting started', 'Regular creative work', 'Higher-volume creative work'],
    chat: ['Standard Chat', 'High-usage Chat', 'Highest Chat Access'],
    models: 'Included + trial models', credits: 'VANTRA Credits', trial: 'Lifetime media trial', period: 'days · no automatic renewal',
    paymentTitle: 'How payment works', steps: ['Choose your plan', 'Make a manual transfer and submit your proof', 'Access activates after review and approval'],
    support: 'Contact support', modelDemo: 'Switch models in one workspace', demoNote: 'Explore the enabled model names. This is an interface demonstration, not an AI generation.',
    creatorTitle: 'Built around your next creative project', creatorCases: ['Reels', 'Product ads', 'Thumbnails', '9:16 story concepts'],
    faq: ['How does payment work?', 'When does paid access activate?', 'Will I be charged automatically?', 'How do I contact support?', 'What happens to my data?'],
    privacy: 'Your account, submitted content and usage data are handled as described in our Privacy Policy.', privacyLink: 'Read the Privacy Policy',
  },
  fr: {
    start: 'Commencer gratuitement', choosePro: 'Choisir Pro', chooseMax: 'Choisir MAX', compare: 'Comparer les offres', more: 'Voir toute la comparaison', less: 'Voir moins',
    rows: ['Idéal pour', 'Modèles', 'Utilisation Chat', 'Crédits média', 'Période d’accès'],
    best: ['Découvrir VANTRA', 'Créer régulièrement', 'Créer en plus grand volume'],
    chat: ['Chat standard', 'Chat à usage intensif', 'Accès Chat maximal'],
    models: 'Modèles inclus + essais', credits: 'VANTRA Credits', trial: 'Essai média à vie', period: 'jours · sans renouvellement automatique',
    paymentTitle: 'Comment fonctionne le paiement', steps: ['Choisissez votre offre', 'Effectuez un virement manuel et envoyez votre justificatif', 'L’accès est activé après vérification et approbation'],
    support: 'Contacter l’assistance', modelDemo: 'Changez de modèle dans un seul espace', demoNote: 'Découvrez les noms des modèles activés. Ceci est une démonstration de l’interface, pas une génération IA.',
    creatorTitle: 'Pour votre prochain projet créatif', creatorCases: ['Reels', 'Publicités produit', 'Miniatures', 'Concepts de stories 9:16'],
    faq: ['Comment fonctionne le paiement ?', 'Quand l’accès payant est-il activé ?', 'Serai-je débité automatiquement ?', 'Comment contacter l’assistance ?', 'Que deviennent mes données ?'],
    privacy: 'Votre compte, vos contenus et vos données d’utilisation sont traités selon notre Politique de confidentialité.', privacyLink: 'Lire la Politique de confidentialité',
  },
  ar: {
    start: 'ابدأ مجانًا', choosePro: 'اختر Pro', chooseMax: 'اختر MAX', compare: 'قارن الخطط', more: 'عرض المقارنة كاملة', less: 'عرض أقل',
    rows: ['الأنسب لـ', 'النماذج', 'استخدام المحادثة', 'رصيد الوسائط', 'مدة الوصول'],
    best: ['تجربة VANTRA', 'الإبداع بانتظام', 'الإنتاج الإبداعي المكثف'],
    chat: ['المحادثة القياسية', 'المحادثة عالية الاستخدام', 'أعلى مستوى وصول للمحادثة'],
    models: 'نماذج مشمولة + تجارب', credits: 'رصيد VANTRA', trial: 'تجربة وسائط مدى الحياة', period: 'يومًا · دون تجديد تلقائي',
    paymentTitle: 'كيف يعمل الدفع', steps: ['اختر خطتك', 'حوّل المبلغ يدويًا وأرسل إثبات الدفع', 'يتفعّل الوصول بعد المراجعة والموافقة'],
    support: 'تواصل مع الدعم', modelDemo: 'بدّل النماذج في مساحة واحدة', demoNote: 'استكشف أسماء النماذج المفعّلة. هذا عرض للواجهة وليس توليدًا بالذكاء الاصطناعي.',
    creatorTitle: 'لمشروعك الإبداعي القادم', creatorCases: ['ريلز', 'إعلانات المنتجات', 'صور مصغّرة', 'أفكار قصص بنسبة 9:16'],
    faq: ['كيف يعمل الدفع؟', 'متى يتفعّل الوصول المدفوع؟', 'هل يتم الخصم تلقائيًا؟', 'كيف أتواصل مع الدعم؟', 'كيف تُستخدم بياناتي؟'],
    privacy: 'تُعالج بيانات حسابك والمحتوى الذي ترسله وبيانات الاستخدام وفق سياسة الخصوصية.', privacyLink: 'اقرأ سياسة الخصوصية',
  },
} as const;

export function landingCopy(locale: string) { return LANDING_COPY[locale === 'ar' || locale === 'fr' ? locale : 'en']; }

type LocalizedText = Record<'en' | 'fr' | 'ar', string>;
export type LandingAsset = { src: string; width: number; height: number; caption: LocalizedText };
export type LandingProof = { type: 'screenshot' | 'video' | 'quote'; asset: LandingAsset | LocalizedText; caption: LocalizedText; date: string; consent: true };
/** Only real, consented, dated proof belongs here. No placeholder media or quotes. */
export const LANDING_PROOF: readonly LandingProof[] = [];
export const CREATOR_SHOWCASE: readonly LandingAsset[] = [];
export const MODEL_SCREENSHOTS: readonly LandingAsset[] = [];

export function usableProof(item: LandingProof) {
  if (item.consent !== true || !/^\d{4}-\d{2}-\d{2}$/.test(item.date) || !Number.isFinite(Date.parse(item.date))) return false;
  if (!['en', 'fr', 'ar'].every((locale) => Boolean(item.caption[locale as keyof LocalizedText]?.trim()))) return false;
  return item.type === 'quote' ? !('src' in item.asset) : 'src' in item.asset && usableAsset(item.asset);
}
export function usableAsset(asset: LandingAsset) {
  return /^\/(?!\/)[^?#]+$/.test(asset.src) && asset.width > 0 && asset.height > 0;
}
