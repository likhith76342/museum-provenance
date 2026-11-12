import { withRole } from '@/lib/db';
import { apiUser, HttpError, run } from '@/lib/api';
import { embedTexts, toVectorLiteral } from '@/lib/embed';

export async function POST(req: Request) {
  return run(async () => {
    // Only curators file reports: admins have no curator profile
    const user = await apiUser(['curator']);
    const body = await req.json().catch(() => ({}));
    const accession = String(body.accession_number ?? '').trim();
    const grade = Number(body.condition_grade);
    const reportDate = String(body.report_date ?? '');
    const text = String(body.report_text ?? '').trim();

    if (!accession) throw new HttpError(400, 'Choose an artifact');
    if (!Number.isInteger(grade) || grade < 1 || grade > 5) throw new HttpError(400, 'Grade must be 1-5');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(reportDate)) throw new HttpError(400, 'Report date is required');
    if (text.length < 30) throw new HttpError(400, 'Report text must be at least 30 characters');
    if (text.length > 5000) throw new HttpError(400, 'Report text must be at most 5000 characters');

    // 1. Embed OUTSIDE the transaction (slow call must not hold row locks)
    const { model, vectors } = await embedTexts([text]);

    // 2. Report + embedding in ONE transaction, as the curator's DB role.
    //    The Phase 2 triggers raise anomaly flags during these INSERTs.
    return withRole(user, async (db) => {
      const cur = await db.query('SELECT curator_id FROM curators WHERE user_id = $1', [user.user_id]);
      if (!cur.rows[0]) throw new HttpError(403, 'Your account is not linked to a curator profile');

      const ins = await db.query(
        `INSERT INTO condition_reports (artifact_id, curator_id, report_date, condition_grade, report_text)
         SELECT a.artifact_id, $2::int, $3::date, $4::smallint, $5::text
         FROM artifacts a WHERE a.accession_number = $1
         RETURNING report_id`,
        [accession, cur.rows[0].curator_id, reportDate, grade, text],
      );
      if (!ins.rows[0]) throw new HttpError(404, `Artifact ${accession} not found`);
      const reportId: number = ins.rows[0].report_id;

      await db.query(
        'INSERT INTO report_embeddings (report_id, model_name, embedding) VALUES ($1, $2, $3::vector)',
        [reportId, model, toVectorLiteral(vectors[0])],
      );

      const flags = await db.query(
        `SELECT f.flag_id, f.flag_type, f.similarity_score, f.compared_report_id,
                a.accession_number AS compared_accession
         FROM anomaly_flags f
         LEFT JOIN condition_reports rc ON rc.report_id = f.compared_report_id
         LEFT JOIN artifacts a          ON a.artifact_id = rc.artifact_id
         WHERE f.report_id = $1
         ORDER BY f.flag_id`,
        [reportId],
      );
      return { report_id: reportId, flags: flags.rows };
    });
  }, 201);
}
