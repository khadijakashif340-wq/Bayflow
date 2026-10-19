'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Wrench, LogOut, ArrowLeft, Bot, PhoneCall } from 'lucide-react';
import { NotificationBell } from './NotificationBell';
import { AIFrontDeskModal } from './AIFrontDeskModal';

export function PosHeader({
  stationTitle,
  stationSubtitle,
  roleBadge,
  userName = 'Staff Member',
  shopName = 'Workshop Central',
  shopId,
  isOwner,
}: {
  stationTitle: string;
  stationSubtitle?: string;
  roleBadge: string;
  userName?: string;
  shopName?: string;
  shopId?: string;
  isOwner?: boolean;
}) {
  const router = useRouter();
  const [isAiModalOpen, setIsAiModalOpen] = React.useState(false);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  return (
    <>
      <header className="bg-[#FFFFFF] border-b border-[#E7E0D5] sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left: Brand & Station Name */}
            <div className="flex items-center gap-4">
              <Link href="/" className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#E8590C] text-white flex items-center justify-center">
                  <Wrench className="w-4 h-4" />
                </div>
                <span className="font-heading font-bold text-lg text-[#1C1917] hidden sm:inline">
                  Bay<span className="text-[#E8590C]">Flow</span>
                </span>
              </Link>

              <div className="h-5 w-px bg-[#E7E0D5] hidden sm:block" />

              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <h1 className="font-heading font-bold text-sm sm:text-base text-[#1C1917]">
                    {stationTitle}
                  </h1>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#E8590C]/10 text-[#E8590C] border border-[#E8590C]/30">
                    {roleBadge}
                  </span>
                </div>
                <span className="text-[11px] text-[#6B645B] -mt-0.5">
                  {stationSubtitle || shopName}
                </span>
              </div>
            </div>

            {/* Right: Station Links, AI Front Desk, Notification Bell, User, Logout */}
            <div className="flex items-center gap-2.5">
              {/* AI Front Desk Quick Trigger */}
              <motion.button
                type="button"
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => setIsAiModalOpen(true)}
                className="flex items-center gap-1.5 text-xs font-bold text-white bg-[#1C1917] hover:bg-[#2C2825] px-3 py-1.5 rounded-xl border border-stone-800 shadow-xs transition-colors cursor-pointer"
                title="Launch AI Front Desk Call Assistant"
              >
                <Bot className="w-3.5 h-3.5 text-[#FFA94D]" />
                <span className="hidden sm:inline">AI Reception</span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              </motion.button>

              <Link
                href="/pos/ai-logs"
                className="hidden lg:flex items-center gap-1 text-xs font-semibold text-[#6B645B] hover:text-[#1C1917] px-2.5 py-1.5 rounded-lg border border-[#E7E0D5] hover:bg-[#FAF7F2]"
              >
                <span>AI Tasks</span>
              </Link>

              {isOwner && (
                <Link
                  href="/owner"
                  className="hidden md:flex items-center gap-1 text-xs font-semibold text-[#6B645B] hover:text-[#1C1917] px-2.5 py-1.5 rounded-lg border border-[#E7E0D5] hover:bg-[#FAF7F2]"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Owner Portal</span>
                </Link>
              )}

              <NotificationBell shopId={shopId} />

              <div className="hidden sm:flex flex-col text-right">
                <span className="text-xs font-bold text-[#1C1917]">{userName}</span>
                <span className="text-[10px] text-[#6B645B]">POS Terminal Active</span>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                className="p-2 text-[#6B645B] hover:text-[#B91C1C] rounded-xl hover:bg-[#FAF7F2] border border-transparent hover:border-[#E7E0D5] transition-colors"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <AIFrontDeskModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        shopId={shopId}
      />
    </>
  );
}
