import Link from "next/link";
import Image from "next/image";
import type { GuideArticle } from "@/lib/guide-content";

export function ArticleCard({
  article,
  priority = false,
}: {
  article: GuideArticle;
  priority?: boolean;
}) {
  return (
    <Link
      href={`/guide/${article.slug}`}
      className="group block overflow-hidden rounded-xl border border-border bg-white transition-shadow hover:shadow-lg"
    >
      <div className="relative aspect-[16/10] overflow-hidden">
        <Image
          src={article.heroImage}
          alt={article.heroAlt}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          priority={priority}
        />
        <div className="absolute bottom-3 left-3">
          <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-foreground backdrop-blur-sm">
            {article.categoryLabel}
          </span>
        </div>
      </div>
      <div className="p-4 sm:p-5">
        <h3 className="text-lg font-semibold leading-snug text-foreground group-hover:text-primary transition-colors sm:text-xl">
          {article.title}
        </h3>
        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
          {article.excerpt}
        </p>
        <p className="mt-3 text-xs text-muted-foreground/60">
          Updated{" "}
          {new Date(article.updatedAt).toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
        </p>
      </div>
    </Link>
  );
}
