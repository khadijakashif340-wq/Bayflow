import { PrismaClient, ShopRole } from '@prisma/client';

export class TenantAccessError extends Error {
  statusCode: number;
  code: string;

  constructor(message: string, code = 'TENANT_ACCESS_DENIED', statusCode = 403) {
    super(message);
    this.name = 'TenantAccessError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

export type TenantVerificationResult =
  | {
      allowed: true;
      member: {
        id: string;
        shopId: string;
        userId: string;
        role: ShopRole;
        isActive: boolean;
      };
    }
  | {
      allowed: false;
      error: TenantAccessError;
    };

/**
 * Validates that `userId` has active membership in `targetShopId`, and optionally has one of `allowedRoles`.
 * Staff from Shop A will strictly receive a 403 / forbidden error when attempting to access Shop B resources.
 */
export async function verifyTenantAccess(
  prismaClient: PrismaClient,
  userId: string,
  targetShopId: string,
  allowedRoles?: ShopRole[]
): Promise<TenantVerificationResult> {
  const membership = await prismaClient.shopMember.findUnique({
    where: {
      shopId_userId: {
        shopId: targetShopId,
        userId: userId,
      },
    },
  });

  if (!membership) {
    return {
      allowed: false,
      error: new TenantAccessError(
        'User is not a member of this auto repair shop (Cross-tenant access forbidden)',
        'CROSS_TENANT_ACCESS_DENIED',
        403
      ),
    };
  }

  if (!membership.isActive) {
    return {
      allowed: false,
      error: new TenantAccessError(
        'Staff membership is deactivated for this shop',
        'MEMBERSHIP_INACTIVE',
        403
      ),
    };
  }

  // Shop Owner always has super-permissions within their shop
  if (membership.role === ShopRole.OWNER) {
    return { allowed: true, member: membership };
  }

  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(membership.role)) {
    return {
      allowed: false,
      error: new TenantAccessError(
        `Staff role ${membership.role} is not authorized for this action. Required: ${allowedRoles.join(', ')}`,
        'INSUFFICIENT_ROLE_PERMISSIONS',
        403
      ),
    };
  }

  return { allowed: true, member: membership };
}
