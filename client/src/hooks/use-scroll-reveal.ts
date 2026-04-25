"use client";

import { useEffect, useState } from "react";

type ScrollRevealOptions = {
  revealAt?: number;
  hideAt?: number;
};

export function useScrollReveal({
  revealAt = 120,
  hideAt = 72,
}: ScrollRevealOptions = {}) {
  const [isRevealed, setIsRevealed] = useState(false);

  useEffect(() => {
    let frame = 0;

    function updateVisibility() {
      frame = 0;
      const scrollY = window.scrollY;

      setIsRevealed((current) => {
        if (current) {
          return scrollY > hideAt;
        }

        return scrollY >= revealAt;
      });
    }

    function requestUpdate() {
      if (frame) {
        return;
      }

      if (typeof window.requestAnimationFrame === "function") {
        frame = window.requestAnimationFrame(updateVisibility);
      } else {
        updateVisibility();
      }
    }

    updateVisibility();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);

    return () => {
      if (frame && typeof window.cancelAnimationFrame === "function") {
        window.cancelAnimationFrame(frame);
      }

      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
    };
  }, [hideAt, revealAt]);

  return isRevealed;
}
