import Image from "next/image";
import Link from "next/link";
import { InlineEmailCapture } from "@/components/marketing/inline-email-capture";

export function CtaBanner() {
  return (
    <section className="relative py-24 md:py-32 overflow-hidden">
      <div className="absolute inset-0">
        <Image
          src="/images/home/photo-1743040510243-d5fcd8f3864c.jpeg"
          alt="Cherry blossoms along the Portland waterfront"
          fill
          className="object-cover"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-black/50" />
      </div>
      <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
        <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Don&apos;t Just Visit Portland — Live It.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-lg text-white/80">
          Browse 275+ vacation rentals in Portland&apos;s best neighborhoods. No
          booking fees. Lowest price guaranteed.
        </p>
        <Link
          href="/properties"
          className="mt-8 inline-flex items-center rounded-full bg-white px-8 py-3.5 text-sm font-semibold text-foreground transition-colors hover:bg-white/90"
        >
          Browse All Properties
        </Link>
        <div className="mx-auto mt-6 max-w-md">
          <InlineEmailCapture
            headline="Get Portland travel tips in your inbox."
            buttonText="Sign up"
            variant="dark"
          />
        </div>
      </div>
    </section>
  );
}
