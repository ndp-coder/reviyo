import { branding } from '@/config/branding';

interface BrandLogoProps {
  variant?: 'wordmark' | 'icon';
  className?: string;
}

export function BrandLogo({ variant = 'wordmark', className = '' }: BrandLogoProps) {
  // The originals are 800px and 512px wide but the logo is shown at most about
  // 110px wide, so pages use 2x-resolution copies (12 KB instead of 93 KB).
  const src = variant === 'icon' ? branding.iconSmall : branding.logoSmall;

  return (
    <img
      src={src}
      alt={`${branding.name} logo`}
      width={variant === 'icon' ? 192 : 216}
      height={variant === 'icon' ? 192 : 89}
      className={`block object-contain ${className}`}
      draggable={false}
      decoding="async"
    />
  );
}
