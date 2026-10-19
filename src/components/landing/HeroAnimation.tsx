'use client';

import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { staggerContainer, fadeUp, floatProps } from '@/lib/motion';

export function HeroContent({ children }: { children: React.ReactNode }) {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return <div className="space-y-6">{children}</div>;
  }

  return (
    <motion.div
      variants={staggerContainer(0.08, 0.05)}
      initial="initial"
      animate="animate"
      className="space-y-6"
    >
      {React.Children.map(children, (child) => (
        <motion.div variants={fadeUp}>{child}</motion.div>
      ))}
    </motion.div>
  );
}

export function HeroFloatingCard({ children }: { children: React.ReactNode }) {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return <div>{children}</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      <motion.div
        animate={floatProps.animate}
        transition={floatProps.transition}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}
