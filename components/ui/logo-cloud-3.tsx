'use client';

import { cn } from '@/lib/utils';

type Logo = {
  src: string;
  alt: string;
  width?: number;
  height?: number;
};

type LogoCloudProps = React.ComponentProps<'div'> & {
  logos: Logo[];
};

export function LogoCloud({ className, logos, ...props }: LogoCloudProps) {
  const logoGroup = (duplicate = false) => (
    <div
      aria-hidden={duplicate || undefined}
      className='logo-marquee-group'
    >
      {logos.map((logo) => (
        <img
          alt={duplicate ? '' : logo.alt}
          className='pointer-events-none h-5 w-auto shrink-0 select-none opacity-90 md:h-6'
          height={logo.height || 'auto'}
          key={`${duplicate ? 'duplicate-' : ''}logo-${logo.alt}`}
          loading='eager'
          src={logo.src}
          width={logo.width || 'auto'}
        />
      ))}
    </div>
  );

  return (
    <div
      {...props}
      className={cn(
        'overflow-hidden py-4 [mask-image:linear-gradient(to_right,transparent,black,transparent)]',
        className
      )}
    >
      <div className='logo-marquee-track'>
        {logoGroup()}
        {logoGroup(true)}
      </div>
      <style jsx global>{`
        .logo-marquee-track {
          direction: ltr;
          display: flex;
          flex-wrap: nowrap;
          width: max-content;
          will-change: transform;
          animation: logo-marquee 19s linear infinite;
        }

        .logo-marquee-group {
          box-sizing: border-box;
          display: flex;
          flex-shrink: 0;
          align-items: center;
          gap: 3rem;
          padding-right: 3rem;
          white-space: nowrap;
        }

        @keyframes logo-marquee {
          from {
            transform: translate3d(-50%, 0, 0);
          }
          to {
            transform: translate3d(0, 0, 0);
          }
        }
      `}</style>
    </div>
  );
}
