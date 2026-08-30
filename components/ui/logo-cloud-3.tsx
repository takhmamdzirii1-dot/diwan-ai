'use client';

import { InfiniteSlider } from '@/components/ui/infinite-slider';
import { cn } from '@/lib/utils';

type Logo = {
  src: string;
  alt: string;
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
      <InfiniteSlider gap={42} reverse duration={48} durationOnHover={20}>
        {logos.map((logo) => (
          <img
            alt={logo.alt}
            className={cn(
              'pointer-events-none h-4 select-none opacity-80 md:h-5',
              logo.className
            )}
            height={logo.height || 'auto'}
            key={`logo-${logo.alt}`}
            loading='lazy'
            src={logo.src}
            width={logo.width || 'auto'}
          />
        ))}
      </InfiniteSlider>
    </div>
  );
}
