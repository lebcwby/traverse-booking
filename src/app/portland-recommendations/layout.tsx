// src/app/portland-recommendations/layout.tsx
// Reuses the /plan workspace's chrome-suppression CSS (hides global header,
// footer, mobile bottom nav, Conduit chat widget) so the recommender chat
// owns the full viewport. The CSS is scoped via :has([data-plan-chrome])
// — the RecommendChat client renders that attribute on its root.

import "../plan/plan.css";

export default function PortlandRecommendationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="flex h-full flex-col bg-neutral-50">{children}</div>;
}
