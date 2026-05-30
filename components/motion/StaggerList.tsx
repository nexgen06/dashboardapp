"use client";

import { motion, useReducedMotion, type HTMLMotionProps } from "framer-motion";
import {
  staggerContainerVariants,
  staggerItemVariants,
} from "@/components/motion/motionPresets";
import { cn } from "@/lib/utils";

/**
 * Liste container — children'a sıralı fade-in stagger verir.
 *
 * Kullanım:
 *   <StaggerList as="ul" className="space-y-2">
 *     {items.map(it => (
 *       <StaggerItem key={it.id} as="li">...</StaggerItem>
 *     ))}
 *   </StaggerList>
 *
 * Notlar:
 *   - prefers-reduced-motion'da otomatik devre dışı
 *   - Mount-once: viewport tabanlı değil, mount anında çalışır
 */
type StaggerListProps = Omit<HTMLMotionProps<"div">, "variants" | "initial" | "animate"> & {
  as?: "div" | "ul" | "ol" | "section";
};

export function StaggerList({ as = "div", className, children, ...rest }: StaggerListProps) {
  const reduced = useReducedMotion();
  const Comp = motion[as] as typeof motion.div;

  if (reduced) {
    // Erişilebilirlik: animasyonu komple atla
    const Tag = as;
    return (
      <Tag className={className} {...(rest as React.HTMLAttributes<HTMLElement>)}>
        {children as React.ReactNode}
      </Tag>
    );
  }

  return (
    <Comp
      className={cn(className)}
      variants={staggerContainerVariants}
      initial="hidden"
      animate="visible"
      {...rest}
    >
      {children}
    </Comp>
  );
}

type StaggerItemProps = Omit<HTMLMotionProps<"div">, "variants"> & {
  as?: "div" | "li" | "article" | "section";
};

export function StaggerItem({ as = "div", className, children, ...rest }: StaggerItemProps) {
  const reduced = useReducedMotion();
  const Comp = motion[as] as typeof motion.div;

  if (reduced) {
    const Tag = as;
    return (
      <Tag className={className} {...(rest as React.HTMLAttributes<HTMLElement>)}>
        {children as React.ReactNode}
      </Tag>
    );
  }

  return (
    <Comp className={cn(className)} variants={staggerItemVariants} {...rest}>
      {children}
    </Comp>
  );
}
