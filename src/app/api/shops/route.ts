import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiSuccess, apiError } from '@/lib/api-response';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const city = searchParams.get('city');
    const query = searchParams.get('query');

    const whereClause: Record<string, unknown> = {};

    if (city && city !== 'All') {
      whereClause.city = { equals: city, mode: 'insensitive' };
    }

    if (query && query.trim() !== '') {
      whereClause.OR = [
        { name: { contains: query.trim(), mode: 'insensitive' } },
        { address: { contains: query.trim(), mode: 'insensitive' } },
        { description: { contains: query.trim(), mode: 'insensitive' } },
      ];
    }

    const shops = await prisma.shop.findMany({
      where: whereClause,
      include: {
        _count: {
          select: {
            services: true,
            members: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return apiSuccess(shops);
  } catch (error: any) {
    console.error('Error fetching shops:', error);
    return apiError('INTERNAL_ERROR', 'Failed to retrieve shops', 500);
  }
}
