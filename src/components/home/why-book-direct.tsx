import Image from "next/image";
import { Check } from "lucide-react";
import { InlineEmailCapture } from "@/components/marketing/inline-email-capture";

const VALUE_PROPS = [
  {
    title: "No Booking Fees",
    description:
      "Book direct and save 10–15% compared to Airbnb and VRBO. No service fees, no hidden charges — the price you see is the price you pay.",
  },
  {
    title: "Locally Managed",
    description:
      "Every property is managed by our Portland-based team. You get local support, neighborhood recommendations, and someone who actually knows the city.",
  },
  {
    title: "Instant Booking",
    description:
      "Confirm your vacation rental in seconds. No waiting for host approval, no back-and-forth — just pick your dates and book.",
  },
];

export function WhyBookDirect() {
  return (
    <section className="py-16 md:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-2 lg:gap-16">
          <div className="relative aspect-[4/5] overflow-hidden rounded-2xl lg:aspect-[3/4]">
            <Image
              src="/images/home/2c130183-e179-4a86-bbcb-99df71ebe774.jpg"
              alt="Portland craftsman home at sunset — a Book Traverse vacation rental"
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 50vw"
            />
          </div>
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Why Book Direct with Book Traverse
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
              Portland&apos;s local vacation rental company — better prices,
              better service, better stays.
            </p>
            <div className="mt-8 space-y-6">
              {VALUE_PROPS.map((prop) => (
                <div key={prop.title} className="flex gap-4">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 mt-0.5">
                    <Check className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-foreground">
                      {prop.title}
                    </h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {prop.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <InlineEmailCapture
              headline="Save 10-15% — book direct, skip the fees"
              subtext="Plus Portland travel tips and seasonal deals. No spam."
              buttonText="Sign up"
              className="mt-8 rounded-xl border border-border bg-muted/30 p-5"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
