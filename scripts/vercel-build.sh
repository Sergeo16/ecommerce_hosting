#!/usr/bin/env sh
set -e
# Prisma exige DIRECT_URL dans schema.prisma ; sur Vercel on peut ne définir que DATABASE_URL (URL directe).
export DIRECT_URL="${DIRECT_URL:-$DATABASE_URL}"
if [ -z "$DIRECT_URL" ]; then
  echo "Erreur: définissez au minimum DATABASE_URL sur Vercel." >&2
  exit 1
fi
prisma generate
prisma migrate deploy
npm run build
