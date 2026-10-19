import { describe, it, expect, vi } from 'vitest';
import { ShopRole } from '@prisma/client';
import { verifyTenantAccess, TenantAccessError } from '../tenant-guard';

describe('Tenant Guard - Multi-Tenant Isolation', () => {
  const shopAId = 'shop-lahore-central-uuid';
  const shopBId = 'shop-karachi-hub-uuid';
  const staffUserId = 'user-tech-1-uuid';

  it('strictly rejects Shop A staff attempting to access Shop B resources (403)', async () => {
    // Mock prisma client
    const mockPrisma = {
      shopMember: {
        findUnique: vi.fn().mockImplementation(({ where }) => {
          // User is only a member of Shop A
          if (where.shopId_userId.shopId === shopAId && where.shopId_userId.userId === staffUserId) {
            return Promise.resolve({
              id: 'member-1',
              shopId: shopAId,
              userId: staffUserId,
              role: ShopRole.TECHNICIAN,
              isActive: true,
            });
          }
          // Not a member of Shop B
          return Promise.resolve(null);
        }),
      },
    } as any;

    // Staff accessing Shop A: allowed
    const shopAResult = await verifyTenantAccess(mockPrisma, staffUserId, shopAId);
    expect(shopAResult.allowed).toBe(true);
    if (shopAResult.allowed) {
      expect(shopAResult.member.shopId).toBe(shopAId);
    }

    // Staff accessing Shop B: FORBIDDEN 403
    const shopBResult = await verifyTenantAccess(mockPrisma, staffUserId, shopBId);
    expect(shopBResult.allowed).toBe(false);
    if (!shopBResult.allowed) {
      expect(shopBResult.error).toBeInstanceOf(TenantAccessError);
      expect(shopBResult.error.statusCode).toBe(403);
      expect(shopBResult.error.code).toBe('CROSS_TENANT_ACCESS_DENIED');
      expect(shopBResult.error.message).toContain('Cross-tenant access forbidden');
    }
  });

  it('rejects deactivated staff members (403)', async () => {
    const mockPrisma = {
      shopMember: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'member-2',
          shopId: shopAId,
          userId: staffUserId,
          role: ShopRole.TECHNICIAN,
          isActive: false, // Inactive
        }),
      },
    } as any;

    const result = await verifyTenantAccess(mockPrisma, staffUserId, shopAId);
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.error.statusCode).toBe(403);
      expect(result.error.code).toBe('MEMBERSHIP_INACTIVE');
    }
  });

  it('enforces role constraints within the same tenant (403 for insufficient role)', async () => {
    const mockPrisma = {
      shopMember: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'member-3',
          shopId: shopAId,
          userId: staffUserId,
          role: ShopRole.TECHNICIAN,
          isActive: true,
        }),
      },
    } as any;

    // Technician trying an action requiring QC_INSPECTOR or SERVICE_ADVISOR
    const result = await verifyTenantAccess(mockPrisma, staffUserId, shopAId, [
      ShopRole.QC_INSPECTOR,
      ShopRole.SERVICE_ADVISOR,
    ]);

    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.error.statusCode).toBe(403);
      expect(result.error.code).toBe('INSUFFICIENT_ROLE_PERMISSIONS');
    }
  });

  it('allows Shop Owner across all role-protected endpoints in their shop', async () => {
    const mockPrisma = {
      shopMember: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'member-owner',
          shopId: shopAId,
          userId: 'owner-user-id',
          role: ShopRole.OWNER,
          isActive: true,
        }),
      },
    } as any;

    const result = await verifyTenantAccess(mockPrisma, 'owner-user-id', shopAId, [
      ShopRole.QC_INSPECTOR,
    ]);

    expect(result.allowed).toBe(true);
  });
});
