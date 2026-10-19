import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { signJwtToken, COOKIE_NAME } from '@/lib/auth';
import { apiSuccess, apiError } from '@/lib/api-response';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Invalid email or password format', 400);
    }

    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: {
        memberships: {
          where: { isActive: true },
          include: {
            shop: {
              select: {
                id: true,
                name: true,
                slug: true,
                city: true,
              },
            },
          },
        },
        ownedShops: {
          select: {
            id: true,
            name: true,
            slug: true,
            city: true,
          },
        },
      },
    });

    if (!user) {
      return apiError('UNAUTHORIZED', 'Invalid email or password', 401);
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      return apiError('UNAUTHORIZED', 'Invalid email or password', 401);
    }

    // Generate JWT token
    const token = signJwtToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      userType: user.userType,
    });

    const responseData = {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        userType: user.userType,
        memberships: user.memberships.map((m) => ({
          shopId: m.shopId,
          shopName: m.shop.name,
          role: m.role,
        })),
        ownedShops: user.ownedShops,
      },
    };

    const response = apiSuccess(responseData);

    // Set httpOnly cookie
    response.cookies.set({
      name: COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch (error: any) {
    console.error('Login error:', error);
    return apiError('INTERNAL_ERROR', 'Failed to authenticate user', 500);
  }
}
