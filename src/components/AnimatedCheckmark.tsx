'use client';

import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

export function AnimatedCheckmark({
  size = 48,
  color = '#0F5C4D',
  className = '',
}: {
  size?: number;
  color?: string;
  className?: string;
}) {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return (
      <div
        className={`inline-flex items-center justify-center rounded-full bg-teal-50 border border-teal-200 text-[#0F5C4D] ${className}`}
        style={{ width: size, height: size }}
      >
        <svg
          width={size * 0.55}
          height={size * 0.55}
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20 6L9 17L4 12" />
        </svg>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: [0.8, 1.05, 1], opacity: 1 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className={`relative inline-flex items-center justify-center rounded-full bg-teal-50 border border-teal-200 ${className}`}
      style={{ width: size, height: size }}
    >
      {/* Subtle pulse ring */}
      <motion.div
        className="absolute inset-0 rounded-full bg-teal-400/25 pointer-events-none"
        initial={{ scale: 1, opacity: 0.6 }}
        animate={{ scale: [1, 1.25, 1.35], opacity: [0.6, 0.25, 0] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' }}
      />

      <svg
        width={size * 0.55}
        height={size * 0.55}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <motion.path
          d="M20 6L9 17L4 12"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
        />
      </svg>
    </motion.div>
  );
}
