import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import { verifyTenantAccess } from '@/lib/tenant-guard';
import { apiSuccess, apiError } from '@/lib/api-response';
import { ShopRole } from '@prisma/client';

const addServiceSchema = z.object({
  name: z.string().min(2, 'Service name is required'),
  description: z.string().min(5, 'Description is required'),
  category: z.string().min(2, 'Category is required'),
  durationMinutes: z.coerce.number().min(15).max(480).default(60),
  basePrice: z.coerce.number().min(0, 'Base price in PKR must be positive'),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ shopId: string }> }
) {
  try {
    const session = await getSessionUser();
    if (!session) return apiError('UNAUTHORIZED', 'Not authenticated', 401);

    const { shopId } = await params;
    const access = await verifyTenantAccess(prisma, session.userId, shopId, [ShopRole.OWNER]);
    if (!access.allowed) {
      return apiError(access.error.code, access.error.message, access.error.statusCode);
    }

    const body = await req.json();
    const parsed = addServiceSchema.safeParse(body);

    if (!parsed.success) {
      const fields: Record<string, string> = {};
      parsed.error.errors.forEach((err) => {
        if (err.path[0]) fields[err.path[0].toString()] = err.message;
      });
      return apiError('VALIDATION_ERROR', 'Please verify service details', 400, fields);
    }

    const service = await prisma.service.create({
      data: {
        ...parsed.data,
        shopId,
        isActive: true,
      },
    });

    return apiSuccess(service, 201);
  } catch (error: any) {
    console.error('Create service error:', error);
    return apiError('INTERNAL_ERROR', 'Failed to add service', 500);
  }
}
