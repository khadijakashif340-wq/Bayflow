import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import { verifyTenantAccess } from '@/lib/tenant-guard';
import { apiSuccess, apiError } from '@/lib/api-response';
import { executeBookingTransition } from '@/lib/booking-state-machine';
import { BookingStatus, AuditRole, ShopRole, POStatus } from '@prisma/client';

const receiveSchema = z.object({
  bookingId: z.string().uuid().optional(),
  receivedItems: z.array(
    z.object({
      itemId: z.string().uuid(),
      quantityReceivedNow: z.coerce.number().min(1),
    })
  ).min(1, 'Please specify items to receive'),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ poId: string }> }
) {
  try {
    const session = await getSessionUser();
    if (!session) return apiError('UNAUTHORIZED', 'Not authenticated', 401);

    const { poId } = await params;
    const body = await req.json();
    const parsed = receiveSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Invalid receive payload', 400);
    }

    const { bookingId, receivedItems } = parsed.data;

    const po = await prisma.purchaseOrder.findUnique({
      where: { id: poId },
      include: { items: true },
    });

    if (!po) return apiError('NOT_FOUND', 'Purchase Order not found', 404);

    const access = await verifyTenantAccess(prisma, session.userId, po.shopId, [
      ShopRole.PARTS_PERSON,
      ShopRole.OWNER,
    ]);
    if (!access.allowed) {
      return apiError(access.error.code, access.error.message, access.error.statusCode);
    }

    const actorRole = access.member.role === ShopRole.OWNER ? AuditRole.OWNER : AuditRole.PARTS_PERSON;

    // Execute atomic receive: stock up inventory and update item received counts
    const updatedPO = await prisma.$transaction(async (tx) => {
      for (const rec of receivedItems) {
        const item = po.items.find((i) => i.id === rec.itemId);
        if (item) {
          // Increment received count on PO item
          await tx.purchaseOrderItem.update({
            where: { id: item.id },
            data: {
              quantityReceived: { increment: rec.quantityReceivedNow },
            },
          });

          // RECEIVE = STOCK UP INVENTORY!
          await tx.part.update({
            where: { id: item.partId },
            data: {
              quantityInStock: { increment: rec.quantityReceivedNow },
            },
          });
        }
      }

      // Re-fetch items to check if all received
      const freshItems = await tx.purchaseOrderItem.findMany({
        where: { purchaseOrderId: po.id },
      });

      const isFullyReceived = freshItems.every((i) => i.quantityReceived >= i.quantityOrdered);
      const isPartiallyReceived = freshItems.some((i) => i.quantityReceived > 0);

      const newStatus = isFullyReceived
        ? POStatus.RECEIVED
        : isPartiallyReceived
        ? POStatus.PARTIALLY_RECEIVED
        : POStatus.ORDERED;

      return await tx.purchaseOrder.update({
        where: { id: po.id },
        data: { status: newStatus },
        include: { items: { include: { part: true } } },
      });
    });

    // If linked booking is in PARTS_ORDERED
    if (bookingId) {
      const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
      if (booking && booking.status === BookingStatus.PARTS_ORDERED) {
        if (updatedPO.status === POStatus.RECEIVED) {
          // All parts received: transition to PARTS_READY!
          await executeBookingTransition(prisma, {
            bookingId,
            targetStatus: BookingStatus.PARTS_READY,
            actorUserId: session.userId,
            actorRole,
            note: `All parts on PO #${po.poNumber} received and stocked. Vehicle transitioned to PARTS_READY.`,
          });

          if (booking.assignedTechnicianId) {
            await prisma.notification.create({
              data: {
                shopId: booking.shopId,
                userId: booking.assignedTechnicianId,
                title: `Parts Received: #${booking.bookingNumber}`,
                message: `PO #${po.poNumber} completely delivered. Vehicle is ready for repair.`,
                type: 'PARTS_READY',
                bookingId: booking.id,
                link: `/pos/technician`,
              },
            });
          }
        } else {
          // Partial receipt: keeps status PARTS_ORDERED as per brief!
          await executeBookingTransition(prisma, {
            bookingId,
            targetStatus: BookingStatus.PARTS_ORDERED,
            actorUserId: session.userId,
            actorRole,
            note: `Partial shipment received for PO #${po.poNumber}. Remaining parts on backorder.`,
          });
        }
      }
    }

    return apiSuccess(updatedPO);
  } catch (error: any) {
    console.error('PO receive error:', error);
    return apiError('INTERNAL_ERROR', error.message || 'Failed to receive PO items', 500);
  }
}
