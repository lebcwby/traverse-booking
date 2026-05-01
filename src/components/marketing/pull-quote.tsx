export function PullQuote({ text, author }: { text: string; author: string }) {
  return (
    <blockquote className="my-8 border-l-4 border-accent pl-6">
      <p className="text-lg italic leading-relaxed text-foreground/80">
        &ldquo;{text}&rdquo;
      </p>
      <cite className="mt-2 block text-sm font-medium not-italic text-muted-foreground">
        — {author}
      </cite>
    </blockquote>
  );
}
