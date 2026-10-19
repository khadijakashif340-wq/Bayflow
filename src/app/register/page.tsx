'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { Wrench, ArrowRight, Loader2, AlertCircle } from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('+92 ');
  const [shopName, setShopName] = useState('');
  const [city, setCity] = useState('Lahore');
  const [address, setAddress] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setErrorMsg(null);

      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          password,
          phone,
          shopName,
          city,
          address,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || 'Registration failed');
      }

      router.push('/owner');
    } catch (err: any) {
      setErrorMsg(err.message || 'Registration error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF7F2]">
      <Navbar />

      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full flex-1 flex flex-col justify-center">
        <div className="card-bayflow p-8 bg-[#FFFFFF] shadow-sm space-y-6">
          <div className="space-y-1">
            <span className="text-xs font-bold text-[#E8590C] uppercase tracking-wider">
              Workshop Onboarding
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold font-heading text-[#1C1917]">
              Register Your Auto Workshop
            </h1>
            <p className="text-xs text-[#6B645B]">
              Deploy BayFlow OS for your repair business. Manage bays, catalog, technicians, and digital estimates.
            </p>
          </div>

          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-[#B91C1C]/10 border border-[#B91C1C]/30 text-[#B91C1C] text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-[#1C1917] block mb-1">
                  Owner Full Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Tariq Mehmood"
                  className="w-full px-3.5 py-2.5 bg-[#FAF7F2] border border-[#E7E0D5] rounded-xl text-sm text-[#1C1917] focus:outline-none focus:border-[#E8590C]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[#1C1917] block mb-1">
                  Owner Phone Number
                </label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+92 300 1234567"
                  className="w-full px-3.5 py-2.5 bg-[#FAF7F2] border border-[#E7E0D5] rounded-xl text-sm text-[#1C1917] focus:outline-none focus:border-[#E8590C]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-[#1C1917] block mb-1">
                  Owner Email Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tariq@example.pk"
                  className="w-full px-3.5 py-2.5 bg-[#FAF7F2] border border-[#E7E0D5] rounded-xl text-sm text-[#1C1917] focus:outline-none focus:border-[#E8590C]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[#1C1917] block mb-1">
                  Password
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full px-3.5 py-2.5 bg-[#FAF7F2] border border-[#E7E0D5] rounded-xl text-sm text-[#1C1917] focus:outline-none focus:border-[#E8590C]"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-[#E7E0D5]">
              <span className="text-xs font-bold text-[#E8590C] uppercase tracking-wider block mb-3">
                Workshop Profile
              </span>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-[#1C1917] block mb-1">
                    Workshop Business Name
                  </label>
                  <input
                    type="text"
                    required
                    value={shopName}
                    onChange={(e) => setShopName(e.target.value)}
                    placeholder="e.g. Apex Motor Care"
                    className="w-full px-3.5 py-2.5 bg-[#FAF7F2] border border-[#E7E0D5] rounded-xl text-sm text-[#1C1917] focus:outline-none focus:border-[#E8590C]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-[#1C1917] block mb-1">
                      City
                    </label>
                    <select
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-[#FAF7F2] border border-[#E7E0D5] rounded-xl text-sm text-[#1C1917] focus:outline-none focus:border-[#E8590C]"
                    >
                      <option value="Lahore">Lahore</option>
                      <option value="Karachi">Karachi</option>
                      <option value="Islamabad">Islamabad</option>
                      <option value="Rawalpindi">Rawalpindi</option>
                      <option value="Faisalabad">Faisalabad</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-[#1C1917] block mb-1">
                      Street Address
                    </label>
                    <input
                      type="text"
                      required
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="e.g. Plot 42-B, Main Boulevard, Gulberg III"
                      className="w-full px-3.5 py-2.5 bg-[#FAF7F2] border border-[#E7E0D5] rounded-xl text-sm text-[#1C1917] focus:outline-none focus:border-[#E8590C]"
                    />
                  </div>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[#E8590C] hover:bg-[#D04F0A] text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-sm disabled:opacity-50 mt-4"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Setting Up Workshop...</span>
                </>
              ) : (
                <>
                  <span>Register & Launch Workshop OS</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="pt-4 border-t border-[#E7E0D5] text-center text-xs text-[#6B645B]">
            Already registered?{' '}
            <Link href="/login" className="font-semibold text-[#E8590C] hover:underline">
              Sign In to Your Station
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
