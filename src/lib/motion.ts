import { Variants, Transition } from 'framer-motion';

// Standardized easing curves for buttery 60fps animations
export const easeOutExpo: Transition['ease'] = [0.16, 1, 0.3, 1];
export const easeInOutCubic: Transition['ease'] = [0.65, 0, 0.35, 1];

// Stagger container
export const staggerContainer = (staggerChildren = 0.08, delayChildren = 0): Variants => ({
  initial: {},
  animate: {
    transition: {
      staggerChildren,
      delayChildren,
    },
  },
});

// Fade and slide up (Transform + Opacity only)
export const fadeUp: Variants = {
  initial: {
    opacity: 0,
    y: 16,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.35,
      ease: easeOutExpo,
    },
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: {
      duration: 0.2,
      ease: 'easeOut',
    },
  },
};

// Simple fade
export const fadeIn: Variants = {
  initial: {
    opacity: 0,
  },
  animate: {
    opacity: 1,
    transition: {
      duration: 0.25,
      ease: 'easeOut',
    },
  },
  exit: {
    opacity: 0,
    transition: {
      duration: 0.15,
      ease: 'easeIn',
    },
  },
};

// Scale in for modals, tooltips, checkmarks
export const scaleIn: Variants = {
  initial: {
    opacity: 0,
    scale: 0.96,
  },
  animate: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.25,
      ease: easeOutExpo,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.96,
    transition: {
      duration: 0.15,
      ease: 'easeIn',
    },
  },
};

// Direction-aware horizontal sliding for wizard steps
export const slideStep: Variants = {
  initial: (direction: number) => ({
    opacity: 0,
    x: direction > 0 ? 32 : -32,
  }),
  animate: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.3,
      ease: easeOutExpo,
    },
  },
  exit: (direction: number) => ({
    opacity: 0,
    x: direction > 0 ? -32 : 32,
    transition: {
      duration: 0.2,
      ease: 'easeInOut',
    },
  }),
};

// Staggered list row item
export const listRowItem: Variants = {
  initial: {
    opacity: 0,
    y: 10,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.25,
      ease: easeOutExpo,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.98,
    transition: {
      duration: 0.15,
      ease: 'easeOut',
    },
  },
};

// Standard button hover & tap micro-interactions
export const buttonTapProps = {
  whileHover: { y: -1, transition: { duration: 0.15 } },
  whileTap: { scale: 0.98 },
};

// Card hover micro-interaction (lift 4px)
export const cardHoverProps = {
  whileHover: {
    y: -4,
    transition: { duration: 0.2, ease: 'easeOut' as const },
  },
};

// Floating loop animation for hero illustrations
export const floatProps = {
  animate: {
    y: [0, -8, 0],
  },
  transition: {
    duration: 6,
    repeat: Infinity,
    ease: 'easeInOut' as const,
  },
};
