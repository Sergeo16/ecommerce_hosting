import { NextRequest, NextResponse } from 'next/server';
import { readFile, stat } from 'fs/promises';
import path from 'path';

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? path.join(process.cwd(), '.uploads');

const CONTENT_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
};

const VIDEO_EXT = new Set(['.mp4', '.webm', '.mov']);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  const pathSegments = (await params).path;
  if (!pathSegments?.length) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const safeSegment = (p: string) => /^[a-zA-Z0-9._-]+$/.test(p);
  if (!pathSegments.every(safeSegment)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const filePath = path.join(UPLOAD_DIR, ...pathSegments);
  const resolvedRoot = path.resolve(UPLOAD_DIR);
  const resolvedFile = path.resolve(filePath);
  if (!resolvedFile.startsWith(resolvedRoot)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  try {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = CONTENT_TYPES[ext] ?? 'application/octet-stream';
    const isVideo = VIDEO_EXT.has(ext);
    const rangeHeader = request.headers.get('range');

    if (isVideo && rangeHeader?.startsWith('bytes=')) {
      const stats = await stat(filePath);
      const size = stats.size;
      const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
      const start = match ? parseInt(match[1], 10) : 0;
      const end = match?.[2] ? Math.min(parseInt(match[2], 10), size - 1) : size - 1;
      const chunkSize = end - start + 1;
      const buffer = await readFile(filePath);
      const chunk = buffer.subarray(start, start + chunkSize);
      return new NextResponse(chunk, {
        status: 206,
        headers: {
          'Content-Type': contentType,
          'Content-Length': String(chunk.length),
          'Content-Range': `bytes ${start}-${start + chunk.length - 1}/${size}`,
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'public, max-age=86400',
        },
      });
    }

    const buffer = await readFile(filePath);
    const headers: Record<string, string> = {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=86400',
    };
    if (isVideo) headers['Accept-Ranges'] = 'bytes';
    return new NextResponse(buffer, { headers });
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
}
