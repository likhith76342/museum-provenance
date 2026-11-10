const STYLE: Record<string, string> = {
  high: 'border-red-600 text-red-700',
  medium: 'border-amber-600 text-amber-700',
  low: 'border-green-700 text-green-700',
  no_provenance: 'border-gray-500 text-gray-600',
};

export default function RiskBadge({ risk }: { risk: string }) {
  return <span className={`rounded border px-1.5 py-0.5 text-xs ${STYLE[risk] ?? ''}`}>{risk}</span>;
}
