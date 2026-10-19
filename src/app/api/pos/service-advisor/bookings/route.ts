import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import { verifyTenantAccess } from '@/lib/tenant-guard';
import { apiSuccess, apiError } from '@/lib/api-response';
import { ShopRole } from '@prisma/client';

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionUser();
    if (!session) return apiError('UNAUTHORIZED', 'Not authenticated', 401);

    const { searchParams } = new URL(req.url);
    const shopId = searchParams.get('shopId');

    if (!shopId) {
      return apiError('BAD_REQUEST', 'shopId query parameter is required', 400);
    }

    const access = await verifyTenantAccess(prisma, session.userId, shopId, [
      ShopRole.SERVICE_ADVISOR,
      ShopRole.OWNER,
    ]);
    if (!access.allowed) {
      return apiError(access.error.code, access.error.message, access.error.statusCode);
    }

    const bookings = await prisma.booking.findMany({
      where: { shopId },
      include: {
        customer: {
          select: { id: true, name: true, phone: true, email: true },
        },
        slot: true,
        assignedAdvisor: { select: { id: true, name: true } },
        assignedTechnician: { select: { id: true, name: true } },
        assignedPartsPerson: { select: { id: true, name: true } },
        qcInspector: { select: { id: true, name: true } },
        services: { include: { service: true } },
        estimates: {
          orderBy: { revision: 'desc' },
          include: { items: true },
        },
        auditLogs: {
          orderBy: { createdAt: 'desc' },
          take: 3,
          include: { performedBy: { select: { name: true } } },
        },
        qcIssues: {
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return apiSuccess(bookings);
  } catch (error: any) {
    console.error('Service advisor bookings fetch error:', error);
    return apiError('INTERNAL_ERROR', 'Failed to retrieve bookings', 500);
  }
}
