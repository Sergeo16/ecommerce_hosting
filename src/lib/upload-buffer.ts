/**
 * Upload d’un buffer (média normalisé) vers S3 ou stockage local.
 * Utilisé par la route d’upload (après conversion image) et par la normalisation des URLs produit.
 */
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { uploadFile } from '@/lib/s3';

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? path.join(process.cwd(), '.uploads');

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100) || 'file';
}

export async function uploadToLocal(
  userId: string,
  filename: string,
  buffer: Buffer,
  contentType: string
): Promise<string> {
  const dir = path.join(UPLOAD_DIR, userId);
  await mkdir(dir, { recursive: true });
  const safeName = `${Date.now()}-${sanitizeFilename(filename)}`;
  const filePath = path.join(dir, safeName);
  await writeFile(filePath, buffer);
  return `/api/uploads/${userId}/${safeName}`;
}

/**
 * Envoie un buffer vers S3 ou, en échec, vers le stockage local.
 * Retourne l’URL finale (S3 ou /api/uploads/...).
 */
export async function uploadBuffer(
  userId: string,
  buffer: Buffer,
  contentType: string,
  filename: string
): Promise<string> {
  const safeName = sanitizeFilename(filename);
  const key = `uploads/${userId}/${Date.now()}-${safeName}`;

  try {
    return await uploadFile(key, buffer, contentType);
  } catch (err) {
    const isProd = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);
    if (isProd) {
      // Sur Vercel (et la plupart des plateformes serverless), le disque n'est pas persistant:
      // un fallback local créerait des URLs cassées après redéploiement / changement d'instance.
      throw err;
    }
    console.warn('S3 upload failed, using local fallback (dev only):', err);
    return uploadToLocal(userId, safeName, buffer, contentType);
  }
}
