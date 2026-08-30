'use client';

import { InfiniteSlider } from '@/components/ui/infinite-slider';
import { cn } from '@/lib/utils';

type Logo = {
  src: string;
  alt: string;
  iconSrc?: string;
  iconClassName?: string;
  className?: string;
  width?: number;
  height?: number;
};

type LogoCloudProps = React.ComponentProps<'div'> & {
  logos: Logo[];
};

export function LogoCloud({ className, logos, ...props }: LogoCloudProps) {
  return (
    <div
      {...props}
      className={cn(
        'overflow-hidden py-4 [mask-image:linear-gradient(to_right,transparent,black,transparent)]',
        className
      )}
    >
      <InfiniteSlider gap={42} reverse duration={28}>
        {logos.map((logo) => (
          <span className='relative inline-flex h-4 items-center md:h-5' key={`logo-${logo.alt}`}>
            <img alt={logo.alt} className='pointer-events-none h-full select-none invert opacity-80' height={logo.height || 'auto'} loading='lazy' src={logo.src} width={logo.width || 'auto'} />
            {logo.iconSrc && <img alt='' aria-hidden='true' className={cn('pointer-events-none absolute start-0 h-full w-auto opacity-90', logo.iconClassName)} src={logo.iconSrc} />}
          </span>
        ))}
      </InfiniteSlider>
    </div>
  );
}
