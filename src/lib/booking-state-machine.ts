import { BookingStatus, ShopRole, AuditRole, PrismaClient } from '@prisma/client';

export class StateMachineConflictError extends Error {
  statusCode: number;
  code: string;
  fromStatus: BookingStatus;
  toStatus: BookingStatus;

  constructor(message: string, fromStatus: BookingStatus, toStatus: BookingStatus) {
    super(message);
    this.name = 'StateMachineConflictError';
    this.statusCode = 409;
    this.code = 'INVALID_STATE_TRANSITION';
    this.fromStatus = fromStatus;
    this.toStatus = toStatus;
  }
}

export class StateMachineForbiddenError extends Error {
  statusCode: number;
  code: string;

  constructor(message: string) {
    super(message);
    this.name = 'StateMachineForbiddenError';
    this.statusCode = 403;
    this.code = 'ROLE_NOT_AUTHORIZED';
  }
}

export type TransitionRule = {
  from: BookingStatus;
  to: BookingStatus;
  allowedRoles: AuditRole[];
  description: string;
  condition?: (context: TransitionContext) => boolean | string; // Returns true or error message
};

export type TransitionContext = {
  actorUserId: string;
  actorRole: AuditRole;
  booking: {
    id: string;
    shopId: string;
    customerId: string;
    status: BookingStatus;
    assignedAdvisorId?: string | null;
    assignedTechnicianId?: string | null;
    assignedPartsPersonId?: string | null;
    qcInspectorId?: string | null;
  };
  note?: string;
  qcIssue?: {
    title: string;
    description: string;
  };
};

// States that occur before repair starts where cancellation is legally allowed
export const PRE_REPAIR_STATUSES: readonly BookingStatus[] = [
  BookingStatus.PENDING,
  BookingStatus.CONFIRMED,
  BookingStatus.ASSIGNED,
  BookingStatus.INSPECTING,
  BookingStatus.ESTIMATE_REVIEW,
  BookingStatus.AWAITING_CUSTOMER,
  BookingStatus.ESTIMATE_APPROVED,
  BookingStatus.ESTIMATE_REJECTED,
  BookingStatus.PARTS_PENDING,
  BookingStatus.PARTS_ORDERED,
  BookingStatus.PARTS_READY,
] as const;

