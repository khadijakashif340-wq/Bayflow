'use client';

import React, { useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import {
  Car,
  Clock,
  MapPin,
  Phone,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  FileText,
  Wrench,
  Loader2,
  RefreshCw,
  ThumbsUp,
  ThumbsDown,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { AnimatedCheckmark } from '@/components/AnimatedCheckmark';

type BookingDetail = {
  id: string;
  bookingNumber: string;
  status: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear: number;
  vehicleVin?: string | null;
  licensePlate: string;
  mileage?: number | null;
  customerNotes?: string | null;
  createdAt: string;
  updatedAt: string;
  shop: {
    id: string;
    name: string;
    city: string;
    address: string;
    phone: string;
    email: string;
    openTime: string;
    closeTime: string;
    workingDays: string;
  };
  customer: {
    id: string;
    name: string;
    email: string;
    phone: string;
  };
  assignedAdvisor?: { id: string; name: string } | null;
  assignedTechnician?: { id: string; name: string } | null;
  qcInspector?: { id: string; name: string } | null;
  services: Array<{
    id: string;
    price: string | number;
    service: {
      id: string;
      name: string;
      category: string;
      durationMinutes: number;
    };
  }>;
  estimates: Array<{
    id: string;
    revision: number;
    status: string;
    subtotalParts: string | number;
    subtotalLabor: string | number;
    taxRate: string | number;
    taxAmount: string | number;
    total: string | number;
    notes?: string | null;
    rejectionReason?: string | null;
    items: Array<{
      id: string;
      itemType: 'PART' | 'LABOR';
      description: string;
      quantity: string | number;
      unitPrice: string | number;
      total: string | number;
    }>;
  }>;
  auditLogs: Array<{
    id: string;
    fromStatus: string;
    toStatus: string;
    role: string;
    note?: string | null;
    createdAt: string;
    performedBy: { name: string };
  }>;
  qcIssues: Array<{
    id: string;
    title: string;
    description: string;
    resolved: boolean;
    createdAt: string;
    raisedBy: { name: string };
  }>;
};

// 17 Deterministic status sequence
const STATUS_STEPS = [
  { key: 'PENDING', label: 'Booking Placed' },
  { key: 'CONFIRMED', label: 'Advisor Confirmed' },
  { key: 'ASSIGNED', label: 'Tech Assigned' },
  { key: 'INSPECTING', label: 'Lift Diagnosis' },
  { key: 'ESTIMATE_REVIEW', label: 'Estimate Review' },
  { key: 'AWAITING_CUSTOMER', label: 'Customer Approval' },
  { key: 'ESTIMATE_APPROVED', label: 'Approved' },
  { key: 'PARTS_PENDING', label: 'Parts Evaluation' },
  { key: 'PARTS_ORDERED', label: 'Parts Sourced' },
  { key: 'PARTS_READY', label: 'Parts Allocated' },
  { key: 'IN_REPAIR', label: 'Under Repair' },
  { key: 'QC_PENDING', label: 'QC Queue' },
  { key: 'QC_IN_PROGRESS', label: 'QC Testing' },
  { key: 'READY_FOR_PICKUP', label: 'Ready for Pickup' },
  { key: 'COMPLETED', label: 'Completed' },
];

export default function BookingTrackerPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const bookingNumber = params.bookingNumber as string;
  const justBooked = searchParams.get('justBooked') === 'true';

  const [decisionLoading, setDecisionLoading] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);
  const [actionErrorMsg, setActionErrorMsg] = useState<string | null>(null);
  const shouldReduceMotion = useReducedMotion();

  // TanStack Query with 7-second live polling (meets 5-10s polling requirement)
  const { data, isLoading, isError, refetch, isFetching } = useQuery<BookingDetail>({
    queryKey: ['booking', bookingNumber],
    queryFn: async () => {
      const res = await fetch(`/api/bookings/${bookingNumber}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || 'Failed to fetch booking');
      return json.data;
    },
    refetchInterval: 7000,
  });

  // Handle Estimate Approve / Reject
  const handleEstimateAction = async (action: 'APPROVE' | 'REJECT') => {
    try {
      setDecisionLoading(true);
      setActionSuccessMsg(null);
      setActionErrorMsg(null);

      const res = await fetch(`/api/bookings/${bookingNumber}/estimate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          reason: action === 'REJECT' ? rejectionReason : undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || 'Failed to update estimate');
      }

      setRejectModalOpen(false);
      setRejectionReason('');
      setActionSuccessMsg(
        action === 'APPROVE'
          ? 'Estimate approved successfully! Workshop parts allocation has been triggered.'
          : 'Estimate declined. The Service Advisor has been notified to revise the punchlist.'
      );
      await refetch();
    } catch (err: any) {
      setActionErrorMsg(err.message || 'Error updating estimate');
    } finally {
      setDecisionLoading(false);
    }
  };

  // Handle Customer Pickup Confirmation
  const handlePickupConfirm = async () => {
    try {
      setDecisionLoading(true);
      setActionSuccessMsg(null);
      setActionErrorMsg(null);

      const res = await fetch(`/api/bookings/${bookingNumber}/pickup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || 'Failed to confirm vehicle pickup');
      }

      setActionSuccessMsg('Vehicle pickup confirmed! Thank you for using BayFlow.');
      await refetch();
    } catch (err: any) {
      setActionErrorMsg(err.message || 'Error confirming pickup');
    } finally {
      setDecisionLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-[#FAF7F2]">
        <Navbar />
        <div className="flex-1 flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3 text-[#E8590C]">
            <Loader2 className="w-8 h-8 animate-spin" />
            <span className="text-sm font-semibold text-[#1C1917]">
              Connecting to BayFlow Live Gateway...
            </span>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen flex flex-col bg-[#FAF7F2]">
        <Navbar />
        <div className="flex-1 flex items-center justify-center py-20 px-4">
          <div className="card-bayflow p-8 max-w-md w-full bg-[#FFFFFF] text-center space-y-4">
            <XCircle className="w-12 h-12 text-[#B91C1C] mx-auto" />
            <h2 className="font-heading font-bold text-xl text-[#1C1917]">
              Booking #{bookingNumber} Not Found
            </h2>
            <p className="text-xs text-[#6B645B]">
              Please check your reference number or return to the tracker search page.
            </p>
            <Link
              href="/track"
              className="inline-block px-4 py-2 bg-[#E8590C] text-white rounded-xl text-xs font-semibold"
            >
              Back to Tracker Search
            </Link>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  const latestEstimate = data.estimates[0];
  const isCancelled = data.status === 'CANCELLED';
  const currentStepIndex = STATUS_STEPS.findIndex((s) => s.key === data.status);

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF7F2]">
      <Navbar />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1 space-y-6">
        {/* Just Booked Success Alert */}
        {justBooked && (
          <motion.div
            initial={shouldReduceMotion ? {} : { opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="p-6 rounded-2xl bg-[#0F5C4D]/10 border-2 border-[#0F5C4D]/30 text-[#0F5C4D] flex flex-col sm:flex-row items-center gap-5 shadow-sm relative overflow-hidden"
          >
            <div className="shrink-0 flex items-center justify-center">
              <AnimatedCheckmark size={52} color="#0F5C4D" />
            </div>
            <div className="space-y-1 text-center sm:text-left flex-1">
              <div className="flex items-center justify-center sm:justify-start gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider bg-[#0F5C4D]/20 px-2 py-0.5 rounded text-[#0F5C4D]">
                  Booking Confirmed
                </span>
                <span className="text-xs text-[#6B645B]">Real-time Tracking Ready</span>
              </div>
              <h2 className="text-xl font-bold font-heading text-[#1C1917]">
                Appointment Reserved Successfully!
              </h2>
              <p className="text-xs text-[#6B645B] leading-relaxed">
                Your vehicle has been booked under reference{' '}
                <span className="font-mono font-bold text-[#E8590C] bg-[#FFFFFF] px-2 py-0.5 rounded border border-[#E7E0D5]">
                  #{data.bookingNumber}
                </span>
                . Save this reference to monitor live progress as your car moves across workshop bays.
              </p>
            </div>
          </motion.div>
        )}

        {/* Action Notifications */}
        {actionSuccessMsg && (
          <div className="p-4 rounded-xl bg-[#0F5C4D]/10 border border-[#0F5C4D]/30 text-[#0F5C4D] text-sm flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span className="text-xs font-semibold">{actionSuccessMsg}</span>
          </div>
        )}
        {actionErrorMsg && (
          <div className="p-4 rounded-xl bg-[#B91C1C]/10 border border-[#B91C1C]/30 text-[#B91C1C] text-sm flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span className="text-xs font-semibold">{actionErrorMsg}</span>
          </div>
        )}

        {/* Top Header Card */}
        <div className="card-bayflow p-6 bg-[#FFFFFF] shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-[#E7E0D5]">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-[#E8590C] bg-[#E8590C]/10 px-2.5 py-1 rounded-md border border-[#E8590C]/20">
                  {data.bookingNumber}
                </span>
                <span className="text-xs text-[#6B645B]">
                  Booked on {new Date(data.createdAt).toLocaleDateString()}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold font-heading text-[#1C1917] flex items-center gap-2.5">
                <span>{data.vehicleYear} {data.vehicleMake} {data.vehicleModel}</span>
              </h1>
              <div className="flex items-center gap-3 text-xs">
                <span className="font-mono font-bold px-2.5 py-0.5 rounded bg-[#1C1917] text-[#FAF7F2] border border-[#2B2520]">
                  {data.licensePlate}
                </span>
                {data.mileage && (
                  <span className="text-[#6B645B]">
                    {data.mileage.toLocaleString()} km
                  </span>
                )}
              </div>
            </div>

            {/* Status Badge & Auto-Refresh Indicator */}
            <div className="flex flex-col items-start sm:items-end gap-2">
              <AnimatePresence mode="wait">
                <motion.span
                  key={data.status}
                  initial={shouldReduceMotion ? {} : { opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={shouldReduceMotion ? {} : { opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.2 }}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold tracking-wide border uppercase ${
                    isCancelled
                      ? 'bg-[#B91C1C]/10 text-[#B91C1C] border-[#B91C1C]/30'
                      : data.status === 'COMPLETED'
                      ? 'bg-[#0F5C4D]/10 text-[#0F5C4D] border-[#0F5C4D]/30'
                      : data.status === 'AWAITING_CUSTOMER'
                      ? 'bg-[#D97706]/10 text-[#D97706] border-[#D97706]/30 animate-pulse'
                      : 'bg-[#E8590C]/10 text-[#E8590C] border-[#E8590C]/30'
                  }`}
                >
                  {data.status.replace(/_/g, ' ')}
                </motion.span>
              </AnimatePresence>
              <div className="flex items-center gap-1.5 text-[11px] text-[#6B645B]">
                <RefreshCw className={`w-3 h-3 text-[#0F5C4D] ${isFetching ? 'animate-spin' : ''}`} />
                <span>Live polling active (every 7s)</span>
              </div>
            </div>
          </div>

          {/* Workshop & Personnel Metadata */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 text-xs text-[#6B645B]">
            <div>
              <span className="font-semibold text-[#1C1917] block mb-0.5">Workshop</span>
              <div className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-[#E8590C]" />
                <span>{data.shop.name} ({data.shop.city})</span>
              </div>
              <div className="text-[11px] text-[#6B645B] mt-0.5">{data.shop.address}</div>
            </div>

            <div>
              <span className="font-semibold text-[#1C1917] block mb-0.5">Assigned Staff</span>
              <div>Advisor: <span className="text-[#1C1917] font-medium">{data.assignedAdvisor?.name || 'Pending assignment'}</span></div>
              <div>Master Tech: <span className="text-[#1C1917] font-medium">{data.assignedTechnician?.name || 'Pending assignment'}</span></div>
            </div>

            <div>
              <span className="font-semibold text-[#1C1917] block mb-0.5">Contact Workshop</span>
              <div className="flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-[#0F5C4D]" />
                <a href={`tel:${data.shop.phone}`} className="text-[#1C1917] font-semibold hover:underline">
                  {data.shop.phone}
                </a>
              </div>
              <div className="text-[11px] text-[#6B645B] mt-0.5">Hours: {data.shop.openTime} – {data.shop.closeTime}</div>
            </div>
          </div>
        </div>

        {/* 17-Status Stepper Progress Bar */}
        <div className="card-bayflow p-6 bg-[#FFFFFF] space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-heading font-bold text-base text-[#1C1917] flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[#E8590C]" />
              <span>Real-Time State Machine Progress</span>
            </h2>
            <span className="text-xs font-semibold text-[#6B645B]">
              {isCancelled ? 'Booking Cancelled' : `Stage ${Math.max(1, currentStepIndex + 1)} of ${STATUS_STEPS.length}`}
            </span>
          </div>

          {/* Desktop Timeline Stepper */}
          <div className="overflow-x-auto pb-4 pt-2">
            <div className="min-w-[850px] flex items-center justify-between relative px-4">
              {/* Connector line tracks */}
              <div className="absolute top-3.5 left-8 right-8 h-1 bg-[#E7E0D5] z-0 rounded" />
              <motion.div
                className="absolute top-3.5 left-8 h-1 bg-[#0F5C4D] z-0 rounded"
                initial={shouldReduceMotion ? undefined : { width: '0%' }}
                animate={{
                  width: `${Math.min(100, Math.max(0, (currentStepIndex / (STATUS_STEPS.length - 1)) * 100))}%`,
                }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              />

              {STATUS_STEPS.map((s, idx) => {
                const isPassed = !isCancelled && currentStepIndex > idx;
                const isCurrent = !isCancelled && s.key === data.status;

                return (
                  <div key={s.key} className="flex flex-col items-center relative z-10 flex-1">
                    <div className="relative">
                      {isCurrent && !shouldReduceMotion && (
                        <motion.div
                          className="absolute -inset-1 rounded-full bg-[#E8590C]/30 z-0"
                          animate={{ scale: [1, 1.45, 1], opacity: [0.8, 0, 0.8] }}
                          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                        />
                      )}
                      <motion.div
                        initial={shouldReduceMotion ? {} : { scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: idx * 0.02, duration: 0.25 }}
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold transition-all relative z-10 ${
                          isPassed
                            ? 'bg-[#0F5C4D] text-white shadow-xs'
                            : isCurrent
                            ? 'bg-[#E8590C] text-white ring-4 ring-[#E8590C]/20 shadow-xs'
                            : 'bg-[#FAF7F2] text-[#6B645B] border border-[#E7E0D5]'
                        }`}
                      >
                        {isPassed ? <CheckCircle2 className="w-3.5 h-3.5" /> : idx + 1}
                      </motion.div>
                    </div>
                    <span
                      className={`text-[10px] font-medium text-center mt-2 leading-tight max-w-[65px] transition-colors ${
                        isCurrent
                          ? 'text-[#E8590C] font-bold'
                          : isPassed
                          ? 'text-[#0F5C4D] font-semibold'
                          : 'text-[#6B645B]'
                      }`}
                    >
                      {s.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Action Card: ESTIMATE AWAITING CUSTOMER APPROVAL */}
        {data.status === 'AWAITING_CUSTOMER' && latestEstimate && (
          <div className="card-bayflow p-6 bg-[#FFFFFF] border-2 border-[#E8590C] shadow-lg space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-[#E7E0D5]">
              <div className="space-y-1">
                <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-[#E8590C]/10 text-[#E8590C] uppercase tracking-wider">
                  Action Required
                </span>
                <h3 className="text-xl font-bold font-heading text-[#1C1917]">
                  Service Estimate Review (Revision #{latestEstimate.revision})
                </h3>
                <p className="text-xs text-[#6B645B]">
                  Master Technician has diagnosed your vehicle. Please inspect the line items below and approve to commence repairs.
                </p>
              </div>

              <div className="text-right">
                <span className="text-xs text-[#6B645B] block">Total Payable in PKR</span>
                <div className="font-mono text-2xl font-black text-[#E8590C]">
                  PKR {Number(latestEstimate.total).toLocaleString()}
                </div>
              </div>
            </div>

            {/* Line Items Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#E7E0D5] text-[#6B645B] uppercase tracking-wider">
                    <th className="py-2 font-semibold">Type</th>
                    <th className="py-2 font-semibold">Description</th>
                    <th className="py-2 font-semibold text-center">Qty</th>
                    <th className="py-2 font-semibold text-right">Unit (PKR)</th>
                    <th className="py-2 font-semibold text-right">Total (PKR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E7E0D5]">
                  {latestEstimate.items.map((item) => (
                    <tr key={item.id} className="hover:bg-[#FAF7F2]/50">
                      <td className="py-2.5">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            item.itemType === 'PART'
                              ? 'bg-[#0F5C4D]/10 text-[#0F5C4D]'
                              : 'bg-[#D97706]/10 text-[#D97706]'
                          }`}
                        >
                          {item.itemType}
                        </span>
                      </td>
                      <td className="py-2.5 font-medium text-[#1C1917]">{item.description}</td>
                      <td className="py-2.5 text-center font-mono">{Number(item.quantity)}</td>
                      <td className="py-2.5 text-right font-mono">{Number(item.unitPrice).toLocaleString()}</td>
                      <td className="py-2.5 text-right font-mono font-semibold text-[#1C1917]">
                        {Number(item.total).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Breakdown Totals */}
            <div className="p-4 bg-[#FAF7F2] rounded-xl border border-[#E7E0D5] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
              <div className="space-y-1 text-[#6B645B]">
                <div>Parts Subtotal: <span className="font-mono font-semibold text-[#1C1917]">PKR {Number(latestEstimate.subtotalParts).toLocaleString()}</span></div>
                <div>Labor Subtotal: <span className="font-mono font-semibold text-[#1C1917]">PKR {Number(latestEstimate.subtotalLabor).toLocaleString()}</span></div>
                <div>Sales Tax (Optional / 0%): <span className="font-mono font-semibold text-[#1C1917]">PKR 0</span></div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button
                  type="button"
                  disabled={decisionLoading}
                  onClick={() => setRejectModalOpen(true)}
                  className="flex-1 sm:flex-none px-4 py-2.5 border border-[#B91C1C]/40 text-[#B91C1C] hover:bg-[#B91C1C]/10 rounded-xl font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <ThumbsDown className="w-3.5 h-3.5" />
                  <span>Decline Estimate</span>
                </button>
                <button
                  type="button"
                  disabled={decisionLoading}
                  onClick={() => handleEstimateAction('APPROVE')}
                  className="flex-1 sm:flex-none px-6 py-2.5 bg-[#0F5C4D] hover:bg-[#0A473B] text-white rounded-xl font-bold text-xs transition-all shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {decisionLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <ThumbsUp className="w-3.5 h-3.5" />
                  )}
                  <span>Approve & Authorize Repair</span>
                </button>
              </div>
            </div>

            {/* Decline Reason Modal / Form */}
            <AnimatePresence>
              {rejectModalOpen && (
                <motion.div
                  initial={shouldReduceMotion ? {} : { opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={shouldReduceMotion ? {} : { opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="p-4 rounded-xl border border-[#B91C1C]/30 bg-[#B91C1C]/5 space-y-3">
                    <div className="text-xs font-bold text-[#B91C1C]">
                      Please provide a reason for declining this estimate:
                    </div>
                    <textarea
                      rows={2}
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="e.g. Budget constraints, only want front brakes done, need revision..."
                      className="w-full p-2.5 bg-[#FFFFFF] border border-[#E7E0D5] rounded-lg text-xs text-[#1C1917]"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setRejectModalOpen(false)}
                        className="px-3 py-1.5 border border-[#E7E0D5] rounded-lg text-xs text-[#6B645B]"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => handleEstimateAction('REJECT')}
                        disabled={decisionLoading || !rejectionReason.trim()}
                        className="px-4 py-1.5 bg-[#B91C1C] text-white rounded-lg text-xs font-semibold disabled:opacity-50"
                      >
                        Submit Decline
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Action Card: READY FOR PICKUP */}
        {data.status === 'READY_FOR_PICKUP' && (
          <div className="card-bayflow p-6 bg-[#FFFFFF] border-2 border-[#0F5C4D] shadow-lg space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-[#0F5C4D]/10 text-[#0F5C4D] uppercase tracking-wider">
                  Quality Control Passed
                </span>
                <h3 className="text-xl font-bold font-heading text-[#1C1917]">
                  Your Vehicle is Ready for Pickup!
                </h3>
                <p className="text-xs text-[#6B645B]">
                  All punchlist items and certified road test checks have passed. You may now collect your keys and vehicle.
                </p>
              </div>

              <button
                type="button"
                disabled={decisionLoading}
                onClick={handlePickupConfirm}
                className="w-full sm:w-auto px-6 py-3 bg-[#0F5C4D] hover:bg-[#0A473B] text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-sm disabled:opacity-50"
              >
                {decisionLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                <span>Confirm Vehicle Received & Handover</span>
              </button>
            </div>
          </div>
        )}

        {/* Audit Log Timeline History */}
        <div className="card-bayflow p-6 bg-[#FFFFFF] space-y-4">
          <div className="border-b border-[#E7E0D5] pb-3 flex items-center justify-between">
            <h3 className="font-heading font-bold text-base text-[#1C1917] flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#E8590C]" />
              <span>Immutable Workshop Audit History</span>
            </h3>
            <span className="text-xs text-[#6B645B]">
              {data.auditLogs.length} events logged
            </span>
          </div>

          <div className="space-y-4 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#E7E0D5]">
            {data.auditLogs.map((log, idx) => {
              const timeFormatted = new Date(log.createdAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              });
              const dateFormatted = new Date(log.createdAt).toLocaleDateString();

              return (
                <motion.div
                  key={log.id}
                  initial={shouldReduceMotion ? {} : { opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.04, duration: 0.25 }}
                  className="flex items-start gap-4 relative pl-8"
                >
                  <div className="absolute left-1.5 top-1.5 w-3 h-3 rounded-full bg-[#E8590C] ring-4 ring-[#FFFFFF]" />
                  <div className="flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-bold text-[#1C1917]">
                        {log.toStatus.replace(/_/g, ' ')}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#FAF7F2] border border-[#E7E0D5] text-[#6B645B]">
                        {log.role} • {log.performedBy.name}
                      </span>
                      <span className="text-[11px] text-[#6B645B]">
                        {dateFormatted} at {timeFormatted}
                      </span>
                    </div>
                    {log.note && (
                      <p className="text-xs text-[#6B645B] leading-relaxed">
                        {log.note}
                      </p>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* QC Issues Section (if any occurred) */}
        {data.qcIssues.length > 0 && (
          <div className="card-bayflow p-6 bg-[#FFFFFF] space-y-4 border border-[#B91C1C]/30">
            <h3 className="font-heading font-bold text-base text-[#B91C1C] flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              <span>QC Inspection Punchlist Notes</span>
            </h3>
            <div className="space-y-3">
              {data.qcIssues.map((qc) => (
                <div key={qc.id} className="p-3 rounded-xl bg-[#FAF7F2] border border-[#E7E0D5] text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#1C1917]">{qc.title}</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        qc.resolved ? 'bg-[#0F5C4D]/10 text-[#0F5C4D]' : 'bg-[#B91C1C]/10 text-[#B91C1C]'
                      }`}
                    >
                      {qc.resolved ? 'Resolved' : 'Rework in Progress'}
                    </span>
                  </div>
                  <p className="text-[#6B645B]">{qc.description}</p>
                  <div className="text-[10px] text-[#6B645B] pt-1">
                    Raised by {qc.raisedBy.name} on {new Date(qc.createdAt).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
