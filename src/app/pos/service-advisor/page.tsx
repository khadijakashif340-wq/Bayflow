'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { PosHeader } from '@/components/PosHeader';
import { Footer } from '@/components/Footer';
import {
  Wrench,
  CheckCircle2,
  Clock,
  Car,
  User,
  Plus,
  Trash2,
  Send,
  AlertCircle,
  Loader2,
  RefreshCw,
  Search,
  ExternalLink,
  ChevronRight,
  Shield,
  FileText,
  DollarSign,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

export default function ServiceAdvisorPage() {
  const router = useRouter();
  const shouldReduceMotion = useReducedMotion();

  const [activeShopId, setActiveShopId] = useState<string>('');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [assignModalBooking, setAssignModalBooking] = useState<any | null>(null);
  const [selectedTechId, setSelectedTechId] = useState('');
  const [availableTechs, setAvailableTechs] = useState<any[]>([]);

  const [estimateModalBooking, setEstimateModalBooking] = useState<any | null>(null);
  const [estimateItems, setEstimateItems] = useState<Array<{
    itemType: 'PART' | 'LABOR';
    description: string;
    quantity: number;
    unitPrice: number;
  }>>([]);
  const [estimateNotes, setEstimateNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 1. Load Session & User Shops
  useEffect(() => {
    async function loadSession() {
      try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) {
          router.push('/login');
          return;
        }
        const json = await res.json();
        setCurrentUser(json.data);

        // Find primary shop
        if (json.data.memberships.length > 0) {
          setActiveShopId(json.data.memberships[0].shopId);
        } else if (json.data.ownedShops.length > 0) {
          setActiveShopId(json.data.ownedShops[0].id);
        }
      } catch (err) {
        router.push('/login');
      }
    }
    loadSession();
  }, [router]);

  // 2. Load Technicians for assignment modal
  useEffect(() => {
    if (!activeShopId) return;
    async function loadStaff() {
      try {
        const res = await fetch(`/api/owner/shops/${activeShopId}/members`);
        const json = await res.json();
        if (json.data) {
          const techs = json.data.filter((m: any) => m.role === 'TECHNICIAN' && m.isActive);
          setAvailableTechs(techs);
          if (techs.length > 0) setSelectedTechId(techs[0].userId);
        }
      } catch (err) {
        console.error('Error loading techs:', err);
      }
    }
    loadStaff();
  }, [activeShopId]);

  // 3. React Query Polling (7s live updates as per brief)
  const { data: bookings = [], refetch, isFetching } = useQuery<any[]>({
    queryKey: ['sa-bookings', activeShopId],
    queryFn: async () => {
      if (!activeShopId) return [];
      const res = await fetch(`/api/pos/service-advisor/bookings?shopId=${activeShopId}`);
      const json = await res.json();
      return json.data || [];
    },
    enabled: !!activeShopId,
    refetchInterval: 7000,
  });

  // Action: Confirm Booking (PENDING -> CONFIRMED)
  const handleConfirm = async (bookingId: string) => {
    try {
      setActionLoading(true);
      setFeedbackMsg(null);
      const res = await fetch('/api/pos/service-advisor/transition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId,
          targetStatus: 'CONFIRMED',
          note: 'Service Advisor confirmed appointment with customer.',
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || 'Failed to confirm booking');
      setFeedbackMsg({ type: 'success', text: 'Appointment confirmed.' });
      refetch();
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  // Action: Assign Tech (CONFIRMED -> ASSIGNED)
  const handleAssignTechSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignModalBooking || !selectedTechId) return;
    try {
      setActionLoading(true);
      setFeedbackMsg(null);
      const res = await fetch('/api/pos/service-advisor/transition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: assignModalBooking.id,
          targetStatus: 'ASSIGNED',
          assignedTechnicianId: selectedTechId,
          note: 'Assigned to Master Technician for mechanical diagnosis.',
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || 'Failed to assign technician');
      setAssignModalBooking(null);
      setFeedbackMsg({ type: 'success', text: 'Technician assigned successfully.' });
      refetch();
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  // Action: Open Estimate Builder Modal
  const openEstimateBuilder = (booking: any) => {
    setEstimateModalBooking(booking);
    setEstimateNotes('');
    const latestEst = booking.estimates?.[0];
    if (latestEst && latestEst.items && latestEst.items.length > 0) {
      setEstimateItems(
        latestEst.items.map((i: any) => ({
          itemType: i.itemType,
          description: i.description,
          quantity: Number(i.quantity),
          unitPrice: Number(i.unitPrice),
        }))
      );
      setEstimateNotes(latestEst.notes || '');
    } else {
      // Default template from selected services
      const initialItems: any[] = [];
      booking.services.forEach((bs: any) => {
        initialItems.push({
          itemType: 'LABOR',
          description: `${bs.service.name} Labor`,
          quantity: 1,
          unitPrice: Number(bs.price),
        });
      });
      if (initialItems.length === 0) {
        initialItems.push({
          itemType: 'LABOR',
          description: 'Comprehensive Inspection & Labor',
          quantity: 1,
          unitPrice: 4000,
        });
      }
      setEstimateItems(initialItems);
    }
  };

  // Action: Save and Send Estimate to Customer
  const handleSaveEstimate = async (sendToCustomer: boolean) => {
    if (!estimateModalBooking) return;
    try {
      setActionLoading(true);
      setFeedbackMsg(null);
      const res = await fetch('/api/pos/service-advisor/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: estimateModalBooking.id,
          sendToCustomer,
          notes: estimateNotes,
          taxRate: 0.0,
          items: estimateItems,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || 'Failed to save estimate');
      setEstimateModalBooking(null);
      setFeedbackMsg({
        type: 'success',
        text: sendToCustomer
          ? 'Estimate dispatched to customer! Status updated to AWAITING_CUSTOMER.'
          : 'Estimate saved as draft.',
      });
      refetch();
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  // Action: Confirm Pickup (READY_FOR_PICKUP -> COMPLETED)
  const handleCompleteHandover = async (bookingId: string) => {
    try {
      setActionLoading(true);
      setFeedbackMsg(null);
      const res = await fetch('/api/pos/service-advisor/transition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId,
          targetStatus: 'COMPLETED',
          note: 'Vehicle handed over to customer. Invoiced and settled.',
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || 'Failed to complete handover');
      setFeedbackMsg({ type: 'success', text: 'Vehicle handover completed and closed.' });
      refetch();
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  // Calculations for active estimate modal
  const computedPartsTotal = estimateItems
    .filter((i) => i.itemType === 'PART')
    .reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
  const computedLaborTotal = estimateItems
    .filter((i) => i.itemType === 'LABOR')
    .reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
  const computedGrandTotal = computedPartsTotal + computedLaborTotal;

  // Filter Bookings by Tab
  const filteredBookings = bookings.filter((b) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchNumber = b.bookingNumber.toLowerCase().includes(q);
      const matchPlate = b.licensePlate.toLowerCase().includes(q);
      const matchCustomer = b.customer.name.toLowerCase().includes(q);
      if (!matchNumber && !matchPlate && !matchCustomer) return false;
    }

    if (activeTab === 'intake') return b.status === 'PENDING';
    if (activeTab === 'confirmed') return b.status === 'CONFIRMED' || b.status === 'ASSIGNED';
    if (activeTab === 'estimates')
      return b.status === 'INSPECTING' || b.status === 'ESTIMATE_REVIEW' || b.status === 'ESTIMATE_REJECTED';
    if (activeTab === 'awaiting') return b.status === 'AWAITING_CUSTOMER';
    if (activeTab === 'in_progress')
      return (
        b.status === 'ESTIMATE_APPROVED' ||
        b.status === 'PARTS_PENDING' ||
        b.status === 'PARTS_ORDERED' ||
        b.status === 'PARTS_READY' ||
        b.status === 'IN_REPAIR' ||
        b.status === 'QC_PENDING' ||
        b.status === 'QC_IN_PROGRESS'
      );
    if (activeTab === 'ready') return b.status === 'READY_FOR_PICKUP';
    if (activeTab === 'completed') return b.status === 'COMPLETED';
    return true;
  });

  const activeShop = currentUser?.memberships?.find((m: any) => m.shopId === activeShopId)?.shop || currentUser?.ownedShops?.find((s: any) => s.id === activeShopId);

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF7F2]">
      <PosHeader
        stationTitle="Service Advisor Station"
        roleBadge="SERVICE ADVISOR"
        userName={currentUser?.name || 'Advisor'}
        shopName={activeShop?.name || 'Apex Motor Care'}
        shopId={activeShopId}
        isOwner={currentUser?.userType === 'OWNER'}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1 space-y-6">
        {/* Feedback Message */}
        {feedbackMsg && (
          <div
            className={`p-4 rounded-xl text-xs font-semibold flex items-center justify-between gap-3 ${
              feedbackMsg.type === 'success'
                ? 'bg-[#0F5C4D]/10 border border-[#0F5C4D]/30 text-[#0F5C4D]'
                : 'bg-[#B91C1C]/10 border border-[#B91C1C]/30 text-[#B91C1C]'
            }`}
          >
            <div className="flex items-center gap-2">
              {feedbackMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              <span>{feedbackMsg.text}</span>
            </div>
            <button type="button" onClick={() => setFeedbackMsg(null)} className="underline">
              Dismiss
            </button>
          </div>
        )}

        {/* Filter Navigation Bar & Search */}
        <div className="card-bayflow p-4 bg-[#FFFFFF] space-y-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-[#6B645B] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search booking number, plate (LEA-21-4892), customer..."
                className="w-full pl-9 pr-3 py-2 bg-[#FAF7F2] border border-[#E7E0D5] rounded-xl text-xs text-[#1C1917] focus:outline-none focus:border-[#E8590C]"
              />
            </div>

            <div className="flex items-center gap-2 text-xs text-[#6B645B]">
              <RefreshCw className={`w-3.5 h-3.5 text-[#0F5C4D] ${isFetching ? 'animate-spin' : ''}`} />
              <span>Live Polling Active (7s)</span>
            </div>
          </div>

          {/* Workflow Stage Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            {[
              { key: 'all', label: `All (${bookings.length})` },
              { key: 'intake', label: `Intake (${bookings.filter((b) => b.status === 'PENDING').length})` },
              { key: 'confirmed', label: `Confirmed (${bookings.filter((b) => b.status === 'CONFIRMED' || b.status === 'ASSIGNED').length})` },
              { key: 'estimates', label: `Estimates (${bookings.filter((b) => b.status === 'INSPECTING' || b.status === 'ESTIMATE_REVIEW' || b.status === 'ESTIMATE_REJECTED').length})` },
              { key: 'awaiting', label: `Awaiting Approval (${bookings.filter((b) => b.status === 'AWAITING_CUSTOMER').length})` },
              { key: 'in_progress', label: `In Progress (${bookings.filter((b) => ['ESTIMATE_APPROVED', 'PARTS_PENDING', 'PARTS_ORDERED', 'PARTS_READY', 'IN_REPAIR', 'QC_PENDING', 'QC_IN_PROGRESS'].includes(b.status)).length})` },
              { key: 'ready', label: `Ready for Pickup (${bookings.filter((b) => b.status === 'READY_FOR_PICKUP').length})` },
              { key: 'completed', label: `Completed (${bookings.filter((b) => b.status === 'COMPLETED').length})` },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`px-3 py-1.5 rounded-lg font-semibold shrink-0 transition-all ${
                  activeTab === tab.key
                    ? 'bg-[#E8590C] text-white shadow-sm'
                    : 'bg-[#FAF7F2] text-[#6B645B] border border-[#E7E0D5] hover:text-[#1C1917]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Work Orders List */}
        <div className="space-y-4">
          {filteredBookings.length === 0 ? (
            <div className="card-bayflow p-12 bg-[#FFFFFF] text-center space-y-2">
              <Car className="w-10 h-10 text-[#6B645B] mx-auto opacity-50" />
              <h3 className="font-heading font-bold text-base text-[#1C1917]">
                No Work Orders in this View
              </h3>
              <p className="text-xs text-[#6B645B]">
                New customer bookings will automatically appear here via real-time polling.
              </p>
            </div>
          ) : (
            filteredBookings.map((b) => {
              const latestEst = b.estimates?.[0];
              const isRejected = b.status === 'ESTIMATE_REJECTED';

              return (
                <div
                  key={b.id}
                  className={`card-bayflow p-6 bg-[#FFFFFF] space-y-4 transition-all ${
                    b.status === 'AWAITING_CUSTOMER'
                      ? 'border-[#D97706]/50 shadow-sm'
                      : b.status === 'READY_FOR_PICKUP'
                      ? 'border-[#0F5C4D] bg-[#0F5C4D]/5'
                      : ''
                  }`}
                >
                  {/* Top Row: Identifier, Plate, Status */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-[#E7E0D5]">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs font-bold text-[#E8590C] bg-[#E8590C]/10 px-2 py-0.5 rounded border border-[#E8590C]/20">
                        {b.bookingNumber}
                      </span>
                      <span className="font-mono-plate text-sm text-[#1C1917] bg-[#FAF7F2] px-2.5 py-0.5 rounded border border-[#E7E0D5]">
                        {b.licensePlate}
                      </span>
                      <span className="font-bold text-sm text-[#1C1917]">
                        {b.vehicleYear} {b.vehicleMake} {b.vehicleModel}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold border ${
                          b.status === 'PENDING'
                            ? 'bg-[#E8590C]/10 text-[#E8590C] border-[#E8590C]/30 animate-pulse'
                            : b.status === 'CONFIRMED' || b.status === 'ASSIGNED'
                            ? 'bg-[#D97706]/10 text-[#D97706] border-[#D97706]/30'
                            : b.status === 'AWAITING_CUSTOMER'
                            ? 'bg-[#D97706]/15 text-[#D97706] border-[#D97706]/40'
                            : b.status === 'READY_FOR_PICKUP'
                            ? 'bg-[#0F5C4D]/15 text-[#0F5C4D] border-[#0F5C4D]/40'
                            : b.status === 'COMPLETED'
                            ? 'bg-[#0F5C4D]/10 text-[#0F5C4D] border-[#0F5C4D]/20'
                            : 'bg-[#6B645B]/10 text-[#6B645B] border-[#6B645B]/30'
                        }`}
                      >
                        {b.status.replace(/_/g, ' ')}
                      </span>
                      <Link
                        href={`/track/${b.bookingNumber}`}
                        target="_blank"
                        className="p-1 text-[#6B645B] hover:text-[#E8590C]"
                        title="View Customer Tracking Portal"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>

                  {/* Middle: Details Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs text-[#6B645B]">
                    <div>
                      <span className="font-semibold text-[#1C1917] block mb-0.5">Customer</span>
                      <div className="font-medium text-[#1C1917]">{b.customer.name}</div>
                      <div>{b.customer.phone}</div>
                    </div>

                    <div>
                      <span className="font-semibold text-[#1C1917] block mb-0.5">Assigned Technician</span>
                      <div className="font-medium text-[#1C1917]">
                        {b.assignedTechnician?.name || <span className="text-[#D97706]">Unassigned</span>}
                      </div>
                    </div>

                    <div>
                      <span className="font-semibold text-[#1C1917] block mb-0.5">Active Estimate</span>
                      {latestEst ? (
                        <div>
                          <span className="font-mono font-bold text-[#E8590C]">
                            PKR {Number(latestEst.total).toLocaleString()}
                          </span>
                          <span className="text-[10px] ml-1.5 font-semibold text-[#6B645B]">
                            (Rev #{latestEst.revision} • {latestEst.status})
                          </span>
                        </div>
                      ) : (
                        <span>No estimate yet</span>
                      )}
                    </div>

                    <div>
                      <span className="font-semibold text-[#1C1917] block mb-0.5">Requested Services</span>
                      <div className="truncate text-[#1C1917]">
                        {b.services.map((s: any) => s.service.name).join(', ')}
                      </div>
                    </div>
                  </div>

                  {/* Rejection Alert if Customer declined estimate */}
                  {isRejected && (
                    <div className="p-3 bg-[#B91C1C]/10 border border-[#B91C1C]/30 rounded-xl text-xs text-[#B91C1C] flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-bold">Customer Declined Estimate</div>
                        <div className="text-[11px] mt-0.5">
                          Reason: {latestEst?.rejectionReason || 'No specific feedback provided.'} Please click &quot;Revise Estimate&quot; below to adjust pricing/items.
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Customer Notes */}
                  {b.customerNotes && (
                    <div className="text-xs bg-[#FAF7F2] p-2.5 rounded-lg border border-[#E7E0D5]">
                      <span className="font-semibold text-[#1C1917]">Customer Notes: </span>
                      <span className="text-[#6B645B]">{b.customerNotes}</span>
                    </div>
                  )}

                  {/* Bottom Action Triggers */}
                  <div className="pt-3 border-t border-[#E7E0D5] flex flex-wrap items-center justify-between gap-3">
                    <div className="text-[11px] text-[#6B645B]">
                      Last updated: {new Date(b.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>

                    <div className="flex items-center gap-2">
                      {/* 1. Intake: Confirm Booking */}
                      {b.status === 'PENDING' && (
                        <button
                          type="button"
                          disabled={actionLoading}
                          onClick={() => handleConfirm(b.id)}
                          className="px-4 py-2 bg-[#E8590C] hover:bg-[#D04F0A] text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Confirm Booking</span>
                        </button>
                      )}

                      {/* 2. Confirmed: Assign Tech */}
                      {b.status === 'CONFIRMED' && (
                        <button
                          type="button"
                          disabled={actionLoading}
                          onClick={() => {
                            setAssignModalBooking(b);
                            if (availableTechs.length > 0) setSelectedTechId(availableTechs[0].userId);
                          }}
                          className="px-4 py-2 bg-[#D97706] hover:bg-[#B45309] text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                        >
                          <User className="w-3.5 h-3.5" />
                          <span>Assign Technician</span>
                        </button>
                      )}

                      {/* 3. Prepare / Revise Estimate */}
                      {(b.status === 'ESTIMATE_REVIEW' || b.status === 'ESTIMATE_REJECTED' || b.status === 'INSPECTING') && (
                        <button
                          type="button"
                          disabled={actionLoading}
                          onClick={() => openEstimateBuilder(b)}
                          className="px-4 py-2 bg-[#0F5C4D] hover:bg-[#0A473B] text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>{isRejected ? 'Revise Estimate (Rev +1)' : 'Prepare Digital Estimate'}</span>
                        </button>
                      )}

                      {/* 4. Complete Handover */}
                      {b.status === 'READY_FOR_PICKUP' && (
                        <button
                          type="button"
                          disabled={actionLoading}
                          onClick={() => handleCompleteHandover(b.id)}
                          className="px-5 py-2 bg-[#0F5C4D] hover:bg-[#0A473B] text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Complete Handover & Payment</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>

      {/* Modal: Assign Master Technician */}
      <AnimatePresence>
        {assignModalBooking && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
            <motion.div
              initial={shouldReduceMotion ? {} : { opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={shouldReduceMotion ? {} : { opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="card-bayflow p-6 bg-[#FFFFFF] max-w-md w-full space-y-4 shadow-xl"
            >
              <h3 className="font-heading font-bold text-base text-[#1C1917]">
                Assign Technician to #{assignModalBooking.bookingNumber}
              </h3>
              <p className="text-xs text-[#6B645B]">
                Vehicle: {assignModalBooking.vehicleYear} {assignModalBooking.vehicleMake} {assignModalBooking.vehicleModel} ({assignModalBooking.licensePlate})
              </p>
              <form onSubmit={handleAssignTechSubmit} className="space-y-4 text-xs">
                <div>
                  <label className="font-semibold text-[#1C1917] block mb-1">
                    Available Workshop Technicians
                  </label>
                  {availableTechs.length === 0 ? (
                    <div className="p-3 bg-[#FAF7F2] rounded-lg text-[#6B645B] border border-[#E7E0D5]">
                      No active technicians found. Please add a technician in the Owner Portal first.
                    </div>
                  ) : (
                    <select
                      value={selectedTechId}
                      onChange={(e) => setSelectedTechId(e.target.value)}
                      className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#E7E0D5] rounded-lg text-sm text-[#1C1917]"
                    >
                      {availableTechs.map((t) => (
                        <option key={t.userId} value={t.userId}>
                          {t.user.name} ({t.user.email})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-[#E7E0D5]">
                  <button
                    type="button"
                    onClick={() => setAssignModalBooking(null)}
                    className="px-3 py-2 border border-[#E7E0D5] rounded-lg text-[#6B645B]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading || availableTechs.length === 0}
                    className="px-4 py-2 bg-[#E8590C] hover:bg-[#D04F0A] text-white rounded-lg font-bold disabled:opacity-50"
                  >
                    {actionLoading ? 'Assigning...' : 'Assign & Start Workflow'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: Itemized Estimate Builder */}
      <AnimatePresence>
        {estimateModalBooking && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
            <motion.div
              initial={shouldReduceMotion ? {} : { opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={shouldReduceMotion ? {} : { opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="card-bayflow p-6 bg-[#FFFFFF] max-w-2xl w-full space-y-4 shadow-xl max-h-[90vh] overflow-y-auto"
            >
            <div className="flex items-center justify-between border-b border-[#E7E0D5] pb-3">
              <div>
                <h3 className="font-heading font-bold text-base text-[#1C1917]">
                  Digital Estimate Builder
                </h3>
                <span className="text-xs text-[#6B645B]">
                  Booking #{estimateModalBooking.bookingNumber} • {estimateModalBooking.licensePlate}
                </span>
              </div>
              <span className="font-mono text-sm font-bold text-[#E8590C] bg-[#E8590C]/10 px-2.5 py-1 rounded-md">
                Revision #{estimateModalBooking.estimates?.[0] ? estimateModalBooking.estimates[0].revision + 1 : 1}
              </span>
            </div>

            {/* Line Items List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold text-[#1C1917]">
                <span>Billable Line Items (Parts & Labor)</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setEstimateItems([
                        ...estimateItems,
                        { itemType: 'PART', description: 'New OEM Part', quantity: 1, unitPrice: 2500 },
                      ])
                    }
                    className="px-2 py-1 bg-[#FAF7F2] border border-[#E7E0D5] hover:border-[#0F5C4D] text-[#0F5C4D] rounded font-bold"
                  >
                    + Add Part
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setEstimateItems([
                        ...estimateItems,
                        { itemType: 'LABOR', description: 'Labor Service', quantity: 1, unitPrice: 2000 },
                      ])
                    }
                    className="px-2 py-1 bg-[#FAF7F2] border border-[#E7E0D5] hover:border-[#E8590C] text-[#E8590C] rounded font-bold"
                  >
                    + Add Labor
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                {estimateItems.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2.5 bg-[#FAF7F2] rounded-xl border border-[#E7E0D5] text-xs">
                    <select
                      value={item.itemType}
                      onChange={(e) => {
                        const copy = [...estimateItems];
                        copy[idx].itemType = e.target.value as any;
                        setEstimateItems(copy);
                      }}
                      className="px-2 py-1.5 bg-[#FFFFFF] border border-[#E7E0D5] rounded-lg font-bold"
                    >
                      <option value="PART">PART</option>
                      <option value="LABOR">LABOR</option>
                    </select>

                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => {
                        const copy = [...estimateItems];
                        copy[idx].description = e.target.value;
                        setEstimateItems(copy);
                      }}
                      placeholder="Item description..."
                      className="flex-1 px-2.5 py-1.5 bg-[#FFFFFF] border border-[#E7E0D5] rounded-lg text-[#1C1917]"
                    />

                    <div className="w-16">
                      <input
                        type="number"
                        min={0.1}
                        step={0.5}
                        value={item.quantity}
                        onChange={(e) => {
                          const copy = [...estimateItems];
                          copy[idx].quantity = parseFloat(e.target.value) || 1;
                          setEstimateItems(copy);
                        }}
                        className="w-full px-2 py-1.5 bg-[#FFFFFF] border border-[#E7E0D5] rounded-lg font-mono text-center"
                        title="Quantity"
                      />
                    </div>

                    <div className="w-24">
                      <input
                        type="number"
                        min={0}
                        value={item.unitPrice}
                        onChange={(e) => {
                          const copy = [...estimateItems];
                          copy[idx].unitPrice = parseFloat(e.target.value) || 0;
                          setEstimateItems(copy);
                        }}
                        className="w-full px-2 py-1.5 bg-[#FFFFFF] border border-[#E7E0D5] rounded-lg font-mono text-right"
                        title="Unit Price in PKR"
                      />
                    </div>

                    <span className="font-mono font-bold w-20 text-right text-[#1C1917]">
                      PKR {(item.quantity * item.unitPrice).toLocaleString()}
                    </span>

                    <button
                      type="button"
                      onClick={() => setEstimateItems(estimateItems.filter((_, i) => i !== idx))}
                      className="text-[#6B645B] hover:text-[#B91C1C] p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Estimate Breakdown Totals */}
              <div className="p-3.5 bg-[#FFFFFF] border border-[#E7E0D5] rounded-xl space-y-1 text-xs">
                <div className="flex justify-between text-[#6B645B]">
                  <span>Parts Subtotal:</span>
                  <span className="font-mono font-bold text-[#1C1917]">PKR {computedPartsTotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-[#6B645B]">
                  <span>Labor Subtotal:</span>
                  <span className="font-mono font-bold text-[#1C1917]">PKR {computedLaborTotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-[#6B645B]">
                  <span>Sales Tax (0% default):</span>
                  <span className="font-mono font-bold text-[#1C1917]">PKR 0</span>
                </div>
                <div className="border-t border-[#E7E0D5] pt-1.5 mt-1.5 flex justify-between font-bold text-sm">
                  <span className="text-[#1C1917]">Grand Total:</span>
                  <span className="font-mono text-[#E8590C]">PKR {computedGrandTotal.toLocaleString()}</span>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#1C1917] block mb-1">
                  Advisor Notes & Punchlist Remarks for Customer
                </label>
                <textarea
                  rows={2}
                  value={estimateNotes}
                  onChange={(e) => setEstimateNotes(e.target.value)}
                  placeholder="e.g. Front brake pads worn to 2mm. Caliper pins polished. Recommended fluid flush."
                  className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#E7E0D5] rounded-xl text-xs text-[#1C1917]"
                />
              </div>
            </div>

            <div className="flex justify-between pt-3 border-t border-[#E7E0D5]">
              <button
                type="button"
                onClick={() => setEstimateModalBooking(null)}
                className="px-3 py-2 border border-[#E7E0D5] rounded-xl text-xs text-[#6B645B]"
              >
                Cancel
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={actionLoading || estimateItems.length === 0}
                  onClick={() => handleSaveEstimate(false)}
                  className="px-4 py-2 border border-[#E7E0D5] hover:bg-[#FAF7F2] text-[#1C1917] rounded-xl text-xs font-semibold"
                >
                  Save Draft
                </button>
                <button
                  type="button"
                  disabled={actionLoading || estimateItems.length === 0}
                  onClick={() => handleSaveEstimate(true)}
                  className="px-5 py-2 bg-[#E8590C] hover:bg-[#D04F0A] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send to Customer Approval</span>
                </button>
              </div>
            </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <Footer />
    </div>
  );
}
