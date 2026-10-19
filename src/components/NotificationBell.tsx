'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bell, Check, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  link?: string | null;
  createdAt: string;
};

export function NotificationBell({ shopId }: { shopId?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  // Poll notifications every 7s (brief: 5-10s polling)
  const { data, refetch } = useQuery<{ notifications: NotificationItem[]; unreadCount: number }>({
    queryKey: ['notifications', shopId],
    queryFn: async () => {
      const res = await fetch(`/api/notifications${shopId ? `?shopId=${shopId}` : ''}`);
      const json = await res.json();
      return json.data || { notifications: [], unreadCount: 0 };
    },
    refetchInterval: 7000,
  });

  const unreadCount = data?.unreadCount || 0;
  const notifications = data?.notifications || [];

  const markAsRead = async (id: string) => {
    await fetch(`/api/notifications/${id}`, { method: 'PATCH' });
    refetch();
  };

  const markAllRead = async () => {
    await fetch('/api/notifications/mark-all-read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shopId }),
    });
    refetch();
  };

  return (
    <div className="relative">
      <motion.button
        type="button"
        whileHover={shouldReduceMotion ? {} : { y: -1 }}
        whileTap={shouldReduceMotion ? {} : { scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-xl bg-[#FAF7F2] border border-[#E7E0D5] text-[#1C1917] hover:border-[#E8590C] transition-colors relative flex items-center justify-center cursor-pointer"
        aria-label="Notifications"
      >
        <motion.div
          animate={
            unreadCount > 0 && !shouldReduceMotion
              ? { rotate: [0, -14, 14, -10, 10, 0] }
              : { rotate: 0 }
          }
          transition={{ duration: 0.6, repeat: Infinity, repeatDelay: 6 }}
        >
          <Bell className="w-4 h-4 text-[#1C1917]" />
        </motion.div>
        {unreadCount > 0 && (
          <motion.span
            initial={shouldReduceMotion ? {} : { scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 25 }}
            className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[#E8590C] text-white text-[10px] font-bold flex items-center justify-center shadow-xs"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </motion.span>
        )}
      </motion.button>

      {/* Notifications Flyout Modal */}
      <AnimatePresence>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <motion.div
              initial={shouldReduceMotion ? {} : { opacity: 0, scale: 0.95, y: -6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={shouldReduceMotion ? {} : { opacity: 0, scale: 0.95, y: -6 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="absolute right-0 mt-2 w-80 sm:w-96 bg-[#FFFFFF] border border-[#E7E0D5] rounded-2xl shadow-xl z-50 overflow-hidden text-xs"
            >
            <div className="p-3.5 bg-[#FAF7F2] border-b border-[#E7E0D5] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-heading font-bold text-sm text-[#1C1917]">
                  Notifications
                </span>
                {unreadCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-[#E8590C] text-white">
                    {unreadCount} unread
                  </span>
                )}
              </div>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllRead}
                  className="text-[11px] font-semibold text-[#E8590C] hover:underline"
                >
                  Mark all read
                </button>
              )}
            </div>

            <div className="max-h-80 overflow-y-auto divide-y divide-[#E7E0D5]">
              {notifications.length === 0 ? (
                <div className="py-8 text-center text-[#6B645B]">
                  No notifications yet.
                </div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`p-3.5 transition-colors flex items-start justify-between gap-3 ${
                      !n.read ? 'bg-[#E8590C]/5' : 'hover:bg-[#FAF7F2]'
                    }`}
                  >
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-[#1C1917]">{n.title}</span>
                        {!n.read && (
                          <span className="w-1.5 h-1.5 rounded-full bg-[#E8590C] shrink-0" />
                        )}
                      </div>
                      <p className="text-[11px] text-[#6B645B] leading-relaxed">
                        {n.message}
                      </p>
                      <div className="flex items-center gap-3 pt-1 text-[10px] text-[#A8A196]">
                        <span>{new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        {n.link && (
                          <Link
                            href={n.link}
                            onClick={() => {
                              markAsRead(n.id);
                              setIsOpen(false);
                            }}
                            className="text-[#E8590C] font-semibold flex items-center gap-0.5 hover:underline"
                          >
                            <span>Open</span>
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                        )}
                      </div>
                    </div>

                    {!n.read && (
                      <button
                        type="button"
                        onClick={() => markAsRead(n.id)}
                        className="p-1 rounded text-[#6B645B] hover:text-[#0F5C4D] shrink-0"
                        title="Mark read"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
