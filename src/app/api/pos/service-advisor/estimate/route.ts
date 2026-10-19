import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import { verifyTenantAccess } from '@/lib/tenant-guard';
import { apiSuccess, apiError } from '@/lib/api-response';
import { executeBookingTransition } from '@/lib/booking-state-machine';
import { ShopRole, AuditRole, BookingStatus, EstimateStatus, EstimateItemType } from '@prisma/client';

const estimateItemSchema = z.object({
  partId: z.string().uuid().optional().nullable(),
  itemType: z.nativeEnum(EstimateItemType),
  description: z.string().min(2, 'Description required'),
  quantity: z.coerce.number().min(0.1).default(1.0),
  unitPrice: z.coerce.number().min(0, 'Unit price must be non-negative'),
});

const saveEstimateSchema = z.object({
  bookingId: z.string().uuid(),
  notes: z.string().optional(),
  taxRate: z.coerce.number().min(0).max(1).default(0.0), // Defaults to 0% in Pakistan
  sendToCustomer: z.boolean().default(false),
  items: z.array(estimateItemSchema).min(1, 'Please add at least one line item'),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionUser();
    if (!session) return apiError('UNAUTHORIZED', 'Not authenticated', 401);

    const body = await req.json();
    const parsed = saveEstimateSchema.safeParse(body);
    if (!parsed.success) {
      const fields: Record<string, string> = {};
      parsed.error.errors.forEach((err) => {
        if (err.path[0]) fields[err.path[0].toString()] = err.message;
      });
      return apiError('VALIDATION_ERROR', 'Please verify estimate items', 400, fields);
    }

    const { bookingId, notes, taxRate, sendToCustomer, items } = parsed.data;

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        estimates: {
          orderBy: { revision: 'desc' },
          take: 1,
        },
      },
    });

    if (!booking) {
      return apiError('NOT_FOUND', 'Booking not found', 404);
    }

    const access = await verifyTenantAccess(prisma, session.userId, booking.shopId, [
      ShopRole.SERVICE_ADVISOR,
      ShopRole.OWNER,
    ]);
    if (!access.allowed) {
      return apiError(access.error.code, access.error.message, access.error.statusCode);
    }

    // SERVER-SIDE COMPUTATION OF LINE ITEMS & TOTALS
    let subtotalParts = 0;
    let subtotalLabor = 0;

    const computedItems = items.map((item) => {
      const lineTotal = item.quantity * item.unitPrice;
      if (item.itemType === 'PART') {
        subtotalParts += lineTotal;
      } else {
        subtotalLabor += lineTotal;
      }
      return {
        ...item,
        total: lineTotal,
      };
    });

    const taxAmount = (subtotalParts + subtotalLabor) * taxRate;
    const grandTotal = subtotalParts + subtotalLabor + taxAmount;

    // Revision counter logic: if existing estimate exists, increment revision
    const latestEstimate = booking.estimates[0];
    const newRevision = latestEstimate ? latestEstimate.revision + 1 : 1;

    const newEstimate = await prisma.$transaction(async (tx) => {
      // Mark previous as SUPERSEDED if existing
      if (latestEstimate) {
        await tx.estimate.update({
          where: { id: latestEstimate.id },
          data: { status: EstimateStatus.SUPERSEDED },
        });
      }

      // Create new Estimate
      const createdEstimate = await tx.estimate.create({
        data: {
          bookingId,
          shopId: booking.shopId,
          revision: newRevision,
          status: sendToCustomer ? EstimateStatus.SENT : EstimateStatus.DRAFT,
          subtotalParts,
          subtotalLabor,
          taxRate,
          taxAmount,
          total: grandTotal,
          notes,
          items: {
            create: computedItems.map((item) => ({
              partId: item.partId || null,
              itemType: item.itemType,
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              total: item.total,
            })),
          },
        },
        include: { items: true },
      });

      return createdEstimate;
    });

    // If SA selected "Send to Customer", transition booking status
    if (sendToCustomer) {
      const actorRole = access.member.role === ShopRole.OWNER ? AuditRole.OWNER : AuditRole.SERVICE_ADVISOR;

      await executeBookingTransition(prisma, {
        bookingId: booking.id,
        targetStatus: BookingStatus.AWAITING_CUSTOMER,
        actorUserId: session.userId,
        actorRole,
        note: `Estimate (Rev #${newRevision}) prepared and dispatched to customer for PKR ${grandTotal.toLocaleString()}`,
      });

      // Notification
      await prisma.notification.create({
        data: {
          shopId: booking.shopId,
          title: `Estimate Sent: #${booking.bookingNumber}`,
          message: `Estimate (Rev #${newRevision}) totaling PKR ${grandTotal.toLocaleString()} is now awaiting customer approval.`,
          type: 'ESTIMATE_SENT',
          bookingId: booking.id,
          link: `/track/${booking.bookingNumber}`,
        },
      });
    }

    return apiSuccess({
      estimate: newEstimate,
      computed: {
        subtotalParts,
        subtotalLabor,
        taxAmount,
        total: grandTotal,
      },
    }, 201);
  } catch (error: any) {
    console.error('Save estimate error:', error);
    return apiError('INTERNAL_ERROR', error.message || 'Failed to save estimate', 500);
  }
}
