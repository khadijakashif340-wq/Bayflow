'use client';

import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Calendar, Wrench, CheckCircle2, ShieldCheck } from 'lucide-react';
import { staggerContainer, fadeUp } from '@/lib/motion';

const STEPS = [
  {
    step: '01',
    title: 'Book Workshop Slot',
    desc: 'Select your preferred repair center, vehicle details, and pick an open slot that fits your schedule.',
    icon: Calendar,
  },
  {
    step: '02',
    title: '30-Point Inspection',
    desc: 'Assigned technician performs comprehensive mechanical diagnostic and logs photo findings on bay lifts.',
    icon: Wrench,
  },
  {
    step: '03',
    title: 'Digital Estimate Sign-off',
    desc: 'Review exact parts and labor line items in PKR. Accept or decline right from your phone before repair begins.',
    icon: CheckCircle2,
  },
  {
    step: '04',
    title: 'QC Inspection & Pickup',
    desc: 'Independent QC inspector verifies the punchlist before approving handover. Pay and drive away with confidence.',
    icon: ShieldCheck,
  },
];

export function WorkflowSection() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <div className="relative">
      {/* Animated Connector Line across top of steps (visible on md+ screens) */}
      <div className="hidden md:block absolute top-[52px] left-[10%] right-[10%] h-0.5 z-0 pointer-events-none">
        <svg className="w-full h-2 overflow-visible" preserveAspectRatio="none">
          <motion.line
            x1="0%"
            y1="50%"
            x2="100%"
            y2="50%"
            stroke="#E8590C"
            strokeWidth="2"
            strokeDasharray="6 6"
            strokeOpacity="0.4"
            initial={{ pathLength: 0, opacity: 0 }}
            whileInView={{ pathLength: 1, opacity: 1 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          />
        </svg>
      </div>

      <motion.div
        variants={staggerContainer(0.12, 0.1)}
        initial={shouldReduceMotion ? 'animate' : 'initial'}
        whileInView="animate"
        viewport={{ once: true, margin: '-50px' }}
        className="grid grid-cols-1 md:grid-cols-4 gap-6 relative z-10"
      >
        {STEPS.map((item) => {
          const Icon = item.icon;
          return (
            <motion.div
              key={item.step}
              variants={fadeUp}
              whileHover={
                shouldReduceMotion
                  ? {}
                  : { y: -3, transition: { duration: 0.15 } }
              }
              className="bg-white rounded-2xl p-6 border border-[#E7E0D5] space-y-3 relative shadow-xs"
            >
              <div className="flex items-center justify-between">
                <span className="font-heading font-black text-2xl text-[#E8590C]/30">
                  {item.step}
                </span>
                <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center text-[#E8590C]">
                  <Icon className="w-5 h-5" />
                </div>
              </div>
              <h3 className="font-heading font-bold text-base text-stone-900">
                {item.title}
              </h3>
              <p className="text-xs text-stone-600 leading-relaxed">
                {item.desc}
              </p>
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
}
