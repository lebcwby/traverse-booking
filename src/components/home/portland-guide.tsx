import Link from "next/link";
import Image from "next/image";
import { InlineEmailCapture } from "@/components/marketing/inline-email-capture";

export function PortlandGuide() {
  return (
    <section className="py-16 md:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-2 lg:gap-16">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Your Guide to Vacation Rentals in Portland, Oregon
            </h2>
            <div className="mt-6 space-y-6 text-base leading-relaxed text-muted-foreground">
              <p>
                Portland, Oregon is one of the Pacific Northwest&apos;s most
                rewarding destinations — a city built around incredible food,
                craft beverages, independent shops, and easy access to
                mountains, rivers, and the coast. Whether you&apos;re visiting
                for a long weekend or an extended stay, a vacation rental gives
                you the space, privacy, and neighborhood immersion that hotels
                simply can&apos;t match. Wake up in a real Portland
                neighborhood, brew coffee in your own kitchen, and walk to
                breakfast at a spot the locals love.
              </p>

              <h3 className="text-xl font-semibold text-foreground pt-2">
                The Best Places to Stay in Portland
              </h3>
              <p>
                The best places to stay in Portland depend on what you&apos;re
                looking for. Southeast Portland — neighborhoods like Hawthorne,
                Division, and Belmont — is the city&apos;s culinary and cultural
                epicenter, with James Beard-recognized restaurants and eclectic
                vintage shops on every block. Northeast Portland&apos;s Alberta
                Arts District and Mississippi Avenue offer creative energy,
                murals, and some of the best brunch in the Pacific Northwest.
                Northwest Portland puts you steps from the Pearl District&apos;s
                galleries and the 5,200-acre Forest Park, while North
                Portland&apos;s St. Johns neighborhood feels like a small town
                with its own bridge, brewery scene, and stunning Cathedral Park.
              </p>

              <h3 className="text-xl font-semibold text-foreground pt-2">
                When to Visit Portland
              </h3>
              <p>
                Portland is a year-round destination. Summers are warm, dry, and
                long — perfect for rooftop patios, river floats, and day trips
                to Mt. Hood or the Oregon Coast. Fall and spring bring mild
                temperatures and fewer crowds. And Portland&apos;s famous rainy
                season from November through March? That&apos;s when the
                city&apos;s cozy side shines — fireplaces, hot tubs, bookstores,
                and the kind of restaurants that make you want to linger for
                hours. No matter when you visit, booking a vacation rental in
                Portland means you&apos;ll experience the city like a local, not
                a tourist.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/guide/where-to-stay-in-portland"
                  className="inline-flex items-center rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary/90"
                >
                  Neighborhood Guide
                </Link>
                <Link
                  href="/guide"
                  className="inline-flex items-center rounded-full border border-primary/30 px-6 py-3 text-sm font-semibold text-primary transition-colors hover:bg-primary/5"
                >
                  Full Travel Guide
                </Link>
              </div>

              <InlineEmailCapture
                headline="Get our Portland guide + insider deals"
                subtext="Deals, local tips, and neighborhood picks — straight to your inbox."
                buttonText="Send it"
                className="mt-6"
              />
            </div>
          </div>
          <div className="relative aspect-[3/4] overflow-hidden rounded-2xl lg:sticky lg:top-24">
            <Image
              src="/images/home/7b564b83-b3dd-49dd-9977-0f51e3d583b9.jpg"
              alt="Beautifully designed bedroom in a Book Traverse vacation rental"
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 50vw"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
