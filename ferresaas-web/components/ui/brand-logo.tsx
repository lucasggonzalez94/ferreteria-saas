import Image from 'next/image';
import { cn } from '@/lib/utils';

interface BrandLogoProps {
  className?: string;
  priority?: boolean;
}

export function BrandLogo({ className, priority = false }: BrandLogoProps) {
  return (
    <>
      <Image
        src="/icons/logo-principal-oscuro.png"
        alt="Ferrahock"
        width={246}
        height={82}
        priority={priority}
        className={cn('dark:hidden', className)}
      />
      <Image
        src="/icons/logo-principal-blanco.png"
        alt="Ferrahock"
        width={246}
        height={82}
        priority={priority}
        className={cn('hidden dark:block', className)}
      />
    </>
  );
}
