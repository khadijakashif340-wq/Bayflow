import { describe, it, expect } from 'vitest';
import {
  BookingStatus,
  AuditRole,
} from '@prisma/client';
import {
  validateTransition,
  StateMachineConflictError,
  StateMachineForbiddenError,
  PRE_REPAIR_STATUSES,
  TransitionContext,
} from '../booking-state-machine';

describe('Booking State Machine - Transition Engine', () => {
  const baseContext: TransitionContext = {
    actorUserId: 'user-tech-1',
    actorRole: AuditRole.TECHNICIAN,
    booking: {
      id: 'booking-1',
      shopId: 'shop-lahore-1',
      customerId: 'user-customer-1',
      status: BookingStatus.PENDING,
      assignedTechnicianId: 'user-tech-1',
      assignedAdvisorId: 'user-sa-1',
      assignedPartsPersonId: 'user-parts-1',
      qcInspectorId: 'user-qc-1',
    },
  };

  describe('Happy Path Lifecycle & Role Permissions', () => {
    it('allows Service Advisor to confirm PENDING -> CONFIRMED', () => {
      const result = validateTransition(
        BookingStatus.PENDING,
        BookingStatus.CONFIRMED,
        AuditRole.SERVICE_ADVISOR,
        { ...baseContext, actorRole: AuditRole.SERVICE_ADVISOR }
      );
      expect(result.valid).toBe(true);
    });

    it('denies Customer from confirming PENDING -> CONFIRMED (403)', () => {
      const result = validateTransition(
        BookingStatus.PENDING,
        BookingStatus.CONFIRMED,
        AuditRole.CUSTOMER,
        { ...baseContext, actorRole: AuditRole.CUSTOMER }
      );
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBeInstanceOf(StateMachineForbiddenError);
        expect(result.error.statusCode).toBe(403);
      }
    });

    it('allows Service Advisor to assign CONFIRMED -> ASSIGNED', () => {
      const result = validateTransition(
        BookingStatus.CONFIRMED,
        BookingStatus.ASSIGNED,
        AuditRole.SERVICE_ADVISOR,
        { ...baseContext, actorRole: AuditRole.SERVICE_ADVISOR }
      );
      expect(result.valid).toBe(true);
    });

    it('allows Technician to start inspection ASSIGNED -> INSPECTING', () => {
      const result = validateTransition(
        BookingStatus.ASSIGNED,
        BookingStatus.INSPECTING,
        AuditRole.TECHNICIAN,
        { ...baseContext, actorRole: AuditRole.TECHNICIAN }
      );
      expect(result.valid).toBe(true);
    });

    it('allows ONLY assigned Technician to move INSPECTING -> ESTIMATE_REVIEW', () => {
      // Assigned tech succeeds
      const resultAssigned = validateTransition(
        BookingStatus.INSPECTING,
        BookingStatus.ESTIMATE_REVIEW,
        AuditRole.TECHNICIAN,
        { ...baseContext, actorUserId: 'user-tech-1' }
      );
      expect(resultAssigned.valid).toBe(true);

      // Unassigned tech fails condition
      const resultUnassigned = validateTransition(
        BookingStatus.INSPECTING,
        BookingStatus.ESTIMATE_REVIEW,
        AuditRole.TECHNICIAN,
        { ...baseContext, actorUserId: 'different-tech-99' }
      );
      expect(resultUnassigned.valid).toBe(false);
      if (!resultUnassigned.valid) {
        expect(resultUnassigned.error).toBeInstanceOf(StateMachineConflictError);
        expect(resultUnassigned.error.message).toContain('Only the technician assigned');
      }
    });

    it('allows SA to send estimate: ESTIMATE_REVIEW -> AWAITING_CUSTOMER', () => {
      const result = validateTransition(
        BookingStatus.ESTIMATE_REVIEW,
        BookingStatus.AWAITING_CUSTOMER,
        AuditRole.SERVICE_ADVISOR,
        { ...baseContext, actorRole: AuditRole.SERVICE_ADVISOR }
      );
      expect(result.valid).toBe(true);
    });

    it('enforces CUSTOMER ONLY for AWAITING_CUSTOMER -> ESTIMATE_APPROVED (No SA/Owner override)', () => {
      // Customer succeeds
      const resultCustomer = validateTransition(
        BookingStatus.AWAITING_CUSTOMER,
        BookingStatus.ESTIMATE_APPROVED,
        AuditRole.CUSTOMER,
        {
          ...baseContext,
          actorUserId: 'user-customer-1',
          actorRole: AuditRole.CUSTOMER,
        }
      );
      expect(resultCustomer.valid).toBe(true);

      // Service Advisor fails (role forbidden)
      const resultSA = validateTransition(
        BookingStatus.AWAITING_CUSTOMER,
        BookingStatus.ESTIMATE_APPROVED,
        AuditRole.SERVICE_ADVISOR,
        { ...baseContext, actorRole: AuditRole.SERVICE_ADVISOR }
      );
      expect(resultSA.valid).toBe(false);
      if (!resultSA.valid) {
        expect(resultSA.error).toBeInstanceOf(StateMachineForbiddenError);
      }

      // Owner fails (role forbidden)
      const resultOwner = validateTransition(
        BookingStatus.AWAITING_CUSTOMER,
        BookingStatus.ESTIMATE_APPROVED,
        AuditRole.OWNER,
        { ...baseContext, actorRole: AuditRole.OWNER }
      );
      expect(resultOwner.valid).toBe(false);
      if (!resultOwner.valid) {
        expect(resultOwner.error).toBeInstanceOf(StateMachineForbiddenError);
      }
    });

    it('enforces CUSTOMER ONLY for AWAITING_CUSTOMER -> ESTIMATE_REJECTED', () => {
      const result = validateTransition(
        BookingStatus.AWAITING_CUSTOMER,
        BookingStatus.ESTIMATE_REJECTED,
        AuditRole.CUSTOMER,
        {
          ...baseContext,
          actorUserId: 'user-customer-1',
          actorRole: AuditRole.CUSTOMER,
        }
      );
      expect(result.valid).toBe(true);
    });

    it('allows SA to revise estimate after rejection: ESTIMATE_REJECTED -> ESTIMATE_REVIEW', () => {
      const result = validateTransition(
        BookingStatus.ESTIMATE_REJECTED,
        BookingStatus.ESTIMATE_REVIEW,
        AuditRole.SERVICE_ADVISOR,
        { ...baseContext, actorRole: AuditRole.SERVICE_ADVISOR }
      );
      expect(result.valid).toBe(true);
    });

    it('allows Parts Person transitions: PARTS_PENDING -> PARTS_READY directly when stock is available', () => {
      const result = validateTransition(
        BookingStatus.PARTS_PENDING,
        BookingStatus.PARTS_READY,
        AuditRole.PARTS_PERSON,
        { ...baseContext, actorRole: AuditRole.PARTS_PERSON }
      );
      expect(result.valid).toBe(true);
    });

    it('allows Parts Person transitions: PARTS_PENDING -> PARTS_ORDERED when PO is created', () => {
      const result = validateTransition(
        BookingStatus.PARTS_PENDING,
        BookingStatus.PARTS_ORDERED,
        AuditRole.PARTS_PERSON,
        { ...baseContext, actorRole: AuditRole.PARTS_PERSON }
      );
      expect(result.valid).toBe(true);
    });

    it('allows PARTS_ORDERED -> PARTS_ORDERED for partial PO receipts', () => {
      const result = validateTransition(
        BookingStatus.PARTS_ORDERED,
        BookingStatus.PARTS_ORDERED,
        AuditRole.PARTS_PERSON,
        { ...baseContext, actorRole: AuditRole.PARTS_PERSON }
      );
      expect(result.valid).toBe(true);
    });

    it('allows PARTS_READY -> IN_REPAIR by Technician', () => {
      const result = validateTransition(
        BookingStatus.PARTS_READY,
        BookingStatus.IN_REPAIR,
        AuditRole.TECHNICIAN,
        { ...baseContext, actorRole: AuditRole.TECHNICIAN }
      );
      expect(result.valid).toBe(true);
    });

    it('allows IN_REPAIR -> QC_PENDING by Technician', () => {
      const result = validateTransition(
        BookingStatus.IN_REPAIR,
        BookingStatus.QC_PENDING,
        AuditRole.TECHNICIAN,
        { ...baseContext, actorRole: AuditRole.TECHNICIAN }
      );
      expect(result.valid).toBe(true);
    });

    it('allows QC Inspector to claim job: QC_PENDING -> QC_IN_PROGRESS', () => {
      const result = validateTransition(
        BookingStatus.QC_PENDING,
        BookingStatus.QC_IN_PROGRESS,
        AuditRole.QC_INSPECTOR,
        { ...baseContext, actorRole: AuditRole.QC_INSPECTOR }
      );
      expect(result.valid).toBe(true);
    });

    it('QC Failed Loop: QC_IN_PROGRESS -> IN_REPAIR requires QCIssue details', () => {
      // Without QCIssue details -> fails
      const resultNoIssue = validateTransition(
        BookingStatus.QC_IN_PROGRESS,
        BookingStatus.IN_REPAIR,
        AuditRole.QC_INSPECTOR,
        { ...baseContext, actorRole: AuditRole.QC_INSPECTOR }
      );
      expect(resultNoIssue.valid).toBe(false);
      if (!resultNoIssue.valid) {
        expect(resultNoIssue.error.message).toContain('QC issue with title and description is required');
      }

      // With QCIssue details -> succeeds
      const resultWithIssue = validateTransition(
        BookingStatus.QC_IN_PROGRESS,
        BookingStatus.IN_REPAIR,
        AuditRole.QC_INSPECTOR,
        {
          ...baseContext,
          actorRole: AuditRole.QC_INSPECTOR,
          qcIssue: {
            title: 'Brake fluid leak detected',
            description: 'Rear caliper fitting is leaking fluid under pressure test',
          },
        }
      );
      expect(resultWithIssue.valid).toBe(true);
    });

    it('QC Passed: QC_IN_PROGRESS -> READY_FOR_PICKUP', () => {
      const result = validateTransition(
        BookingStatus.QC_IN_PROGRESS,
        BookingStatus.READY_FOR_PICKUP,
        AuditRole.QC_INSPECTOR,
        { ...baseContext, actorRole: AuditRole.QC_INSPECTOR }
      );
      expect(result.valid).toBe(true);
    });

    it('READY_FOR_PICKUP -> COMPLETED allows Customer or Service Advisor', () => {
      // Customer confirmation
      const resultCust = validateTransition(
        BookingStatus.READY_FOR_PICKUP,
        BookingStatus.COMPLETED,
        AuditRole.CUSTOMER,
        {
          ...baseContext,
          actorUserId: 'user-customer-1',
          actorRole: AuditRole.CUSTOMER,
        }
      );
      expect(resultCust.valid).toBe(true);

      // SA confirmation
      const resultSA = validateTransition(
        BookingStatus.READY_FOR_PICKUP,
        BookingStatus.COMPLETED,
        AuditRole.SERVICE_ADVISOR,
        { ...baseContext, actorRole: AuditRole.SERVICE_ADVISOR }
      );
      expect(resultSA.valid).toBe(true);
    });
  });

  describe('Cancellation Rules', () => {
    it('allows cancellation from all pre-repair statuses', () => {
      for (const status of PRE_REPAIR_STATUSES) {
        const result = validateTransition(
          status,
          BookingStatus.CANCELLED,
          AuditRole.SERVICE_ADVISOR,
          { ...baseContext, actorRole: AuditRole.SERVICE_ADVISOR }
        );
        expect(result.valid).toBe(true);
      }
    });

    it('STRICTLY FORBIDS cancellation once IN_REPAIR or after (409 Conflict)', () => {
      const postRepairStatuses = [
        BookingStatus.IN_REPAIR,
        BookingStatus.QC_PENDING,
        BookingStatus.QC_IN_PROGRESS,
        BookingStatus.READY_FOR_PICKUP,
        BookingStatus.COMPLETED,
      ];

      for (const status of postRepairStatuses) {
        const result = validateTransition(
          status,
          BookingStatus.CANCELLED,
          AuditRole.SERVICE_ADVISOR,
          { ...baseContext, actorRole: AuditRole.SERVICE_ADVISOR }
        );
        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.error).toBeInstanceOf(StateMachineConflictError);
          expect(result.error.statusCode).toBe(409);
          expect(result.error.message).toContain('Cancellation is prohibited once a vehicle enters IN_REPAIR');
        }
      }
    });
  });

  describe('Invalid Status Jumps (409 Conflict)', () => {
    it('rejects jumping from PENDING directly to IN_REPAIR with 409', () => {
      const result = validateTransition(
        BookingStatus.PENDING,
        BookingStatus.IN_REPAIR,
        AuditRole.TECHNICIAN,
        { ...baseContext, actorRole: AuditRole.TECHNICIAN }
      );
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBeInstanceOf(StateMachineConflictError);
        expect(result.error.statusCode).toBe(409);
      }
    });

    it('rejects jumping from QC_PENDING directly to COMPLETED with 409', () => {
      const result = validateTransition(
        BookingStatus.QC_PENDING,
        BookingStatus.COMPLETED,
        AuditRole.SERVICE_ADVISOR,
        { ...baseContext, actorRole: AuditRole.SERVICE_ADVISOR }
      );
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBeInstanceOf(StateMachineConflictError);
        expect(result.error.statusCode).toBe(409);
      }
    });
  });
});
