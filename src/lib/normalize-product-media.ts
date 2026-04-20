/**
 * Normalise les URLs médias d’un produit : les URLs externes (http/https) sont
 * récupérées, converties (images en WebP), hébergées sur la plateforme, puis remplacées.
 * Évite les liens cassés ou formats incompatibles sur le catalogue public.
 */
import {
  isExternalMediaUrl,
  resolveImageUrl,
  fetchImageBuffer,
  fetchVideoBuffer,
  normalizeImageBuffer,
} from '@/lib/media-normalize';
import { uploadBuffer } from '@/lib/upload-buffer';

/** URLs de vidéos à garder telles quelles (embed iframe), pas de téléchargement. */
function isEmbedOnlyVideoUrl(url: string): boolean {
  const u = url.trim().toLowerCase();
  try {
    const parsed = new URL(u);
    const host = parsed.hostname.replace(/^www\./, '');
    if (host === 'youtube.com' || host === 'youtu.be') return true;
    if (host === 'vimeo.com' || host.endsWith('.vimeo.com')) return true;
    return false;
  } catch {
    return false;
  }
}

const ALLOWED_VIDEO_TYPES: Record<string, string> = {
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/quicktime': '.mov',
};
const DEFAULT_VIDEO_EXT = '.mp4';

/**
 * Normalise une liste d’URLs images : pour chaque URL externe, fetch → convert WebP → upload.
 * Les URLs déjà internes (/api/uploads/, ou domaine S3) sont conservées.
 */
export async function normalizeImageUrls(
  userId: string,
  imageUrls: string[]
): Promise<string[]> {
  const result: string[] = [];

  for (const url of imageUrls) {
    const u = url.trim();
    if (!u) continue;

    if (!isExternalMediaUrl(u)) {
      result.push(u);
      continue;
    }

    const fetchUrl = resolveImageUrl(u);
    try {
      const buffer = await fetchImageBuffer(fetchUrl);
      const normalized = await normalizeImageBuffer(buffer);
      const filename = `img-${Date.now()}-${result.length}${normalized.ext}`;
      const newUrl = await uploadBuffer(
        userId,
        normalized.buffer,
        normalized.contentType,
        filename
      );
      result.push(newUrl);
    } catch (err) {
      console.warn('Failed to normalize image URL:', u, err);
      // On garde l’URL d’origine si la normalisation échoue (ex. site externe down)
      result.push(u);
    }
  }

  return result;
}

/**
 * Normalise une liste d’URLs vidéo : pour chaque URL externe, fetch → re-upload (même format).
 * Les vidéos sont stockées telles quelles (MP4/WebM/MOV acceptés).
 */
export async function normalizeVideoUrls(
  userId: string,
  videoUrls: string[]
): Promise<string[]> {
  const result: string[] = [];

  for (const url of videoUrls) {
    const u = url.trim();
    if (!u) continue;

    if (!isExternalMediaUrl(u)) {
      result.push(u);
      continue;
    }

    if (isEmbedOnlyVideoUrl(u)) {
      result.push(u);
      continue;
    }

    try {
      const { buffer, contentType } = await fetchVideoBuffer(u);
      const ext = ALLOWED_VIDEO_TYPES[contentType] ?? DEFAULT_VIDEO_EXT;
      const filename = `video-${Date.now()}-${result.length}${ext}`;
      const newUrl = await uploadBuffer(userId, buffer, contentType, filename);
      result.push(newUrl);
    } catch (err) {
      console.warn('Failed to normalize video URL:', u, err);
      result.push(u);
    }
  }

  return result;
}

/**
 * Normalise images et vidéos d’un produit (URLs externes → hébergement plateforme).
 */
export async function normalizeProductMedia(
  userId: string,
  imageUrls: string[],
  videoUrls: string[]
): Promise<{ imageUrls: string[]; videoUrls: string[] }> {
  const [normImages, normVideos] = await Promise.all([
    normalizeImageUrls(userId, imageUrls),
    normalizeVideoUrls(userId, videoUrls),
  ]);
  return { imageUrls: normImages, videoUrls: normVideos };
}
