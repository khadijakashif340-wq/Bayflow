import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiSuccess, apiError } from '@/lib/api-response';
import {
  executeBookingTransition,
  StateMachineConflictError,
  StateMachineForbiddenError,
} from '@/lib/booking-state-machine';
import { BookingStatus, AuditRole } from '@prisma/client';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ bookingNumber: string }> }
) {
  try {
    const { bookingNumber } = await params;

    const booking = await prisma.booking.findUnique({
      where: { bookingNumber },
      include: { customer: true },
    });

    if (!booking) {
      return apiError('NOT_FOUND', 'Booking not found', 404);
    }

    const note = `Customer ${booking.customer.name} confirmed vehicle handover & pickup. Booking successfully completed.`;

    const updatedBooking = await executeBookingTransition(prisma, {
      bookingId: booking.id,
      targetStatus: BookingStatus.COMPLETED,
      actorUserId: booking.customerId,
      actorRole: AuditRole.CUSTOMER,
      note,
    });

    // Notify shop
    await prisma.notification.create({
      data: {
        shopId: booking.shopId,
        title: `Vehicle Picked Up: #${booking.bookingNumber}`,
        message: note,
        type: 'VEHICLE_PICKED_UP',
        bookingId: booking.id,
        link: `/pos/service-advisor`,
      },
    });

    return apiSuccess({
      booking: updatedBooking,
      message: 'Vehicle pickup confirmed. Thank you for choosing BayFlow!',
    });
  } catch (error: any) {
    if (error instanceof StateMachineConflictError) {
      return apiError(error.code, error.message, 409);
    }
    if (error instanceof StateMachineForbiddenError) {
      return apiError(error.code, error.message, 403);
    }
    console.error('Error confirming pickup:', error);
    return apiError('INTERNAL_ERROR', error.message || 'Failed to confirm pickup', 500);
  }
}
