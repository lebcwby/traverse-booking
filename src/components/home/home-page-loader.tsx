"use client";

import { useState, useEffect } from "react";
import Image from "next/image";

export function HomePageLoader() {
  const [ready, setReady] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const MIN_DISPLAY_MS = 800;

    let imageReady = false;
    let minTimeReached = false;

    function dismiss() {
      setFadeOut(true);
      setTimeout(() => setReady(true), 500);
    }

    function tryDismiss() {
      if (imageReady && minTimeReached) dismiss();
    }

    // Preload the hero background image
    const img = new window.Image();
    img.onload = () => {
      imageReady = true;
      tryDismiss();
    };
    img.onerror = () => {
      imageReady = true;
      tryDismiss();
    };
    img.src =
      window.innerWidth >= 640
        ? "/images/home/hero-desktop.jpg"
        : "/images/home/hero-mobile.jpg";

    // Minimum display time
    const minTimer = setTimeout(() => {
      minTimeReached = true;
      tryDismiss();
    }, MIN_DISPLAY_MS);

    // Safety timeout
    const timeout = setTimeout(() => dismiss(), 6000);

    return () => {
      clearTimeout(minTimer);
      clearTimeout(timeout);
    };
  }, []);

  if (ready) return null;

  return (
    <div
      className={`fixed inset-0 z-[200] flex flex-col items-center justify-center bg-white transition-opacity duration-500 ${
        fadeOut ? "opacity-0" : "opacity-100"
      }`}
    >
      <Image
        src="/book-traverse-icon.png"
        alt="Book Traverse"
        width={56}
        height={63}
        className="mb-6 animate-pulse"
        priority
      />
      <div className="h-1 w-40 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary/50"
          style={{
            animation: "shimmer 2.5s ease-in-out infinite",
            width: "40%",
          }}
        />
      </div>
    </div>
  );
}
