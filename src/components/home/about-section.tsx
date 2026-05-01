import Image from "next/image";

export function AboutSection() {
  return (
    <section className="bg-secondary/50 py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
          <div>
            <h2 className="text-3xl font-bold text-foreground">
              We Love Portland, Plain and Simple.
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
              We&apos;re not just a rental company &mdash; we&apos;re your local
              guides to everything Portland. Our properties feature timeless,
              airy designs with locally curated interiors in the city&apos;s
              most walkable neighborhoods.
            </p>
            <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
              From the foodie haven of Division Street to the creative energy of
              Alberta Arts District, each home is designed to provide
              hotel-quality comfort with authentic Portland character.
            </p>
            <p className="mt-4 font-medium text-primary">
              Portland&apos;s Local Booking Platform &mdash; book direct and
              save.
            </p>
          </div>
          <div className="relative aspect-[4/3] overflow-hidden rounded-xl">
            <Image
              src="/images/interior-illustrated-overlay.png"
              alt="Book Traverse interior"
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
