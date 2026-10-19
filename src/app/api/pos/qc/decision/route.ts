import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import { verifyTenantAccess } from '@/lib/tenant-guard';
import { apiSuccess, apiError } from '@/lib/api-response';
import { executeBookingTransition } from '@/lib/booking-state-machine';
import { BookingStatus, AuditRole, ShopRole } from '@prisma/client';

const decisionSchema = z.object({
  bookingId: z.string().uuid(),
  decision: z.enum(['PASS', 'FAIL']),
  note: z.string().optional(),
  qcIssueTitle: z.string().optional(),
  qcIssueDescription: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionUser();
    if (!session) return apiError('UNAUTHORIZED', 'Not authenticated', 401);

    const body = await req.json();
    const parsed = decisionSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Invalid QC decision payload', 400);
    }

    const { bookingId, decision, note, qcIssueTitle, qcIssueDescription } = parsed.data;

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

    if (decision === 'PASS') {
      const updated = await executeBookingTransition(prisma, {
        bookingId,
        targetStatus: BookingStatus.READY_FOR_PICKUP,
        actorUserId: session.userId,
        actorRole,
        note: note || 'QC Passed: 30-point mechanical and safety test passed. Vehicle approved for customer pickup.',
      });

      // Notify SA and Customer
      await prisma.notification.create({
        data: {
          shopId: booking.shopId,
          title: `Vehicle QC Passed: #${booking.bookingNumber}`,
          message: `${booking.vehicleMake} ${booking.vehicleModel} (${booking.licensePlate}) passed QC and is ready for customer delivery.`,
          type: 'QC_PASSED',
          bookingId: booking.id,
          link: `/pos/service-advisor`,
        },
      });

      return apiSuccess({ status: 'READY_FOR_PICKUP', booking: updated });
    } else {
      // QC FAIL LOOP
      if (!qcIssueTitle || !qcIssueDescription) {
        return apiError('BAD_REQUEST', 'Title and description of failure are required when failing QC inspection', 400);
      }

      const updated = await executeBookingTransition(prisma, {
        bookingId,
        targetStatus: BookingStatus.IN_REPAIR, // Loops back to IN_REPAIR!
        actorUserId: session.userId,
        actorRole,
        note: `QC Failed: ${qcIssueTitle}. Returned to technician for rework.`,
        qcIssue: {
          title: qcIssueTitle,
          description: qcIssueDescription,
        },
      });

      // Notify technician
      if (booking.assignedTechnicianId) {
        await prisma.notification.create({
          data: {
            shopId: booking.shopId,
            userId: booking.assignedTechnicianId,
            title: `QC Failed Rework: #${booking.bookingNumber}`,
            message: `QC Inspector rejected inspection: "${qcIssueTitle}". Vehicle returned to your bay.`,
            type: 'QC_FAILED',
            bookingId: booking.id,
            link: `/pos/technician`,
          },
        });
      }

      return apiSuccess({ status: 'IN_REPAIR', booking: updated, issueCreated: true });
    }
  } catch (error: any) {
    console.error('QC decision error:', error);
    return apiError('INTERNAL_ERROR', error.message || 'Failed to submit QC decision', 500);
  }
}
