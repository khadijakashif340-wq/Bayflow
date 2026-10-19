'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import {
  Wrench,
  Users,
  Layers,
  Settings,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertCircle,
  Clock,
  MapPin,
  Phone,
  DollarSign,
  ChevronDown,
  Building,
  Loader2,
  UserPlus,
  Shield,
  LogOut,
} from 'lucide-react';

type Shop = {
  id: string;
  name: string;
  slug: string;
  city: string;
  address: string;
  phone: string;
  email: string;
  openTime: string;
  closeTime: string;
  workingDays: string;
  maxParallelSlots: number;
  _count?: {
    members: number;
    services: number;
    bookings: number;
  };
};

type Member = {
  id: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    phone: string;
  };
};

type Service = {
  id: string;
  name: string;
  description: string;
  category: string;
  durationMinutes: number;
  basePrice: string | number;
  isActive: boolean;
};

export default function OwnerDashboardPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [shops, setShops] = useState<Shop[]>([]);
  const [activeShopId, setActiveShopId] = useState<string>('');

  // Active view tab
  const [activeTab, setActiveTab] = useState<'overview' | 'team' | 'services' | 'settings'>('overview');

  // Shop data
  const [members, setMembers] = useState<Member[]>([]);
  const [services, setServices] = useState<Service[]>([]);

  // Modals & form state
  const [addMemberModal, setAddMemberModal] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberPhone, setNewMemberPhone] = useState('+92 ');
  const [newMemberRole, setNewMemberRole] = useState('SERVICE_ADVISOR');

  const [addServiceModal, setAddServiceModal] = useState(false);
  const [newServiceName, setNewServiceName] = useState('');
  const [newServiceCategory, setNewServiceCategory] = useState('Maintenance');
  const [newServiceDesc, setNewServiceDesc] = useState('');
  const [newServiceDuration, setNewServiceDuration] = useState('60');
  const [newServicePrice, setNewServicePrice] = useState('6500');

  const [createShopModal, setCreateShopModal] = useState(false);
  const [newShopName, setNewShopName] = useState('');
  const [newShopCity, setNewShopCity] = useState('Lahore');
  const [newShopAddress, setNewShopAddress] = useState('');
  const [newShopPhone, setNewShopPhone] = useState('+92 ');
  const [newShopEmail, setNewShopEmail] = useState('');

  const [actionMsg, setActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 1. Check Session & Load Shops
  useEffect(() => {
    async function loadSession() {
      try {
        setLoading(true);
        const res = await fetch('/api/auth/me');
        if (!res.ok) {
          router.push('/login');
          return;
        }
        const json = await res.json();
        setCurrentUser(json.data);

        // Fetch shops owned/managed
        const shopsRes = await fetch('/api/owner/shops');
        const shopsJson = await shopsRes.json();
        if (shopsJson.data && shopsJson.data.length > 0) {
          setShops(shopsJson.data);
          setActiveShopId(shopsJson.data[0].id);
        }
      } catch (err) {
        console.error('Session check error:', err);
        router.push('/login');
      } finally {
        setLoading(false);
      }
    }
    loadSession();
  }, [router]);

  // 2. Fetch Members & Services when active shop changes
  useEffect(() => {
    if (!activeShopId) return;

    async function loadShopDetails() {
      try {
        const [membersRes, servicesRes] = await Promise.all([
          fetch(`/api/owner/shops/${activeShopId}/members`),
          fetch(`/api/shops/${activeShopId}/services`),
        ]);

        const membersJson = await membersRes.json();
        const servicesJson = await servicesRes.json();

        if (membersJson.data) setMembers(membersJson.data);
        if (servicesJson.data) setServices(servicesJson.data);
      } catch (err) {
        console.error('Error loading shop team/services:', err);
      }
    }

    loadShopDetails();
  }, [activeShopId]);

  const activeShop = shops.find((s) => s.id === activeShopId);

  // Add Member Handler
  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setActionMsg(null);
      const res = await fetch(`/api/owner/shops/${activeShopId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newMemberName,
          email: newMemberEmail,
          phone: newMemberPhone,
          role: newMemberRole,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || 'Failed to add member');

      setAddMemberModal(false);
      setNewMemberName('');
      setNewMemberEmail('');
      setNewMemberPhone('+92 ');
      setActionMsg({ type: 'success', text: `Staff member added successfully with role ${newMemberRole}!` });

      // Reload members
      const refreshed = await fetch(`/api/owner/shops/${activeShopId}/members`);
      const refJson = await refreshed.json();
      if (refJson.data) setMembers(refJson.data);
    } catch (err: any) {
      setActionMsg({ type: 'error', text: err.message });
    }
  };

  // Toggle Member Active Status
  const handleToggleMember = async (memberId: string, currentActive: boolean) => {
    try {
      const res = await fetch(`/api/owner/shops/${activeShopId}/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentActive }),
      });
      if (res.ok) {
        setMembers(members.map((m) => (m.id === memberId ? { ...m, isActive: !currentActive } : m)));
        setActionMsg({ type: 'success', text: 'Member status updated.' });
      }
    } catch (err) {
      console.error('Error toggling member:', err);
    }
  };

  // Add Service Handler
  const handleAddService = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setActionMsg(null);
      const res = await fetch(`/api/owner/shops/${activeShopId}/services`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newServiceName,
          category: newServiceCategory,
          description: newServiceDesc,
          durationMinutes: parseInt(newServiceDuration, 10),
          basePrice: parseFloat(newServicePrice),
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || 'Failed to add service');

      setAddServiceModal(false);
      setNewServiceName('');
      setNewServiceDesc('');
      setActionMsg({ type: 'success', text: 'New service added to catalog.' });

      // Reload services
      const refreshed = await fetch(`/api/shops/${activeShopId}/services`);
      const refJson = await refreshed.json();
      if (refJson.data) setServices(refJson.data);
    } catch (err: any) {
      setActionMsg({ type: 'error', text: err.message });
    }
  };

  // Create New Workshop Handler
  const handleCreateShop = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setActionMsg(null);
      const res = await fetch('/api/owner/shops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newShopName,
          city: newShopCity,
          address: newShopAddress,
          phone: newShopPhone,
          email: newShopEmail,
          openTime: '09:00',
          closeTime: '19:00',
          maxParallelSlots: 4,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || 'Failed to create workshop');

      setCreateShopModal(false);
      setActionMsg({ type: 'success', text: `Workshop ${json.data.name} created successfully!` });

      // Reload shops
      const shopsRes = await fetch('/api/owner/shops');
      const shopsJson = await shopsRes.json();
      if (shopsJson.data) {
        setShops(shopsJson.data);
        setActiveShopId(json.data.id);
      }
    } catch (err: any) {
      setActionMsg({ type: 'error', text: err.message });
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-[#FAF7F2]">
        <Navbar />
        <div className="flex-1 flex items-center justify-center py-20 text-[#E8590C]">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF7F2]">
      {/* Owner Top Navigation Bar */}
      <header className="bg-[#FFFFFF] border-b border-[#E7E0D5] sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#E8590C] text-white flex items-center justify-center">
                  <Wrench className="w-4 h-4" />
                </div>
                <span className="font-heading font-bold text-lg text-[#1C1917]">
                  BayFlow <span className="text-[#E8590C]">Owner</span>
                </span>
              </div>

              {/* Shop Switcher Dropdown */}
              {shops.length > 0 && (
                <div className="relative flex items-center gap-2">
                  <Building className="w-4 h-4 text-[#6B645B]" />
                  <select
                    value={activeShopId}
                    onChange={(e) => setActiveShopId(e.target.value)}
                    className="pl-2 pr-8 py-1.5 bg-[#FAF7F2] border border-[#E7E0D5] rounded-lg text-xs font-bold text-[#1C1917] focus:outline-none focus:border-[#E8590C]"
                  >
                    {shops.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.city})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Right: User Profile & Actions */}
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setCreateShopModal(true)}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-[#FAF7F2] border border-[#E7E0D5] hover:border-[#E8590C] text-[#1C1917] text-xs font-semibold rounded-lg transition-colors"
              >
                <Plus className="w-3.5 h-3.5 text-[#E8590C]" />
                <span>New Workshop</span>
              </button>

              <div className="flex items-center gap-2 text-xs">
                <span className="font-semibold text-[#1C1917]">{currentUser?.name}</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#E8590C]/10 text-[#E8590C]">
                  OWNER
                </span>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                className="p-1.5 text-[#6B645B] hover:text-[#B91C1C] rounded-lg hover:bg-[#FAF7F2]"
                title="Log Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1 space-y-6">
        {/* Feedback Message */}
        {actionMsg && (
          <div
            className={`p-4 rounded-xl text-xs font-semibold flex items-center justify-between gap-3 ${
              actionMsg.type === 'success'
                ? 'bg-[#0F5C4D]/10 border border-[#0F5C4D]/30 text-[#0F5C4D]'
                : 'bg-[#B91C1C]/10 border border-[#B91C1C]/30 text-[#B91C1C]'
            }`}
          >
            <div className="flex items-center gap-2">
              {actionMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              <span>{actionMsg.text}</span>
            </div>
            <button type="button" onClick={() => setActionMsg(null)} className="underline">
              Dismiss
            </button>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-[#E7E0D5] pb-2 text-sm overflow-x-auto">
          {[
            { key: 'overview', label: 'Workshop Overview', icon: Building },
            { key: 'team', label: `Staff & Roles (${members.length})`, icon: Users },
            { key: 'services', label: `Service Catalog (${services.length})`, icon: Layers },
            { key: 'settings', label: 'Facility Settings', icon: Settings },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key as any)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all shrink-0 ${
                  active
                    ? 'bg-[#E8590C] text-white shadow-sm'
                    : 'text-[#6B645B] hover:text-[#1C1917] hover:bg-[#FFFFFF]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && activeShop && (
          <div className="space-y-6">
            {/* Quick Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="card-bayflow p-5 bg-[#FFFFFF]">
                <span className="text-xs text-[#6B645B]">Parallel Work Bays</span>
                <div className="font-heading font-bold text-2xl text-[#1C1917] mt-1">
                  {activeShop.maxParallelSlots} Bays
                </div>
                <span className="text-[11px] text-[#0F5C4D]">Configured capacity</span>
              </div>
              <div className="card-bayflow p-5 bg-[#FFFFFF]">
                <span className="text-xs text-[#6B645B]">Active Staff</span>
                <div className="font-heading font-bold text-2xl text-[#1C1917] mt-1">
                  {members.filter((m) => m.isActive).length} Members
                </div>
                <span className="text-[11px] text-[#0F5C4D]">5 certified roles</span>
              </div>
              <div className="card-bayflow p-5 bg-[#FFFFFF]">
                <span className="text-xs text-[#6B645B]">Service Catalog</span>
                <div className="font-heading font-bold text-2xl text-[#1C1917] mt-1">
                  {services.filter((s) => s.isActive).length} Services
                </div>
                <span className="text-[11px] text-[#6B645B]">Itemized PKR prices</span>
              </div>
              <div className="card-bayflow p-5 bg-[#FFFFFF]">
                <span className="text-xs text-[#6B645B]">Working Schedule</span>
                <div className="font-mono text-sm font-bold text-[#E8590C] mt-1">
                  {activeShop.openTime} – {activeShop.closeTime}
                </div>
                <span className="text-[11px] text-[#6B645B]">{activeShop.workingDays}</span>
              </div>
            </div>

            {/* Workshop Information Card */}
            <div className="card-bayflow p-6 bg-[#FFFFFF] space-y-4">
              <h2 className="font-heading font-bold text-lg text-[#1C1917]">
                {activeShop.name} ({activeShop.city})
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-[#6B645B]">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-[#E8590C]" />
                  <span>{activeShop.address}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-[#E8590C]" />
                  <span>{activeShop.phone}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#E8590C]" />
                  <span>{activeShop.openTime} – {activeShop.closeTime}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: TEAM MANAGEMENT */}
        {activeTab === 'team' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h2 className="font-heading font-bold text-lg text-[#1C1917]">
                  Workshop Personnel & POS Roles
                </h2>
                <p className="text-xs text-[#6B645B]">
                  Manage staff assignments across Service Advisor, Master Tech, Parts Person, and QC Inspector stations.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAddMemberModal(true)}
                className="px-4 py-2 bg-[#E8590C] hover:bg-[#D04F0A] text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
              >
                <UserPlus className="w-4 h-4" />
                <span>Add Staff Member</span>
              </button>
            </div>

            {/* Staff Members Table */}
            <div className="card-bayflow bg-[#FFFFFF] overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FAF7F2] border-b border-[#E7E0D5] text-[#6B645B] uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4 font-semibold">Staff Member</th>
                    <th className="py-3 px-4 font-semibold">Station / Role</th>
                    <th className="py-3 px-4 font-semibold">Phone</th>
                    <th className="py-3 px-4 font-semibold">Status</th>
                    <th className="py-3 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E7E0D5]">
                  {members.map((m) => (
                    <tr key={m.id} className="hover:bg-[#FAF7F2]/40 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-[#1C1917]">{m.user.name}</div>
                        <div className="text-[11px] text-[#6B645B]">{m.user.email}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                            m.role === 'OWNER'
                              ? 'bg-[#E8590C]/10 text-[#E8590C] border-[#E8590C]/30'
                              : m.role === 'SERVICE_ADVISOR'
                              ? 'bg-[#D97706]/10 text-[#D97706] border-[#D97706]/30'
                              : m.role === 'TECHNICIAN'
                              ? 'bg-[#0F5C4D]/10 text-[#0F5C4D] border-[#0F5C4D]/30'
                              : m.role === 'QC_INSPECTOR'
                              ? 'bg-[#B91C1C]/10 text-[#B91C1C] border-[#B91C1C]/30'
                              : 'bg-[#6B645B]/10 text-[#6B645B] border-[#6B645B]/30'
                          }`}
                        >
                          {m.role.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-[#6B645B] font-mono">{m.user.phone || '—'}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            m.isActive ? 'bg-[#0F5C4D]/10 text-[#0F5C4D]' : 'bg-[#B91C1C]/10 text-[#B91C1C]'
                          }`}
                        >
                          {m.isActive ? 'ACTIVE' : 'DEACTIVATED'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {m.role !== 'OWNER' && (
                          <button
                            type="button"
                            onClick={() => handleToggleMember(m.id, m.isActive)}
                            className="text-xs font-semibold text-[#6B645B] hover:text-[#1C1917] underline ml-2"
                          >
                            {m.isActive ? 'Deactivate' : 'Activate'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: SERVICE CATALOG */}
        {activeTab === 'services' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h2 className="font-heading font-bold text-lg text-[#1C1917]">
                  Workshop Service Catalog
                </h2>
                <p className="text-xs text-[#6B645B]">
                  Manage standardized packages, labor times, and base pricing in Pakistani Rupees (PKR).
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAddServiceModal(true)}
                className="px-4 py-2 bg-[#E8590C] hover:bg-[#D04F0A] text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Add Service</span>
              </button>
            </div>

            {/* Services List Table */}
            <div className="card-bayflow bg-[#FFFFFF] overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FAF7F2] border-b border-[#E7E0D5] text-[#6B645B] uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4 font-semibold">Service Name</th>
                    <th className="py-3 px-4 font-semibold">Category</th>
                    <th className="py-3 px-4 font-semibold">Est. Duration</th>
                    <th className="py-3 px-4 font-semibold text-right">Base Price (PKR)</th>
                    <th className="py-3 px-4 font-semibold text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E7E0D5]">
                  {services.map((svc) => (
                    <tr key={svc.id} className="hover:bg-[#FAF7F2]/40">
                      <td className="py-3 px-4">
                        <div className="font-bold text-[#1C1917]">{svc.name}</div>
                        <div className="text-[11px] text-[#6B645B] line-clamp-1">{svc.description}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#FAF7F2] border border-[#E7E0D5] text-[#6B645B]">
                          {svc.category}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-[#6B645B]">{svc.durationMinutes} mins</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-[#1C1917]">
                        PKR {Number(svc.basePrice).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            svc.isActive ? 'bg-[#0F5C4D]/10 text-[#0F5C4D]' : 'bg-[#B91C1C]/10 text-[#B91C1C]'
                          }`}
                        >
                          {svc.isActive ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: FACILITY SETTINGS */}
        {activeTab === 'settings' && activeShop && (
          <div className="card-bayflow p-6 bg-[#FFFFFF] max-w-2xl space-y-4">
            <h2 className="font-heading font-bold text-lg text-[#1C1917]">
              Facility & Bay Configuration
            </h2>
            <div className="space-y-3 text-xs">
              <div>
                <label className="text-xs font-semibold text-[#1C1917] block mb-1">
                  Parallel Bay Capacity
                </label>
                <input
                  type="number"
                  disabled
                  value={activeShop.maxParallelSlots}
                  className="w-full px-3.5 py-2 bg-[#FAF7F2] border border-[#E7E0D5] rounded-xl text-sm text-[#1C1917]"
                />
                <span className="text-[11px] text-[#6B645B]">Maximum concurrent vehicles allowed per hour.</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-[#1C1917] block mb-1">Open Time</label>
                  <input
                    type="text"
                    disabled
                    value={activeShop.openTime}
                    className="w-full px-3.5 py-2 bg-[#FAF7F2] border border-[#E7E0D5] rounded-xl text-sm text-[#1C1917]"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#1C1917] block mb-1">Close Time</label>
                  <input
                    type="text"
                    disabled
                    value={activeShop.closeTime}
                    className="w-full px-3.5 py-2 bg-[#FAF7F2] border border-[#E7E0D5] rounded-xl text-sm text-[#1C1917]"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modal: Add Staff Member */}
      {addMemberModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="card-bayflow p-6 bg-[#FFFFFF] max-w-md w-full space-y-4 shadow-xl">
            <h3 className="font-heading font-bold text-base text-[#1C1917]">
              Add Staff Member to Workshop
            </h3>
            <form onSubmit={handleAddMember} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-[#1C1917] block mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  placeholder="e.g. Asim Raza"
                  className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#E7E0D5] rounded-lg text-sm text-[#1C1917]"
                />
              </div>
              <div>
                <label className="font-semibold text-[#1C1917] block mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={newMemberEmail}
                  onChange={(e) => setNewMemberEmail(e.target.value)}
                  placeholder="asim@bayflow.pk"
                  className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#E7E0D5] rounded-lg text-sm text-[#1C1917]"
                />
              </div>
              <div>
                <label className="font-semibold text-[#1C1917] block mb-1">Phone</label>
                <input
                  type="tel"
                  required
                  value={newMemberPhone}
                  onChange={(e) => setNewMemberPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#E7E0D5] rounded-lg text-sm text-[#1C1917]"
                />
              </div>
              <div>
                <label className="font-semibold text-[#1C1917] block mb-1">Assigned Role</label>
                <select
                  value={newMemberRole}
                  onChange={(e) => setNewMemberRole(e.target.value)}
                  className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#E7E0D5] rounded-lg text-sm text-[#1C1917]"
                >
                  <option value="SERVICE_ADVISOR">Service Advisor</option>
                  <option value="TECHNICIAN">Technician</option>
                  <option value="PARTS_PERSON">Parts Person</option>
                  <option value="QC_INSPECTOR">QC Inspector</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#E7E0D5]">
                <button
                  type="button"
                  onClick={() => setAddMemberModal(false)}
                  className="px-3 py-2 border border-[#E7E0D5] rounded-lg text-[#6B645B]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#E8590C] hover:bg-[#D04F0A] text-white rounded-lg font-semibold"
                >
                  Assign Role
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Service */}
      {addServiceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="card-bayflow p-6 bg-[#FFFFFF] max-w-md w-full space-y-4 shadow-xl">
            <h3 className="font-heading font-bold text-base text-[#1C1917]">
              Add Service Offering to Catalog
            </h3>
            <form onSubmit={handleAddService} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-[#1C1917] block mb-1">Service Name</label>
                <input
                  type="text"
                  required
                  value={newServiceName}
                  onChange={(e) => setNewServiceName(e.target.value)}
                  placeholder="e.g. Brake Fluid Replacement"
                  className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#E7E0D5] rounded-lg text-sm text-[#1C1917]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-[#1C1917] block mb-1">Category</label>
                  <select
                    value={newServiceCategory}
                    onChange={(e) => setNewServiceCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#E7E0D5] rounded-lg text-sm text-[#1C1917]"
                  >
                    <option value="Maintenance">Maintenance</option>
                    <option value="Diagnostics">Diagnostics</option>
                    <option value="Brakes">Brakes</option>
                    <option value="Suspension">Suspension</option>
                    <option value="AC & Climate">AC & Climate</option>
                    <option value="Transmission">Transmission</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-[#1C1917] block mb-1">Duration (Mins)</label>
                  <input
                    type="number"
                    min={15}
                    max={480}
                    value={newServiceDuration}
                    onChange={(e) => setNewServiceDuration(e.target.value)}
                    className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#E7E0D5] rounded-lg text-sm text-[#1C1917]"
                  />
                </div>
              </div>
              <div>
                <label className="font-semibold text-[#1C1917] block mb-1">Base Price in PKR</label>
                <input
                  type="number"
                  min={0}
                  value={newServicePrice}
                  onChange={(e) => setNewServicePrice(e.target.value)}
                  className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#E7E0D5] rounded-lg text-sm font-mono text-[#1C1917]"
                />
              </div>
              <div>
                <label className="font-semibold text-[#1C1917] block mb-1">Description</label>
                <textarea
                  rows={2}
                  required
                  value={newServiceDesc}
                  onChange={(e) => setNewServiceDesc(e.target.value)}
                  placeholder="Detailed description of labor and components included..."
                  className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#E7E0D5] rounded-lg text-xs text-[#1C1917]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#E7E0D5]">
                <button
                  type="button"
                  onClick={() => setAddServiceModal(false)}
                  className="px-3 py-2 border border-[#E7E0D5] rounded-lg text-[#6B645B]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#E8590C] hover:bg-[#D04F0A] text-white rounded-lg font-semibold"
                >
                  Add to Catalog
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Create Workshop */}
      {createShopModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="card-bayflow p-6 bg-[#FFFFFF] max-w-md w-full space-y-4 shadow-xl">
            <h3 className="font-heading font-bold text-base text-[#1C1917]">
              Open Additional Workshop Branch
            </h3>
            <form onSubmit={handleCreateShop} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-[#1C1917] block mb-1">Workshop Name</label>
                <input
                  type="text"
                  required
                  value={newShopName}
                  onChange={(e) => setNewShopName(e.target.value)}
                  placeholder="e.g. Apex Auto Care DHA"
                  className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#E7E0D5] rounded-lg text-sm text-[#1C1917]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-[#1C1917] block mb-1">City</label>
                  <select
                    value={newShopCity}
                    onChange={(e) => setNewShopCity(e.target.value)}
                    className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#E7E0D5] rounded-lg text-sm text-[#1C1917]"
                  >
                    <option value="Lahore">Lahore</option>
                    <option value="Karachi">Karachi</option>
                    <option value="Islamabad">Islamabad</option>
                    <option value="Rawalpindi">Rawalpindi</option>
                    <option value="Faisalabad">Faisalabad</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-[#1C1917] block mb-1">Phone</label>
                  <input
                    type="tel"
                    required
                    value={newShopPhone}
                    onChange={(e) => setNewShopPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#E7E0D5] rounded-lg text-sm text-[#1C1917]"
                  />
                </div>
              </div>
              <div>
                <label className="font-semibold text-[#1C1917] block mb-1">Street Address</label>
                <input
                  type="text"
                  required
                  value={newShopAddress}
                  onChange={(e) => setNewShopAddress(e.target.value)}
                  placeholder="Plot / Sector / Phase"
                  className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#E7E0D5] rounded-lg text-sm text-[#1C1917]"
                />
              </div>
              <div>
                <label className="font-semibold text-[#1C1917] block mb-1">Branch Email</label>
                <input
                  type="email"
                  required
                  value={newShopEmail}
                  onChange={(e) => setNewShopEmail(e.target.value)}
                  placeholder="dha@apexauto.pk"
                  className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#E7E0D5] rounded-lg text-sm text-[#1C1917]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#E7E0D5]">
                <button
                  type="button"
                  onClick={() => setCreateShopModal(false)}
                  className="px-3 py-2 border border-[#E7E0D5] rounded-lg text-[#6B645B]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#E8590C] hover:bg-[#D04F0A] text-white rounded-lg font-semibold"
                >
                  Launch Branch
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
