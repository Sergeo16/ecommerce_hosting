/**
 * Normalisation des médias pour la plateforme :
 * - Images : conversion en WebP, redimensionnement si trop grand (max 1920px, qualité 85)
 * - Garantit un format stable et léger pour le catalogue public.
 */
import sharp from 'sharp';

const MAX_DIMENSION = 1920;
const WEBP_QUALITY = 85;

export interface NormalizedImage {
  buffer: Buffer;
  contentType: string;
  ext: string;
}

/**
 * Convertit un buffer image (JPEG, PNG, GIF, WebP, etc.) en WebP normalisé
 * (taille max 1920px, qualité 85). Lance une erreur si le fichier n'est pas une image valide.
 */
export async function normalizeImageBuffer(
  inputBuffer: Buffer,
  _inputMime?: string
): Promise<NormalizedImage> {
  const pipeline = sharp(inputBuffer);
  const meta = await pipeline.metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  const hasAlpha = meta.hasAlpha === true;

  let resized = pipeline;
  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    resized = pipeline.resize(MAX_DIMENSION, MAX_DIMENSION, {
      fit: 'inside',
      withoutEnlargement: true,
    });
  }

  const buffer = await resized
    .webp({
      quality: WEBP_QUALITY,
      alphaQuality: hasAlpha ? 85 : undefined,
      effort: 4,
    })
    .toBuffer();

  return {
    buffer,
    contentType: 'image/webp',
    ext: '.webp',
  };
}

/**
 * Indique si une URL est externe (http/https) et doit être ré-hébergée.
 */
export function isExternalMediaUrl(url: string): boolean {
  const u = url.trim();
  return u.startsWith('http://') || u.startsWith('https://');
}

/**
 * Si l’URL est une page Google Images (imgres), extrait l’URL réelle de l’image (paramètre imgurl).
 * Sinon retourne l’URL telle quelle.
 */
export function resolveImageUrl(url: string): string {
  const u = url.trim();
  try {
    const parsed = new URL(u);
    if (parsed.hostname.replace(/^www\./, '') !== 'google.com' && !parsed.hostname.endsWith('.google.com')) {
      return u;
    }
    if (!parsed.pathname.includes('/imgres')) return u;
    const imgurl = parsed.searchParams.get('imgurl');
    if (imgurl) return imgurl;
  } catch {
    // ignore
  }
  return u;
}

const FETCH_TIMEOUT_MS = 15000;
const MAX_IMAGE_FETCH_SIZE = 15 * 1024 * 1024; // 15 MB

/** Headers type navigateur pour que les CDN/sites externes acceptent le fetch (évite 403). */
const FETCH_HEADERS = {
  Accept: 'image/*',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
} as const;

const FETCH_HEADERS_VIDEO = {
  Accept: 'video/*',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
} as const;

/**
 * Récupère une image depuis une URL (avec timeout et limite de taille).
 * Lance en cas d'erreur ou de dépassement.
 */
export async function fetchImageBuffer(url: string): Promise<Buffer> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: FETCH_HEADERS,
    });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const contentLength = res.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_IMAGE_FETCH_SIZE) {
      throw new Error('Image too large');
    }
    const arrayBuffer = await res.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_IMAGE_FETCH_SIZE) {
      throw new Error('Image too large');
    }
    return Buffer.from(arrayBuffer);
  } catch (e) {
    clearTimeout(timeout);
    throw e;
  }
}

const MAX_VIDEO_FETCH_SIZE = 100 * 1024 * 1024; // 100 MB

export interface FetchedVideo {
  buffer: Buffer;
  contentType: string;
}

/**
 * Récupère une vidéo depuis une URL (timeout et limite de taille).
 * Retourne le buffer et le Content-Type pour un re-upload correct.
 */
export async function fetchVideoBuffer(url: string): Promise<FetchedVideo> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000); // 60s pour vidéos

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: FETCH_HEADERS_VIDEO,
    });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const contentLength = res.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_VIDEO_FETCH_SIZE) {
      throw new Error('Video too large');
    }
    const contentType = (res.headers.get('content-type') || '').split(';')[0].trim() || 'video/mp4';
    const arrayBuffer = await res.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_VIDEO_FETCH_SIZE) {
      throw new Error('Video too large');
    }
    return { buffer: Buffer.from(arrayBuffer), contentType };
  } catch (e) {
    clearTimeout(timeout);
    throw e;
  }
}