export const TRANSITION_RULES: TransitionRule[] = [
  // 1. PENDING -> CONFIRMED
  {
    from: BookingStatus.PENDING,
    to: BookingStatus.CONFIRMED,
    allowedRoles: [AuditRole.SERVICE_ADVISOR, AuditRole.OWNER],
    description: 'Service Advisor confirms appointment and slot availability',
  },
  // 2. CONFIRMED -> ASSIGNED
  {
    from: BookingStatus.CONFIRMED,
    to: BookingStatus.ASSIGNED,
    allowedRoles: [AuditRole.SERVICE_ADVISOR, AuditRole.OWNER],
    description: 'Service Advisor assigns Technician to the booking',
  },
  // 3. ASSIGNED -> INSPECTING
  {
    from: BookingStatus.ASSIGNED,
    to: BookingStatus.INSPECTING,
    allowedRoles: [AuditRole.TECHNICIAN, AuditRole.OWNER],
    description: 'Technician begins initial vehicle diagnosis and inspection',
  },
  // 4. INSPECTING -> ESTIMATE_REVIEW (Only assigned technician or owner)
  {
    from: BookingStatus.INSPECTING,
    to: BookingStatus.ESTIMATE_REVIEW,
    allowedRoles: [AuditRole.TECHNICIAN, AuditRole.OWNER],
    description: 'Technician completes inspection; Service Advisor reviews estimate',
    condition: (ctx) => {
      if (ctx.actorRole === AuditRole.OWNER) return true;
      if (ctx.booking.assignedTechnicianId && ctx.booking.assignedTechnicianId !== ctx.actorUserId) {
        return 'Only the technician assigned to this booking can complete inspection';
      }
      return true;
    },
  },
  // 5. ESTIMATE_REVIEW -> AWAITING_CUSTOMER
  {
    from: BookingStatus.ESTIMATE_REVIEW,
    to: BookingStatus.AWAITING_CUSTOMER,
    allowedRoles: [AuditRole.SERVICE_ADVISOR, AuditRole.OWNER],
    description: 'Service Advisor sends estimate to customer for review',
  },
  // 6. AWAITING_CUSTOMER -> ESTIMATE_APPROVED (CUSTOMER ONLY, no SA/Owner override)
  {
    from: BookingStatus.AWAITING_CUSTOMER,
    to: BookingStatus.ESTIMATE_APPROVED,
    allowedRoles: [AuditRole.CUSTOMER],
    description: 'Customer accepts and approves the estimate',
    condition: (ctx) => {
      if (ctx.booking.customerId !== ctx.actorUserId) {
        return 'Only the customer who owns this booking can approve the estimate';
      }
      return true;
    },
  },
  // 7. AWAITING_CUSTOMER -> ESTIMATE_REJECTED (CUSTOMER ONLY, no SA/Owner override)
  {
    from: BookingStatus.AWAITING_CUSTOMER,
    to: BookingStatus.ESTIMATE_REJECTED,
    allowedRoles: [AuditRole.CUSTOMER],
    description: 'Customer declines the estimate',
    condition: (ctx) => {
      if (ctx.booking.customerId !== ctx.actorUserId) {
        return 'Only the customer who owns this booking can reject the estimate';
      }
      return true;
    },
  },
  // 8. ESTIMATE_REJECTED -> ESTIMATE_REVIEW (SA revises estimate, revision +1)
  {
    from: BookingStatus.ESTIMATE_REJECTED,
    to: BookingStatus.ESTIMATE_REVIEW,
    allowedRoles: [AuditRole.SERVICE_ADVISOR, AuditRole.OWNER],
    description: 'Service Advisor revises estimate after customer feedback',
  },
  // 9. ESTIMATE_APPROVED -> PARTS_PENDING
  {
    from: BookingStatus.ESTIMATE_APPROVED,
    to: BookingStatus.PARTS_PENDING,
    allowedRoles: [AuditRole.SERVICE_ADVISOR, AuditRole.PARTS_PERSON, AuditRole.OWNER],
    description: 'Parts Person checks inventory requirements',
  },
  // 10. PARTS_PENDING -> PARTS_READY (In-stock parts allocated directly)
  {
    from: BookingStatus.PARTS_PENDING,
    to: BookingStatus.PARTS_READY,
    allowedRoles: [AuditRole.PARTS_PERSON, AuditRole.OWNER],
    description: 'All required parts are in stock and allocated',
  },
  // 11. PARTS_PENDING -> PARTS_ORDERED (PO created for missing parts)
  {
    from: BookingStatus.PARTS_PENDING,
    to: BookingStatus.PARTS_ORDERED,
    allowedRoles: [AuditRole.PARTS_PERSON, AuditRole.OWNER],
    description: 'Purchase Order created for missing parts',
  },
  // 12. PARTS_ORDERED -> PARTS_ORDERED (Partial receipt of PO)
  {
    from: BookingStatus.PARTS_ORDERED,
    to: BookingStatus.PARTS_ORDERED,
    allowedRoles: [AuditRole.PARTS_PERSON, AuditRole.OWNER],
    description: 'Partial parts received; waiting for complete order',
  },
  // 13. PARTS_ORDERED -> PARTS_READY (All parts received & allocated)
  {
    from: BookingStatus.PARTS_ORDERED,
    to: BookingStatus.PARTS_READY,
    allowedRoles: [AuditRole.PARTS_PERSON, AuditRole.OWNER],
    description: 'All ordered parts received and allocated to booking',
  },
  // 14. PARTS_READY -> IN_REPAIR
  {
    from: BookingStatus.PARTS_READY,
    to: BookingStatus.IN_REPAIR,
    allowedRoles: [AuditRole.TECHNICIAN, AuditRole.OWNER],
    description: 'Technician begins repair work with ready parts',
  },
  // 15. IN_REPAIR -> QC_PENDING
  {
    from: BookingStatus.IN_REPAIR,
    to: BookingStatus.QC_PENDING,
    allowedRoles: [AuditRole.TECHNICIAN, AuditRole.OWNER],
    description: 'Technician completes repairs; submits vehicle to QC queue',
  },
  // 16. QC_PENDING -> QC_IN_PROGRESS (Atomic job lock by QC Inspector)
  {
    from: BookingStatus.QC_PENDING,
    to: BookingStatus.QC_IN_PROGRESS,
    allowedRoles: [AuditRole.QC_INSPECTOR, AuditRole.OWNER],
    description: 'QC Inspector claims the job and begins testing',
  },
  // 17. QC_IN_PROGRESS -> IN_REPAIR (Failed QC loop! Creates QCIssue)
  {
    from: BookingStatus.QC_IN_PROGRESS,
    to: BookingStatus.IN_REPAIR,
    allowedRoles: [AuditRole.QC_INSPECTOR, AuditRole.OWNER],
    description: 'QC failed; creates QCIssue and loops back to technician for rework',
    condition: (ctx) => {
      if (!ctx.qcIssue || !ctx.qcIssue.title || !ctx.qcIssue.description) {
        return 'A QC issue with title and description is required when failing inspection';
      }
      return true;
    },
  },
  // 18. QC_IN_PROGRESS -> READY_FOR_PICKUP (Passed QC)
  {
    from: BookingStatus.QC_IN_PROGRESS,
    to: BookingStatus.READY_FOR_PICKUP,
    allowedRoles: [AuditRole.QC_INSPECTOR, AuditRole.OWNER],
    description: 'QC inspection passed; vehicle ready for customer pickup',
  },
  // 19. READY_FOR_PICKUP -> COMPLETED (Customer mark picked up, or Service Advisor / Owner)
  {
    from: BookingStatus.READY_FOR_PICKUP,
    to: BookingStatus.COMPLETED,
    allowedRoles: [AuditRole.CUSTOMER, AuditRole.SERVICE_ADVISOR, AuditRole.OWNER],
    description: 'Customer marked picked up, or Service Advisor marked complete & payment settled',
    condition: (ctx) => {
      if (ctx.actorRole === AuditRole.CUSTOMER && ctx.booking.customerId !== ctx.actorUserId) {
        return 'Only the customer for this booking can confirm pickup';
      }
      return true;
    },
  },
  // 20. Cancellation rules: Allowed ONLY before IN_REPAIR
  ...PRE_REPAIR_STATUSES.map(
    (status): TransitionRule => ({
      from: status,
      to: BookingStatus.CANCELLED,
      allowedRoles:
        status === BookingStatus.PENDING ||
        status === BookingStatus.CONFIRMED ||
        status === BookingStatus.AWAITING_CUSTOMER
          ? [AuditRole.CUSTOMER, AuditRole.SERVICE_ADVISOR, AuditRole.OWNER]
          : [AuditRole.SERVICE_ADVISOR, AuditRole.OWNER],
      description: `Booking cancelled from ${status}; releases any allocated parts`,
      condition: (ctx) => {
        if (ctx.actorRole === AuditRole.CUSTOMER && ctx.booking.customerId !== ctx.actorUserId) {
          return 'Only the customer who owns this booking can cancel it';
        }
        return true;
      },
    })
  ),
];

