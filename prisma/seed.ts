import { PrismaClient, UserType, ShopRole, BookingStatus, EstimateStatus, AuditRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding BayFlow database with realistic Pakistan auto repair data...');

  const passwordHash = await bcrypt.hash('bayflow2026', 10);

  // 1. Create Platform Users & Shop Staff
  // Platform Owner
  const ownerUser = await prisma.user.upsert({
    where: { email: 'owner@bayflow.pk' },
    update: {},
    create: {
      email: 'owner@bayflow.pk',
      passwordHash,
      name: 'Tariq Mehmood',
      phone: '+92 300 5551122',
      userType: UserType.OWNER,
    },
  });

  // Sample Customer
  const customerUser = await prisma.user.upsert({
    where: { email: 'customer@bayflow.pk' },
    update: {},
    create: {
      email: 'customer@bayflow.pk',
      passwordHash,
      name: 'Hamza Khan',
      phone: '+92 321 4443322',
      userType: UserType.CUSTOMER,
    },
  });

  // Shop A Staff (Lahore)
  const saLahore = await prisma.user.upsert({
    where: { email: 'sa.lahore@bayflow.pk' },
    update: {},
    create: {
      email: 'sa.lahore@bayflow.pk',
      passwordHash,
      name: 'Bilal Ahmed (SA)',
      phone: '+92 333 1112233',
      userType: UserType.STAFF,
    },
  });

  const techLahore = await prisma.user.upsert({
    where: { email: 'tech.lahore@bayflow.pk' },
    update: {},
    create: {
      email: 'tech.lahore@bayflow.pk',
      passwordHash,
      name: 'Rashid Ali (Master Tech)',
      phone: '+92 333 2223344',
      userType: UserType.STAFF,
    },
  });

  const partsLahore = await prisma.user.upsert({
    where: { email: 'parts.lahore@bayflow.pk' },
    update: {},
    create: {
      email: 'parts.lahore@bayflow.pk',
      passwordHash,
      name: 'Zubair Qureshi (Parts)',
      phone: '+92 333 3334455',
      userType: UserType.STAFF,
    },
  });

  const qcLahore = await prisma.user.upsert({
    where: { email: 'qc.lahore@bayflow.pk' },
    update: {},
    create: {
      email: 'qc.lahore@bayflow.pk',
      passwordHash,
      name: 'Farhan Siddiqui (QC Inspector)',
      phone: '+92 333 4445566',
      userType: UserType.STAFF,
    },
  });

  // 2. Create 3 Auto Repair Shops in Pakistan
  const shopData = [
    {
      name: 'Apex Motor Care',
      slug: 'apex-motor-care-lahore',
      description: 'Premier auto diagnostic, mechanical overhaul & preventative maintenance center in Gulberg III.',
      address: 'Plot 42-B, Main Boulevard, Gulberg III',
      city: 'Lahore',
      phone: '+92 42 35789012',
      email: 'contact@apexmotorcare.pk',
      openTime: '09:00',
      closeTime: '20:00',
      workingDays: 'Monday - Saturday',
      maxParallelSlots: 5,
      slotDurationMinutes: 60,
      ownerId: ownerUser.id,
    },
    {
      name: 'Karachi Precision Auto',
      slug: 'karachi-precision-auto',
      description: 'Full-service auto workshop specializing in EFI diagnostics, hybrid systems, suspension & brakes.',
      address: 'Showroom 12, Main Shahrah-e-Faisal, PECHS Block 6',
      city: 'Karachi',
      phone: '+92 21 34567890',
      email: 'service@karachiprecision.pk',
      openTime: '08:30',
      closeTime: '21:00',
      workingDays: 'Monday - Saturday',
      maxParallelSlots: 6,
      slotDurationMinutes: 60,
      ownerId: ownerUser.id,
    },
    {
      name: 'Capital Auto Craft',
      slug: 'capital-auto-craft-islamabad',
      description: 'State-of-the-art facility offering German & Japanese vehicle tuning, computerized wheel alignment, and engine overhaul.',
      address: 'Sector I-9/2, Industrial Area',
      city: 'Islamabad',
      phone: '+92 51 44332211',
      email: 'info@capitalautocraft.pk',
      openTime: '09:00',
      closeTime: '19:00',
      workingDays: 'Monday - Saturday',
      maxParallelSlots: 4,
      slotDurationMinutes: 60,
      ownerId: ownerUser.id,
    },
  ];

  const createdShops = [];
  for (const s of shopData) {
    const shop = await prisma.shop.upsert({
      where: { slug: s.slug },
      update: s,
      create: s,
    });
    createdShops.push(shop);
  }

  const lahoreShop = createdShops[0];

  // 3. Assign Staff Memberships to Lahore Shop
  const staffAssignments = [
    { userId: ownerUser.id, role: ShopRole.OWNER },
    { userId: saLahore.id, role: ShopRole.SERVICE_ADVISOR },
    { userId: techLahore.id, role: ShopRole.TECHNICIAN },
    { userId: partsLahore.id, role: ShopRole.PARTS_PERSON },
    { userId: qcLahore.id, role: ShopRole.QC_INSPECTOR },
  ];

  for (const assignment of staffAssignments) {
    await prisma.shopMember.upsert({
      where: {
        shopId_userId: {
          shopId: lahoreShop.id,
          userId: assignment.userId,
        },
      },
      update: { role: assignment.role, isActive: true },
      create: {
        shopId: lahoreShop.id,
        userId: assignment.userId,
        role: assignment.role,
        isActive: true,
      },
    });
  }

  // 4. Create Standard Services Catalog for all shops
  const standardServices = [
    {
      name: 'Comprehensive Periodic Maintenance',
      description: 'Engine oil replacement, oil filter, air filter cleaning/change, spark plug inspection, 30-point safety check.',
      category: 'Maintenance',
      durationMinutes: 90,
      basePrice: 8500.0,
    },
    {
      name: 'Computerized Engine Diagnostic Scan',
      description: 'Full OBD-II diagnostic fault code reading, live sensor data analysis, and ECU check.',
      category: 'Diagnostics',
      durationMinutes: 45,
      basePrice: 3500.0,
    },
    {
      name: 'Front & Rear Brake Pad Service',
      description: 'Brake pads replacement, rotor resurfacing/polishing, caliper lubrication, and brake fluid top-up.',
      category: 'Brakes',
      durationMinutes: 75,
      basePrice: 6500.0,
    },
    {
      name: 'Suspension & Bushings Overhaul',
      description: 'Control arm replacement, shock absorber inspection, tie rod ends, and wheel bearing check.',
      category: 'Suspension',
      durationMinutes: 120,
      basePrice: 14500.0,
    },
    {
      name: 'Air Conditioning System Recharge & Clean',
      description: 'R134a refrigerant evacuation and recharge, condenser cleaning, AC cabin filter replacement.',
      category: 'AC & Climate',
      durationMinutes: 60,
      basePrice: 7200.0,
    },
    {
      name: 'Automatic Transmission Fluid Flush',
      description: 'Complete ATF drain and refill with genuine spec transmission fluid, pan gasket inspection.',
      category: 'Transmission',
      durationMinutes: 90,
      basePrice: 16000.0,
    },
  ];

  for (const shop of createdShops) {
    for (const s of standardServices) {
      const existing = await prisma.service.findFirst({
        where: { shopId: shop.id, name: s.name },
      });
      if (!existing) {
        await prisma.service.create({
          data: {
            ...s,
            shopId: shop.id,
          },
        });
      }
    }
  }

  // 5. Create Inventory Parts for Lahore Shop
  const sampleParts = [
    {
      sku: 'OIL-5W30-4L',
      name: 'Synthetic Engine Oil 5W-30 (4 Litres)',
      description: 'High performance API SP synthetic motor oil',
      category: 'Lubricants',
      unitPrice: 9500.0,
      costPrice: 7200.0,
      quantityInStock: 25,
      quantityAllocated: 2,
      minStockLevel: 5,
    },
    {
      sku: 'FLT-OIL-TY01',
      name: 'Genuine Toyota/Honda Engine Oil Filter',
      description: 'OEM grade oil filter cartridge',
      category: 'Filters',
      unitPrice: 1800.0,
      costPrice: 1100.0,
      quantityInStock: 40,
      quantityAllocated: 2,
      minStockLevel: 10,
    },
    {
      sku: 'BRK-PAD-FR01',
      name: 'Ceramic Front Brake Pads Set',
      description: 'Low-dust ceramic brake pads for Japanese sedans',
      category: 'Brakes',
      unitPrice: 7500.0,
      costPrice: 5200.0,
      quantityInStock: 18,
      quantityAllocated: 1,
      minStockLevel: 4,
    },
    {
      sku: 'SPK-IRID-04',
      name: 'Iridium Spark Plugs (Pack of 4)',
      description: 'Long-life iridium tip spark plugs',
      category: 'Ignition',
      unitPrice: 8800.0,
      costPrice: 6500.0,
      quantityInStock: 15,
      quantityAllocated: 0,
      minStockLevel: 3,
    },
    {
      sku: 'GAS-R134A-CAN',
      name: 'R134a AC Refrigerant Canister (13.6kg)',
      description: 'High purity eco-friendly refrigerant gas',
      category: 'Climate',
      unitPrice: 28000.0,
      costPrice: 22000.0,
      quantityInStock: 4,
      quantityAllocated: 0,
      minStockLevel: 2,
    },
  ];

  for (const p of sampleParts) {
    await prisma.part.upsert({
      where: {
        shopId_sku: {
          shopId: lahoreShop.id,
          sku: p.sku,
        },
      },
      update: p,
      create: {
        ...p,
        shopId: lahoreShop.id,
      },
    });
  }

  // 6. Create 14 Days of Slots for Lahore Shop
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let dayOffset = 0; dayOffset < 14; dayOffset++) {
    const slotDate = new Date(today);
    slotDate.setDate(today.getDate() + dayOffset);

    // Skip Sundays
    if (slotDate.getDay() === 0) continue;

    // Slots from 9:00 AM to 6:00 PM (18:00)
    for (let hour = 9; hour < 18; hour++) {
      const startTime = new Date(slotDate);
      startTime.setHours(hour, 0, 0, 0);

      const endTime = new Date(slotDate);
      endTime.setHours(hour + 1, 0, 0, 0);

      await prisma.bookingSlot.upsert({
        where: {
          shopId_startTime: {
            shopId: lahoreShop.id,
            startTime,
          },
        },
        update: {
          capacity: lahoreShop.maxParallelSlots,
        },
        create: {
          shopId: lahoreShop.id,
          startTime,
          endTime,
          capacity: lahoreShop.maxParallelSlots,
          bookedCount: dayOffset === 0 && hour === 10 ? 1 : 0, // 1 sample booking booked
        },
      });
    }
  }

  // 7. Create a Sample Active Booking with Full Flow Data
  const sampleSlot = await prisma.bookingSlot.findFirst({
    where: { shopId: lahoreShop.id, bookedCount: 1 },
  });

  const sampleBooking = await prisma.booking.upsert({
    where: { bookingNumber: 'BF-2026-1001' },
    update: {},
    create: {
      bookingNumber: 'BF-2026-1001',
      shopId: lahoreShop.id,
      customerId: customerUser.id,
      slotId: sampleSlot?.id,
      status: BookingStatus.AWAITING_CUSTOMER,
      vehicleMake: 'Honda',
      vehicleModel: 'Civic Oriel 1.8 i-VTEC',
      vehicleYear: 2021,
      vehicleVin: 'NFBFC1690MN102384',
      licensePlate: 'LEA-21-4892',
      mileage: 48500,
      customerNotes: 'Noticeable brake squeal when coming to a halt and AC cooling is weak during noon heat.',
      internalNotes: 'Customer reported brake squeal. Tech found worn front pads and low AC refrigerant level.',
      assignedAdvisorId: saLahore.id,
      assignedTechnicianId: techLahore.id,
      assignedPartsPersonId: partsLahore.id,
    },
  });

  // Attach services to sample booking
  const maintenanceService = await prisma.service.findFirst({
    where: { shopId: lahoreShop.id, category: 'Brakes' },
  });
  if (maintenanceService) {
    const existingBs = await prisma.bookingService.findFirst({
      where: { bookingId: sampleBooking.id, serviceId: maintenanceService.id },
    });
    if (!existingBs) {
      await prisma.bookingService.create({
        data: {
          bookingId: sampleBooking.id,
          serviceId: maintenanceService.id,
          price: maintenanceService.basePrice,
        },
      });
    }
  }

  // Create Estimate for sample booking (in PKR, 0% tax)
  const existingEstimate = await prisma.estimate.findFirst({
    where: { bookingId: sampleBooking.id, revision: 1 },
  });

  if (!existingEstimate) {
    const estimate = await prisma.estimate.create({
      data: {
        bookingId: sampleBooking.id,
        shopId: lahoreShop.id,
        revision: 1,
        status: EstimateStatus.SENT,
        subtotalParts: 9300.0,
        subtotalLabor: 6500.0,
        taxRate: 0.0,
        taxAmount: 0.0,
        total: 15800.0,
        notes: 'Includes replacement of ceramic front brake pads, rotor polishing, and AC system top-up.',
      },
    });

    await prisma.estimateItem.createMany({
      data: [
        {
          estimateId: estimate.id,
          itemType: 'PART',
          description: 'Ceramic Front Brake Pads Set (OEM spec)',
          quantity: 1.0,
          unitPrice: 7500.0,
          total: 7500.0,
        },
        {
          estimateId: estimate.id,
          itemType: 'PART',
          description: 'Genuine Oil Filter & Sump Washer',
          quantity: 1.0,
          unitPrice: 1800.0,
          total: 1800.0,
        },
        {
          estimateId: estimate.id,
          itemType: 'LABOR',
          description: 'Front Brake System Overhaul & Rotor Polish Labor',
          quantity: 1.0,
          unitPrice: 4000.0,
          total: 4000.0,
        },
        {
          estimateId: estimate.id,
          itemType: 'LABOR',
          description: 'AC Gas Vacuum & Refrigerant Top-up Labor',
          quantity: 1.0,
          unitPrice: 2500.0,
          total: 2500.0,
        },
      ],
    });
  }

  // Create initial audit logs for sample booking
  const auditEntries = [
    {
      fromStatus: BookingStatus.PENDING,
      toStatus: BookingStatus.CONFIRMED,
      role: AuditRole.SERVICE_ADVISOR,
      performedById: saLahore.id,
      note: 'Appointment confirmed with customer via phone.',
    },
    {
      fromStatus: BookingStatus.CONFIRMED,
      toStatus: BookingStatus.ASSIGNED,
      role: AuditRole.SERVICE_ADVISOR,
      performedById: saLahore.id,
      note: 'Assigned to Master Tech Rashid Ali.',
    },
    {
      fromStatus: BookingStatus.ASSIGNED,
      toStatus: BookingStatus.INSPECTING,
      role: AuditRole.TECHNICIAN,
      performedById: techLahore.id,
      note: 'Vehicle placed on Bay 2 lift; 30-point inspection in progress.',
    },
    {
      fromStatus: BookingStatus.INSPECTING,
      toStatus: BookingStatus.ESTIMATE_REVIEW,
      role: AuditRole.TECHNICIAN,
      performedById: techLahore.id,
      note: 'Inspection complete: Front brake pads worn to 2.5mm, AC pressure low at 22 PSI.',
    },
    {
      fromStatus: BookingStatus.ESTIMATE_REVIEW,
      toStatus: BookingStatus.AWAITING_CUSTOMER,
      role: AuditRole.SERVICE_ADVISOR,
      performedById: saLahore.id,
      note: 'Estimate #1 sent to customer Hamza Khan for PKR 15,800 total.',
    },
  ];

  for (const log of auditEntries) {
    const existingLog = await prisma.bookingAuditLog.findFirst({
      where: {
        bookingId: sampleBooking.id,
        fromStatus: log.fromStatus,
        toStatus: log.toStatus,
      },
    });
    if (!existingLog) {
      await prisma.bookingAuditLog.create({
        data: {
          bookingId: sampleBooking.id,
          shopId: lahoreShop.id,
          fromStatus: log.fromStatus,
          toStatus: log.toStatus,
          performedById: log.performedById,
          role: log.role,
          note: log.note,
        },
      });
    }
  }

  console.log('Seeding completed successfully!');
  console.log('Created 3 shops, 5 staff accounts, 6 services, 5 parts, 14 days of slots, and 1 full-flow sample booking.');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
