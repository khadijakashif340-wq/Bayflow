'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useInView, useReducedMotion } from 'framer-motion';

interface CounterProps {
  from?: number;
  to: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}

export function Counter({
  from = 0,
  to,
  duration = 1.2,
  prefix = '',
  suffix = '',
  className = '',
}: CounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-40px' });
  const shouldReduceMotion = useReducedMotion();
  const [count, setCount] = useState<number>(from);

  useEffect(() => {
    if (!isInView) return;
    if (shouldReduceMotion) {
      setCount(to);
      return;
    }

    let startTimestamp: number | null = null;
    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / (duration * 1000), 1);
      // easeOutExpo function
      const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      const current = Math.floor(from + (to - from) * ease);
      setCount(current);

      if (progress < 1) {
        window.requestAnimationFrame(step);
      } else {
        setCount(to);
      }
    };

    window.requestAnimationFrame(step);
  }, [isInView, from, to, duration, shouldReduceMotion]);

  return (
    <span ref={ref} className={className}>
      {prefix}
      {count.toLocaleString()}
      {suffix}
    </span>
  );
}
