// Domain badges: one place that decides what each value looks like,
// so a colour means the same thing on every page.
import { Badge, type Tone } from './Badge';

type Spec = Record<string, [label: string, tone: Tone]>;

/** "under_review" -> "Under review" for values a map doesn't know. */
export function humanize(v: string) {
  const s = v.replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function make(spec: Spec, value: string) {
  const [label, tone] = spec[value] ?? [humanize(value), 'neutral'];
  return <Badge tone={tone}>{label}</Badge>;
}

const RISK: Spec = {
  high: ['High', 'bad'],
  medium: ['Medium', 'warn'],
  low: ['Low', 'good'],
  no_provenance: ['No provenance', 'neutral'],
};
export function RiskBadge({ risk }: { risk: string }) {
  return make(RISK, risk);
}

const STATUS: Spec = {
  on_display: ['On display', 'good'],
  in_storage: ['In storage', 'neutral'],
  on_loan: ['On loan', 'info'],
  under_conservation: ['Under conservation', 'warn'],
  deaccessioned: ['Deaccessioned', 'neutral'],
};
export function ArtifactStatusBadge({ status }: { status: string }) {
  return make(STATUS, status);
}

const GRADE: Record<number, [string, Tone]> = {
  5: ['Excellent', 'good'],
  4: ['Good', 'good'],
  3: ['Fair', 'warn'],
  2: ['Poor', 'bad'],
  1: ['Critical', 'bad'],
};
export function GradeBadge({ grade }: { grade: number }) {
  const [label, tone] = GRADE[grade] ?? ['Unknown', 'neutral'];
  return <Badge tone={tone}>{grade} · {label}</Badge>;
}

const INSPECTION: Spec = {
  ok: ['Up to date', 'good'],
  overdue: ['Overdue', 'warn'],
  never_inspected: ['Never inspected', 'neutral'],
};
export function InspectionBadge({ status }: { status: string }) {
  return make(INSPECTION, status);
}

const FLAG_TYPE: Spec = {
  rapid_degradation: ['Rapid degradation', 'bad'],
  unexplained_improvement: ['Unexplained improvement', 'warn'],
  inconsistent_description: ['Inconsistent description', 'warn'],
  possible_mislabel: ['Possible mislabel', 'bad'],
  possible_forgery: ['Possible forgery', 'bad'],
};
export function FlagTypeBadge({ type }: { type: string }) {
  return make(FLAG_TYPE, type);
}

const FLAG_STATUS: Spec = {
  open: ['Open', 'bad'],
  under_review: ['Under review', 'warn'],
  confirmed: ['Confirmed', 'info'],
  dismissed: ['Dismissed', 'neutral'],
};
export function FlagStatusBadge({ status }: { status: string }) {
  return make(FLAG_STATUS, status);
}

const ROLE: Spec = {
  admin: ['Admin', 'info'],
  curator: ['Curator', 'good'],
  researcher: ['Researcher', 'neutral'],
};
export function RoleBadge({ role }: { role: string }) {
  return make(ROLE, role);
}
