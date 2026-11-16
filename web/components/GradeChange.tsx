/** Change in grade versus the previous report. Blank = no change or no earlier report. */
export default function GradeChange({ change }: { change: number | null }) {
  if (change == null || change === 0) return null;
  if (change < 0) return <span className="font-medium tabular-nums text-red-700">−{Math.abs(change)}</span>;
  if (change >= 2) {
    return (
      <span
        title="An improvement of 2 or more grades can mean the object was substituted"
        className="font-medium tabular-nums text-amber-700"
      >
        +{change}
      </span>
    );
  }
  return <span className="tabular-nums text-stone-600">+{change}</span>;
}
