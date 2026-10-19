import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import { verifyTenantAccess } from '@/lib/tenant-guard';
import { apiSuccess, apiError } from '@/lib/api-response';
import { executeBookingTransition } from '@/lib/booking-state-machine';
import { BookingStatus, AuditRole, ShopRole, POStatus } from '@prisma/client';

const poSchema = z.object({
  bookingId: z.string().uuid().optional(),
  shopId: z.string().uuid(),
  supplierName: z.string().min(2, 'Supplier name is required'),
  notes: z.string().optional(),
  items: z.array(
    z.object({
      partId: z.string().uuid(),
      quantityOrdered: z.coerce.number().min(1),
      unitCost: z.coerce.number().min(0),
    })
  ).min(1, 'At least one part is required on PO'),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionUser();
    if (!session) return apiError('UNAUTHORIZED', 'Not authenticated', 401);

    const body = await req.json();
    const parsed = poSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Invalid PO details', 400);
    }

    const { bookingId, shopId, supplierName, notes, items } = parsed.data;

    const access = await verifyTenantAccess(prisma, session.userId, shopId, [
      ShopRole.PARTS_PERSON,
      ShopRole.OWNER,
    ]);
    if (!access.allowed) {
      return apiError(access.error.code, access.error.message, access.error.statusCode);
    }

    const actorRole = access.member.role === ShopRole.OWNER ? AuditRole.OWNER : AuditRole.PARTS_PERSON;

    const poNumber = `PO-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const totalCost = items.reduce((sum, item) => sum + item.quantityOrdered * item.unitCost, 0);

    const po = await prisma.$transaction(async (tx) => {
      const createdPO = await tx.purchaseOrder.create({
        data: {
          shopId,
          poNumber,
          supplierName,
          status: POStatus.ORDERED,
          totalCost,
          notes,
          items: {
            create: items.map((i) => ({
              partId: i.partId,
              quantityOrdered: i.quantityOrdered,
              quantityReceived: 0,
              unitCost: i.unitCost,
            })),
          },
        },
        include: { items: true },
      });

      return createdPO;
    });

    // If linked to a booking in PARTS_PENDING, transition to PARTS_ORDERED
    if (bookingId) {
      const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
      if (booking && (booking.status === BookingStatus.PARTS_PENDING || booking.status === BookingStatus.ESTIMATE_APPROVED)) {
        await executeBookingTransition(prisma, {
          bookingId,
          targetStatus: BookingStatus.PARTS_ORDERED,
          actorUserId: session.userId,
          actorRole,
          note: `PO #${poNumber} placed with ${supplierName} for required parts. Total: PKR ${totalCost.toLocaleString()}`,
        });
      }
    }

    return apiSuccess(po, 201);
  } catch (error: any) {
    console.error('Create PO error:', error);
    return apiError('INTERNAL_ERROR', error.message || 'Failed to create Purchase Order', 500);
  }
}
