'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Wrench, Search, Calendar, ShieldCheck, Menu, X, User } from 'lucide-react';
import { AIFrontDeskModal } from './AIFrontDeskModal';

export function Navbar() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);

  const navLinks = [
    { href: '/shops', label: 'Workshops', icon: Search },
    { href: '/book', label: 'Book Appointment', icon: Calendar },
    { href: '/track', label: 'Track Vehicle', icon: ShieldCheck },
  ];

  return (
    <>
      <header className="sticky top-0 z-50 bg-[#FFFFFF]/90 backdrop-blur-md border-b border-[#E7E0D5]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-lg bg-[#E8590C] flex items-center justify-center text-white shadow-sm transition-transform group-hover:scale-105">
              <Wrench className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <span className="font-heading text-xl font-bold tracking-tight text-[#1C1917] leading-tight">
                Bay<span className="text-[#E8590C]">Flow</span>
              </span>
              <span className="text-[10px] uppercase tracking-wider font-semibold text-[#6B645B] -mt-0.5">
                Pakistan
              </span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href));
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-[#FAF7F2] text-[#E8590C] font-semibold border border-[#E7E0D5]'
                      : 'text-[#6B645B] hover:text-[#1C1917] hover:bg-[#FAF7F2]'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* Right Action Buttons */}
          <div className="hidden md:flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setIsAiModalOpen(true)}
              className="flex items-center gap-1.5 text-xs font-bold text-white bg-[#1C1917] hover:bg-[#2C2825] px-3 py-1.5 rounded-lg border border-stone-800 shadow-xs transition"
            >
              <span>🤖 AI Reception</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            </button>

            <Link
              href="/track/BF-2026-1001"
              className="text-xs font-semibold text-[#0F5C4D] bg-[#0F5C4D]/10 hover:bg-[#0F5C4D]/15 px-3 py-1.5 rounded-md border border-[#0F5C4D]/20 transition-colors"
            >
              Demo Car (BF-2026-1001)
            </Link>
            <Link
              href="/login"
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#E8590C] hover:bg-[#D04F0A] shadow-sm transition-all"
            >
              <User className="w-3.5 h-3.5" />
              Staff Login
            </Link>
          </div>

          {/* Mobile Menu Toggle */}
          <div className="flex md:hidden">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-[#6B645B] hover:text-[#1C1917] hover:bg-[#FAF7F2]"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-[#E7E0D5] bg-[#FFFFFF] px-4 pt-2 pb-4 space-y-2">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href));
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-base font-medium ${
                  isActive
                    ? 'bg-[#FAF7F2] text-[#E8590C] font-semibold'
                    : 'text-[#6B645B] hover:text-[#1C1917] hover:bg-[#FAF7F2]'
                }`}
              >
                <Icon className="w-5 h-5" />
                {link.label}
              </Link>
            );
          })}
          <div className="pt-2 border-t border-[#E7E0D5] flex flex-col gap-2">
            <Link
              href="/track/BF-2026-1001"
              onClick={() => setMobileMenuOpen(false)}
              className="text-center text-xs font-semibold text-[#0F5C4D] bg-[#0F5C4D]/10 py-2 rounded-md"
            >
              Demo Car Tracker (BF-2026-1001)
            </Link>
            <Link
              href="/login"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold text-white bg-[#E8590C]"
            >
              <User className="w-4 h-4" />
              Staff Login
            </Link>
          </div>
        </div>
      )}
    </header>

    <AIFrontDeskModal
      isOpen={isAiModalOpen}
      onClose={() => setIsAiModalOpen(false)}
    />
  </>
  );
}
