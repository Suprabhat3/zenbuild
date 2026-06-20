"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

type RevealProps = {
  children: ReactNode;
  className?: string;
  /** stagger delay tier: 1, 2 or 3 */
  delay?: 1 | 2 | 3;
  /** wrapper element tag */
  as?: "div" | "section" | "li" | "article";
};

/**
 * Wraps content with a scroll-triggered reveal. Adds the `in-view` class
 * (consumed by landing.css) once the element enters the viewport. Honors
 * prefers-reduced-motion by revealing immediately.
 */
export function Reveal({
  children,
  className = "",
  delay,
  as = "div",
}: RevealProps) {
  const ref = useRef<HTMLElement | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setInView(true);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const Tag = as;
  const delayClass = delay ? `reveal-d${delay}` : "";

  return (
    <Tag
      // @ts-expect-error — ref typing across union of intrinsic tags
      ref={ref}
      className={`reveal ${delayClass} ${inView ? "in-view" : ""} ${className}`.trim()}
    >
      {children}
    </Tag>
  );
}
