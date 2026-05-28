"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { Share, X, Copy, Mail, MessageSquare, Check } from "lucide-react";
import { getPhotoUrl } from "@/lib/utils";

// SVG icons for social platforms not in Lucide
function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function MessengerIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M.001 11.639C.001 4.949 5.241 0 12.001 0S24 4.95 24 11.639c0 6.689-5.24 11.638-12 11.638-1.21 0-2.38-.16-3.47-.46a.96.96 0 00-.64.05l-2.39 1.05a.96.96 0 01-1.35-.85l-.07-2.14a.97.97 0 00-.32-.68A11.39 11.389 0 01.002 11.64zm8.32-2.19l-3.52 5.6c-.35.53.32 1.139.82.75l3.79-2.87c.26-.2.6-.2.87 0l2.8 2.1c.84.63 2.04.4 2.6-.48l3.52-5.6c.35-.53-.32-1.13-.82-.75l-3.79 2.87c-.25.2-.6.2-.86 0l-2.8-2.1a1.8 1.8 0 00-2.61.48z" />
    </svg>
  );
}

interface ShareDialogProps {
  title: string;
  description: string;
  photo?: string | null;
  city?: string | null;
  bedrooms?: number | null;
  beds?: number | null;
  bathrooms?: number | string | null;
  variant?: "text" | "icon";
}

export function ShareButton({
  title,
  photo,
  city,
  bedrooms,
  beds,
  bathrooms,
  variant = "text",
}: ShareDialogProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  const url = typeof window !== "undefined" ? window.location.href : "";

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [open]);

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  }

  const stats = [
    bedrooms && `${bedrooms} bedroom${bedrooms === 1 ? "" : "s"}`,
    beds && `${beds} bed${beds === 1 ? "" : "s"}`,
    bathrooms &&
      `${Number(bathrooms)} bath${Number(bathrooms) === 1 ? "" : "s"}`,
  ]
    .filter(Boolean)
    .join(" · ");
  const summaryText = `Home in ${city || "Colorado"}${stats ? ` · ${stats}` : ""}`;

  const shareText = `Check out this place on Book Traverse: ${title}`;

  const options = [
    {
      label: "Copy Link",
      icon: copied ? (
        <Check className="h-5 w-5" />
      ) : (
        <Copy className="h-5 w-5" />
      ),
      onClick: copyLink,
    },
    {
      label: "Email",
      icon: <Mail className="h-5 w-5" />,
      onClick: () =>
        window.open(
          `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(`${shareText}\n\n${url}`)}`
        ),
    },
    {
      label: "Messages",
      icon: <MessageSquare className="h-5 w-5" />,
      onClick: () =>
        window.open(`sms:?&body=${encodeURIComponent(`${shareText} ${url}`)}`),
    },
    {
      label: "WhatsApp",
      icon: <WhatsAppIcon className="h-5 w-5" />,
      onClick: () =>
        window.open(
          `https://wa.me/?text=${encodeURIComponent(`${shareText} ${url}`)}`,
          "_blank"
        ),
    },
    {
      label: "Messenger",
      icon: <MessengerIcon className="h-5 w-5" />,
      onClick: () =>
        window.open(
          `fb-messenger://share/?link=${encodeURIComponent(url)}`,
          "_blank"
        ),
    },
    {
      label: "Facebook",
      icon: <FacebookIcon className="h-5 w-5" />,
      onClick: () =>
        window.open(
          `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
          "_blank",
          "width=600,height=400"
        ),
    },
    {
      label: "X",
      icon: <XIcon className="h-5 w-5" />,
      onClick: () =>
        window.open(
          `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(url)}`,
          "_blank",
          "width=600,height=400"
        ),
    },
  ];

  return (
    <>
      {variant === "icon" ? (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center justify-center rounded-full"
          aria-label="Share"
        >
          <Share className="h-5 w-5 text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.5)]" />
        </button>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 text-sm font-medium text-foreground underline-offset-2 hover:underline"
        >
          <Share className="h-4 w-4" />
          Share
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-4">
          <div
            ref={dialogRef}
            className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
          >
            <button
              onClick={() => setOpen(false)}
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-foreground hover:bg-muted"
            >
              <X className="h-5 w-5" />
            </button>

            <h2 className="text-xl font-semibold text-foreground">
              Share this place
            </h2>

            {/* Property preview */}
            <div className="mt-4 flex items-center gap-3">
              {photo && (
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg">
                  <Image
                    src={getPhotoUrl(photo, 200)}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="48px"
                  />
                </div>
              )}
              <p className="text-sm text-foreground">{summaryText}</p>
            </div>

            {/* Share options grid */}
            <div className="mt-5 grid grid-cols-2 gap-3">
              {options.map((opt) => (
                <button
                  key={opt.label}
                  onClick={() => {
                    opt.onClick();
                    if (opt.label !== "Copy Link") setOpen(false);
                  }}
                  className="flex items-center gap-3 rounded-xl border border-border px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                >
                  {opt.icon}
                  {opt.label === "Copy Link" && copied ? "Copied!" : opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
