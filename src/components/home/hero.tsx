import Image, { getImageProps } from "next/image";
import { FloatingSearchBar } from "@/components/home/floating-search-bar";

export function Hero() {
  const common = {
    alt: "Portland skyline with autumn foliage and Mt. Hood",
    sizes: "100vw",
    priority: true,
  };

  const {
    props: { srcSet: desktop },
  } = getImageProps({
    ...common,
    src: "/images/home/hero-desktop.jpg",
    width: 1920,
    height: 1280,
    quality: 80,
  });

  const {
    props: { srcSet: mobile, ...rest },
  } = getImageProps({
    ...common,
    src: "/images/home/hero-mobile.jpg",
    width: 828,
    height: 662,
    quality: 75,
  });

  return (
    <section className="relative flex min-h-[260px] items-center justify-center px-4 pt-[80px] pb-4 sm:min-h-[400px] sm:py-16">
      <picture>
        <source media="(min-width: 640px)" srcSet={desktop} sizes="100vw" />
        {/* alt is spread via {...rest} from getImageProps */}
        <img
          {...rest}
          srcSet={mobile}
          className="absolute inset-0 h-full w-full object-cover object-bottom"
        />
      </picture>
      <div className="absolute inset-0 bg-primary/40" />
      <div className="relative z-10 mx-auto w-full max-w-3xl text-center">
        <Image
          src="/book-traverse-wordmark-white.png"
          alt="Book Traverse"
          width={340}
          height={68}
          className="mx-auto mb-4"
          priority
        />
        <h1 className="mb-1.5 text-sm font-normal text-white/90 sm:text-lg">
          Portland Vacation Rentals — Walkable Neighborhoods, Hotel-Quality
          Comfort
        </h1>
        <p className="mb-2 hidden text-sm text-accent sm:block">
          No Fees. Lowest Price Guaranteed.
        </p>
        <p className="mb-6 text-sm tracking-wide text-white/90 sm:font-medium">
          <span className="font-bold">275+</span> homes &middot;{" "}
          <span className="font-bold">80,000+</span> guests hosted &middot;{" "}
          <span className="font-bold">87%</span> 5★ reviews
        </p>
        <FloatingSearchBar />
      </div>
    </section>
  );
}
