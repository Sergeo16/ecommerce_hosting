/**
 * Middleware : vérification JWT pour routes API protégées
 * Rate limit et maintenance gérés dans les API routes (Node runtime)
 */
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyAccessToken } from '@/lib/jwt';

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (!path.startsWith('/api/')) return NextResponse.next();

  // Routes API auth publiques
  if (path === '/api/auth/login' || path === '/api/auth/register' || path === '/api/auth/refresh') {
    return NextResponse.next();
  }

  // GET /api/admin/maintenance : public (pour afficher la page maintenance aux visiteurs)
  if (path === '/api/admin/maintenance' && request.method === 'GET') {
    return NextResponse.next();
  }

  // POST /api/orders : auth optionnelle (checkout invité ou connecté)
  if (path === '/api/orders' && request.method === 'POST') {
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const payload = await verifyAccessToken(authHeader.slice(7));
      if (payload) {
        const reqHeaders = new Headers(request.headers);
        reqHeaders.set('x-user-id', payload.sub);
        reqHeaders.set('x-user-role', payload.role);
        return NextResponse.next({ request: { headers: reqHeaders } });
      }
    }
    return NextResponse.next();
  }

  // Routes API protégées
  if (path.startsWith('/api/auth/') || path.startsWith('/api/admin/') || path.startsWith('/api/orders') || path.startsWith('/api/affiliate') || path.startsWith('/api/courier') || path.startsWith('/api/supplier') || path.startsWith('/api/notifications')) {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const payload = await verifyAccessToken(authHeader.slice(7));
    if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const reqHeaders = new Headers(request.headers);
    reqHeaders.set('x-user-id', payload.sub);
    reqHeaders.set('x-user-role', payload.role);

    return NextResponse.next({
      request: { headers: reqHeaders },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*'],
};
