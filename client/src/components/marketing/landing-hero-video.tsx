"use client";

import { useEffect, useRef } from "react";

const desktopMotionQuery =
  "(min-width: 1024px) and (prefers-reduced-motion: no-preference)";

export function LandingHeroVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;

    if (!video || typeof window.matchMedia !== "function") {
      return;
    }

    const mediaQuery = window.matchMedia(desktopMotionQuery);
    let isIntersecting = true;

    const syncPlayback = () => {
      const shouldPlay =
        mediaQuery.matches &&
        isIntersecting &&
        document.visibilityState !== "hidden";

      if (shouldPlay) {
        void video.play().catch(() => undefined);
        return;
      }

      video.pause();
    };

    const observer =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(
            ([entry]) => {
              isIntersecting = Boolean(entry?.isIntersecting);
              syncPlayback();
            },
            { threshold: 0.05 },
          );

    observer?.observe(video);
    mediaQuery.addEventListener("change", syncPlayback);
    document.addEventListener("visibilitychange", syncPlayback);
    syncPlayback();

    return () => {
      observer?.disconnect();
      mediaQuery.removeEventListener("change", syncPlayback);
      document.removeEventListener("visibilitychange", syncPlayback);
    };
  }, []);

  return (
    <div className="landing-hero-media" aria-hidden="true">
      <div className="landing-hero-fallback" />
      <video
        ref={videoRef}
        className="landing-hero-video"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        tabIndex={-1}
      >
        <source
          src="/opsflow-hero-bg.mp4"
          type="video/mp4"
          media={desktopMotionQuery}
        />
      </video>
      <div className="landing-hero-scrim" />
    </div>
  );
}
