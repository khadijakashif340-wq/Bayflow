import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import { verifyTenantAccess } from '@/lib/tenant-guard';
import { apiSuccess, apiError } from '@/lib/api-response';
import { executeBookingTransition } from '@/lib/booking-state-machine';
import { BookingStatus, AuditRole, ShopRole } from '@prisma/client';

const claimSchema = z.object({
  bookingId: z.string().uuid(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionUser();
    if (!session) return apiError('UNAUTHORIZED', 'Not authenticated', 401);

    const body = await req.json();
    const parsed = claimSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Invalid booking ID', 400);
    }

    const { bookingId } = parsed.data;

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
    });
    if (!booking) return apiError('NOT_FOUND', 'Booking not found', 404);

    const access = await verifyTenantAccess(prisma, session.userId, booking.shopId, [
      ShopRole.QC_INSPECTOR,
      ShopRole.OWNER,
    ]);
    if (!access.allowed) {
      return apiError(access.error.code, access.error.message, access.error.statusCode);
    }

    const actorRole = access.member.role === ShopRole.OWNER ? AuditRole.OWNER : AuditRole.QC_INSPECTOR;

    // ATOMIC TRANSACTION LOCK FOR QC JOB CLAIM
    const claimedBooking = await executeBookingTransition(prisma, {
      bookingId,
      targetStatus: BookingStatus.QC_IN_PROGRESS,
      actorUserId: session.userId,
      actorRole,
      note: `QC Inspector claimed vehicle for road testing and punchlist verification.`,
    });

    return apiSuccess(claimedBooking);
  } catch (error: any) {
    console.error('QC claim error:', error);
    return apiError('INTERNAL_ERROR', error.message || 'Failed to claim QC job', 500);
  }
}
