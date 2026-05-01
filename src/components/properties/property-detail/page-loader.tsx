"use client";

import { useState, useEffect } from "react";
import Image from "next/image";

export function PageLoader({ photoCount }: { photoCount: number }) {
  const [ready, setReady] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    if (photoCount === 0) {
      setReady(true);
      return;
    }

    const target = Math.min(photoCount, 5);
    const MIN_DISPLAY_MS = 1500;
    let imagesReady = false;
    let minTimeReached = false;

    function dismiss() {
      setFadeOut(true);
      setTimeout(() => setReady(true), 500);
    }

    function tryDismiss() {
      if (imagesReady && minTimeReached) dismiss();
    }

    function checkImages() {
      const imgs =
        document.querySelectorAll<HTMLImageElement>("[data-gallery-img]");
      if (imgs.length === 0) return false;

      let loadedCount = 0;
      imgs.forEach((img) => {
        if (img.complete && img.naturalHeight > 0) loadedCount++;
      });

      return loadedCount >= target;
    }

    // Poll for image completion
    const interval = setInterval(() => {
      if (checkImages()) {
        clearInterval(interval);
        imagesReady = true;
        tryDismiss();
      }
    }, 150);

    // Minimum display time
    const minTimer = setTimeout(() => {
      minTimeReached = true;
      tryDismiss();
    }, MIN_DISPLAY_MS);

    // Safety timeout
    const timeout = setTimeout(() => {
      clearInterval(interval);
      dismiss();
    }, 8000);

    return () => {
      clearInterval(interval);
      clearTimeout(minTimer);
      clearTimeout(timeout);
    };
  }, [photoCount]);

  if (ready) return null;

  return (
    <div
      className={`fixed inset-0 z-[200] flex flex-col items-center justify-center bg-white transition-opacity duration-500 ${
        fadeOut ? "opacity-0" : "opacity-100"
      }`}
    >
      <Image
        src="/book-traverse-icon.png"
        alt="Traverse Hospitality"
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
      <p className="mt-4 text-sm text-muted-foreground">Loading your next unforgettable experience...</p>
    </div>
  );
}
