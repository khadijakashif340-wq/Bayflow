import { describe, it, expect, vi } from 'vitest';
import {
  BookingStatus,
  AuditRole,
  ShopRole,
} from '@prisma/client';
import {
  validateTransition,
  executeBookingTransition,
  StateMachineConflictError,
  StateMachineForbiddenError,
  PRE_REPAIR_STATUSES,
  TransitionContext,
} from '../booking-state-machine';
import { verifyTenantAccess, TenantAccessError } from '../tenant-guard';

describe('Full-Flow Auto Repair Lifecycle Integration Tests', () => {
  const shopId = 'shop-lahore-central-001';
  const otherShopId = 'shop-karachi-hub-002';

  const customerId = 'user-customer-ahmed';
  const advisorId = 'user-sa-bilal';
  const technicianId = 'user-tech-tariq';
  const partsPersonId = 'user-parts-zubair';
  const qcInspectorId = 'user-qc-hamza';
  const otherTechId = 'user-tech-wrong';

  const bookingId = 'booking-civic-1001';

  let currentStatus: BookingStatus = BookingStatus.PENDING;
  let assignedTech: string | null = null;
  let claimedQC: string | null = null;

  function getContext(actorUserId: string, actorRole: AuditRole, extra?: Partial<TransitionContext>): TransitionContext {
    return {
      actorUserId,
      actorRole,
      booking: {
        id: bookingId,
        shopId,
        customerId,
        status: currentStatus,
        assignedAdvisorId: advisorId,
        assignedTechnicianId: assignedTech,
        assignedPartsPersonId: partsPersonId,
        qcInspectorId: claimedQC,
      },
      ...extra,
    };
  }

  describe('Complete 17-Status State Machine Workflow Execution', () => {
    it('Step 1: Service Advisor confirms appointment (PENDING -> CONFIRMED)', () => {
      const res = validateTransition(
        BookingStatus.PENDING,
        BookingStatus.CONFIRMED,
        AuditRole.SERVICE_ADVISOR,
        getContext(advisorId, AuditRole.SERVICE_ADVISOR)
      );
      expect(res.valid).toBe(true);
      currentStatus = BookingStatus.CONFIRMED;
    });

    it('Step 2: Service Advisor assigns Technician (CONFIRMED -> ASSIGNED)', () => {
      const res = validateTransition(
        BookingStatus.CONFIRMED,
        BookingStatus.ASSIGNED,
        AuditRole.SERVICE_ADVISOR,
        getContext(advisorId, AuditRole.SERVICE_ADVISOR)
      );
      expect(res.valid).toBe(true);
      currentStatus = BookingStatus.ASSIGNED;
      assignedTech = technicianId;
    });

    it('Step 3: Assigned Technician begins diagnosis (ASSIGNED -> INSPECTING)', () => {
      const res = validateTransition(
        BookingStatus.ASSIGNED,
        BookingStatus.INSPECTING,
        AuditRole.TECHNICIAN,
        getContext(technicianId, AuditRole.TECHNICIAN)
      );
      expect(res.valid).toBe(true);
      currentStatus = BookingStatus.INSPECTING;
    });

    it('Step 4a: Non-assigned tech fails to complete inspection (409 Conflict)', () => {
      const res = validateTransition(
        BookingStatus.INSPECTING,
        BookingStatus.ESTIMATE_REVIEW,
        AuditRole.TECHNICIAN,
        getContext(otherTechId, AuditRole.TECHNICIAN)
      );
      expect(res.valid).toBe(false);
      if (!res.valid) {
        expect(res.error).toBeInstanceOf(StateMachineConflictError);
        expect(res.error.statusCode).toBe(409);
        expect(res.error.message).toContain('Only the technician assigned');
      }
    });

    it('Step 4b: Assigned Technician finishes inspection (INSPECTING -> ESTIMATE_REVIEW)', () => {
      const res = validateTransition(
        BookingStatus.INSPECTING,
        BookingStatus.ESTIMATE_REVIEW,
        AuditRole.TECHNICIAN,
        getContext(technicianId, AuditRole.TECHNICIAN)
      );
      expect(res.valid).toBe(true);
      currentStatus = BookingStatus.ESTIMATE_REVIEW;
    });

    it('Step 5: Service Advisor reviews and sends estimate to customer (ESTIMATE_REVIEW -> AWAITING_CUSTOMER)', () => {
      const res = validateTransition(
        BookingStatus.ESTIMATE_REVIEW,
        BookingStatus.AWAITING_CUSTOMER,
        AuditRole.SERVICE_ADVISOR,
        getContext(advisorId, AuditRole.SERVICE_ADVISOR)
      );
      expect(res.valid).toBe(true);
      currentStatus = BookingStatus.AWAITING_CUSTOMER;
    });

    it('Step 6a: Service Advisor or Tech CANNOT approve estimate (CUSTOMER ONLY)', () => {
      const resAdvisor = validateTransition(
        BookingStatus.AWAITING_CUSTOMER,
        BookingStatus.ESTIMATE_APPROVED,
        AuditRole.SERVICE_ADVISOR,
        getContext(advisorId, AuditRole.SERVICE_ADVISOR)
      );
      expect(resAdvisor.valid).toBe(false);

      const resTech = validateTransition(
        BookingStatus.AWAITING_CUSTOMER,
        BookingStatus.ESTIMATE_APPROVED,
        AuditRole.TECHNICIAN,
        getContext(technicianId, AuditRole.TECHNICIAN)
      );
      expect(resTech.valid).toBe(false);
    });

    it('Step 6b: Customer rejects estimate with feedback punchlist (AWAITING_CUSTOMER -> ESTIMATE_REJECTED)', () => {
      const res = validateTransition(
        BookingStatus.AWAITING_CUSTOMER,
        BookingStatus.ESTIMATE_REJECTED,
        AuditRole.CUSTOMER,
        getContext(customerId, AuditRole.CUSTOMER, {
          note: 'Brake pads price too high; please use OEM aftermarket option',
        })
      );
      expect(res.valid).toBe(true);
      currentStatus = BookingStatus.ESTIMATE_REJECTED;
    });

    it('Step 7: Service Advisor revises estimate after customer feedback (ESTIMATE_REJECTED -> ESTIMATE_REVIEW)', () => {
      const res = validateTransition(
        BookingStatus.ESTIMATE_REJECTED,
        BookingStatus.ESTIMATE_REVIEW,
        AuditRole.SERVICE_ADVISOR,
        getContext(advisorId, AuditRole.SERVICE_ADVISOR)
      );
      expect(res.valid).toBe(true);
      currentStatus = BookingStatus.ESTIMATE_REVIEW;
    });

    it('Step 8: Service Advisor sends revised estimate back (ESTIMATE_REVIEW -> AWAITING_CUSTOMER)', () => {
      const res = validateTransition(
        BookingStatus.ESTIMATE_REVIEW,
        BookingStatus.AWAITING_CUSTOMER,
        AuditRole.SERVICE_ADVISOR,
        getContext(advisorId, AuditRole.SERVICE_ADVISOR)
      );
      expect(res.valid).toBe(true);
      currentStatus = BookingStatus.AWAITING_CUSTOMER;
    });

    it('Step 9: Customer approves revised estimate (AWAITING_CUSTOMER -> ESTIMATE_APPROVED)', () => {
      const res = validateTransition(
        BookingStatus.AWAITING_CUSTOMER,
        BookingStatus.ESTIMATE_APPROVED,
        AuditRole.CUSTOMER,
        getContext(customerId, AuditRole.CUSTOMER)
      );
      expect(res.valid).toBe(true);
      currentStatus = BookingStatus.ESTIMATE_APPROVED;
    });

    it('Step 10: Parts Person moves to inventory allocation (ESTIMATE_APPROVED -> PARTS_PENDING)', () => {
      const res = validateTransition(
        BookingStatus.ESTIMATE_APPROVED,
        BookingStatus.PARTS_PENDING,
        AuditRole.PARTS_PERSON,
        getContext(partsPersonId, AuditRole.PARTS_PERSON)
      );
      expect(res.valid).toBe(true);
      currentStatus = BookingStatus.PARTS_PENDING;
    });

    it('Step 11a: Direct in-stock path is valid (PARTS_PENDING -> PARTS_READY)', () => {
      const res = validateTransition(
        BookingStatus.PARTS_PENDING,
        BookingStatus.PARTS_READY,
        AuditRole.PARTS_PERSON,
        getContext(partsPersonId, AuditRole.PARTS_PERSON)
      );
      expect(res.valid).toBe(true);
    });

    it('Step 11b: Purchase Order path: Missing parts ordered (PARTS_PENDING -> PARTS_ORDERED)', () => {
      const res = validateTransition(
        BookingStatus.PARTS_PENDING,
        BookingStatus.PARTS_ORDERED,
        AuditRole.PARTS_PERSON,
        getContext(partsPersonId, AuditRole.PARTS_PERSON)
      );
      expect(res.valid).toBe(true);
      currentStatus = BookingStatus.PARTS_ORDERED;
    });

    it('Step 12: Partial PO shipment receipt keeps status in PARTS_ORDERED', () => {
      const res = validateTransition(
        BookingStatus.PARTS_ORDERED,
        BookingStatus.PARTS_ORDERED,
        AuditRole.PARTS_PERSON,
        getContext(partsPersonId, AuditRole.PARTS_PERSON, {
          note: 'Received 1 of 2 front rotors from supplier',
        })
      );
      expect(res.valid).toBe(true);
      currentStatus = BookingStatus.PARTS_ORDERED;
    });

    it('Step 13: Complete PO shipment received and allocated (PARTS_ORDERED -> PARTS_READY)', () => {
      const res = validateTransition(
        BookingStatus.PARTS_ORDERED,
        BookingStatus.PARTS_READY,
        AuditRole.PARTS_PERSON,
        getContext(partsPersonId, AuditRole.PARTS_PERSON)
      );
      expect(res.valid).toBe(true);
      currentStatus = BookingStatus.PARTS_READY;
    });

    it('Step 14: Technician starts mechanical repair work (PARTS_READY -> IN_REPAIR)', () => {
      const res = validateTransition(
        BookingStatus.PARTS_READY,
        BookingStatus.IN_REPAIR,
        AuditRole.TECHNICIAN,
        getContext(technicianId, AuditRole.TECHNICIAN)
      );
      expect(res.valid).toBe(true);
      currentStatus = BookingStatus.IN_REPAIR;
    });

    it('Step 15: Technician completes repair and queues for QC (IN_REPAIR -> QC_PENDING)', () => {
      const res = validateTransition(
        BookingStatus.IN_REPAIR,
        BookingStatus.QC_PENDING,
        AuditRole.TECHNICIAN,
        getContext(technicianId, AuditRole.TECHNICIAN)
      );
      expect(res.valid).toBe(true);
      currentStatus = BookingStatus.QC_PENDING;
    });

    it('Step 16: QC Inspector claims job and begins inspection (QC_PENDING -> QC_IN_PROGRESS)', () => {
      const res = validateTransition(
        BookingStatus.QC_PENDING,
        BookingStatus.QC_IN_PROGRESS,
        AuditRole.QC_INSPECTOR,
        getContext(qcInspectorId, AuditRole.QC_INSPECTOR)
      );
      expect(res.valid).toBe(true);
      currentStatus = BookingStatus.QC_IN_PROGRESS;
      claimedQC = qcInspectorId;
    });

    it('Step 17a: QC Failure requires defect title and punchlist (QC_IN_PROGRESS -> IN_REPAIR)', () => {
      // Missing qcIssue details fails condition
      const resNoIssue = validateTransition(
        BookingStatus.QC_IN_PROGRESS,
        BookingStatus.IN_REPAIR,
        AuditRole.QC_INSPECTOR,
        getContext(qcInspectorId, AuditRole.QC_INSPECTOR)
      );
      expect(resNoIssue.valid).toBe(false);
      if (!resNoIssue.valid) {
        expect(resNoIssue.error.message).toContain('A QC issue with title and description is required');
      }

      // Valid QC fail creates rework loop
      const resWithIssue = validateTransition(
        BookingStatus.QC_IN_PROGRESS,
        BookingStatus.IN_REPAIR,
        AuditRole.QC_INSPECTOR,
        getContext(qcInspectorId, AuditRole.QC_INSPECTOR, {
          qcIssue: {
            title: 'Brake pedal spongy',
            description: 'Air in hydraulic line, needs re-bleeding on rear left caliper',
          },
        })
      );
      expect(resWithIssue.valid).toBe(true);
      currentStatus = BookingStatus.IN_REPAIR;
      claimedQC = null;
    });

    it('Step 17b: Technician reworks defect and re-submits (IN_REPAIR -> QC_PENDING)', () => {
      const res = validateTransition(
        BookingStatus.IN_REPAIR,
        BookingStatus.QC_PENDING,
        AuditRole.TECHNICIAN,
        getContext(technicianId, AuditRole.TECHNICIAN, {
          note: 'Rear left caliper re-bled and pressure tested to 120 PSI',
        })
      );
      expect(res.valid).toBe(true);
      currentStatus = BookingStatus.QC_PENDING;
    });

    it('Step 17c: QC Inspector re-claims job (QC_PENDING -> QC_IN_PROGRESS)', () => {
      const res = validateTransition(
        BookingStatus.QC_PENDING,
        BookingStatus.QC_IN_PROGRESS,
        AuditRole.QC_INSPECTOR,
        getContext(qcInspectorId, AuditRole.QC_INSPECTOR)
      );
      expect(res.valid).toBe(true);
      currentStatus = BookingStatus.QC_IN_PROGRESS;
      claimedQC = qcInspectorId;
    });

    it('Step 18: QC Inspector passes vehicle (QC_IN_PROGRESS -> READY_FOR_PICKUP)', () => {
      const res = validateTransition(
        BookingStatus.QC_IN_PROGRESS,
        BookingStatus.READY_FOR_PICKUP,
        AuditRole.QC_INSPECTOR,
        getContext(qcInspectorId, AuditRole.QC_INSPECTOR)
      );
      expect(res.valid).toBe(true);
      currentStatus = BookingStatus.READY_FOR_PICKUP;
    });

    it('Step 19: Customer confirms handover and vehicle pickup (READY_FOR_PICKUP -> COMPLETED)', () => {
      const res = validateTransition(
        BookingStatus.READY_FOR_PICKUP,
        BookingStatus.COMPLETED,
        AuditRole.CUSTOMER,
        getContext(customerId, AuditRole.CUSTOMER, {
          note: 'Customer picked up vehicle and signed handover slip',
        })
      );
      expect(res.valid).toBe(true);
      currentStatus = BookingStatus.COMPLETED;
    });
  });

  describe('Cancellation Boundary Rules & Inventory Protection', () => {
    it('allows cancellation during all pre-repair states (PENDING through PARTS_READY)', () => {
      for (const preStatus of PRE_REPAIR_STATUSES) {
        const res = validateTransition(
          preStatus,
          BookingStatus.CANCELLED,
          AuditRole.SERVICE_ADVISOR,
          {
            actorUserId: advisorId,
            actorRole: AuditRole.SERVICE_ADVISOR,
            booking: {
              id: 'booking-cancel-test',
              shopId,
              customerId,
              status: preStatus,
            },
          }
        );
        expect(res.valid).toBe(true);
      }
    });

    it('STRICTLY REJECTS cancellation once IN_REPAIR or beyond (409 Conflict)', () => {
      const illegalStatuses: BookingStatus[] = [
        BookingStatus.IN_REPAIR,
        BookingStatus.QC_PENDING,
        BookingStatus.QC_IN_PROGRESS,
        BookingStatus.READY_FOR_PICKUP,
        BookingStatus.COMPLETED,
      ];

      for (const status of illegalStatuses) {
        const res = validateTransition(
          status,
          BookingStatus.CANCELLED,
          AuditRole.SERVICE_ADVISOR,
          {
            actorUserId: advisorId,
            actorRole: AuditRole.SERVICE_ADVISOR,
            booking: {
              id: 'booking-illegal-cancel',
              shopId,
              customerId,
              status,
            },
          }
        );
        expect(res.valid).toBe(false);
        if (!res.valid) {
          expect(res.error).toBeInstanceOf(StateMachineConflictError);
          expect(res.error.statusCode).toBe(409);
          expect(res.error.message).toContain('Cancellation is prohibited once a vehicle enters IN_REPAIR');
        }
      }
    });
  });

  describe('executeBookingTransition DB Transaction & Side Effects', () => {
    it('creates QCIssue and logs audit record on QC inspection failure', async () => {
      const createdQCIssues: any[] = [];
      const createdAuditLogs: any[] = [];
      let updatedBookingData: any = null;

      const mockPrisma = {
        $transaction: vi.fn().mockImplementation(async (callback) => {
          const tx = {
            booking: {
              findUnique: vi.fn().mockResolvedValue({
                id: 'booking-qc-fail',
                shopId,
                customerId,
                status: BookingStatus.QC_IN_PROGRESS,
                assignedAdvisorId: advisorId,
                assignedTechnicianId: technicianId,
                assignedPartsPersonId: partsPersonId,
                qcInspectorId,
                partAllocations: [],
              }),
              update: vi.fn().mockImplementation(({ data }) => {
                updatedBookingData = data;
                return Promise.resolve({ id: 'booking-qc-fail', status: data.status });
              }),
            },
            qCIssue: {
              create: vi.fn().mockImplementation(({ data }) => {
                createdQCIssues.push(data);
                return Promise.resolve({ id: 'qc-issue-1', ...data });
              }),
            },
            bookingAuditLog: {
              create: vi.fn().mockImplementation(({ data }) => {
                createdAuditLogs.push(data);
                return Promise.resolve({ id: 'audit-log-1', ...data });
              }),
            },
          };
          return await callback(tx);
        }),
      } as any;

      const result = await executeBookingTransition(mockPrisma, {
        bookingId: 'booking-qc-fail',
        targetStatus: BookingStatus.IN_REPAIR,
        actorUserId: qcInspectorId,
        actorRole: AuditRole.QC_INSPECTOR,
        note: 'Brake fluid line loose',
        qcIssue: {
          title: 'Hydraulic leak',
          description: 'Brake fluid dripping under rear master cylinder fitting',
        },
      });

      expect(result.status).toBe(BookingStatus.IN_REPAIR);
      expect(createdQCIssues.length).toBe(1);
      expect(createdQCIssues[0].title).toBe('Hydraulic leak');
      expect(createdQCIssues[0].resolved).toBe(false);
      expect(createdAuditLogs.length).toBe(1);
      expect(createdAuditLogs[0].fromStatus).toBe(BookingStatus.QC_IN_PROGRESS);
      expect(createdAuditLogs[0].toStatus).toBe(BookingStatus.IN_REPAIR);
      expect(createdAuditLogs[0].role).toBe(AuditRole.QC_INSPECTOR);
    });

    it('releases part allocations and decrements quantityAllocated on cancellation', async () => {
      const updatedAllocations: any[] = [];
      const updatedParts: any[] = [];

      const mockPrisma = {
        $transaction: vi.fn().mockImplementation(async (callback) => {
          const tx = {
            booking: {
              findUnique: vi.fn().mockResolvedValue({
                id: 'booking-cancel-parts',
                shopId,
                customerId,
                status: BookingStatus.PARTS_READY,
                assignedAdvisorId: advisorId,
                partAllocations: [
                  { id: 'alloc-1', partId: 'part-oil-filter', quantity: 2, status: 'ALLOCATED' },
                  { id: 'alloc-2', partId: 'part-brake-pads', quantity: 1, status: 'ALLOCATED' },
                ],
              }),
              update: vi.fn().mockResolvedValue({ id: 'booking-cancel-parts', status: BookingStatus.CANCELLED }),
            },
            partAllocation: {
              update: vi.fn().mockImplementation(({ where, data }) => {
                updatedAllocations.push({ where, data });
                return Promise.resolve();
              }),
            },
            part: {
              update: vi.fn().mockImplementation(({ where, data }) => {
                updatedParts.push({ where, data });
                return Promise.resolve();
              }),
            },
            bookingAuditLog: {
              create: vi.fn().mockResolvedValue({ id: 'audit-cancel-1' }),
            },
          };
          return await callback(tx);
        }),
      } as any;

      await executeBookingTransition(mockPrisma, {
        bookingId: 'booking-cancel-parts',
        targetStatus: BookingStatus.CANCELLED,
        actorUserId: advisorId,
        actorRole: AuditRole.SERVICE_ADVISOR,
        note: 'Customer requested cancellation prior to repair',
      });

      expect(updatedAllocations.length).toBe(2);
      expect(updatedAllocations[0].data.status).toBe('RELEASED');
      expect(updatedAllocations[1].data.status).toBe('RELEASED');

      expect(updatedParts.length).toBe(2);
      expect(updatedParts[0].data.quantityAllocated.decrement).toBe(2);
      expect(updatedParts[1].data.quantityAllocated.decrement).toBe(1);
    });
  });

  describe('Multi-Tenant Isolation Enforcement', () => {
    it('Shop A staff receives 403 CROSS_TENANT_ACCESS_DENIED when attempting operations in Shop B', async () => {
      const mockPrisma = {
        shopMember: {
          findUnique: vi.fn().mockImplementation(({ where }) => {
            // Staff belongs only to shopId (Shop A), not otherShopId (Shop B)
            if (where.shopId_userId.shopId === shopId && where.shopId_userId.userId === technicianId) {
              return Promise.resolve({
                id: 'member-lahore-tech',
                shopId,
                userId: technicianId,
                role: ShopRole.TECHNICIAN,
                isActive: true,
              });
            }
            return Promise.resolve(null);
          }),
        },
      } as any;

      // Access Shop A: granted
      const accessA = await verifyTenantAccess(mockPrisma, technicianId, shopId);
      expect(accessA.allowed).toBe(true);

      // Access Shop B: strictly forbidden 403
      const accessB = await verifyTenantAccess(mockPrisma, technicianId, otherShopId);
      expect(accessB.allowed).toBe(false);
      if (!accessB.allowed) {
        expect(accessB.error).toBeInstanceOf(TenantAccessError);
        expect(accessB.error.statusCode).toBe(403);
        expect(accessB.error.code).toBe('CROSS_TENANT_ACCESS_DENIED');
      }
    });
  });
});
