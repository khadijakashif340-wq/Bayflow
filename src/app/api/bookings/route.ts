import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { apiSuccess, apiError } from '@/lib/api-response';
import { BookingStatus, AuditRole, UserType } from '@prisma/client';
import bcrypt from 'bcryptjs';

const createBookingSchema = z.object({
  shopId: z.string().uuid(),
  slotId: z.string().uuid().optional().nullable(),
  serviceIds: z.array(z.string().uuid()).min(1, 'Please select at least one service'),
  vehicleMake: z.string().min(2, 'Make is required'),
  vehicleModel: z.string().min(2, 'Model is required'),
  vehicleYear: z.coerce.number().min(1980).max(2030),
  vehicleVin: z.string().optional().nullable(),
  licensePlate: z.string().min(3, 'License plate is required'),
  mileage: z.coerce.number().optional().nullable(),
  customerNotes: z.string().optional().nullable(),
  customerName: z.string().min(2, 'Name is required'),
  customerPhone: z.string().min(7, 'Valid phone number is required'),
  customerEmail: z.string().email('Valid email is required'),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = createBookingSchema.safeParse(body);

    if (!parsed.success) {
      const fields: Record<string, string> = {};
      parsed.error.errors.forEach((err) => {
        if (err.path[0]) fields[err.path[0].toString()] = err.message;
      });
      return apiError('VALIDATION_ERROR', 'Please verify your form details', 400, fields);
    }

    const data = parsed.data;

    // Verify shop exists
    const shop = await prisma.shop.findUnique({
      where: { id: data.shopId },
    });
    if (!shop) {
      return apiError('NOT_FOUND', 'Selected repair shop does not exist', 404);
    }

    // Verify services exist and belong to shop
    const services = await prisma.service.findMany({
      where: {
        id: { in: data.serviceIds },
        shopId: data.shopId,
        isActive: true,
      },
    });

    if (services.length === 0) {
      return apiError('BAD_REQUEST', 'None of the selected services were found for this shop', 400);
    }

    // Execute booking creation inside transaction
    const booking = await prisma.$transaction(async (tx) => {
      // 1. Slot capacity check
      if (data.slotId) {
        const slot = await tx.bookingSlot.findUnique({
          where: { id: data.slotId },
        });

        if (!slot) {
          throw new Error('SLOT_NOT_FOUND');
        }

        if (slot.bookedCount >= slot.capacity) {
          throw new Error('SLOT_FULL');
        }

        // Increment booked count
        await tx.bookingSlot.update({
          where: { id: slot.id },
          data: { bookedCount: { increment: 1 } },
        });
      }

      // 2. Find or create customer
      let customer = await tx.user.findUnique({
        where: { email: data.customerEmail.toLowerCase().trim() },
      });

      if (!customer) {
        const defaultHash = await bcrypt.hash('customer123', 10);
        customer = await tx.user.create({
          data: {
            email: data.customerEmail.toLowerCase().trim(),
            name: data.customerName.trim(),
            phone: data.customerPhone.trim(),
            passwordHash: defaultHash,
            userType: UserType.CUSTOMER,
          },
        });
      }

      // 3. Generate sequential-like booking number
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const bookingNumber = `BF-${new Date().getFullYear()}-${randomSuffix}`;

      // 4. Create Booking
      const newBooking = await tx.booking.create({
        data: {
          bookingNumber,
          shopId: data.shopId,
          customerId: customer.id,
          slotId: data.slotId || null,
          status: BookingStatus.PENDING,
          vehicleMake: data.vehicleMake.trim(),
          vehicleModel: data.vehicleModel.trim(),
          vehicleYear: data.vehicleYear,
          vehicleVin: data.vehicleVin?.trim() || null,
          licensePlate: data.licensePlate.trim().toUpperCase(),
          mileage: data.mileage || null,
          customerNotes: data.customerNotes?.trim() || null,
        },
      });

      // 5. Create BookingServices
      const bookingServicesData = services.map((s) => ({
        bookingId: newBooking.id,
        serviceId: s.id,
        price: s.basePrice,
      }));

      await tx.bookingService.createMany({
        data: bookingServicesData,
      });

      // 6. Log in BookingAuditLog
      await tx.bookingAuditLog.create({
        data: {
          bookingId: newBooking.id,
          shopId: data.shopId,
          fromStatus: BookingStatus.PENDING,
          toStatus: BookingStatus.PENDING,
          performedById: customer.id,
          role: AuditRole.CUSTOMER,
          note: `Appointment booked online for ${data.vehicleYear} ${data.vehicleMake} ${data.vehicleModel} (${data.licensePlate})`,
        },
      });

      // 7. Create notification for shop
      await tx.notification.create({
        data: {
          shopId: data.shopId,
          title: `New Booking #${bookingNumber}`,
          message: `${customer.name} booked an appointment for ${data.vehicleMake} ${data.vehicleModel} (${data.licensePlate.toUpperCase()}).`,
          type: 'BOOKING_CREATED',
          bookingId: newBooking.id,
          link: `/pos/service-advisor`,
        },
      });

      return newBooking;
    });

    return apiSuccess(booking, 201);
  } catch (error: any) {
    if (error.message === 'SLOT_FULL') {
      return apiError('SLOT_FULL', 'The selected time slot is full. Please select another slot.', 409);
    }
    if (error.message === 'SLOT_NOT_FOUND') {
      return apiError('SLOT_NOT_FOUND', 'Selected appointment slot was not found', 404);
    }
    console.error('Error creating booking:', error);
    return apiError('INTERNAL_ERROR', 'Failed to create booking', 500);
  }
}
