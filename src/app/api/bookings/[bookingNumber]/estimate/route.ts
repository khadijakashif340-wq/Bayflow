import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiSuccess, apiError } from '@/lib/api-response';
import {
  executeBookingTransition,
  StateMachineConflictError,
  StateMachineForbiddenError,
} from '@/lib/booking-state-machine';
import { BookingStatus, AuditRole, EstimateStatus } from '@prisma/client';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ bookingNumber: string }> }
) {
  try {
    const { bookingNumber } = await params;
    const body = await req.json();
    const { action, reason, customerEmail } = body;

    if (!action || !['APPROVE', 'REJECT'].includes(action)) {
      return apiError('BAD_REQUEST', 'Action must be APPROVE or REJECT', 400);
    }

    const booking = await prisma.booking.findUnique({
      where: { bookingNumber },
      include: {
        customer: true,
        estimates: {
          orderBy: { revision: 'desc' },
          take: 1,
        },
      },
    });

    if (!booking) {
      return apiError('NOT_FOUND', 'Booking not found', 404);
    }

    const latestEstimate = booking.estimates[0];
    if (!latestEstimate) {
      return apiError('BAD_REQUEST', 'No active estimate found for this booking', 400);
    }

    // Target status based on decision
    const targetStatus =
      action === 'APPROVE'
        ? BookingStatus.ESTIMATE_APPROVED
        : BookingStatus.ESTIMATE_REJECTED;

    const note =
      action === 'APPROVE'
        ? `Customer ${booking.customer.name} approved Estimate (Rev #${latestEstimate.revision}) for PKR ${latestEstimate.total}`
        : `Customer ${booking.customer.name} rejected Estimate (Rev #${latestEstimate.revision}). Reason: ${reason || 'Not specified'}`;

    // Execute state machine transition with Customer role
    const updatedBooking = await executeBookingTransition(prisma, {
      bookingId: booking.id,
      targetStatus,
      actorUserId: booking.customerId,
      actorRole: AuditRole.CUSTOMER,
      note,
    });

    // Update estimate status
    await prisma.estimate.update({
      where: { id: latestEstimate.id },
      data: {
        status: action === 'APPROVE' ? EstimateStatus.APPROVED : EstimateStatus.REJECTED,
        rejectionReason: action === 'REJECT' ? reason || null : null,
      },
    });

    // Create notification for shop
    await prisma.notification.create({
      data: {
        shopId: booking.shopId,
        title: action === 'APPROVE' ? `Estimate Approved: #${booking.bookingNumber}` : `Estimate Declined: #${booking.bookingNumber}`,
        message: note,
        type: action === 'APPROVE' ? 'ESTIMATE_APPROVED' : 'ESTIMATE_REJECTED',
        bookingId: booking.id,
        link: `/pos/service-advisor`,
      },
    });

    return apiSuccess({
      booking: updatedBooking,
      decision: action,
      note,
    });
  } catch (error: any) {
    if (error instanceof StateMachineConflictError) {
      return apiError(error.code, error.message, 409);
    }
    if (error instanceof StateMachineForbiddenError) {
      return apiError(error.code, error.message, 403);
    }
    console.error('Error updating estimate decision:', error);
    return apiError('INTERNAL_ERROR', error.message || 'Failed to update estimate decision', 500);
  }
}
