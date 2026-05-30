/**
 * Ortak motion variant'ları ve spring preset'leri.
 *
 * Tüm yeni Framer Motion entegrasyonları buradan beslenmeli — yoksa
 * easing / duration tutarsızlığı oluşur. Kurumsal "premium ama sakin" hissi:
 *   - softSpring: standart UI öğeleri (dialog, popover)
 *   - bouncySpring: dikkat çeken aksiyonlar (toast, badge)
 *   - smoothEase: liste/stagger geçişleri
 */

import type { Transition, Variants } from "framer-motion";

/** Standart yumuşak spring — UI öğeleri için. */
export const softSpring: Transition = {
  type: "spring",
  stiffness: 380,
  damping: 32,
  mass: 0.8,
};

/** Hafif zıplama — toast, badge, success state. */
export const bouncySpring: Transition = {
  type: "spring",
  stiffness: 480,
  damping: 22,
  mass: 0.7,
};

/** Stagger ve liste geçişleri için ease. */
export const smoothEase: Transition = {
  duration: 0.24,
  ease: [0.16, 1, 0.3, 1], // ease-out-quart benzeri
};

/** Scale + fade — dialog / modal / popover. */
export const scaleFadeVariants: Variants = {
  hidden: { opacity: 0, scale: 0.96, y: 4 },
  visible: { opacity: 1, scale: 1, y: 0, transition: softSpring },
  exit: { opacity: 0, scale: 0.96, y: 4, transition: { duration: 0.15 } },
};

/** Sağdan kayarak gelen toast — bouncy. */
export const slideInRightVariants: Variants = {
  hidden: { opacity: 0, x: 40, scale: 0.95 },
  visible: { opacity: 1, x: 0, scale: 1, transition: bouncySpring },
  exit: { opacity: 0, x: 20, scale: 0.95, transition: { duration: 0.18 } },
};

/** Stagger container — children'a 0.04sn aralık verir. */
export const staggerContainerVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.04, // 40ms — pricey hissetmeden gözle takip edilir
      delayChildren: 0.02,
    },
  },
};

/** Stagger item — alt-üst kayarak fade-in. */
export const staggerItemVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: smoothEase },
};

/** Hover lift — kartlar, drag feedback. */
export const liftHover = {
  scale: 1.015,
  transition: softSpring,
};

export const liftTap = {
  scale: 0.985,
  transition: { duration: 0.1 },
};
