import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import { apiSuccess, apiError } from '@/lib/api-response';

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ notificationId: string }> }
) {
  try {
    const session = await getSessionUser();
    if (!session) return apiError('UNAUTHORIZED', 'Not authenticated', 401);

    const { notificationId } = await params;

    const updated = await prisma.notification.update({
      where: { id: notificationId },
      data: { read: true },
    });

    return apiSuccess(updated);
  } catch (error: any) {
    console.error('Update notification error:', error);
    return apiError('INTERNAL_ERROR', 'Failed to update notification', 500);
  }
}
