import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import { verifyTenantAccess } from '@/lib/tenant-guard';
import { apiSuccess, apiError } from '@/lib/api-response';
import { ShopRole, BookingStatus } from '@prisma/client';

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionUser();
    if (!session) return apiError('UNAUTHORIZED', 'Not authenticated', 401);

    const { searchParams } = new URL(req.url);
    const shopId = searchParams.get('shopId');

    if (!shopId) return apiError('BAD_REQUEST', 'shopId query parameter is required', 400);

    const access = await verifyTenantAccess(prisma, session.userId, shopId, [
      ShopRole.QC_INSPECTOR,
      ShopRole.OWNER,
    ]);
    if (!access.allowed) {
      return apiError(access.error.code, access.error.message, access.error.statusCode);
    }

    const qcBookings = await prisma.booking.findMany({
      where: {
        shopId,
        status: {
          in: [
            BookingStatus.QC_PENDING,
            BookingStatus.QC_IN_PROGRESS,
            BookingStatus.READY_FOR_PICKUP,
          ],
        },
      },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        assignedAdvisor: { select: { id: true, name: true } },
        assignedTechnician: { select: { id: true, name: true } },
        qcInspector: { select: { id: true, name: true } },
        services: { include: { service: true } },
        estimates: {
          orderBy: { revision: 'desc' },
          take: 1,
          include: { items: true },
        },
        qcIssues: {
          orderBy: { createdAt: 'desc' },
        },
        auditLogs: {
          orderBy: { createdAt: 'desc' },
          take: 3,
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return apiSuccess(qcBookings);
  } catch (error: any) {
    console.error('QC queue fetch error:', error);
    return apiError('INTERNAL_ERROR', 'Failed to retrieve QC queue', 500);
  }
}
