/**
 * S3 (compatible) : upload avatars, preuves livraison, documents.
 * Supporte Amazon S3 et Cloudflare R2 (via S3_ENDPOINT + S3_PUBLIC_BASE_URL).
 */
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const bucket = process.env.S3_BUCKET ?? 'marketplace-uploads';
const s3Endpoint = process.env.S3_ENDPOINT;
const s3PublicBaseUrl = process.env.S3_PUBLIC_BASE_URL?.replace(/\/$/, '') ?? ''; // sans slash final
const isR2 = Boolean(s3Endpoint);

// R2 : S3_ACCESS_KEY / S3_SECRET_KEY + S3_REGION=auto. Sinon : AWS_*.
const accessKey = process.env.S3_ACCESS_KEY ?? process.env.AWS_ACCESS_KEY_ID ?? '';
const secretKey = process.env.S3_SECRET_KEY ?? process.env.AWS_SECRET_ACCESS_KEY ?? '';
const region = isR2 ? (process.env.S3_REGION ?? 'auto') : (process.env.AWS_REGION ?? 'eu-west-1');

const client = new S3Client({
  region,
  ...(s3Endpoint && {
    endpoint: s3Endpoint,
    forcePathStyle: true,
  }),
  ...(accessKey && secretKey && {
    credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
  }),
});

export async function uploadFile(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string
): Promise<string> {
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
  if (s3PublicBaseUrl) return `${s3PublicBaseUrl}/${key}`;
  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
}

export async function getSignedDownloadUrl(key: string, expiresIn = 3600): Promise<string> {
  const cmd = new GetObjectCommand({ Bucket: bucket, Key: key });
  return getSignedUrl(client, cmd, { expiresIn });
}

export async function deleteFile(key: string): Promise<void> {
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

export function productImageKey(companyId: string, productId: string, filename: string): string {
  return `products/${companyId}/${productId}/${Date.now()}-${filename}`;
}

export function deliveryProofKey(deliveryId: string, filename: string): string {
  return `deliveries/${deliveryId}/${Date.now()}-${filename}`;
}
