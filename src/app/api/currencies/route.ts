import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

const DEFAULT_CURRENCIES = ['XOF'];

/** Liste des devises autorisées pour les produits (configurée par l’admin). XOF (F CFA) toujours inclus. */
export async function GET() {
  const row = await prisma.settings.findUnique({
    where: { key: 'allowed_currencies' },
  });
  const value = row?.value;
  const list = Array.isArray(value) ? value : DEFAULT_CURRENCIES;
  const codes = list
    .filter((c): c is string => typeof c === 'string' && c.trim().length > 0)
    .map((c) => c.trim().toUpperCase())
    .filter((c, i, arr) => arr.indexOf(c) === i);
  if (!codes.includes('XOF')) codes.unshift('XOF');
  return NextResponse.json(codes);
}