/**
 * Validates whether a transition from `from` to `to` by `actorRole` is allowed under `context`.
 */
export function validateTransition(
  from: BookingStatus,
  to: BookingStatus,
  actorRole: AuditRole,
  context: TransitionContext
): { valid: true; rule: TransitionRule } | { valid: false; error: StateMachineConflictError | StateMachineForbiddenError } {
  // Check if target is CANCELLED but booking has already entered or passed IN_REPAIR
  if (to === BookingStatus.CANCELLED && !PRE_REPAIR_STATUSES.includes(from)) {
    return {
      valid: false,
      error: new StateMachineConflictError(
        `Cancellation is prohibited once a vehicle enters IN_REPAIR. Current status: ${from}`,
        from,
        to
      ),
    };
  }

  // Find candidate rules for this from -> to transition
  const matchingRules = TRANSITION_RULES.filter((r) => r.from === from && r.to === to);

  if (matchingRules.length === 0) {
    return {
      valid: false,
      error: new StateMachineConflictError(
        `Invalid status transition from ${from} to ${to}`,
        from,
        to
      ),
    };
  }

  // Check role authorization
  const authorizedRule = matchingRules.find((r) => r.allowedRoles.includes(actorRole));

  if (!authorizedRule) {
    const allowed = Array.from(new Set(matchingRules.flatMap((r) => r.allowedRoles))).join(', ');
    return {
      valid: false,
      error: new StateMachineForbiddenError(
        `Role ${actorRole} is not permitted to transition booking from ${from} to ${to}. Allowed roles: ${allowed}`
      ),
    };
  }

  // Check custom business condition if any
  if (authorizedRule.condition) {
    const condResult = authorizedRule.condition(context);
    if (condResult !== true) {
      return {
        valid: false,
        error: new StateMachineConflictError(
          typeof condResult === 'string' ? condResult : 'Business condition check failed',
          from,
          to
        ),
      };
    }
  }

  return { valid: true, rule: authorizedRule };
}

