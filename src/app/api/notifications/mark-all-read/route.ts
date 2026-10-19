import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import { apiSuccess, apiError } from '@/lib/api-response';

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionUser();
    if (!session) return apiError('UNAUTHORIZED', 'Not authenticated', 401);

    const body = await req.json().catch(() => ({}));
    const { shopId } = body;

    const whereClause: Record<string, unknown> = { read: false };
    if (shopId) {
      whereClause.shopId = shopId;
    }

    await prisma.notification.updateMany({
      where: whereClause,
      data: { read: true },
    });

    return apiSuccess({ message: 'All notifications marked as read' });
  } catch (error: any) {
    console.error('Mark all read error:', error);
    return apiError('INTERNAL_ERROR', 'Failed to mark notifications read', 500);
  }
}
