import { rankFor } from "@/lib/creator-rank";

export function RankBadge({ score }: { score: number }) {
  const rank = rankFor(score);
  return <span className={`chip rank-badge rank-${rank.id}`}>{rank.label}</span>;
}
