'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import {
  Wrench,
  Lock,
  Mail,
  ArrowRight,
  Loader2,
  AlertCircle,
  Sparkles,
  UserCheck,
  ShieldAlert,
} from 'lucide-react';

type DemoAccount = {
  role: string;
  name: string;
  email: string;
  badgeColor: string;
  redirectUrl: string;
};

const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    role: 'Shop Owner',
    name: 'Tariq Mehmood',
    email: 'owner@bayflow.pk',
    badgeColor: 'bg-orange-100 text-orange-800 border-orange-300',
    redirectUrl: '/owner',
  },
  {
    role: 'Service Advisor',
    name: 'Bilal Ahmed',
    email: 'sa.lahore@bayflow.pk',
    badgeColor: 'bg-amber-100 text-amber-900 border-amber-300',
    redirectUrl: '/pos/service-advisor',
  },
  {
    role: 'Master Technician',
    name: 'Rashid Ali',
    email: 'tech.lahore@bayflow.pk',
    badgeColor: 'bg-emerald-100 text-emerald-900 border-emerald-300',
    redirectUrl: '/pos/technician',
  },
  {
    role: 'Parts Person',
    name: 'Zubair Qureshi',
    email: 'parts.lahore@bayflow.pk',
    badgeColor: 'bg-stone-200 text-stone-800 border-stone-300',
    redirectUrl: '/pos/parts',
  },
  {
    role: 'QC Inspector',
    name: 'Farhan Siddiqui',
    email: 'qc.lahore@bayflow.pk',
    badgeColor: 'bg-red-100 text-red-800 border-red-300',
    redirectUrl: '/pos/qc',
  },
  {
    role: 'Customer',
    name: 'Hamza Khan',
    email: 'customer@bayflow.pk',
    badgeColor: 'bg-teal-100 text-teal-900 border-teal-300',
    redirectUrl: '/track/BF-2026-1001',
  },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fillDemoAccount = (demo: DemoAccount) => {
    setEmail(demo.email);
    setPassword('bayflow2026');
    setErrorMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setErrorMsg(null);

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || 'Invalid credentials');
      }

      const user = json.data.user;
      
      // Determine redirection based on primary role
      if (user.userType === 'OWNER' || (user.ownedShops && user.ownedShops.length > 0)) {
        router.push('/owner');
      } else if (user.memberships && user.memberships.length > 0) {
        const primaryRole = user.memberships[0].role;
        switch (primaryRole) {
          case 'SERVICE_ADVISOR':
            router.push('/pos/service-advisor');
            break;
          case 'TECHNICIAN':
            router.push('/pos/technician');
            break;
          case 'PARTS_PERSON':
            router.push('/pos/parts');
            break;
          case 'QC_INSPECTOR':
            router.push('/pos/qc');
            break;
          default:
            router.push('/owner');
        }
      } else {
        router.push('/track/BF-2026-1001');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Login failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF7F2]">
      <Navbar />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full flex-1 flex flex-col justify-center">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Login Form */}
          <div className="lg:col-span-7 bg-white rounded-2xl p-8 border border-[#E7E0D5] shadow-sm space-y-6">
            <div className="space-y-1.5">
              <span className="text-xs font-bold text-[#E8590C] uppercase tracking-wider">
                Authorized Access
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold font-heading text-stone-900">
                Workshop Staff & Owner Login
              </h1>
              <p className="text-sm text-stone-600">
                Enter your credentials to access your tenant dashboard or POS station.
              </p>
            </div>

            {errorMsg && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-stone-800 block mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. owner@bayflow.pk"
                    className="w-full pl-10 pr-4 py-2.5 bg-stone-50/50 border border-stone-300 rounded-xl text-sm font-medium text-stone-900 placeholder:text-stone-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#E8590C] focus:border-[#E8590C] transition"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-stone-800 block mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full pl-10 pr-4 py-2.5 bg-stone-50/50 border border-stone-300 rounded-xl text-sm font-medium text-stone-900 placeholder:text-stone-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#E8590C] focus:border-[#E8590C] transition"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-[#E8590C] hover:bg-[#D04F0A] text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-sm disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Signing In...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In to Station</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="pt-4 border-t border-stone-200 text-center text-xs text-stone-600">
              New workshop owner?{' '}
              <Link href="/register" className="font-bold text-[#E8590C] hover:underline">
                Register New Workshop
              </Link>
            </div>
          </div>

          {/* Right Column: Click-to-Fill Demo Accounts Helper */}
          <div className="lg:col-span-5 bg-white rounded-2xl p-6 border border-[#E7E0D5] shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-stone-200 pb-3">
              <Sparkles className="w-4 h-4 text-[#E8590C]" />
              <h2 className="font-heading font-bold text-sm text-stone-900">
                Click-to-Fill Demo Accounts
              </h2>
            </div>
            <p className="text-xs text-stone-600 leading-relaxed">
              Select any role below to pre-fill verified credentials and sign in directly (Password: <code className="font-mono text-stone-900 font-bold bg-amber-50 text-amber-900 px-1.5 py-0.5 rounded border border-amber-200">bayflow2026</code>).
            </p>

            <div className="space-y-2.5">
              {DEMO_ACCOUNTS.map((demo) => (
                <button
                  key={demo.email}
                  type="button"
                  onClick={() => fillDemoAccount(demo)}
                  className="w-full text-left p-3 rounded-xl border border-stone-200 bg-white hover:border-[#E8590C] hover:bg-orange-50/30 transition-all flex items-center justify-between group shadow-xs cursor-pointer"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-stone-900 group-hover:text-[#E8590C] transition-colors">
                        {demo.name}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${demo.badgeColor}`}>
                        {demo.role}
                      </span>
                    </div>
                    <div className="text-[11px] font-mono text-stone-500">
                      {demo.email}
                    </div>
                  </div>
                  <span className="text-xs font-bold text-[#E8590C] opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                    Fill &rarr;
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
