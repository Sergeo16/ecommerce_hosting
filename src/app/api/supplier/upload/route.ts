import { NextRequest, NextResponse } from 'next/server';
import { normalizeImageBuffer } from '@/lib/media-normalize';
import { uploadBuffer } from '@/lib/upload-buffer';

const PUBLISHER_ROLES = ['SUPPLIER', 'SUPER_ADMIN', 'AFFILIATE'] as const;
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100 MB

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100) || 'file';
}

export async function POST(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  const role = request.headers.get('x-user-role');
  if (!userId || !PUBLISHER_ROLES.includes(role as (typeof PUBLISHER_ROLES)[number])) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get('file');
  const type = (formData.get('type') as string) || 'image'; // 'image' | 'video'

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: 'file required' }, { status: 400 });
  }

  const maxSize = type === 'video' ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
  if (file.size > maxSize) {
    return NextResponse.json(
      { error: type === 'video' ? 'video_too_large' : 'image_too_large' },
      { status: 400 }
    );
  }

  const allowedImages = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  const allowedVideos = ['video/mp4', 'video/webm', 'video/quicktime'];
  const contentType = file.type;
  if (type === 'video') {
    if (!allowedVideos.includes(contentType)) {
      return NextResponse.json({ error: 'invalid_video_type' }, { status: 400 });
    }
  } else {
    if (!allowedImages.includes(contentType)) {
      return NextResponse.json({ error: 'invalid_image_type' }, { status: 400 });
    }
  }

  const rawBuffer = Buffer.from(await file.arrayBuffer());
  let buffer = rawBuffer;
  let finalContentType = contentType;
  let finalFilename = sanitizeFilename(file.name);

  if (type === 'image') {
    try {
      const normalized = await normalizeImageBuffer(rawBuffer, contentType);
      buffer = Buffer.from(normalized.buffer);
      finalContentType = normalized.contentType;
      const base = file.name.replace(/\.[^.]+$/i, '') || 'image';
      finalFilename = sanitizeFilename(base) + normalized.ext;
    } catch (err) {
      console.error('Image normalization failed:', err);
      return NextResponse.json({ error: 'invalid_image_type' }, { status: 400 });
    }
  }

  try {
    const url = await uploadBuffer(userId, buffer, finalContentType, finalFilename);
    return NextResponse.json({ url });
  } catch (err) {
    console.error('Upload error:', err);
    return NextResponse.json({ error: 'upload_failed' }, { status: 500 });
  }
}
