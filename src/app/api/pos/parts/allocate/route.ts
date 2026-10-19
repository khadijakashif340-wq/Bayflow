import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import { verifyTenantAccess } from '@/lib/tenant-guard';
import { apiSuccess, apiError } from '@/lib/api-response';
import { executeBookingTransition } from '@/lib/booking-state-machine';
import { BookingStatus, AuditRole, ShopRole } from '@prisma/client';

const allocateSchema = z.object({
  bookingId: z.string().uuid(),
  partId: z.string().uuid(),
  quantity: z.coerce.number().min(1).default(1),
  markReady: z.boolean().default(false),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionUser();
    if (!session) return apiError('UNAUTHORIZED', 'Not authenticated', 401);

    const body = await req.json();
    const parsed = allocateSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Invalid allocation payload', 400);
    }

    const { bookingId, partId, quantity, markReady } = parsed.data;

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
    });
    if (!booking) return apiError('NOT_FOUND', 'Booking not found', 404);

    const access = await verifyTenantAccess(prisma, session.userId, booking.shopId, [
      ShopRole.PARTS_PERSON,
      ShopRole.OWNER,
    ]);
    if (!access.allowed) {
      return apiError(access.error.code, access.error.message, access.error.statusCode);
    }

    const actorRole = access.member.role === ShopRole.OWNER ? AuditRole.OWNER : AuditRole.PARTS_PERSON;

    // Check inventory stock
    const part = await prisma.part.findUnique({
      where: { id: partId },
    });
    if (!part) return apiError('NOT_FOUND', 'Part not found in shop inventory', 404);

    if (part.quantityInStock < quantity) {
      return apiError('INSUFFICIENT_STOCK', `Insufficient inventory stock. In stock: ${part.quantityInStock}, requested: ${quantity}`, 400);
    }

    // Atomic stock down and allocation
    await prisma.$transaction(async (tx) => {
      // 1. Stock down & allocate up
      await tx.part.update({
        where: { id: partId },
        data: {
          quantityInStock: { decrement: quantity },
          quantityAllocated: { increment: quantity },
        },
      });

      // 2. Create PartAllocation
      await tx.partAllocation.create({
        data: {
          shopId: booking.shopId,
          bookingId: booking.id,
          partId: part.id,
          quantity,
          status: 'ALLOCATED',
        },
      });
    });

    // Handle state transitions:
    // If currently ESTIMATE_APPROVED, advance to PARTS_PENDING
    if (booking.status === BookingStatus.ESTIMATE_APPROVED) {
      await executeBookingTransition(prisma, {
        bookingId: booking.id,
        targetStatus: BookingStatus.PARTS_PENDING,
        actorUserId: session.userId,
        actorRole,
        note: `Parts evaluation initiated; allocated ${quantity}x ${part.name}`,
      });
    }

    // If markReady is true, transition directly to PARTS_READY
    if (markReady) {
      await executeBookingTransition(prisma, {
        bookingId: booking.id,
        targetStatus: BookingStatus.PARTS_READY,
        actorUserId: session.userId,
        actorRole,
        note: `All required parts allocated and ready for mechanical repair.`,
      });

      // Notify technician
      if (booking.assignedTechnicianId) {
        await prisma.notification.create({
          data: {
            shopId: booking.shopId,
            userId: booking.assignedTechnicianId,
            title: `Parts Ready for Repair: #${booking.bookingNumber}`,
            message: `Parts for vehicle ${booking.licensePlate} are packaged and ready on bench.`,
            type: 'PARTS_READY',
            bookingId: booking.id,
            link: `/pos/technician`,
          },
        });
      }
    }

    return apiSuccess({ message: `Successfully allocated ${quantity}x ${part.name}` });
  } catch (error: any) {
    console.error('Part allocation error:', error);
    return apiError('INTERNAL_ERROR', error.message || 'Failed to allocate parts', 500);
  }
}
