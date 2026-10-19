'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { Search, ShieldCheck, ArrowRight, Car } from 'lucide-react';
import Link from 'next/link';

export default function TrackSearchPage() {
  const router = useRouter();
  const [bookingNumber, setBookingNumber] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (bookingNumber.trim()) {
      router.push(`/track/${bookingNumber.trim().toUpperCase()}`);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF7F2]">
      <Navbar />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 w-full flex-1 flex flex-col justify-center">
        <div className="card-bayflow p-8 sm:p-10 bg-[#FFFFFF] shadow-sm text-center space-y-6">
          <div className="w-14 h-14 rounded-2xl bg-[#E8590C]/10 text-[#E8590C] border border-[#E8590C]/20 flex items-center justify-center mx-auto">
            <ShieldCheck className="w-7 h-7" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-bold font-heading text-[#1C1917]">
              Track Your Vehicle in Real Time
            </h1>
            <p className="text-sm text-[#6B645B] max-w-md mx-auto">
              Enter your BayFlow booking reference code to view live inspection notes, approve digital estimates, and monitor QC progress.
            </p>
          </div>

          <form onSubmit={handleSearch} className="max-w-md mx-auto space-y-3">
            <div className="relative">
              <Search className="w-5 h-5 text-[#6B645B] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={bookingNumber}
                onChange={(e) => setBookingNumber(e.target.value.toUpperCase())}
                placeholder="e.g. BF-2026-1001"
                className="w-full pl-11 pr-4 py-3 bg-[#FAF7F2] border border-[#E7E0D5] rounded-xl text-sm font-mono uppercase tracking-wider text-[#1C1917] focus:outline-none focus:border-[#E8590C] focus:ring-1 focus:ring-[#E8590C]"
              />
            </div>
            <button
              type="submit"
              className="w-full py-3 bg-[#E8590C] hover:bg-[#D04F0A] text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors shadow-sm"
            >
              <span>View Vehicle Live Status</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Quick Demo Link */}
          <div className="pt-4 border-t border-[#E7E0D5] flex flex-col sm:flex-row items-center justify-center gap-2 text-xs text-[#6B645B]">
            <span>Try sample demonstration booking:</span>
            <Link
              href="/track/BF-2026-1001"
              className="font-mono font-semibold text-[#0F5C4D] bg-[#0F5C4D]/10 px-2.5 py-1 rounded-md border border-[#0F5C4D]/20 hover:bg-[#0F5C4D]/15"
            >
              BF-2026-1001 (Honda Civic)
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
