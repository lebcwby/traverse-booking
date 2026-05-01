import Link from "next/link";
import Image from "next/image";
import type { BlogPost } from "@/lib/seo-content";

const FALLBACK_IMAGE = "/images/portland-skyline-hero.jpg";

export function BlogPostCard({
  post,
  pillarLabel = "Travel Tips",
}: {
  post: BlogPost;
  pillarLabel?: string;
}) {
  const imageUrl = post.featured_image_url || FALLBACK_IMAGE;
  const isExternal = imageUrl.startsWith("http");

  return (
    <Link
      href={`/guide/${post.slug}`}
      className="group block overflow-hidden rounded-xl border border-border bg-white transition-shadow hover:shadow-lg"
    >
      <div className="relative aspect-[16/10] overflow-hidden">
        {isExternal ? (
          <Image
            src={imageUrl}
            alt={post.meta_description || post.title}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            loading="lazy"
          />
        ) : (
          <Image
            src={imageUrl}
            alt={post.meta_description || post.title}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            loading="lazy"
          />
        )}
        <div className="absolute bottom-3 left-3">
          <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-foreground backdrop-blur-sm">
            {pillarLabel}
          </span>
        </div>
      </div>
      <div className="p-4 sm:p-5">
        <h3 className="text-lg font-semibold leading-snug text-foreground transition-colors group-hover:text-primary sm:text-xl">
          {post.title}
        </h3>
        {post.meta_description && (
          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
            {post.meta_description}
          </p>
        )}
        {post.published_at && (
          <p className="mt-3 text-xs text-muted-foreground/60">
            {new Date(post.published_at).toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        )}
      </div>
    </Link>
  );
}
