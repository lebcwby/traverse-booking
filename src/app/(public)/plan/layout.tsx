import "./plan.css";

export default function PlanLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="flex h-full flex-col bg-neutral-50">{children}</div>;
}
