import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import { verifyTenantAccess } from '@/lib/tenant-guard';
import { apiSuccess, apiError } from '@/lib/api-response';
import { ShopRole } from '@prisma/client';

const updateServiceSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().min(5).optional(),
  category: z.string().min(2).optional(),
  durationMinutes: z.coerce.number().min(15).max(480).optional(),
  basePrice: z.coerce.number().min(0).optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ shopId: string; serviceId: string }> }
) {
  try {
    const session = await getSessionUser();
    if (!session) return apiError('UNAUTHORIZED', 'Not authenticated', 401);

    const { shopId, serviceId } = await params;
    const access = await verifyTenantAccess(prisma, session.userId, shopId, [ShopRole.OWNER]);
    if (!access.allowed) {
      return apiError(access.error.code, access.error.message, access.error.statusCode);
    }

    const body = await req.json();
    const parsed = updateServiceSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Invalid service update fields', 400);
    }

    const updated = await prisma.service.update({
      where: { id: serviceId },
      data: parsed.data,
    });

    return apiSuccess(updated);
  } catch (error: any) {
    console.error('Update service error:', error);
    return apiError('INTERNAL_ERROR', 'Failed to update service', 500);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ shopId: string; serviceId: string }> }
) {
  try {
    const session = await getSessionUser();
    if (!session) return apiError('UNAUTHORIZED', 'Not authenticated', 401);

    const { shopId, serviceId } = await params;
    const access = await verifyTenantAccess(prisma, session.userId, shopId, [ShopRole.OWNER]);
    if (!access.allowed) {
      return apiError(access.error.code, access.error.message, access.error.statusCode);
    }

    // Soft-deactivate to avoid cascading bookingService foreign key violations
    const deactivated = await prisma.service.update({
      where: { id: serviceId },
      data: { isActive: false },
    });

    return apiSuccess({ message: 'Service deactivated from catalog', service: deactivated });
  } catch (error: any) {
    console.error('Delete service error:', error);
    return apiError('INTERNAL_ERROR', 'Failed to remove service', 500);
  }
}
