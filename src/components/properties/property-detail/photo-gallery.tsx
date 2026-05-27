"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ChevronLeft, ChevronRight, X, LayoutGrid } from "lucide-react";
import { getPhotoUrl } from "@/lib/utils";

interface Photo {
  original: string;
  thumbnail: string;
  caption?: string;
}

export function PhotoGallery({
  photos,
  altPrefix = "Colorado vacation rental",
  mobileActions,
}: {
  photos: Photo[];
  altPrefix?: string;
  mobileActions?: React.ReactNode;
}) {
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [mobileIndex, setMobileIndex] = useState(0);
  const [mobileViewerOpen, setMobileViewerOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [lightboxDirection, setLightboxDirection] = useState<
    "forward" | "backward"
  >("forward");
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);
  const touchRef = useRef<{ startX: number; startScroll: number } | null>(null);

  // Lock body scroll when gallery, mobile viewer, or lightbox is open
  useEffect(() => {
    if (!galleryOpen && !mobileViewerOpen && lightboxIndex === null) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [galleryOpen, mobileViewerOpen, lightboxIndex]);

  // Close gallery on Escape
  useEffect(() => {
    if (!galleryOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setGalleryOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [galleryOpen]);

  // Lightbox keyboard navigation: Esc to close, ←/→ to advance
  useEffect(() => {
    if (lightboxIndex === null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxIndex(null);
      else if (e.key === "ArrowLeft") {
        setLightboxDirection("backward");
        setLightboxIndex((prev) =>
          prev === null ? null : (prev - 1 + photos.length) % photos.length
        );
      } else if (e.key === "ArrowRight") {
        setLightboxDirection("forward");
        setLightboxIndex((prev) =>
          prev === null ? null : (prev + 1) % photos.length
        );
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [lightboxIndex, photos.length]);

  if (photos.length === 0) return null;

  const mainPhoto = photos[0];
  const thumbPhotos = photos.slice(1, 5);
  const closeLightbox = () => setLightboxIndex(null);
  const advanceLightbox = (delta: number) => {
    setLightboxDirection(delta >= 0 ? "forward" : "backward");
    setLightboxIndex((prev) =>
      prev === null ? null : (prev + delta + photos.length) % photos.length
    );
  };

  function handleMobileScroll() {
    if (!scrollRef.current) return;
    const { scrollLeft, clientWidth } = scrollRef.current;
    const newIndex = Math.round(scrollLeft / clientWidth);
    setMobileIndex(Math.max(0, Math.min(newIndex, photos.length - 1)));
  }

  return (
    <>
      {/* Mobile: swipeable carousel */}
      <div className="sm:hidden relative">
        <div
          ref={scrollRef}
          className="flex snap-x snap-mandatory overflow-x-auto scrollbar-hide"
          style={{
            scrollbarWidth: "none",
            msOverflowStyle: "none",
            WebkitOverflowScrolling: "touch",
          }}
          onScroll={handleMobileScroll}
          onTouchStart={(e) => {
            if (!scrollRef.current) return;
            touchRef.current = {
              startX: e.touches[0].clientX,
              startScroll: scrollRef.current.scrollLeft,
            };
          }}
          onTouchEnd={() => {
            touchRef.current = null;
          }}
        >
          {photos.map((photo, i) => (
            <div
              key={i}
              className="relative aspect-[4/3] w-full flex-none snap-center"
              onClick={() => setMobileViewerOpen(true)}
            >
              <Image
                src={getPhotoUrl(photo.original, 600)}
                alt={photo.caption || `${altPrefix} - photo ${i + 1}`}
                fill
                className="object-cover"
                priority={i === 0}
                sizes="100vw"
                data-gallery-img=""
              />
            </div>
          ))}
        </div>
        {/* Back arrow — top left over photo */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            router.back();
          }}
          className="absolute left-3 top-3 z-10 drop-shadow-[0_1px_3px_rgba(0,0,0,0.5)]"
        >
          <ChevronLeft className="h-7 w-7 text-white" />
        </button>
        {/* Share & Save overlay — top right */}
        {mobileActions && (
          <div className="absolute right-3 top-3 z-10 flex items-center gap-2">
            {mobileActions}
          </div>
        )}
        {/* Photo counter badge */}
        {photos.length > 1 && (
          <div className="pointer-events-none absolute bottom-3 right-3 rounded-md bg-black/60 px-2.5 py-1 text-xs font-medium text-white">
            {mobileIndex + 1} / {photos.length}
          </div>
        )}
      </div>

      {/* Mobile: fullscreen vertical photo viewer */}
      {mobileViewerOpen && (
        <div className="sm:hidden fixed inset-0 z-[100] bg-white">
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between bg-white/95 backdrop-blur-sm px-4 py-3 border-b border-border">
            <span className="text-sm font-medium text-muted-foreground">
              {photos.length} photos
            </span>
            <button
              onClick={() => setMobileViewerOpen(false)}
              className="flex items-center justify-center h-8 w-8 rounded-full bg-muted"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {/* Scrollable photo list */}
          <div
            className="overflow-y-auto"
            style={{ height: "calc(100vh - 49px)" }}
          >
            <div className="flex flex-col gap-1 pb-8">
              {photos.map((photo, i) => (
                <div key={i} className="relative w-full aspect-[4/3]">
                  <Image
                    src={getPhotoUrl(photo.original, 800)}
                    alt={photo.caption || `${altPrefix} - photo ${i + 1}`}
                    fill
                    className="object-cover"
                    sizes="100vw"
                    priority={i < 3}
                    loading={i < 3 ? "eager" : "lazy"}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Desktop: grid layout */}
      <div className="hidden sm:grid grid-cols-4 grid-rows-2 gap-2 relative">
        <div
          className="relative aspect-[4/3] cursor-pointer overflow-hidden rounded-l-xl col-span-2 row-span-2"
          onClick={() => setGalleryOpen(true)}
        >
          <Image
            src={getPhotoUrl(mainPhoto.original, 1200)}
            alt={mainPhoto.caption || `${altPrefix} - main photo`}
            fill
            className="object-cover transition-transform hover:scale-105"
            priority
            sizes="50vw"
            data-gallery-img=""
          />
        </div>
        {thumbPhotos.map((photo, i) => (
          <div
            key={i}
            className={`relative aspect-[4/3] cursor-pointer overflow-hidden ${
              i === 1 ? "rounded-tr-xl" : i === 3 ? "rounded-br-xl" : ""
            }`}
            onClick={() => setGalleryOpen(true)}
          >
            <Image
              src={getPhotoUrl(photo.original, 600)}
              alt={photo.caption || `${altPrefix} - photo ${i + 1}`}
              fill
              priority
              className="object-cover transition-transform hover:scale-105"
              sizes="25vw"
              data-gallery-img=""
            />
          </div>
        ))}
        {/* Show all photos button */}
        {photos.length > 5 && (
          <button
            onClick={() => setGalleryOpen(true)}
            className="absolute bottom-3 right-3 z-10 flex items-center gap-1.5 rounded-lg border border-foreground bg-background px-3 py-1.5 text-sm font-medium text-foreground shadow-sm hover:bg-muted transition-colors"
          >
            <LayoutGrid className="h-4 w-4" />
            Show all photos
          </button>
        )}
      </div>

      {/* Desktop: fullscreen photo gallery */}
      {galleryOpen && (
        <div className="hidden sm:block fixed inset-0 z-[100] bg-background">
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between bg-background border-b border-border px-6 py-3">
            <button
              onClick={() => setGalleryOpen(false)}
              className="flex items-center justify-center h-8 w-8 rounded-full hover:bg-muted transition-colors"
            >
              <X className="h-5 w-5 text-foreground" />
            </button>
            <span className="text-sm font-medium text-muted-foreground">
              {photos.length} photos
            </span>
            <div className="w-8" />
          </div>

          {/* Scrollable photo grid */}
          <div
            className="overflow-y-auto"
            style={{ height: "calc(100vh - 53px)" }}
          >
            <div className="mx-auto max-w-3xl px-6 py-8 space-y-2">
              {photos.map((photo, i) => {
                // Pattern: full-width, then pairs of 2
                // Position in repeating group of 3: 0 = full, 1 = left half, 2 = right half
                const posInGroup = i % 3;

                if (posInGroup === 0) {
                  // Full-width photo
                  return (
                    <div
                      key={i}
                      className="relative w-full aspect-[3/2] rounded-sm overflow-hidden cursor-zoom-in"
                      onClick={() => setLightboxIndex(i)}
                    >
                      <Image
                        src={getPhotoUrl(photo.original, 1200)}
                        alt={photo.caption || `${altPrefix} - photo ${i + 1}`}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, 768px"
                        priority={i < 3}
                        loading={i < 3 ? "eager" : "lazy"}
                      />
                    </div>
                  );
                }

                if (posInGroup === 1) {
                  // Start of a pair — render both side by side
                  const nextPhoto = photos[i + 1];
                  return (
                    <div key={i} className="grid grid-cols-2 gap-2">
                      <div
                        className="relative aspect-[4/3] rounded-sm overflow-hidden cursor-zoom-in"
                        onClick={() => setLightboxIndex(i)}
                      >
                        <Image
                          src={getPhotoUrl(photo.original, 800)}
                          alt={photo.caption || `${altPrefix} - photo ${i + 1}`}
                          fill
                          className="object-cover"
                          sizes="(max-width: 768px) 50vw, 384px"
                          loading="lazy"
                        />
                      </div>
                      {nextPhoto && (
                        <div
                          className="relative aspect-[4/3] rounded-sm overflow-hidden cursor-zoom-in"
                          onClick={() => setLightboxIndex(i + 1)}
                        >
                          <Image
                            src={getPhotoUrl(nextPhoto.original, 800)}
                            alt={
                              nextPhoto.caption ||
                              `${altPrefix} - photo ${i + 2}`
                            }
                            fill
                            className="object-cover"
                            sizes="(max-width: 768px) 50vw, 384px"
                            loading="lazy"
                          />
                        </div>
                      )}
                    </div>
                  );
                }

                // posInGroup === 2: already rendered as part of the pair above
                return null;
              })}
            </div>
          </div>
        </div>
      )}

      {/* Lightbox: single-image viewer with caption + arrow navigation */}
      {lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-[110] flex flex-col bg-black/95"
          onClick={closeLightbox}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 sm:px-6">
            <span className="text-sm font-medium text-white/70">
              {lightboxIndex + 1} / {photos.length}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                closeLightbox();
              }}
              aria-label="Close"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Image area */}
          <div
            className="relative flex flex-1 items-center justify-center px-4 sm:px-16"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              key={lightboxIndex}
              className={`absolute inset-0 mx-4 sm:mx-16 ${
                lightboxDirection === "forward"
                  ? "animate-lightbox-forward"
                  : "animate-lightbox-backward"
              }`}
            >
              <Image
                src={getPhotoUrl(photos[lightboxIndex].original, 1600)}
                alt={
                  photos[lightboxIndex].caption ||
                  `${altPrefix} - photo ${lightboxIndex + 1}`
                }
                fill
                className="object-contain"
                sizes="100vw"
                priority
              />
            </div>

            {photos.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    advanceLightbox(-1);
                  }}
                  aria-label="Previous photo"
                  className="absolute left-2 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white shadow-lg backdrop-blur transition-colors hover:bg-white/25 sm:left-6"
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    advanceLightbox(1);
                  }}
                  aria-label="Next photo"
                  className="absolute right-2 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white shadow-lg backdrop-blur transition-colors hover:bg-white/25 sm:right-6"
                >
                  <ChevronRight className="h-6 w-6" />
                </button>
              </>
            )}
          </div>

          {/* Caption (only when set) */}
          {photos[lightboxIndex].caption && (
            <div
              key={`caption-${lightboxIndex}`}
              className={`px-4 pb-6 pt-3 text-center sm:px-6 ${
                lightboxDirection === "forward"
                  ? "animate-lightbox-forward"
                  : "animate-lightbox-backward"
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              <p className="mx-auto max-w-2xl text-sm text-white/85">
                {photos[lightboxIndex].caption}
              </p>
            </div>
          )}
        </div>
      )}
    </>
  );
}
