import { prisma } from './prisma';

export interface ToolCall {
  name: string;
  arguments: Record<string, any>;
}

export const AI_TOOLS_SCHEMA = [
  {
    type: 'function',
    function: {
      name: 'find_customer',
      description: 'Look up customer account, phone, and vehicles by phone number or name',
      parameters: {
        type: 'object',
        properties: {
          phone: {
            type: 'string',
            description: 'Customer phone number in Pakistani or international format (e.g. +92 300 1234567 or 03001234567)',
          },
          name: {
            type: 'string',
            description: 'Customer full or partial name (e.g. Ahmed, Bilal, Khan)',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_bookings',
      description: 'Find workshop bookings by customer ID, license plate, booking number, or phone number',
      parameters: {
        type: 'object',
        properties: {
          bookingNumber: {
            type: 'string',
            description: 'Official booking number (e.g. BF-2026-1001)',
          },
          licensePlate: {
            type: 'string',
            description: 'Pakistani vehicle license plate (e.g. LEA-21-4892, ICT-23-7744)',
          },
          phone: {
            type: 'string',
            description: 'Customer phone number to retrieve bookings for',
          },
          shopId: {
            type: 'string',
            description: 'Shop ID if scoping search to a specific branch',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_estimate',
      description: 'Retrieve detailed itemized estimate, labor, parts breakdown, and PKR total for a vehicle booking',
      parameters: {
        type: 'object',
        properties: {
          bookingNumber: {
            type: 'string',
            description: 'Booking reference number (e.g. BF-2026-1001)',
          },
          bookingId: {
            type: 'string',
            description: 'UUID of the booking record',
          },
        },
        required: [],
      },
    },
  },
];

/**
 * Execute AI tools against live Prisma database
 */
export async function executeAITool(toolName: string, args: Record<string, any>, contextShopId?: string): Promise<any> {
  switch (toolName) {
    case 'find_customer': {
      const { phone, name } = args;
      const cleanPhone = phone ? phone.replace(/[\s\-]/g, '') : undefined;

      const customers = await prisma.user.findMany({
        where: {
          userType: 'CUSTOMER',
          OR: [
            ...(cleanPhone ? [{ phone: { contains: cleanPhone.slice(-7) } }] : []),
            ...(name ? [{ name: { contains: name, mode: 'insensitive' as const } }] : []),
          ],
        },
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          bookings: {
            take: 3,
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              bookingNumber: true,
              vehicleMake: true,
              vehicleModel: true,
              licensePlate: true,
              status: true,
              createdAt: true,
            },
          },
        },
        take: 5,
      });

      if (customers.length === 0) {
        return {
          found: false,
          message: `No customer record found matching ${phone || name || 'provided query'}.`,
        };
      }

      return {
        found: true,
        count: customers.length,
        customers,
      };
    }

    case 'get_bookings': {
      const { bookingNumber, licensePlate, phone, shopId } = args;
      const targetShopId = shopId || contextShopId;

      const whereClause: any = {};
      if (targetShopId) whereClause.shopId = targetShopId;

      if (bookingNumber) {
        whereClause.bookingNumber = { contains: bookingNumber.trim(), mode: 'insensitive' };
      } else if (licensePlate) {
        whereClause.licensePlate = { contains: licensePlate.trim(), mode: 'insensitive' };
      } else if (phone) {
        const clean = phone.replace(/[\s\-]/g, '');
        whereClause.customer = { phone: { contains: clean.slice(-7) } };
      }

      const bookings = await prisma.booking.findMany({
        where: whereClause,
        include: {
          shop: { select: { id: true, name: true, city: true, phone: true } },
          customer: { select: { id: true, name: true, phone: true } },
          slot: { select: { startTime: true, endTime: true } },
          services: { include: { service: true } },
          estimates: {
            orderBy: { revision: 'desc' },
            take: 1,
            select: {
              id: true,
              total: true,
              status: true,
              revision: true,
            },
          },
        },
        take: 5,
        orderBy: { createdAt: 'desc' },
      });

      if (bookings.length === 0) {
        return {
          found: false,
          message: 'No matching bookings found.',
        };
      }

      return {
        found: true,
        count: bookings.length,
        bookings: bookings.map((b) => ({
          bookingId: b.id,
          bookingNumber: b.bookingNumber,
          status: b.status,
          vehicle: `${b.vehicleYear} ${b.vehicleMake} ${b.vehicleModel} (${b.licensePlate})`,
          customerName: b.customer?.name || 'Customer',
          customerPhone: b.customer?.phone || '',
          scheduledDate: b.slot ? b.slot.startTime : b.createdAt,
          shopName: b.shop.name,
          city: b.shop.city,
          latestEstimate: b.estimates[0]
            ? {
                totalPKR: Number(b.estimates[0].total),
                status: b.estimates[0].status,
                revision: b.estimates[0].revision,
              }
            : null,
          services: b.services.map((s) => s.service.name),
        })),
      };
    }

    case 'get_estimate': {
      const { bookingNumber, bookingId } = args;

      const booking = await prisma.booking.findFirst({
        where: {
          OR: [
            ...(bookingId ? [{ id: bookingId }] : []),
            ...(bookingNumber ? [{ bookingNumber: { contains: bookingNumber.trim(), mode: 'insensitive' as const } }] : []),
          ],
        },
        include: {
          shop: { select: { name: true } },
          estimates: {
            orderBy: { revision: 'desc' },
            take: 1,
            include: {
              items: {
                include: {
                  part: { select: { sku: true, name: true } },
                },
              },
            },
          },
        },
      });

      if (!booking || booking.estimates.length === 0) {
        return {
          found: false,
          message: `No active estimate found for booking ${bookingNumber || bookingId}.`,
        };
      }

      const estimate = booking.estimates[0];
      return {
        found: true,
        bookingNumber: booking.bookingNumber,
        vehicle: `${booking.vehicleYear} ${booking.vehicleMake} ${booking.vehicleModel}`,
        plate: booking.licensePlate,
        revision: estimate.revision,
        status: estimate.status,
        currency: 'PKR (₨)',
        laborTotalPKR: Number(estimate.subtotalLabor),
        partsTotalPKR: Number(estimate.subtotalParts),
        taxAmountPKR: Number(estimate.taxAmount),
        grandTotalPKR: Number(estimate.total),
        advisorNotes: estimate.notes,
        lineItems: estimate.items.map((item) => ({
          description: item.description,
          type: item.itemType,
          quantity: Number(item.quantity),
          unitPricePKR: Number(item.unitPrice),
          totalPKR: Number(item.total),
          sku: item.part?.sku,
        })),
      };
    }

    default:
      return { error: `Unknown tool name: ${toolName}` };
  }
}
