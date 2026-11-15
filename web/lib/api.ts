import { NextResponse } from 'next/server';
import { getCurrentUser } from './auth';
import type { Role, SessionUser } from './types';

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** For route handlers: throws 401 / 403 instead of redirecting. */
export async function apiUser(roles?: Role[]): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new HttpError(401, 'Not logged in');
  if (roles && !roles.includes(user.role)) throw new HttpError(403, `Role '${user.role}' cannot do this`);
  return user;
}

// PostgreSQL error code -> HTTP status
const PG_STATUS: Record<string, number> = {
  '42501': 403, // insufficient_privilege
  '23505': 409, // unique_violation
  '23P01': 409, // exclusion_violation
  '23514': 400, // check_violation (CHECKs and our triggers)
  '23503': 400, // foreign_key_violation
  '23502': 400, // not_null_violation
  '22P02': 400, // invalid input syntax
  '22007': 400, // invalid date format
  '22008': 400, // date out of range
  '22001': 400, // value too long
  'P0001': 400, // RAISE EXCEPTION in our procedures/triggers
};

// Constraint name -> plain-English message (names from the DDL in db/schema/)
const CONSTRAINT_MESSAGES: Record<string, string> = {
  // users
  users_email_lower_uq: 'An account with this email already exists.',
  users_email_format: 'Enter a valid email address.',
  users_role_check: 'Role must be admin, curator or researcher.',
  users_password_is_bcrypt: 'Passwords must be stored as bcrypt hashes.',
  // curators
  curators_active_period: "A curator's end date can't be before their start date.",
  curators_user_id_key: 'This account is already linked to a curator profile.',
  // owners
  owners_owner_type_check: 'Choose an owner type from the list.',
  // artifacts
  artifacts_accession_number_key: 'An artifact with this accession number already exists.',
  artifacts_accession_number_check:
    'Accession number must look like CHM-1971-0002 (2–5 capital letters, a year, a 4-digit number).',
  artifacts_category_check: 'Choose a category from the list.',
  artifacts_status_check: 'Choose a status from the list.',
  artifacts_dating_range: '"Estimated year to" must be the same as or later than "estimated year from".',
  artifacts_acquired_after_creation: "The acquisition date can't be earlier than the object's estimated date.",
  // ownership_history
  oh_no_overlapping_ownership: 'This ownership period overlaps another owner of the same artifact.',
  oh_valid_period: "An ownership period can't end before it starts.",
  oh_price_needs_currency: 'Enter a currency when a price is given.',
  ownership_history_acquisition_method_check: 'Choose an acquisition method from the list.',
  ownership_history_price_paid_check: "Price can't be negative.",
  ownership_history_currency_check: 'Currency must be a 3-letter code such as INR or GBP.',
  ownership_history_owner_id_fkey: 'That owner does not exist.',
  // condition_reports
  cr_one_per_curator_per_day: 'You have already filed a report for this artifact on this date.',
  condition_reports_condition_grade_check: 'Grade must be between 1 and 5.',
  condition_reports_report_text_check: 'The report must be at least 30 characters long.',
  condition_reports_report_date_check: 'The report date must be in 1900 or later.',
  // report_embeddings / anomaly_flags
  report_embeddings_pkey: 'This report already has an embedding.',
  af_review_complete: 'A reviewed flag must record who reviewed it and when.',
  af_no_duplicate_flag: 'This flag has already been raised.',
  af_not_self_compare: "A report can't be compared with itself.",
  anomaly_flags_status_check: 'Choose a valid flag status.',
};

const CONSTRAINT_KIND: Record<string, string> = {
  '23514': 'CHECK constraint',
  '23505': 'UNIQUE constraint',
  '23P01': 'EXCLUSION constraint',
  '23503': 'FOREIGN KEY',
};

type PgError = {
  code?: string; message?: string; constraint?: string;
  table?: string; column?: string; where?: string;
};

function friendlyPgError(e: PgError): { error: string; detail: string } {
  const code = e.code ?? '';
  const raw = e.message ?? '';

  // Named constraint we know about
  if (e.constraint && CONSTRAINT_MESSAGES[e.constraint]) {
    return {
      error: CONSTRAINT_MESSAGES[e.constraint],
      detail: `Enforced by: ${CONSTRAINT_KIND[code] ?? 'constraint'} ${e.constraint}`,
    };
  }

  // Our own triggers/procedures already raise plain-English messages;
  // name the function that enforced the rule.
  const fn = e.where?.match(/PL\/pgSQL function ([\w.]+)\(/)?.[1];
  if (fn && (code === 'P0001' || code === '23514' || code === '42501')) {
    const kind = fn.startsWith('trg_') ? 'trigger' : 'procedure/function';
    return { error: raw, detail: `Enforced by: ${kind} ${fn}()` };
  }

  switch (code) {
    case '42501':
      return {
        error: "Your role isn't allowed to make this change.",
        detail: `Enforced by: PostgreSQL role permissions (${raw})`,
      };
    case '23505':
      return { error: 'This record already exists.', detail: `Enforced by: UNIQUE constraint ${e.constraint ?? ''}`.trim() };
    case '23503':
      return {
        error: 'This refers to a record that does not exist, or is still in use.',
        detail: `Enforced by: FOREIGN KEY ${e.constraint ?? ''}`.trim(),
      };
    case '23502':
      return { error: `${e.column ?? 'A required field'} is required.`, detail: 'Enforced by: NOT NULL constraint' };
    case '22P02': case '22007': case '22008':
      return { error: 'One of the values has the wrong format.', detail: `PostgreSQL: ${raw}` };
    case '22001':
      return { error: 'One of the values is too long.', detail: `PostgreSQL: ${raw}` };
    default:
      return { error: raw, detail: e.constraint ? `Enforced by: ${e.constraint}` : '' };
  }
}

export function errorResponse(e: unknown) {
  if (e instanceof HttpError) {
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
  const pg = (e ?? {}) as PgError;
  if (typeof pg.code === 'string' && PG_STATUS[pg.code]) {
    const { error, detail } = friendlyPgError(pg);
    return NextResponse.json({ error, detail, code: pg.code }, { status: PG_STATUS[pg.code] });
  }
  console.error(e);
  return NextResponse.json({ error: 'Something went wrong on the server.' }, { status: 500 });
}

/** Wrap a route handler body: JSON result on success, mapped error otherwise. */
export async function run(fn: () => Promise<unknown>, status = 200) {
  try {
    return NextResponse.json(await fn(), { status });
  } catch (e) {
    return errorResponse(e);
  }
}
