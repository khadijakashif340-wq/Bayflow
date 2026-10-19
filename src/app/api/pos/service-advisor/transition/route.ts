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

const transitionSchema = z.object({
  bookingId: z.string().uuid(),
  targetStatus: z.nativeEnum(BookingStatus),
  assignedTechnicianId: z.string().uuid().optional().nullable(),
  assignedPartsPersonId: z.string().uuid().optional().nullable(),
  note: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionUser();
    if (!session) return apiError('UNAUTHORIZED', 'Not authenticated', 401);

    const body = await req.json();
    const parsed = transitionSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Invalid transition payload', 400);
    }

    const { bookingId, targetStatus, assignedTechnicianId, assignedPartsPersonId, note } = parsed.data;

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
    });
    if (!booking) {
      return apiError('NOT_FOUND', 'Booking not found', 404);
    }

    // Verify user belongs to this shop as SA or Owner
    const access = await verifyTenantAccess(prisma, session.userId, booking.shopId, [
      ShopRole.SERVICE_ADVISOR,
      ShopRole.OWNER,
    ]);
    if (!access.allowed) {
      return apiError(access.error.code, access.error.message, access.error.statusCode);
    }

    const actorRole = access.member.role === ShopRole.OWNER ? AuditRole.OWNER : AuditRole.SERVICE_ADVISOR;

    // If assigning staff
    if (assignedTechnicianId || assignedPartsPersonId) {
      await prisma.booking.update({
        where: { id: bookingId },
        data: {
          ...(assignedTechnicianId ? { assignedTechnicianId } : {}),
          ...(assignedPartsPersonId ? { assignedPartsPersonId } : {}),
          assignedAdvisorId: session.userId,
        },
      });
    }

    const updatedBooking = await executeBookingTransition(prisma, {
      bookingId,
      targetStatus,
      actorUserId: session.userId,
      actorRole,
      note: note || `Service Advisor action: transitioned to ${targetStatus}`,
    });

    // Create notifications for assigned tech or customer
    if (targetStatus === BookingStatus.ASSIGNED && assignedTechnicianId) {
      await prisma.notification.create({
        data: {
          shopId: booking.shopId,
          userId: assignedTechnicianId,
          title: `New Job Assigned: #${booking.bookingNumber}`,
          message: `Vehicle ${booking.vehicleMake} ${booking.vehicleModel} (${booking.licensePlate}) assigned to you for diagnosis.`,
          type: 'JOB_ASSIGNED',
          bookingId: booking.id,
          link: `/pos/technician`,
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
    console.error('SA transition error:', error);
    return apiError('INTERNAL_ERROR', error.message || 'Failed to update booking status', 500);
  }
}
