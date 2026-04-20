/**
 * RBAC Money Machine — Périmètres par rôle (voir docs/MONEY_MACHINE_ARCHITECTURE.md).
 * À utiliser dans les API routes et middlewares après vérification JWT.
 */
import type { Role } from "@prisma/client";

export const ROLE_SCOPE: Record<
  Role,
  {
    monetization: boolean;
    kyc: boolean;
    disputes: boolean;
    analyticsAdmin: boolean;
    analyticsSupplier: boolean;
    subscription: boolean;
    ads: boolean;
    deliveryRules: boolean;
    maintenance: boolean;
  }
> = {
  SUPER_ADMIN: {
    monetization: true,
    kyc: true,
    disputes: true,
    analyticsAdmin: true,
    analyticsSupplier: false,
    subscription: false,
    ads: false,
    deliveryRules: true,
    maintenance: true,
  },
  SUPPLIER: {
    monetization: false,
    kyc: false,
    disputes: false,
    analyticsAdmin: false,
    analyticsSupplier: true,
    subscription: true,
    ads: true,
    deliveryRules: false,
    maintenance: false,
  },
  AFFILIATE: {
    monetization: false,
    kyc: false,
    disputes: false,
    analyticsAdmin: false,
    analyticsSupplier: false,
    subscription: false,
    ads: false,
    deliveryRules: false,
    maintenance: false,
  },
  COURIER: {
    monetization: false,
    kyc: false,
    disputes: false,
    analyticsAdmin: false,
    analyticsSupplier: false,
    subscription: false,
    ads: false,
    deliveryRules: false,
    maintenance: false,
  },
  CLIENT: {
    monetization: false,
    kyc: false,
    disputes: false,
    analyticsAdmin: false,
    analyticsSupplier: false,
    subscription: false,
    ads: false,
    deliveryRules: false,
    maintenance: false,
  },
};

export function can(role: Role, scope: keyof (typeof ROLE_SCOPE)[Role]): boolean {
  return ROLE_SCOPE[role]?.[scope] ?? false;
}

export function requireSuperAdmin(role: Role): void {
  if (role !== "SUPER_ADMIN") throw new Error("FORBIDDEN");
}
