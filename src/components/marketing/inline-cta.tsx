import Link from "next/link";

export function InlineCTA({ href, label }: { href: string; label: string }) {
  return (
    <div className="my-10 text-center">
      <Link
        href={href}
        className="inline-flex items-center rounded-full bg-primary px-8 py-3.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
      >
        {label}
      </Link>
      <p className="mt-2 text-xs text-muted-foreground">
        No booking fees &middot; Free cancellation on most stays
      </p>
    </div>
  );
}
