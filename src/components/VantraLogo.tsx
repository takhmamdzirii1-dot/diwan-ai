import Image from 'next/image';

/** Official Brand Pack v1 artwork; never mirrored with the UI locale. */
export function VantraLogo({ className = 'w-8 h-8', tone = 'dark' }: { className?: string; tone?: 'dark' | 'light' }) {
  return <Image src={`/brand/vantra-mark-${tone}.svg`} alt="VANTRA" width={100} height={100} unoptimized dir="ltr" className={`shrink-0 object-contain ${className}`} style={{ transform: 'none' }} />;
}

export function VantraWordmark({ className = 'w-[72px] h-3', tone = 'white' }: { className?: string; tone?: 'white' | 'dark' }) {
  return <Image src={`/brand/vantra-wordmark-${tone}.svg`} alt="VANTRA" width={288} height={48} unoptimized dir="ltr" className={`shrink-0 object-contain ${className}`} style={{ transform: 'none' }} />;
}
