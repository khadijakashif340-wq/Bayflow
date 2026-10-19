'use client';

import React from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { MapPin, Clock, Layers, Phone } from 'lucide-react';
import { staggerContainer, fadeUp } from '@/lib/motion';

interface ShopWithCount {
  id: string;
  name: string;
  description: string | null;
  address: string;
  city: string;
  phone: string;
  openTime: string;
  closeTime: string;
  workingDays: string;
  maxParallelSlots: number;
  _count: {
    services: number;
  };
}

export function ShopCardsGrid({ shops }: { shops: ShopWithCount[] }) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      variants={staggerContainer(0.1, 0.1)}
      initial={shouldReduceMotion ? 'animate' : 'initial'}
      whileInView="animate"
      viewport={{ once: true, margin: '-50px' }}
      className="grid grid-cols-1 md:grid-cols-3 gap-6"
    >
      {shops.map((shop) => (
        <motion.div
          key={shop.id}
          variants={fadeUp}
          whileHover={
            shouldReduceMotion
              ? {}
              : {
                  y: -4,
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04)',
                  borderColor: 'rgba(232, 89, 12, 0.4)',
                  transition: { duration: 0.2, ease: 'easeOut' },
                }
          }
          className="bg-white rounded-2xl p-6 border border-[#E7E0D5] flex flex-col justify-between shadow-xs transition-colors"
        >
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-heading font-bold text-lg text-stone-900 leading-snug">
                {shop.name}
              </h3>
              <span className="shrink-0 px-2.5 py-0.5 rounded-full text-xs font-bold bg-teal-50 text-teal-800 border border-teal-200">
                {shop.city}
              </span>
            </div>

            <p className="text-xs text-stone-600 line-clamp-2">
              {shop.description}
            </p>

            <div className="space-y-1.5 text-xs text-stone-600 pt-2">
              <div className="flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-[#E8590C] shrink-0" />
                <span className="truncate">{shop.address}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-[#E8590C] shrink-0" />
                <span>
                  {shop.openTime} – {shop.closeTime} ({shop.workingDays})
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Layers className="w-3.5 h-3.5 text-[#E8590C] shrink-0" />
                <span>
                  {shop.maxParallelSlots} Parallel Bays • {shop._count.services} Services
                </span>
              </div>
            </div>
          </div>

          <div className="pt-6 mt-6 border-t border-stone-200 flex items-center justify-between gap-3">
            <a
              href={`tel:${shop.phone}`}
              className="px-3 py-2 rounded-xl bg-stone-50 hover:bg-stone-100 text-stone-800 text-xs font-semibold flex items-center gap-1.5 border border-stone-200 transition-colors"
            >
              <Phone className="w-3.5 h-3.5" />
              <span>Call</span>
            </a>
            <Link
              href={`/book?shopId=${shop.id}`}
              className="flex-1 px-4 py-2 rounded-xl bg-[#E8590C] hover:bg-[#D04F0A] text-white text-xs font-bold text-center transition-colors shadow-xs"
            >
              Book Appointment
            </Link>
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}
