'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Counter } from '@/components/Counter';
import { fadeUp } from '@/lib/motion';

export function LandingStats() {
  return (
    <motion.div
      variants={fadeUp}
      initial="initial"
      whileInView="animate"
      viewport={{ once: true, margin: '-30px' }}
      className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-8 border-y border-[#E7E0D5] bg-white/60 rounded-2xl p-6"
    >
      <div className="text-center sm:text-left">
        <div className="font-heading font-extrabold text-2xl sm:text-3xl text-stone-900 flex items-center justify-center sm:justify-start">
          <Counter to={100} duration={1.2} suffix="%" />
        </div>
        <div className="text-xs font-semibold text-stone-700 mt-0.5">Itemized PKR Estimates</div>
        <div className="text-[11px] text-stone-500">Zero hidden surcharges</div>
      </div>

      <div className="text-center sm:text-left">
        <div className="font-heading font-extrabold text-2xl sm:text-3xl text-[#E8590C] flex items-center justify-center sm:justify-start">
          <Counter to={17} duration={1.0} />
        </div>
        <div className="text-xs font-semibold text-stone-700 mt-0.5">Workflow Statuses</div>
        <div className="text-[11px] text-stone-500">Deterministic state machine</div>
      </div>

      <div className="text-center sm:text-left">
        <div className="font-heading font-extrabold text-2xl sm:text-3xl text-[#0F5C4D] flex items-center justify-center sm:justify-start">
          <Counter to={7} duration={0.8} suffix="s" />
        </div>
        <div className="text-xs font-semibold text-stone-700 mt-0.5">Live Polling Rate</div>
        <div className="text-[11px] text-stone-500">Real-time status updates</div>
      </div>

      <div className="text-center sm:text-left">
        <div className="font-heading font-extrabold text-2xl sm:text-3xl text-stone-900 flex items-center justify-center sm:justify-start">
          <Counter to={30} duration={1.1} suffix="+" />
        </div>
        <div className="text-xs font-semibold text-stone-700 mt-0.5">QC Checkpoints</div>
        <div className="text-[11px] text-stone-500">Pre-delivery road testing</div>
      </div>
    </motion.div>
  );
}
