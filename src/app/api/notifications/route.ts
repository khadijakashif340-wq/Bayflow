import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import { apiSuccess, apiError } from '@/lib/api-response';

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionUser();
    if (!session) return apiError('UNAUTHORIZED', 'Not authenticated', 401);

    const { searchParams } = new URL(req.url);
    const shopId = searchParams.get('shopId');

    const whereClause: Record<string, unknown> = {};

    if (shopId) {
      whereClause.shopId = shopId;
    } else {
      // Find shops user belongs to
      const memberships = await prisma.shopMember.findMany({
        where: { userId: session.userId, isActive: true },
        select: { shopId: true },
      });
      const owned = await prisma.shop.findMany({
        where: { ownerId: session.userId },
        select: { id: true },
      });
      const shopIds = Array.from(new Set([...memberships.map((m) => m.shopId), ...owned.map((o) => o.id)]));
      whereClause.shopId = { in: shopIds };
    }

    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      prisma.notification.count({
        where: {
          ...whereClause,
          read: false,
        },
      }),
    ]);

    return apiSuccess({
      notifications,
      unreadCount,
    });
  } catch (error: any) {
    console.error('Notifications fetch error:', error);
    return apiError('INTERNAL_ERROR', 'Failed to retrieve notifications', 500);
  }
}
