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
  AlertCircle,
  Loader2,
  RefreshCw,
  Search,
  ExternalLink,
  ChevronRight,
  Shield,
  FileText,
  Play,
  Check,
  Package,
} from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

export default function TechnicianPosPage() {
  const router = useRouter();
  const shouldReduceMotion = useReducedMotion();

  const [activeShopId, setActiveShopId] = useState<string>('');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Diagnostic submit modal
  const [inspectModalBooking, setInspectModalBooking] = useState<any | null>(null);
  const [diagnosticNotes, setDiagnosticNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 1. Load Session
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

  // 2. React Query Polling (7s live updates as per brief)
  const { data: jobs = [], refetch, isFetching } = useQuery<any[]>({
    queryKey: ['tech-jobs', activeShopId],
    queryFn: async () => {
      if (!activeShopId) return [];
      const res = await fetch(`/api/pos/technician/jobs?shopId=${activeShopId}`);
      const json = await res.json();
      return json.data || [];
    },
    enabled: !!activeShopId,
    refetchInterval: 7000,
  });

  // Action: Transition execution
  const handleTransition = async (bookingId: string, targetStatus: string, note?: string) => {
    try {
      setActionLoading(true);
      setFeedbackMsg(null);

      const res = await fetch('/api/pos/technician/transition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId,
          targetStatus,
          note,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || 'Failed to update job status');

      setInspectModalBooking(null);
      setDiagnosticNotes('');
      setFeedbackMsg({ type: 'success', text: `Status updated to ${targetStatus.replace(/_/g, ' ')}.` });
      refetch();
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const filteredJobs = jobs.filter((j) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchPlate = j.licensePlate.toLowerCase().includes(q);
      const matchNumber = j.bookingNumber.toLowerCase().includes(q);
      if (!matchPlate && !matchNumber) return false;
    }

    if (activeTab === 'diagnosis') return j.status === 'ASSIGNED' || j.status === 'INSPECTING';
    if (activeTab === 'repair') return j.status === 'PARTS_READY' || j.status === 'IN_REPAIR';
    if (activeTab === 'qc') return j.status === 'QC_PENDING' || j.status === 'QC_IN_PROGRESS';
    return true;
  });

  const activeShop = currentUser?.memberships?.find((m: any) => m.shopId === activeShopId)?.shop || currentUser?.ownedShops?.find((s: any) => s.id === activeShopId);

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF7F2]">
      <PosHeader
        stationTitle="Master Technician Station"
        roleBadge="TECHNICIAN"
        userName={currentUser?.name || 'Technician'}
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
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-[#6B645B] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search assigned plate, booking #..."
                className="w-full pl-9 pr-3 py-2 bg-[#FAF7F2] border border-[#E7E0D5] rounded-xl text-xs text-[#1C1917] focus:outline-none focus:border-[#E8590C]"
              />
            </div>

            <div className="flex items-center gap-2 text-xs text-[#6B645B]">
              <RefreshCw className={`w-3.5 h-3.5 text-[#0F5C4D] ${isFetching ? 'animate-spin' : ''}`} />
              <span>Live Terminal Polling (7s)</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            {[
              { key: 'all', label: `All Assigned (${jobs.length})` },
              { key: 'diagnosis', label: `Diagnosis Queue (${jobs.filter((j) => j.status === 'ASSIGNED' || j.status === 'INSPECTING').length})` },
              { key: 'repair', label: `Mechanical Repairs (${jobs.filter((j) => j.status === 'PARTS_READY' || j.status === 'IN_REPAIR').length})` },
              { key: 'qc', label: `Submitted to QC (${jobs.filter((j) => j.status === 'QC_PENDING' || j.status === 'QC_IN_PROGRESS').length})` },
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
          {filteredJobs.length === 0 ? (
            <div className="card-bayflow p-12 bg-[#FFFFFF] text-center space-y-2">
              <Wrench className="w-10 h-10 text-[#6B645B] mx-auto opacity-50" />
              <h3 className="font-heading font-bold text-base text-[#1C1917]">
                No Work Orders Assigned to Your Bay
              </h3>
              <p className="text-xs text-[#6B645B]">
                When the Service Advisor assigns a job to you, it will appear here immediately.
              </p>
            </div>
          ) : (
            filteredJobs.map((j) => {
              const latestQC = j.qcIssues?.[0];
              const isQCRework = j.status === 'IN_REPAIR' && latestQC && !latestQC.resolved;

              return (
                <div
                  key={j.id}
                  className={`card-bayflow p-6 bg-[#FFFFFF] space-y-4 ${
                    isQCRework ? 'border-2 border-[#B91C1C] shadow-sm' : ''
                  }`}
                >
                  {/* Top Bar: Plate, Model, Status */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-[#E7E0D5]">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs font-bold text-[#E8590C] bg-[#E8590C]/10 px-2 py-0.5 rounded border border-[#E8590C]/20">
                        {j.bookingNumber}
                      </span>
                      <span className="font-mono-plate text-sm text-[#1C1917] bg-[#FAF7F2] px-2.5 py-0.5 rounded border border-[#E7E0D5]">
                        {j.licensePlate}
                      </span>
                      <span className="font-bold text-sm text-[#1C1917]">
                        {j.vehicleYear} {j.vehicleMake} {j.vehicleModel}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold border ${
                          isQCRework
                            ? 'bg-[#B91C1C]/10 text-[#B91C1C] border-[#B91C1C]/30 animate-pulse'
                            : j.status === 'INSPECTING' || j.status === 'IN_REPAIR'
                            ? 'bg-[#E8590C]/10 text-[#E8590C] border-[#E8590C]/30'
                            : j.status === 'PARTS_READY'
                            ? 'bg-[#0F5C4D]/10 text-[#0F5C4D] border-[#0F5C4D]/30'
                            : 'bg-[#6B645B]/10 text-[#6B645B] border-[#6B645B]/30'
                        }`}
                      >
                        {isQCRework ? 'QC REWORK REQUIRED' : j.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </div>

                  {/* QC REWORK ALERT BANNER */}
                  {isQCRework && (
                    <div className="p-3.5 bg-[#B91C1C]/10 border border-[#B91C1C]/30 rounded-xl text-xs space-y-1 text-[#B91C1C]">
                      <div className="flex items-center gap-2 font-bold">
                        <AlertCircle className="w-4 h-4" />
                        <span>QC Inspector Punchlist Rejection: {latestQC.title}</span>
                      </div>
                      <p className="text-[11px] leading-relaxed pl-6">
                        {latestQC.description}
                      </p>
                    </div>
                  )}

                  {/* Customer Symptoms & Requested Services */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div className="bg-[#FAF7F2] p-3 rounded-xl border border-[#E7E0D5]">
                      <span className="font-semibold text-[#1C1917] block mb-1">Customer Reported Symptoms:</span>
                      <p className="text-[#6B645B]">
                        {j.customerNotes || 'Routine checkup requested.'}
                      </p>
                    </div>

                    <div className="bg-[#FAF7F2] p-3 rounded-xl border border-[#E7E0D5]">
                      <span className="font-semibold text-[#1C1917] block mb-1">Work Order Packages:</span>
                      <div className="text-[#1C1917] font-medium">
                        {j.services.map((s: any) => s.service.name).join(' • ')}
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons for Technician */}
                  <div className="pt-3 border-t border-[#E7E0D5] flex flex-wrap items-center justify-between gap-3">
                    <div className="text-[11px] text-[#6B645B]">
                      Advisor: <span className="text-[#1C1917] font-medium">{j.assignedAdvisor?.name || 'Unassigned'}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Step 1: Start Inspection */}
                      {j.status === 'ASSIGNED' && (
                        <button
                          type="button"
                          disabled={actionLoading}
                          onClick={() => handleTransition(j.id, 'INSPECTING', 'Technician started vehicle lift diagnosis.')}
                          className="px-4 py-2 bg-[#E8590C] hover:bg-[#D04F0A] text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                        >
                          <Play className="w-3.5 h-3.5" />
                          <span>Start Lift Diagnosis</span>
                        </button>
                      )}

                      {/* Step 2: Complete Inspection & Submit Findings */}
                      {j.status === 'INSPECTING' && (
                        <button
                          type="button"
                          disabled={actionLoading}
                          onClick={() => setInspectModalBooking(j)}
                          className="px-4 py-2 bg-[#0F5C4D] hover:bg-[#0A473B] text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>Complete Diagnosis & Submit Findings</span>
                        </button>
                      )}

                      {/* Step 3: Parts Ready -> Start Repair */}
                      {j.status === 'PARTS_READY' && (
                        <button
                          type="button"
                          disabled={actionLoading}
                          onClick={() => handleTransition(j.id, 'IN_REPAIR', 'Technician collected parts and started mechanical repairs.')}
                          className="px-5 py-2 bg-[#0F5C4D] hover:bg-[#0A473B] text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                        >
                          <Wrench className="w-3.5 h-3.5" />
                          <span>Start Mechanical Repair</span>
                        </button>
                      )}

                      {/* Step 4: In Repair -> Complete & Send to QC */}
                      {j.status === 'IN_REPAIR' && (
                        <button
                          type="button"
                          disabled={actionLoading}
                          onClick={() => handleTransition(j.id, 'QC_PENDING', 'Technician completed repairs and torque checks. Ready for QC inspection.')}
                          className="px-5 py-2 bg-[#E8590C] hover:bg-[#D04F0A] text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                        >
                          <Shield className="w-3.5 h-3.5" />
                          <span>Repairs Done &rarr; Submit to QC Queue</span>
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

      {/* Modal: Submit Inspection Findings */}
      <AnimatePresence>
        {inspectModalBooking && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
            <motion.div
              initial={shouldReduceMotion ? {} : { opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={shouldReduceMotion ? {} : { opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="card-bayflow p-6 bg-[#FFFFFF] max-w-md w-full space-y-4 shadow-xl"
            >
              <h3 className="font-heading font-bold text-base text-[#1C1917]">
                Submit Diagnostic Findings for #{inspectModalBooking.bookingNumber}
              </h3>
              <p className="text-xs text-[#6B645B]">
                Vehicle: {inspectModalBooking.licensePlate} ({inspectModalBooking.vehicleMake} {inspectModalBooking.vehicleModel})
              </p>
              <div className="space-y-3 text-xs">
                <div>
                  <label className="font-semibold text-[#1C1917] block mb-1">
                    Master Technician Findings & Recommended Punchlist
                  </label>
                  <textarea
                    rows={4}
                    required
                    value={diagnosticNotes}
                    onChange={(e) => setDiagnosticNotes(e.target.value)}
                    placeholder="e.g. Front brake pads worn to 2.5mm. Front left rotor has minor groove polish required. Suspension bushings healthy. Low AC refrigerant at 22 PSI."
                    className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#E7E0D5] rounded-xl text-xs text-[#1C1917]"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-[#E7E0D5]">
                  <button
                    type="button"
                    onClick={() => setInspectModalBooking(null)}
                    className="px-3 py-2 border border-[#E7E0D5] rounded-lg text-[#6B645B]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={actionLoading || !diagnosticNotes.trim()}
                    onClick={() => handleTransition(inspectModalBooking.id, 'ESTIMATE_REVIEW', diagnosticNotes)}
                    className="px-4 py-2 bg-[#0F5C4D] hover:bg-[#0A473B] text-white rounded-lg font-bold disabled:opacity-50"
                  >
                    {actionLoading ? 'Submitting...' : 'Submit to Advisor (ESTIMATE_REVIEW)'}
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
