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
      ShopRole.PARTS_PERSON,
      ShopRole.OWNER,
    ]);
    if (!access.allowed) {
      return apiError(access.error.code, access.error.message, access.error.statusCode);
    }

    const [pendingBookings, parts, purchaseOrders] = await Promise.all([
      prisma.booking.findMany({
        where: {
          shopId,
          status: {
            in: [
              BookingStatus.ESTIMATE_APPROVED,
              BookingStatus.PARTS_PENDING,
              BookingStatus.PARTS_ORDERED,
              BookingStatus.PARTS_READY,
            ],
          },
        },
        include: {
          estimates: {
            where: { status: 'APPROVED' },
            take: 1,
            include: { items: true },
          },
          partAllocations: {
            include: { part: true },
          },
        },
        orderBy: { updatedAt: 'desc' },
      }),

      prisma.part.findMany({
        where: { shopId },
        orderBy: { name: 'asc' },
      }),

      prisma.purchaseOrder.findMany({
        where: { shopId },
        include: {
          items: {
            include: { part: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return apiSuccess({
      pendingBookings,
      parts,
      purchaseOrders,
    });
  } catch (error: any) {
    console.error('Parts queue fetch error:', error);
    return apiError('INTERNAL_ERROR', 'Failed to retrieve parts department queue', 500);
  }
}
