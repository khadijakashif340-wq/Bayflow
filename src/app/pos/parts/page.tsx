'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { PosHeader } from '@/components/PosHeader';
import { Footer } from '@/components/Footer';
import {
  Package,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  RefreshCw,
  Search,
  ShoppingCart,
  Plus,
  ArrowRight,
  TrendingUp,
  Inbox,
  Truck,
  Check,
} from 'lucide-react';

export default function PartsPosPage() {
  const router = useRouter();

  const [activeShopId, setActiveShopId] = useState<string>('');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'jobs' | 'inventory' | 'pos'>('jobs');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [allocateModalJob, setAllocateModalJob] = useState<any | null>(null);
  const [selectedPartId, setSelectedPartId] = useState('');
  const [allocateQty, setAllocateQty] = useState(1);
  const [markReadyChecked, setMarkReadyChecked] = useState(true);

  const [createPoModal, setCreatePoModal] = useState(false);
  const [poBookingId, setPoBookingId] = useState('');
  const [poSupplier, setPoSupplier] = useState('');
  const [poItems, setPoItems] = useState<Array<{ partId: string; quantityOrdered: number; unitCost: number }>>([]);

  const [receiveModalPO, setReceiveModalPO] = useState<any | null>(null);
  const [receivedCounts, setReceivedCounts] = useState<Record<string, number>>({});
  const [linkedReceiveBookingId, setLinkedReceiveBookingId] = useState<string>('');

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

  // 2. Query Parts Queue (7s polling)
  const { data, refetch, isFetching } = useQuery<{
    pendingBookings: any[];
    parts: any[];
    purchaseOrders: any[];
  }>({
    queryKey: ['parts-queue', activeShopId],
    queryFn: async () => {
      if (!activeShopId) return { pendingBookings: [], parts: [], purchaseOrders: [] };
      const res = await fetch(`/api/pos/parts/queue?shopId=${activeShopId}`);
      const json = await res.json();
      return json.data || { pendingBookings: [], parts: [], purchaseOrders: [] };
    },
    enabled: !!activeShopId,
    refetchInterval: 7000,
  });

  const pendingBookings = data?.pendingBookings || [];
  const parts = data?.parts || [];
  const purchaseOrders = data?.purchaseOrders || [];

  // Handler: Direct Allocate In-Stock Part
  const handleAllocateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allocateModalJob || !selectedPartId) return;
    try {
      setActionLoading(true);
      setFeedbackMsg(null);

      const res = await fetch('/api/pos/parts/allocate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: allocateModalJob.id,
          partId: selectedPartId,
          quantity: allocateQty,
          markReady: markReadyChecked,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || 'Failed to allocate part');

      setAllocateModalJob(null);
      setFeedbackMsg({
        type: 'success',
        text: markReadyChecked
          ? 'Parts allocated! Vehicle transitioned to PARTS_READY for Master Tech.'
          : 'Part allocated from inventory.',
      });
      refetch();
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  // Handler: Create Purchase Order
  const handleCreatePoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setActionLoading(true);
      setFeedbackMsg(null);

      const res = await fetch('/api/pos/parts/po', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopId: activeShopId,
          bookingId: poBookingId || undefined,
          supplierName: poSupplier,
          items: poItems,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || 'Failed to create Purchase Order');

      setCreatePoModal(false);
      setPoSupplier('');
      setPoItems([]);
      setFeedbackMsg({ type: 'success', text: `Purchase Order created. Linked job moved to PARTS_ORDERED.` });
      refetch();
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  // Handler: Receive PO Items
  const handleReceiveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiveModalPO) return;
    try {
      setActionLoading(true);
      setFeedbackMsg(null);

      const receivedList = Object.entries(receivedCounts).map(([itemId, qty]) => ({
        itemId,
        quantityReceivedNow: qty,
      }));

      const res = await fetch(`/api/pos/parts/po/${receiveModalPO.id}/receive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: linkedReceiveBookingId || undefined,
          receivedItems: receivedList,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || 'Failed to receive PO items');

      setReceiveModalPO(null);
      setReceivedCounts({});
      setFeedbackMsg({
        type: 'success',
        text: 'Stock received into inventory! Inventory levels updated.',
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
        stationTitle="Parts & Inventory Station"
        roleBadge="PARTS PERSON"
        userName={currentUser?.name || 'Parts Specialist'}
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

        {/* Navigation Tabs */}
        <div className="card-bayflow p-4 bg-[#FFFFFF] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab('jobs')}
              className={`px-4 py-2 rounded-lg font-bold flex items-center gap-1.5 transition-all ${
                activeTab === 'jobs'
                  ? 'bg-[#E8590C] text-white shadow-sm'
                  : 'bg-[#FAF7F2] text-[#6B645B] border border-[#E7E0D5] hover:text-[#1C1917]'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              <span>Jobs Requiring Parts ({pendingBookings.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('inventory')}
              className={`px-4 py-2 rounded-lg font-bold flex items-center gap-1.5 transition-all ${
                activeTab === 'inventory'
                  ? 'bg-[#E8590C] text-white shadow-sm'
                  : 'bg-[#FAF7F2] text-[#6B645B] border border-[#E7E0D5] hover:text-[#1C1917]'
              }`}
            >
              <Inbox className="w-3.5 h-3.5" />
              <span>Inventory Stock ({parts.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('pos')}
              className={`px-4 py-2 rounded-lg font-bold flex items-center gap-1.5 transition-all ${
                activeTab === 'pos'
                  ? 'bg-[#E8590C] text-white shadow-sm'
                  : 'bg-[#FAF7F2] text-[#6B645B] border border-[#E7E0D5] hover:text-[#1C1917]'
              }`}
            >
              <Truck className="w-3.5 h-3.5" />
              <span>Purchase Orders ({purchaseOrders.length})</span>
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setCreatePoModal(true);
                if (parts.length > 0) {
                  setPoItems([{ partId: parts[0].id, quantityOrdered: 5, unitCost: Number(parts[0].costPrice) }]);
                }
              }}
              className="px-3.5 py-1.5 bg-[#0F5C4D] hover:bg-[#0A473B] text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Purchase Order</span>
            </button>

            <div className="flex items-center gap-1.5 text-xs text-[#6B645B]">
              <RefreshCw className={`w-3.5 h-3.5 text-[#0F5C4D] ${isFetching ? 'animate-spin' : ''}`} />
              <span>Polling (7s)</span>
            </div>
          </div>
        </div>

        {/* TAB 1: JOBS REQUIRING PARTS */}
        {activeTab === 'jobs' && (
          <div className="space-y-4">
            {pendingBookings.length === 0 ? (
              <div className="card-bayflow p-12 bg-[#FFFFFF] text-center space-y-2">
                <CheckCircle2 className="w-10 h-10 text-[#0F5C4D] mx-auto opacity-70" />
                <h3 className="font-heading font-bold text-base text-[#1C1917]">
                  All Work Orders Have Parts Allocated
                </h3>
                <p className="text-xs text-[#6B645B]">
                  When an estimate is approved by a customer, the work order will arrive here for fulfillment.
                </p>
              </div>
            ) : (
              pendingBookings.map((b) => {
                const isOrdered = b.status === 'PARTS_ORDERED';
                const isReady = b.status === 'PARTS_READY';

                return (
                  <div key={b.id} className="card-bayflow p-6 bg-[#FFFFFF] space-y-4">
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

                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold border ${
                          isReady
                            ? 'bg-[#0F5C4D]/10 text-[#0F5C4D] border-[#0F5C4D]/30'
                            : isOrdered
                            ? 'bg-[#D97706]/10 text-[#D97706] border-[#D97706]/30'
                            : 'bg-[#E8590C]/10 text-[#E8590C] border-[#E8590C]/30'
                        }`}
                      >
                        {b.status.replace(/_/g, ' ')}
                      </span>
                    </div>

                    {/* Approved Estimate Parts Checklist */}
                    {b.estimates?.[0] && (
                      <div className="space-y-1.5 text-xs">
                        <span className="font-bold text-[#1C1917] block">
                          Required Customer-Approved Parts:
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {b.estimates[0].items
                            .filter((i: any) => i.itemType === 'PART')
                            .map((p: any) => (
                              <div
                                key={p.id}
                                className="p-2.5 rounded-lg bg-[#FAF7F2] border border-[#E7E0D5] flex items-center justify-between"
                              >
                                <div>
                                  <span className="font-medium text-[#1C1917]">{p.description}</span>
                                  <div className="text-[10px] text-[#6B645B]">Qty: {Number(p.quantity)}</div>
                                </div>
                                <span className="font-mono font-semibold text-[#1C1917]">
                                  PKR {Number(p.total).toLocaleString()}
                                </span>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    {/* Action Triggers */}
                    <div className="pt-3 border-t border-[#E7E0D5] flex items-center justify-between gap-3">
                      <div className="text-[11px] text-[#6B645B]">
                        Allocations: {b.partAllocations?.length || 0} parts assigned
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Allocate from Stock */}
                        {!isReady && (
                          <button
                            type="button"
                            onClick={() => {
                              setAllocateModalJob(b);
                              if (parts.length > 0) setSelectedPartId(parts[0].id);
                            }}
                            className="px-4 py-2 bg-[#0F5C4D] hover:bg-[#0A473B] text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                          >
                            <Package className="w-3.5 h-3.5" />
                            <span>Allocate Available Stock</span>
                          </button>
                        )}

                        {/* Order Missing Parts */}
                        {b.status !== 'PARTS_READY' && (
                          <button
                            type="button"
                            onClick={() => {
                              setPoBookingId(b.id);
                              setCreatePoModal(true);
                              if (parts.length > 0) {
                                setPoItems([{ partId: parts[0].id, quantityOrdered: 2, unitCost: Number(parts[0].costPrice) }]);
                              }
                            }}
                            className="px-4 py-2 bg-[#FAF7F2] hover:bg-[#E7E0D5] text-[#1C1917] border border-[#E7E0D5] rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                          >
                            <ShoppingCart className="w-3.5 h-3.5 text-[#E8590C]" />
                            <span>Create PO (Missing Parts)</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* TAB 2: INVENTORY STOCK LIST */}
        {activeTab === 'inventory' && (
          <div className="card-bayflow bg-[#FFFFFF] overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAF7F2] border-b border-[#E7E0D5] text-[#6B645B] uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4 font-semibold">SKU / Item Name</th>
                  <th className="py-3 px-4 font-semibold">Category</th>
                  <th className="py-3 px-4 font-semibold text-center">In Stock</th>
                  <th className="py-3 px-4 font-semibold text-center">Allocated</th>
                  <th className="py-3 px-4 font-semibold text-right">Selling Price (PKR)</th>
                  <th className="py-3 px-4 font-semibold text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7E0D5]">
                {parts.map((p) => {
                  const isLow = p.quantityInStock <= p.minStockLevel;
                  return (
                    <tr key={p.id} className="hover:bg-[#FAF7F2]/40">
                      <td className="py-3 px-4">
                        <div className="font-mono text-[11px] font-bold text-[#E8590C]">{p.sku}</div>
                        <div className="font-bold text-[#1C1917]">{p.name}</div>
                      </td>
                      <td className="py-3 px-4 text-[#6B645B]">{p.category}</td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-sm text-[#1C1917]">
                        {p.quantityInStock}
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-[#6B645B]">
                        {p.quantityAllocated}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-[#1C1917]">
                        PKR {Number(p.unitPrice).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            isLow
                              ? 'bg-[#B91C1C]/10 text-[#B91C1C] border border-[#B91C1C]/20 animate-pulse'
                              : 'bg-[#0F5C4D]/10 text-[#0F5C4D]'
                          }`}
                        >
                          {isLow ? 'LOW STOCK' : 'IN STOCK'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 3: PURCHASE ORDERS LIST */}
        {activeTab === 'pos' && (
          <div className="space-y-4">
            {purchaseOrders.length === 0 ? (
              <div className="card-bayflow p-12 bg-[#FFFFFF] text-center space-y-2">
                <Truck className="w-10 h-10 text-[#6B645B] mx-auto opacity-50" />
                <h3 className="font-heading font-bold text-base text-[#1C1917]">
                  No Purchase Orders Placed Yet
                </h3>
              </div>
            ) : (
              purchaseOrders.map((po) => (
                <div key={po.id} className="card-bayflow p-6 bg-[#FFFFFF] space-y-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-[#E7E0D5]">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-[#E8590C] bg-[#E8590C]/10 px-2 py-0.5 rounded">
                          {po.poNumber}
                        </span>
                        <span className="font-bold text-sm text-[#1C1917]">
                          Supplier: {po.supplierName}
                        </span>
                      </div>
                      <div className="text-[11px] text-[#6B645B] mt-0.5">
                        Created on {new Date(po.createdAt).toLocaleDateString()}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold border ${
                          po.status === 'RECEIVED'
                            ? 'bg-[#0F5C4D]/10 text-[#0F5C4D] border-[#0F5C4D]/30'
                            : po.status === 'PARTIALLY_RECEIVED'
                            ? 'bg-[#D97706]/10 text-[#D97706] border-[#D97706]/30'
                            : 'bg-[#E8590C]/10 text-[#E8590C] border-[#E8590C]/30'
                        }`}
                      >
                        {po.status}
                      </span>

                      {po.status !== 'RECEIVED' && (
                        <button
                          type="button"
                          onClick={() => {
                            setReceiveModalPO(po);
                            const initialCounts: Record<string, number> = {};
                            po.items.forEach((item: any) => {
                              const remaining = item.quantityOrdered - item.quantityReceived;
                              initialCounts[item.id] = remaining > 0 ? remaining : 0;
                            });
                            setReceivedCounts(initialCounts);
                          }}
                          className="px-4 py-1.5 bg-[#0F5C4D] hover:bg-[#0A473B] text-white rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                        >
                          <Inbox className="w-3.5 h-3.5" />
                          <span>Receive Shipment</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Line items table */}
                  <div className="overflow-x-auto text-xs">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-[#E7E0D5] text-[#6B645B]">
                          <th className="py-1.5 font-semibold">Part</th>
                          <th className="py-1.5 font-semibold text-center">Ordered</th>
                          <th className="py-1.5 font-semibold text-center">Received</th>
                          <th className="py-1.5 font-semibold text-right">Unit Cost</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E7E0D5]">
                        {po.items.map((i: any) => (
                          <tr key={i.id}>
                            <td className="py-2 font-medium text-[#1C1917]">{i.part.name}</td>
                            <td className="py-2 text-center font-mono">{i.quantityOrdered}</td>
                            <td className="py-2 text-center font-mono font-bold text-[#0F5C4D]">
                              {i.quantityReceived}
                            </td>
                            <td className="py-2 text-right font-mono">
                              PKR {Number(i.unitCost).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </main>

      {/* Modal: Allocate In-Stock Part */}
      {allocateModalJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="card-bayflow p-6 bg-[#FFFFFF] max-w-md w-full space-y-4 shadow-xl">
            <h3 className="font-heading font-bold text-base text-[#1C1917]">
              Allocate Part to #{allocateModalJob.bookingNumber}
            </h3>
            <p className="text-xs text-[#6B645B]">
              Vehicle: {allocateModalJob.licensePlate} ({allocateModalJob.vehicleMake} {allocateModalJob.vehicleModel})
            </p>
            <form onSubmit={handleAllocateSubmit} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-[#1C1917] block mb-1">
                  Select Part from Shop Inventory
                </label>
                <select
                  value={selectedPartId}
                  onChange={(e) => setSelectedPartId(e.target.value)}
                  className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#E7E0D5] rounded-lg text-sm text-[#1C1917]"
                >
                  {parts.map((p) => (
                    <option key={p.id} value={p.id} disabled={p.quantityInStock <= 0}>
                      {p.name} ({p.sku}) — {p.quantityInStock} in stock (PKR {Number(p.unitPrice).toLocaleString()})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-[#1C1917] block mb-1">Quantity</label>
                <input
                  type="number"
                  min={1}
                  value={allocateQty}
                  onChange={(e) => setAllocateQty(parseInt(e.target.value, 10) || 1)}
                  className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#E7E0D5] rounded-lg text-sm font-mono"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer pt-2">
                <input
                  type="checkbox"
                  checked={markReadyChecked}
                  onChange={(e) => setMarkReadyChecked(e.target.checked)}
                  className="accent-[#0F5C4D] w-4 h-4"
                />
                <span className="font-semibold text-[#1C1917]">
                  All required parts ready &rarr; Transition booking to PARTS_READY
                </span>
              </label>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#E7E0D5]">
                <button
                  type="button"
                  onClick={() => setAllocateModalJob(null)}
                  className="px-3 py-2 border border-[#E7E0D5] rounded-lg text-[#6B645B]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-[#0F5C4D] hover:bg-[#0A473B] text-white rounded-lg font-bold disabled:opacity-50"
                >
                  {actionLoading ? 'Allocating...' : 'Allocate Stock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Create PO */}
      {createPoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="card-bayflow p-6 bg-[#FFFFFF] max-w-lg w-full space-y-4 shadow-xl">
            <h3 className="font-heading font-bold text-base text-[#1C1917]">
              Create Supplier Purchase Order
            </h3>
            <form onSubmit={handleCreatePoSubmit} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-[#1C1917] block mb-1">Supplier Name</label>
                <input
                  type="text"
                  required
                  value={poSupplier}
                  onChange={(e) => setPoSupplier(e.target.value)}
                  placeholder="e.g. Al-Madina Auto Spares Rawalpindi"
                  className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#E7E0D5] rounded-lg text-sm text-[#1C1917]"
                />
              </div>

              {/* Items on PO */}
              <div className="space-y-2">
                <span className="font-semibold text-[#1C1917] block">Parts to Order</span>
                {poItems.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2 bg-[#FAF7F2] rounded-lg border border-[#E7E0D5]">
                    <select
                      value={item.partId}
                      onChange={(e) => {
                        const copy = [...poItems];
                        copy[idx].partId = e.target.value;
                        setPoItems(copy);
                      }}
                      className="flex-1 px-2 py-1.5 bg-[#FFFFFF] border border-[#E7E0D5] rounded text-xs"
                    >
                      {parts.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min={1}
                      value={item.quantityOrdered}
                      onChange={(e) => {
                        const copy = [...poItems];
                        copy[idx].quantityOrdered = parseInt(e.target.value, 10) || 1;
                        setPoItems(copy);
                      }}
                      className="w-16 px-2 py-1 bg-[#FFFFFF] border border-[#E7E0D5] rounded text-center"
                      title="Quantity"
                    />
                    <input
                      type="number"
                      min={0}
                      value={item.unitCost}
                      onChange={(e) => {
                        const copy = [...poItems];
                        copy[idx].unitCost = parseFloat(e.target.value) || 0;
                        setPoItems(copy);
                      }}
                      className="w-24 px-2 py-1 bg-[#FFFFFF] border border-[#E7E0D5] rounded text-right font-mono"
                      title="Unit Cost PKR"
                    />
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#E7E0D5]">
                <button
                  type="button"
                  onClick={() => setCreatePoModal(false)}
                  className="px-3 py-2 border border-[#E7E0D5] rounded-lg text-[#6B645B]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !poSupplier}
                  className="px-4 py-2 bg-[#E8590C] hover:bg-[#D04F0A] text-white rounded-lg font-bold disabled:opacity-50"
                >
                  {actionLoading ? 'Placing PO...' : 'Dispatch Purchase Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Receive PO Shipment */}
      {receiveModalPO && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="card-bayflow p-6 bg-[#FFFFFF] max-w-md w-full space-y-4 shadow-xl">
            <h3 className="font-heading font-bold text-base text-[#1C1917]">
              Receive Shipment for {receiveModalPO.poNumber}
            </h3>
            <p className="text-xs text-[#6B645B]">
              Enter delivered quantities below. Inventory stock will automatically increment upon confirmation.
            </p>
            <form onSubmit={handleReceiveSubmit} className="space-y-3 text-xs">
              {receiveModalPO.items.map((i: any) => {
                const pendingCount = i.quantityOrdered - i.quantityReceived;
                return (
                  <div key={i.id} className="p-2.5 bg-[#FAF7F2] rounded-lg border border-[#E7E0D5] space-y-1">
                    <div className="font-bold text-[#1C1917]">{i.part.name}</div>
                    <div className="flex items-center justify-between text-[11px] text-[#6B645B]">
                      <span>Ordered: {i.quantityOrdered} • Already received: {i.quantityReceived}</span>
                      <div className="flex items-center gap-1">
                        <span>Receiving now:</span>
                        <input
                          type="number"
                          min={0}
                          max={pendingCount}
                          value={receivedCounts[i.id] ?? 0}
                          onChange={(e) => {
                            setReceivedCounts({
                              ...receivedCounts,
                              [i.id]: parseInt(e.target.value, 10) || 0,
                            });
                          }}
                          className="w-14 px-2 py-1 bg-[#FFFFFF] border border-[#E7E0D5] rounded text-center font-bold font-mono"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}

              <div className="flex justify-end gap-2 pt-3 border-t border-[#E7E0D5]">
                <button
                  type="button"
                  onClick={() => setReceiveModalPO(null)}
                  className="px-3 py-2 border border-[#E7E0D5] rounded-lg text-[#6B645B]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-[#0F5C4D] hover:bg-[#0A473B] text-white rounded-lg font-bold disabled:opacity-50"
                >
                  {actionLoading ? 'Stocking Up...' : 'Confirm Receipt & Stock Up'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
