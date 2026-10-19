'use client';

import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { fadeUp, easeOutExpo } from '@/lib/motion';

export function AnimatedSection({
  children,
  className = '',
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.4, ease: easeOutExpo, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
