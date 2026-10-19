import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { ShopRole } from '@prisma/client';

const createShopSchema = z.object({
  name: z.string().min(3, 'Shop name is required'),
  city: z.string().min(2, 'City is required'),
  address: z.string().min(5, 'Address is required'),
  phone: z.string().min(7, 'Phone number is required'),
  email: z.string().email('Valid email is required'),
  openTime: z.string().default('09:00'),
  closeTime: z.string().default('19:00'),
  workingDays: z.string().default('Monday - Saturday'),
  maxParallelSlots: z.coerce.number().min(1).max(20).default(4),
  description: z.string().optional(),
});

export async function GET(_req: NextRequest) {
  try {
    const session = await getSessionUser();
    if (!session) return apiError('UNAUTHORIZED', 'Not authenticated', 401);

    const shops = await prisma.shop.findMany({
      where: {
        OR: [
          { ownerId: session.userId },
          { members: { some: { userId: session.userId, isActive: true } } },
        ],
      },
      include: {
        _count: {
          select: {
            members: true,
            services: true,
            bookings: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return apiSuccess(shops);
  } catch (error: any) {
    console.error('Owner shops fetch error:', error);
    return apiError('INTERNAL_ERROR', 'Failed to retrieve shops', 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionUser();
    if (!session) return apiError('UNAUTHORIZED', 'Not authenticated', 401);

    const body = await req.json();
    const parsed = createShopSchema.safeParse(body);

    if (!parsed.success) {
      const fields: Record<string, string> = {};
      parsed.error.errors.forEach((err) => {
        if (err.path[0]) fields[err.path[0].toString()] = err.message;
      });
      return apiError('VALIDATION_ERROR', 'Please verify shop details', 400, fields);
    }

    const data = parsed.data;
    const slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') + '-' + Math.floor(100 + Math.random() * 900);

    const shop = await prisma.$transaction(async (tx) => {
      const newShop = await tx.shop.create({
        data: {
          ...data,
          slug,
          ownerId: session.userId,
        },
      });

      // Add owner membership
      await tx.shopMember.create({
        data: {
          shopId: newShop.id,
          userId: session.userId,
          role: ShopRole.OWNER,
          isActive: true,
        },
      });

      // Default service
      await tx.service.create({
        data: {
          shopId: newShop.id,
          name: 'General Inspection & Maintenance',
          description: 'Basic diagnostic scan, fluid levels check, and brake inspection.',
          category: 'Maintenance',
          durationMinutes: 60,
          basePrice: 6500.0,
        },
      });

      return newShop;
    });

    return apiSuccess(shop, 201);
  } catch (error: any) {
    console.error('Create shop error:', error);
    return apiError('INTERNAL_ERROR', 'Failed to create new workshop', 500);
  }
}
