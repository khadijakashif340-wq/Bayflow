import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import { verifyTenantAccess } from '@/lib/tenant-guard';
import { apiSuccess, apiError } from '@/lib/api-response';
import {
  executeBookingTransition,
  StateMachineConflictError,
  StateMachineForbiddenError,
} from '@/lib/booking-state-machine';
import { BookingStatus, AuditRole, ShopRole } from '@prisma/client';

const techTransitionSchema = z.object({
  bookingId: z.string().uuid(),
  targetStatus: z.nativeEnum(BookingStatus),
  note: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionUser();
    if (!session) return apiError('UNAUTHORIZED', 'Not authenticated', 401);

    const body = await req.json();
    const parsed = techTransitionSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Invalid transition payload', 400);
    }

    const { bookingId, targetStatus, note } = parsed.data;

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
    });
    if (!booking) {
      return apiError('NOT_FOUND', 'Booking not found', 404);
    }

    const access = await verifyTenantAccess(prisma, session.userId, booking.shopId, [
      ShopRole.TECHNICIAN,
      ShopRole.OWNER,
    ]);
    if (!access.allowed) {
      return apiError(access.error.code, access.error.message, access.error.statusCode);
    }

    const actorRole = access.member.role === ShopRole.OWNER ? AuditRole.OWNER : AuditRole.TECHNICIAN;

    const updatedBooking = await executeBookingTransition(prisma, {
      bookingId,
      targetStatus,
      actorUserId: session.userId,
      actorRole,
      note: note || `Technician action: transitioned to ${targetStatus}`,
    });

    // Notify Service Advisor or QC queue
    if (targetStatus === BookingStatus.ESTIMATE_REVIEW) {
      await prisma.notification.create({
        data: {
          shopId: booking.shopId,
          title: `Inspection Complete: #${booking.bookingNumber}`,
          message: `Tech has finished diagnosing vehicle ${booking.licensePlate}. Ready for estimate preparation.`,
          type: 'INSPECTION_COMPLETE',
          bookingId: booking.id,
          link: `/pos/service-advisor`,
        },
      });
    } else if (targetStatus === BookingStatus.QC_PENDING) {
      await prisma.notification.create({
        data: {
          shopId: booking.shopId,
          title: `Vehicle Ready for QC: #${booking.bookingNumber}`,
          message: `Repairs completed on ${booking.vehicleMake} ${booking.vehicleModel} (${booking.licensePlate}). Awaiting QC inspection claim.`,
          type: 'QC_PENDING',
          bookingId: booking.id,
          link: `/pos/qc`,
        },
      });
    }

    return apiSuccess(updatedBooking);
  } catch (error: any) {
    if (error instanceof StateMachineConflictError) {
      return apiError(error.code, error.message, 409);
    }
    if (error instanceof StateMachineForbiddenError) {
      return apiError(error.code, error.message, 403);
    }
    console.error('Technician transition error:', error);
    return apiError('INTERNAL_ERROR', error.message || 'Failed to update job status', 500);
  }
}
