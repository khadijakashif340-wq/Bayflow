'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { PosHeader } from '@/components/PosHeader';
import { Footer } from '@/components/Footer';
import {
  ShieldCheck,
  CheckCircle2,
  Clock,
  Car,
  AlertCircle,
  Loader2,
  RefreshCw,
  Search,
  ExternalLink,
  ThumbsUp,
  ThumbsDown,
  Lock,
  RotateCcw,
} from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

export default function QcInspectorPosPage() {
  const router = useRouter();
  const shouldReduceMotion = useReducedMotion();

  const [activeShopId, setActiveShopId] = useState<string>('');
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Failure modal state
  const [failModalJob, setFailModalJob] = useState<any | null>(null);
  const [failureTitle, setFailureTitle] = useState('');
  const [failureDesc, setFailureDesc] = useState('');

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

  // 2. Query QC Queue (7s polling)
  const { data: queue = [], refetch, isFetching } = useQuery<any[]>({
    queryKey: ['qc-queue', activeShopId],
    queryFn: async () => {
      if (!activeShopId) return [];
      const res = await fetch(`/api/pos/qc/queue?shopId=${activeShopId}`);
      const json = await res.json();
      return json.data || [];
    },
    enabled: !!activeShopId,
    refetchInterval: 7000,
  });

  // Action: Atomic Job Claim Lock (QC_PENDING -> QC_IN_PROGRESS)
  const handleClaimJob = async (bookingId: string) => {
    try {
      setActionLoading(true);
      setFeedbackMsg(null);

      const res = await fetch('/api/pos/qc/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || 'Failed to claim QC job');

      setFeedbackMsg({
        type: 'success',
        text: 'Atomic job claim lock acquired. You are now the assigned QC Inspector for this vehicle.',
      });
      refetch();
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  // Action: Pass QC (QC_IN_PROGRESS -> READY_FOR_PICKUP)
  const handlePassQc = async (bookingId: string) => {
    try {
      setActionLoading(true);
      setFeedbackMsg(null);

      const res = await fetch('/api/pos/qc/decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId,
          decision: 'PASS',
          note: 'All 30-point safety and mechanical tests passed. Approved for customer pickup.',
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || 'Failed to submit QC approval');

      setFeedbackMsg({
        type: 'success',
        text: 'QC Inspection PASSED! Vehicle has been transitioned to READY_FOR_PICKUP.',
      });
      refetch();
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  // Action: Fail QC Loop (QC_IN_PROGRESS -> IN_REPAIR + QCIssue)
  const handleFailQcSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!failModalJob || !failureTitle || !failureDesc) return;
    try {
      setActionLoading(true);
      setFeedbackMsg(null);

      const res = await fetch('/api/pos/qc/decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: failModalJob.id,
          decision: 'FAIL',
          qcIssueTitle: failureTitle,
          qcIssueDescription: failureDesc,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || 'Failed to submit QC failure');

      setFailModalJob(null);
      setFailureTitle('');
      setFailureDesc('');
      setFeedbackMsg({
        type: 'error',
        text: 'QC Failed! QCIssue record generated and vehicle looped back to IN_REPAIR for technician rework.',
      });
      refetch();
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const activeShop = currentUser?.memberships?.find((m: any) => m.shopId === activeShopId)?.shop || currentUser?.ownedShops?.find((s: any) => s.id === activeShopId);

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF7F2]">
      <PosHeader
        stationTitle="Quality Control Inspection Station"
        roleBadge="QC INSPECTOR"
        userName={currentUser?.name || 'QC Inspector'}
        shopName={activeShop?.name || 'Apex Motor Care'}
        shopId={activeShopId}
        isOwner={currentUser?.userType === 'OWNER'}
      />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1 space-y-6">
        {/* Feedback Alert */}
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

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-[#E7E0D5] pb-4">
          <div>
            <h2 className="text-xl font-bold font-heading text-[#1C1917] flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[#E8590C]" />
              <span>Certified Quality Control Inspection Queue</span>
            </h2>
            <p className="text-xs text-[#6B645B] mt-0.5">
              Independent sign-off station. Claim jobs via transaction lock, verify mechanical punchlists, and approve or fail.
            </p>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-[#6B645B]">
            <RefreshCw className={`w-3.5 h-3.5 text-[#0F5C4D] ${isFetching ? 'animate-spin' : ''}`} />
            <span>Live Queue (7s)</span>
          </div>
        </div>

        {/* QC Queue List */}
        <div className="space-y-4">
          {queue.length === 0 ? (
            <div className="card-bayflow p-12 bg-[#FFFFFF] text-center space-y-2">
              <ShieldCheck className="w-10 h-10 text-[#0F5C4D] mx-auto opacity-70" />
              <h3 className="font-heading font-bold text-base text-[#1C1917]">
                QC Queue is Clear
              </h3>
              <p className="text-xs text-[#6B645B]">
                When technicians complete repairs and torque checks, vehicles will arrive here automatically.
              </p>
            </div>
          ) : (
            queue.map((j) => {
              const isClaimedByMe = j.qcInspectorId === currentUser?.id;
              const isInTesting = j.status === 'QC_IN_PROGRESS';
              const isReadyPickup = j.status === 'READY_FOR_PICKUP';

              return (
                <div
                  key={j.id}
                  className={`card-bayflow p-6 bg-[#FFFFFF] space-y-4 ${
                    isInTesting ? 'border-2 border-[#E8590C] shadow-sm' : ''
                  }`}
                >
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

                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold border ${
                        isInTesting
                          ? 'bg-[#E8590C]/10 text-[#E8590C] border-[#E8590C]/30 animate-pulse'
                          : isReadyPickup
                          ? 'bg-[#0F5C4D]/10 text-[#0F5C4D] border-[#0F5C4D]/30'
                          : 'bg-[#D97706]/10 text-[#D97706] border-[#D97706]/30'
                      }`}
                    >
                      {j.status.replace(/_/g, ' ')}
                    </span>
                  </div>

                  {/* Personnel Info */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-[#6B645B]">
                    <div>
                      <span className="font-semibold text-[#1C1917] block mb-0.5">Repair Technician</span>
                      <span className="text-[#1C1917]">{j.assignedTechnician?.name || 'Unassigned'}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-[#1C1917] block mb-0.5">Service Advisor</span>
                      <span className="text-[#1C1917]">{j.assignedAdvisor?.name || 'Unassigned'}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-[#1C1917] block mb-0.5">Assigned Inspector</span>
                      <span className="text-[#1C1917]">
                        {j.qcInspector?.name || <span className="text-[#D97706]">Awaiting Claim</span>}
                      </span>
                    </div>
                  </div>

                  {/* Standard QC Checklist Summary */}
                  <div className="p-3 bg-[#FAF7F2] rounded-xl border border-[#E7E0D5] text-xs space-y-1.5">
                    <span className="font-bold text-[#1C1917] block">Standard 30-Point Inspection Criteria:</span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-[#6B645B]">
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#0F5C4D]" />
                        <span>Torque specs verified</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#0F5C4D]" />
                        <span>Zero fluid leaks</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#0F5C4D]" />
                        <span>OBD-II DTC scan clean</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#0F5C4D]" />
                        <span>Road test braking ok</span>
                      </div>
                    </div>
                  </div>

                  {/* Action Triggers */}
                  <div className="pt-3 border-t border-[#E7E0D5] flex items-center justify-between gap-3">
                    <div className="text-[11px] text-[#6B645B]">
                      Work completed: {j.services.map((s: any) => s.service.name).join(', ')}
                    </div>

                    <div className="flex items-center gap-2">
                      {/* 1. Claim Job: QC_PENDING -> QC_IN_PROGRESS */}
                      {j.status === 'QC_PENDING' && (
                        <button
                          type="button"
                          disabled={actionLoading}
                          onClick={() => handleClaimJob(j.id)}
                          className="px-5 py-2 bg-[#E8590C] hover:bg-[#D04F0A] text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                        >
                          <Lock className="w-3.5 h-3.5" />
                          <span>Claim Inspection (Transaction Lock)</span>
                        </button>
                      )}

                      {/* 2. Decisions: Pass or Fail */}
                      {j.status === 'QC_IN_PROGRESS' && (
                        <>
                          <button
                            type="button"
                            disabled={actionLoading}
                            onClick={() => {
                              setFailModalJob(j);
                              setFailureTitle('Punchlist Defect Detected');
                              setFailureDesc('');
                            }}
                            className="px-4 py-2 border border-[#B91C1C]/40 text-[#B91C1C] hover:bg-[#B91C1C]/10 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                          >
                            <ThumbsDown className="w-3.5 h-3.5" />
                            <span>Fail QC (Rework Loop)</span>
                          </button>

                          <button
                            type="button"
                            disabled={actionLoading}
                            onClick={() => handlePassQc(j.id)}
                            className="px-5 py-2 bg-[#0F5C4D] hover:bg-[#0A473B] text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                          >
                            <ThumbsUp className="w-3.5 h-3.5" />
                            <span>Pass QC &rarr; READY_FOR_PICKUP</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>

      {/* Modal: QC Failure Loop */}
      <AnimatePresence>
        {failModalJob && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
            <motion.div
              initial={shouldReduceMotion ? {} : { opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={shouldReduceMotion ? {} : { opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="card-bayflow p-6 bg-[#FFFFFF] max-w-md w-full space-y-4 shadow-xl"
            >
              <h3 className="font-heading font-bold text-base text-[#B91C1C] flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                <span>Record QC Failure & Punchlist Defect</span>
              </h3>
              <p className="text-xs text-[#6B645B]">
                This action transitions the vehicle back to <code className="font-mono font-bold text-[#1C1917]">IN_REPAIR</code>, creates an immutable QCIssue row, and alerts Master Tech {failModalJob.assignedTechnician?.name}.
              </p>
              <form onSubmit={handleFailQcSubmit} className="space-y-3 text-xs">
                <div>
                  <label className="font-semibold text-[#1C1917] block mb-1">
                    Defect Title
                  </label>
                  <input
                    type="text"
                    required
                    value={failureTitle}
                    onChange={(e) => setFailureTitle(e.target.value)}
                    placeholder="e.g. Brake caliper fluid leak under pressure"
                    className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#E7E0D5] rounded-lg text-sm text-[#1C1917]"
                  />
                </div>

                <div>
                  <label className="font-semibold text-[#1C1917] block mb-1">
                    Detailed Punchlist Instructions for Technician
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={failureDesc}
                    onChange={(e) => setFailureDesc(e.target.value)}
                    placeholder="e.g. Rear right bleed nipple was not torqued to 12 Nm. Minor seepage observed during 30 PSI brake pressure test. Clean and re-torque."
                    className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#E7E0D5] rounded-lg text-xs text-[#1C1917]"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-[#E7E0D5]">
                  <button
                    type="button"
                    onClick={() => setFailModalJob(null)}
                    className="px-3 py-2 border border-[#E7E0D5] rounded-lg text-[#6B645B]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading || !failureTitle || !failureDesc}
                    className="px-4 py-2 bg-[#B91C1C] hover:bg-[#991B1B] text-white rounded-lg font-bold disabled:opacity-50"
                  >
                    {actionLoading ? 'Looping Back...' : 'Fail QC & Send Back to Bay'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <Footer />
    </div>
  );
}
