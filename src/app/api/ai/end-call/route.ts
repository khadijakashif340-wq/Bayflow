import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { errorResponse, successResponse } from '@/lib/api-response';
import { TaskPriority, TaskStatus } from '@prisma/client';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      shopId,
      bookingId,
      bookingNumber,
      callerPhone,
      callerName,
      transcript,
      durationSeconds = 45,
    } = body as {
      shopId?: string;
      bookingId?: string;
      bookingNumber?: string;
      callerPhone?: string;
      callerName?: string;
      transcript: string;
      durationSeconds?: number;
    };

    if (!transcript) {
      return errorResponse('INVALID_PAYLOAD', 'Transcript is required to summarize call', 400);
    }

    // 1. Resolve Target Shop & Booking
    let targetShopId = shopId;
    let targetBookingId = bookingId;

    if (!targetBookingId && bookingNumber) {
      const foundBooking = await prisma.booking.findFirst({
        where: { bookingNumber: { contains: bookingNumber.trim(), mode: 'insensitive' } },
        select: { id: true, shopId: true },
      });
      if (foundBooking) {
        targetBookingId = foundBooking.id;
        if (!targetShopId) targetShopId = foundBooking.shopId;
      }
    }

    if (!targetShopId) {
      // Pick the first available workshop (e.g. Lahore Central)
      const defaultShop = await prisma.shop.findFirst({
        select: { id: true },
      });
      if (defaultShop) targetShopId = defaultShop.id;
      else return errorResponse('SHOP_REQUIRED', 'Valid shopId required', 400);
    }

    // 2. Generate Intelligent Call Summary & Action Item Tasks
    const lines = transcript.split('\n').filter((l) => l.trim().length > 0);
    const summaryLines: string[] = [];

    const isEstimateQuery = transcript.toLowerCase().includes('estimate') || transcript.toLowerCase().includes('cost');
    const isStatusQuery = transcript.toLowerCase().includes('status') || transcript.toLowerCase().includes('ready');
    const isUrgent = transcript.toLowerCase().includes('urgent') || transcript.toLowerCase().includes('asap') || transcript.toLowerCase().includes('emergency');

    summaryLines.push(`Customer ${callerName || 'Inquirer'} (${callerPhone || 'Phone unlisted'}) contacted BayFlow AI Front Desk.`);
    if (isEstimateQuery) summaryLines.push('Requested itemized parts & labor quotation breakdown in PKR.');
    if (isStatusQuery) summaryLines.push('Inquired regarding vehicle progress along the 17-status repair lifecycle.');
    summaryLines.push(`Call concluded normally after ${durationSeconds} seconds.`);

    const callSummary = summaryLines.join(' ');

    // 3. Create AICallLog in Database
    const aiCallLog = await prisma.aICallLog.create({
      data: {
        shopId: targetShopId,
        bookingId: targetBookingId || null,
        callerPhone: callerPhone || '+92 300 1234567',
        callerName: callerName || 'Customer Inquiry',
        transcript,
        summary: callSummary,
        durationSeconds,
      },
    });

    // 4. Create Generated AITasks
    const tasksToCreate = [];

    if (isEstimateQuery) {
      tasksToCreate.push({
        shopId: targetShopId,
        bookingId: targetBookingId || null,
        callLogId: aiCallLog.id,
        title: `Follow up with customer on Estimate quotation`,
        description: `Customer inquired about estimate details. Review parts pricing and check customer approval status on booking portal.`,
        priority: isUrgent ? TaskPriority.HIGH : TaskPriority.MEDIUM,
        status: TaskStatus.PENDING,
      });
    }

    if (isStatusQuery || tasksToCreate.length === 0) {
      tasksToCreate.push({
        shopId: targetShopId,
        bookingId: targetBookingId || null,
        callLogId: aiCallLog.id,
        title: `Service Advisor Callback: ${callerName || 'Customer'}`,
        description: `Automated follow-up task logged by AI Front Desk. Confirm vehicle completion timeline and notify customer upon QC pass.`,
        priority: isUrgent ? TaskPriority.URGENT : TaskPriority.MEDIUM,
        status: TaskStatus.PENDING,
      });
    }

    const createdTasks = [];
    for (const taskData of tasksToCreate) {
      const created = await prisma.aITask.create({
        data: taskData,
      });
      createdTasks.push(created);
    }

    // 5. Create Staff Notification for immediate visibility
    await prisma.notification.create({
      data: {
        shopId: targetShopId,
        title: `AI Front Desk: New Call Log & Task (${callerName || 'Inquiry'})`,
        message: callSummary,
        type: 'AI_DISPATCH',
        bookingId: targetBookingId || null,
        link: `/pos/ai-logs`,
      },
    });

    return successResponse({
      callLog: aiCallLog,
      tasks: createdTasks,
      summary: callSummary,
    });
  } catch (error: any) {
    console.error('End call error:', error);
    return errorResponse('END_CALL_ERROR', error.message || 'Error saving call log', 500);
  }
}
