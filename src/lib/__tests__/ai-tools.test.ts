import { describe, it, expect, vi } from 'vitest';
import { executeAITool } from '../ai-tools';
import { prisma } from '../prisma';

vi.mock('../prisma', () => ({
  prisma: {
    user: {
      findMany: vi.fn(),
    },
    booking: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    estimate: {
      findFirst: vi.fn(),
    },
    shop: {
      findFirst: vi.fn(),
    },
  },
}));

describe('AI Front Desk Server-Side Tool Calling', () => {
  it('find_customer queries database and returns matching customer profile', async () => {
    (prisma.user.findMany as any).mockResolvedValueOnce([
      {
        id: 'cust-1',
        name: 'Ahmed Khan',
        phone: '+92 300 1234567',
        email: 'customer@bayflow.pk',
        bookings: [
          {
            id: 'b-1',
            bookingNumber: 'BF-2026-1001',
            vehicleMake: 'Honda',
            vehicleModel: 'Civic',
            licensePlate: 'LEA-21-4892',
            status: 'IN_REPAIR',
            createdAt: new Date(),
          },
        ],
      },
    ]);

    const result = await executeAITool('find_customer', { phone: '03001234567' });
    expect(result.found).toBe(true);
    expect(result.count).toBe(1);
    expect(result.customers[0].name).toBe('Ahmed Khan');
    expect(result.customers[0].bookings[0].licensePlate).toBe('LEA-21-4892');
  });

  it('get_bookings retrieves active vehicle repair record and status', async () => {
    (prisma.booking.findMany as any).mockResolvedValueOnce([
      {
        id: 'b-1',
        bookingNumber: 'BF-2026-1001',
        status: 'IN_REPAIR',
        vehicleYear: 2021,
        vehicleMake: 'Honda',
        vehicleModel: 'Civic',
        licensePlate: 'LEA-21-4892',
        createdAt: new Date(),
        shop: { id: 's-1', name: 'BayFlow Central Lahore', city: 'Lahore', phone: '+92 42 3578 9000' },
        customer: { id: 'c-1', name: 'Ahmed Khan', phone: '+92 300 1234567' },
        slot: { startTime: new Date('2026-10-19T09:00:00Z'), endTime: new Date('2026-10-19T10:30:00Z') },
        services: [{ service: { name: 'Periodic Maintenance 20,000 KM' } }],
        estimates: [
          {
            id: 'est-1',
            total: 35000,
            status: 'APPROVED',
            revision: 1,
          },
        ],
      },
    ]);

    const result = await executeAITool('get_bookings', { licensePlate: 'LEA-21-4892' });
    expect(result.found).toBe(true);
    expect(result.bookings[0].bookingNumber).toBe('BF-2026-1001');
    expect(result.bookings[0].status).toBe('IN_REPAIR');
    expect(result.bookings[0].latestEstimate?.totalPKR).toBe(35000);
  });

  it('get_estimate returns itemized quotation breakdown in PKR', async () => {
    (prisma.booking.findFirst as any).mockResolvedValueOnce({
      id: 'b-1',
      bookingNumber: 'BF-2026-1001',
      vehicleYear: 2021,
      vehicleMake: 'Honda',
      vehicleModel: 'Civic',
      licensePlate: 'LEA-21-4892',
      shop: { name: 'BayFlow Central Lahore' },
      estimates: [
        {
          id: 'est-1',
          revision: 1,
          status: 'APPROVED',
          subtotalLabor: 12000,
          subtotalParts: 23000,
          taxAmount: 0,
          total: 35000,
          notes: 'Standard OEM parts applied',
          items: [
            {
              description: 'Front Brake Pads OEM',
              itemType: 'PART',
              quantity: 1,
              unitPrice: 15000,
              total: 15000,
              part: { sku: 'BP-HON-CIV-01' },
            },
            {
              description: 'Brake Disc Resurfacing Labor',
              itemType: 'LABOR',
              quantity: 1,
              unitPrice: 12000,
              total: 12000,
              part: null,
            },
          ],
        },
      ],
    });

    const result = await executeAITool('get_estimate', { bookingNumber: 'BF-2026-1001' });
    expect(result.found).toBe(true);
    expect(result.bookingNumber).toBe('BF-2026-1001');
    expect(result.laborTotalPKR).toBe(12000);
    expect(result.partsTotalPKR).toBe(23000);
    expect(result.grandTotalPKR).toBe(35000);
    expect(result.lineItems.length).toBe(2);
  });
});
