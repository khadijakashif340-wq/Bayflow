import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { errorResponse, successResponse } from '@/lib/api-response';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const shopId = searchParams.get('shopId');

    const whereClause = shopId ? { shopId } : {};

    const [callLogs, tasks] = await Promise.all([
      prisma.aICallLog.findMany({
        where: whereClause,
        include: {
          shop: { select: { name: true, city: true } },
          booking: {
            select: {
              bookingNumber: true,
              licensePlate: true,
              vehicleMake: true,
              vehicleModel: true,
              status: true,
            },
          },
          tasks: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
      prisma.aITask.findMany({
        where: whereClause,
        include: {
          shop: { select: { name: true } },
          booking: {
            select: {
              bookingNumber: true,
              licensePlate: true,
              vehicleModel: true,
              status: true,
            },
          },
          callLog: {
            select: {
              callerName: true,
              callerPhone: true,
              summary: true,
            },
          },
        },
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        take: 50,
      }),
    ]);

    return successResponse({
      callLogs,
      tasks,
    });
  } catch (error: any) {
    console.error('Fetch AI logs error:', error);
    return errorResponse('FETCH_AI_LOGS_ERROR', error.message || 'Error fetching AI logs', 500);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { taskId, status } = body;

    if (!taskId || !status) {
      return errorResponse('INVALID_PAYLOAD', 'taskId and status are required', 400);
    }

    const updated = await prisma.aITask.update({
      where: { id: taskId },
      data: { status },
    });

    return successResponse(updated);
  } catch (error: any) {
    console.error('Update AI task error:', error);
    return errorResponse('UPDATE_AI_TASK_ERROR', error.message || 'Error updating AI task', 500);
  }
}
