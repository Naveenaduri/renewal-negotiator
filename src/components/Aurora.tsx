"use client";

import { motion, useMotionTemplate, useMotionValue, useSpring } from "framer-motion";
import { useEffect } from "react";

// Drifting colour fields, a faint dot grid, and a soft light that follows the pointer.
export default function Aurora() {
  const x = useMotionValue(-600);
  const y = useMotionValue(-600);
  const sx = useSpring(x, { stiffness: 90, damping: 22 });
  const sy = useSpring(y, { stiffness: 90, damping: 22 });

  useEffect(() => {
    const move = (e: PointerEvent) => {
      x.set(e.clientX);
      y.set(e.clientY);
    };
    window.addEventListener("pointermove", move);
    return () => window.removeEventListener("pointermove", move);
  }, [x, y]);

  const light = useMotionTemplate`radial-gradient(460px circle at ${sx}px ${sy}px, rgba(62,224,193,0.10), transparent 70%)`;

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-ink">
      <div className="aurora a1" />
      <div className="aurora a2" />
      <div className="aurora a3" />
      <div className="dotgrid absolute inset-0" />
      <motion.div className="absolute inset-0" style={{ background: light }} />
    </div>
  );
}
