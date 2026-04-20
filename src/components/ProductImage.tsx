'use client';

/**
 * Affiche une image produit (R2, /api/uploads, etc.) en utilisant une balise <img> native.
 * Contourne Next.js Image Optimization (_next/image) qui renvoie 400 avec R2 et uploads.
 */
export function ProductImage({
  src,
  alt,
  fill,
  width,
  height,
  className = '',
  sizes,
  onError,
  ...rest
}: {
  src: string;
  alt: string;
  fill?: boolean;
  width?: number;
  height?: number;
  className?: string;
  sizes?: string;
  onError?: (e: React.SyntheticEvent<HTMLImageElement, Event>) => void;
} & Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src' | 'alt'>) {
  if (!src) return null;

  const imgClass = fill
    ? `absolute inset-0 w-full h-full object-cover ${className}`
    : `object-cover w-full h-full ${className}`;

  if (fill) {
    return (
      <div className="relative w-full h-full min-h-0">
        <img
          src={src}
          alt={alt}
          className={imgClass}
          onError={onError}
          loading="lazy"
          decoding="async"
          {...rest}
        />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={imgClass}
      onError={onError}
      loading="lazy"
      decoding="async"
      {...rest}
    />
  );
}
