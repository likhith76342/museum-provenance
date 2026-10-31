"""
Embeds every condition report that does not yet have an embedding.
Model: sentence-transformers/all-MiniLM-L6-v2 (384-dim). Vectors are
L2-normalised, so cosine distance (<=>) is the natural metric.
Reads DATABASE_URL from .env (never hard-code credentials).
Usage: python scripts/embed_reports.py
"""
import os

import numpy as np
import psycopg
from dotenv import load_dotenv
from pgvector.psycopg import register_vector
from sentence_transformers import SentenceTransformer

MODEL_ID = "sentence-transformers/all-MiniLM-L6-v2"
MODEL_NAME = "all-MiniLM-L6-v2"


def main() -> None:
    load_dotenv()
    db_url = os.environ["DATABASE_URL"]

    with psycopg.connect(db_url) as conn:
        register_vector(conn)
        rows = conn.execute(
            """
            SELECT r.report_id, r.report_text
            FROM condition_reports r
            LEFT JOIN report_embeddings e ON e.report_id = r.report_id
            WHERE e.report_id IS NULL
            ORDER BY r.report_id
            """
        ).fetchall()

        if not rows:
            print("All reports already embedded.")
            return

        model = SentenceTransformer(MODEL_ID)
        ids = [r[0] for r in rows]
        texts = [r[1] for r in rows]
        vectors = model.encode(texts, normalize_embeddings=True, show_progress_bar=True)

        with conn.cursor() as cur:
            cur.executemany(
                "INSERT INTO report_embeddings (report_id, model_name, embedding) VALUES (%s, %s, %s)",
                [(rid, MODEL_NAME, np.asarray(vec, dtype=np.float32)) for rid, vec in zip(ids, vectors)],
            )
        conn.commit()
        print(f"Embedded {len(ids)} report(s).")


if __name__ == "__main__":
    main()
