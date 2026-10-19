import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import { verifyTenantAccess } from '@/lib/tenant-guard';
import { apiSuccess, apiError } from '@/lib/api-response';
import { ShopRole } from '@prisma/client';

const updateMemberSchema = z.object({
  role: z.nativeEnum(ShopRole).optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ shopId: string; memberId: string }> }
) {
  try {
    const session = await getSessionUser();
    if (!session) return apiError('UNAUTHORIZED', 'Not authenticated', 401);

    const { shopId, memberId } = await params;
    const access = await verifyTenantAccess(prisma, session.userId, shopId, [ShopRole.OWNER]);
    if (!access.allowed) {
      return apiError(access.error.code, access.error.message, access.error.statusCode);
    }

    const body = await req.json();
    const parsed = updateMemberSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Invalid update parameters', 400);
    }

    const member = await prisma.shopMember.update({
      where: { id: memberId },
      data: parsed.data,
      include: { user: true },
    });

    return apiSuccess(member);
  } catch (error: any) {
    console.error('Update member error:', error);
    return apiError('INTERNAL_ERROR', 'Failed to update member status', 500);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ shopId: string; memberId: string }> }
) {
  try {
    const session = await getSessionUser();
    if (!session) return apiError('UNAUTHORIZED', 'Not authenticated', 401);

    const { shopId, memberId } = await params;
    const access = await verifyTenantAccess(prisma, session.userId, shopId, [ShopRole.OWNER]);
    if (!access.allowed) {
      return apiError(access.error.code, access.error.message, access.error.statusCode);
    }

    await prisma.shopMember.delete({
      where: { id: memberId },
    });

    return apiSuccess({ message: 'Staff member removed from shop' });
  } catch (error: any) {
    console.error('Delete member error:', error);
    return apiError('INTERNAL_ERROR', 'Failed to remove member', 500);
  }
}
