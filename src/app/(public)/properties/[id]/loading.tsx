import Image from "next/image";

export default function PropertyDetailLoading() {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-white">
      <div className="flex flex-col items-center">
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
        <p className="mt-4 text-sm text-muted-foreground">
          Loading your next unforgettable experience...
        </p>
      </div>
    </div>
  );
}
