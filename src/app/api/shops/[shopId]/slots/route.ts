import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiSuccess, apiError } from '@/lib/api-response';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ shopId: string }> }
) {
  try {
    const { shopId } = await params;
    const { searchParams } = new URL(req.url);
    const dateStr = searchParams.get('date'); // YYYY-MM-DD

    if (!dateStr) {
      return apiError('BAD_REQUEST', 'date parameter (YYYY-MM-DD) is required', 400);
    }

    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
    });

    if (!shop) {
      return apiError('NOT_FOUND', 'Shop not found', 404);
    }

    // Parse date range for the full day
    const startDate = new Date(`${dateStr}T00:00:00`);
    const endDate = new Date(`${dateStr}T23:59:59`);

    let slots = await prisma.bookingSlot.findMany({
      where: {
        shopId,
        startTime: {
          gte: startDate,
          lte: endDate,
        },
        isBlocked: false,
      },
      orderBy: { startTime: 'asc' },
    });

    // If slots don't exist yet for this day, generate on demand based on shop hours
    if (slots.length === 0) {
      const openHour = parseInt(shop.openTime.split(':')[0] || '9', 10);
      const closeHour = parseInt(shop.closeTime.split(':')[0] || '19', 10);
      const newSlots = [];

      for (let h = openHour; h < closeHour; h++) {
        const start = new Date(startDate);
        start.setHours(h, 0, 0, 0);

        const end = new Date(startDate);
        end.setHours(h + 1, 0, 0, 0);

        newSlots.push({
          shopId,
          startTime: start,
          endTime: end,
          capacity: shop.maxParallelSlots,
          bookedCount: 0,
        });
      }

      await prisma.bookingSlot.createMany({
        data: newSlots,
        skipDuplicates: true,
      });

      slots = await prisma.bookingSlot.findMany({
        where: {
          shopId,
          startTime: {
            gte: startDate,
            lte: endDate,
          },
          isBlocked: false,
        },
        orderBy: { startTime: 'asc' },
      });
    }

    const formattedSlots = slots.map((s) => ({
      id: s.id,
      startTime: s.startTime.toISOString(),
      endTime: s.endTime.toISOString(),
      capacity: s.capacity,
      bookedCount: s.bookedCount,
      availableSpots: Math.max(0, s.capacity - s.bookedCount),
      isFull: s.bookedCount >= s.capacity,
    }));

    return apiSuccess(formattedSlots);
  } catch (error: any) {
    console.error('Error fetching shop slots:', error);
    return apiError('INTERNAL_ERROR', 'Failed to retrieve available slots', 500);
  }
}
