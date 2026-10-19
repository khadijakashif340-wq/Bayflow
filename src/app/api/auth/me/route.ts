import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser, COOKIE_NAME } from '@/lib/auth';
import { apiSuccess, apiError } from '@/lib/api-response';

export async function GET(_req: NextRequest) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return apiError('UNAUTHORIZED', 'Not authenticated', 401);
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
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
                address: true,
                phone: true,
                openTime: true,
                closeTime: true,
                workingDays: true,
                maxParallelSlots: true,
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
            address: true,
            phone: true,
            openTime: true,
            closeTime: true,
            workingDays: true,
            maxParallelSlots: true,
          },
        },
      },
    });

    if (!user) {
      return apiError('NOT_FOUND', 'User record not found', 404);
    }

    return apiSuccess({
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      userType: user.userType,
      memberships: user.memberships.map((m) => ({
        id: m.id,
        shopId: m.shopId,
        shopName: m.shop.name,
        shopCity: m.shop.city,
        role: m.role,
        shop: m.shop,
      })),
      ownedShops: user.ownedShops,
    });
  } catch (error: any) {
    console.error('Session error:', error);
    return apiError('INTERNAL_ERROR', 'Failed to retrieve active session', 500);
  }
}

export async function POST(_req: NextRequest) {
  const response = apiSuccess({ message: 'Logged out successfully' });
  response.cookies.delete(COOKIE_NAME);
  return response;
}
