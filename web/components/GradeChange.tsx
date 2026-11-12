/** Change in grade versus the previous report. Negative = worse. +2 or more is suspicious. */
export default function GradeChange({ change }: { change: number | null }) {
  if (change == null) return <span className="text-gray-400">—</span>;
  if (change < 0) return <span className="font-medium text-red-700">▼ {Math.abs(change)} worse</span>;
  if (change >= 2) return <span className="font-medium text-amber-700">▲ +{change} suspicious</span>;
  if (change > 0) return <span className="text-gray-700">▲ +{change}</span>;
  return <span className="text-gray-500">no change</span>;
}