/**
 * Executes a state transition inside an atomic Prisma transaction.
 * Enforces role guards, 409 conflicts, QC failure logging, inventory release on cancel,
 * and immutable audit logging.
 */
export async function executeBookingTransition(
  prismaClient: PrismaClient,
  params: {
    bookingId: string;
    targetStatus: BookingStatus;
    actorUserId: string;
    actorRole: AuditRole;
    note?: string;
    qcIssue?: {
      title: string;
      description: string;
    };
  }
) {
  const { bookingId, targetStatus, actorUserId, actorRole, note, qcIssue } = params;

  return await prismaClient.$transaction(async (tx) => {
    // 1. Fetch current booking state with pessimistic check
    const booking = await tx.booking.findUnique({
      where: { id: bookingId },
      include: {
        partAllocations: {
          where: { status: 'ALLOCATED' },
        },
      },
    });

    if (!booking) {
      throw new Error(`Booking with id ${bookingId} not found`);
    }

    const context: TransitionContext = {
      actorUserId,
      actorRole,
      booking: {
        id: booking.id,
        shopId: booking.shopId,
        customerId: booking.customerId,
        status: booking.status,
        assignedAdvisorId: booking.assignedAdvisorId,
        assignedTechnicianId: booking.assignedTechnicianId,
        assignedPartsPersonId: booking.assignedPartsPersonId,
        qcInspectorId: booking.qcInspectorId,
      },
      note,
      qcIssue,
    };

    // 2. Validate transition
    const validation = validateTransition(booking.status, targetStatus, actorRole, context);
    if (!validation.valid) {
      throw validation.error;
    }

    // 3. Special handling for QC job claim (QC_PENDING -> QC_IN_PROGRESS)
    const updateData: Record<string, unknown> = {
      status: targetStatus,
    };

    if (booking.status === BookingStatus.QC_PENDING && targetStatus === BookingStatus.QC_IN_PROGRESS) {
      // Atomic claim: if already claimed by someone else, throw conflict
      if (booking.qcInspectorId && booking.qcInspectorId !== actorUserId && actorRole !== AuditRole.OWNER) {
        throw new StateMachineConflictError(
          'This QC job has already been claimed by another inspector',
          booking.status,
          targetStatus
        );
      }
      updateData.qcInspectorId = actorUserId;
    }

    // 4. Special handling for QC Failure (QC_IN_PROGRESS -> IN_REPAIR)
    if (booking.status === BookingStatus.QC_IN_PROGRESS && targetStatus === BookingStatus.IN_REPAIR) {
      if (!qcIssue) {
        throw new StateMachineConflictError(
          'QC issue details required for failed inspection',
          booking.status,
          targetStatus
        );
      }
      await tx.qCIssue.create({
        data: {
          shopId: booking.shopId,
          bookingId: booking.id,
          title: qcIssue.title,
          description: qcIssue.description,
          raisedById: actorUserId,
          resolved: false,
        },
      });
    }

    // 5. Special handling for Cancellation: release active parts allocations
    if (targetStatus === BookingStatus.CANCELLED) {
      for (const allocation of booking.partAllocations) {
        await tx.partAllocation.update({
          where: { id: allocation.id },
          data: { status: 'RELEASED' },
        });

        // Decrement Part.quantityAllocated
        await tx.part.update({
          where: { id: allocation.partId },
          data: {
            quantityAllocated: {
              decrement: allocation.quantity,
            },
          },
        });
      }
    }

    // 6. Update Booking status
    const updatedBooking = await tx.booking.update({
      where: { id: booking.id },
      data: updateData,
    });

    // 7. Write immutable audit log
    await tx.bookingAuditLog.create({
      data: {
        bookingId: booking.id,
        shopId: booking.shopId,
        fromStatus: booking.status,
        toStatus: targetStatus,
        performedById: actorUserId,
        role: actorRole,
        note: note || validation.rule.description,
      },
    });

    return updatedBooking;
  });
}
