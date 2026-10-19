import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiSuccess, apiError } from '@/lib/api-response';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ bookingNumber: string }> }
) {
  try {
    const { bookingNumber } = await params;

    const booking = await prisma.booking.findUnique({
      where: { bookingNumber },
      include: {
        shop: {
          select: {
            id: true,
            name: true,
            slug: true,
            city: true,
            address: true,
            phone: true,
            email: true,
            openTime: true,
            closeTime: true,
            workingDays: true,
          },
        },
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        slot: true,
        assignedAdvisor: {
          select: { id: true, name: true },
        },
        assignedTechnician: {
          select: { id: true, name: true },
        },
        qcInspector: {
          select: { id: true, name: true },
        },
        services: {
          include: {
            service: true,
          },
        },
        estimates: {
          orderBy: { revision: 'desc' },
          take: 1,
          include: {
            items: true,
          },
        },
        auditLogs: {
          orderBy: { createdAt: 'asc' },
          include: {
            performedBy: {
              select: { name: true },
            },
          },
        },
        qcIssues: {
          orderBy: { createdAt: 'desc' },
          include: {
            raisedBy: { select: { name: true } },
          },
        },
      },
    });

    if (!booking) {
      return apiError('NOT_FOUND', `Booking #${bookingNumber} not found`, 404);
    }

    return apiSuccess(booking);
  } catch (error: any) {
    console.error('Error fetching booking details:', error);
    return apiError('INTERNAL_ERROR', 'Failed to retrieve booking information', 500);
  }
}
