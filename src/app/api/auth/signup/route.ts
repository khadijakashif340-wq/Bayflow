import { NextRequest } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { signJwtToken, COOKIE_NAME } from '@/lib/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { UserType, ShopRole } from '@prisma/client';

const signupSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  email: z.string().email('Valid email is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  phone: z.string().min(7, 'Valid phone number is required'),
  shopName: z.string().min(3, 'Shop name is required'),
  city: z.string().min(2, 'City is required'),
  address: z.string().min(5, 'Address is required'),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = signupSchema.safeParse(body);

    if (!parsed.success) {
      const fields: Record<string, string> = {};
      parsed.error.errors.forEach((err) => {
        if (err.path[0]) fields[err.path[0].toString()] = err.message;
      });
      return apiError('VALIDATION_ERROR', 'Please verify your details', 400, fields);
    }

    const { name, email, password, phone, shopName, city, address } = parsed.data;

    // Check if email already exists
    const existing = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (existing) {
      return apiError('EMAIL_EXISTS', 'An account with this email already exists', 409);
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const slug = shopName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') + '-' + Math.floor(100 + Math.random() * 900);

    // Create Owner User, Shop, and Owner Membership in transaction
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: name.trim(),
          email: email.toLowerCase().trim(),
          phone: phone.trim(),
          passwordHash,
          userType: UserType.OWNER,
        },
      });

      const shop = await tx.shop.create({
        data: {
          name: shopName.trim(),
          slug,
          city: city.trim(),
          address: address.trim(),
          phone: phone.trim(),
          email: email.toLowerCase().trim(),
          openTime: '09:00',
          closeTime: '19:00',
          workingDays: 'Monday - Saturday',
          maxParallelSlots: 4,
          ownerId: user.id,
        },
      });

      // Create owner membership
      await tx.shopMember.create({
        data: {
          shopId: shop.id,
          userId: user.id,
          role: ShopRole.OWNER,
          isActive: true,
        },
      });

      // Seed standard services for this new shop
      const defaultServices = [
        {
          name: 'General Maintenance & Oil Change',
          description: 'Synthetic engine oil, filter replacement, fluid levels check.',
          category: 'Maintenance',
          durationMinutes: 60,
          basePrice: 7500.0,
        },
        {
          name: 'Computerized Diagnostic Scan',
          description: 'Complete OBD-II electronic diagnostic and sensor testing.',
          category: 'Diagnostics',
          durationMinutes: 45,
          basePrice: 3000.0,
        },
        {
          name: 'Brake Inspection & Pad Replacement',
          description: 'Full brake caliper, disc, and pad inspection and service.',
          category: 'Brakes',
          durationMinutes: 60,
          basePrice: 5500.0,
        },
      ];

      for (const svc of defaultServices) {
        await tx.service.create({
          data: {
            ...svc,
            shopId: shop.id,
          },
        });
      }

      return { user, shop };
    });

    const token = signJwtToken({
      userId: result.user.id,
      email: result.user.email,
      name: result.user.name,
      userType: result.user.userType,
    });

    const response = apiSuccess({
      user: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        userType: result.user.userType,
        shop: {
          id: result.shop.id,
          name: result.shop.name,
          slug: result.shop.slug,
          city: result.shop.city,
        },
      },
    }, 201);

    response.cookies.set({
      name: COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (error: any) {
    console.error('Signup error:', error);
    return apiError('INTERNAL_ERROR', 'Failed to register shop account', 500);
  }
}
