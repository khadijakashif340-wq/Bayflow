import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiSuccess, apiError } from '@/lib/api-response';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ shopId: string }> }
) {
  try {
    const { shopId } = await params;

    const services = await prisma.service.findMany({
      where: {
        shopId,
        isActive: true,
      },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });

    return apiSuccess(services);
  } catch (error: any) {
    console.error('Error fetching shop services:', error);
    return apiError('INTERNAL_ERROR', 'Failed to retrieve shop services', 500);
  }
}
