export function ListicleItem({
  number,
  icon: Icon,
  title,
  children,
}: {
  number: number;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3 py-10 first:pt-0 sm:gap-5">
      <div className="flex shrink-0 flex-col items-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <span className="text-xl font-bold text-primary">{number}</span>
        </div>
        <div className="mt-3 flex h-8 w-8 items-center justify-center">
          <Icon className="h-5 w-5 text-muted-foreground/50" />
        </div>
      </div>
      <div className="min-w-0">
        <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
          {title}
        </h2>
        <div className="mt-3 space-y-3 text-muted-foreground leading-relaxed">
          {children}
        </div>
      </div>
    </div>
  );
}
