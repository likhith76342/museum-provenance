"""
Embedding API for new condition reports (used by the web app).
Same model and normalisation as embed_reports.py, so vectors from the API
and from the batch script are directly comparable with cosine distance.

GET  /health                       -> {"status": "ok", "model": ..., "dim": 384}
POST /embed {"texts": ["...", ...]} -> {"model": ..., "dim": 384, "vectors": [[...], ...]}

The API does not touch the database: the web app stores the vector inside
the same transaction as the report, so the Phase 2 trigger fires.
"""
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from sentence_transformers import SentenceTransformer

MODEL_ID = "sentence-transformers/all-MiniLM-L6-v2"
MODEL_NAME = "all-MiniLM-L6-v2"
EXPECTED_DIM = 384
MAX_CHARS = 5000

model = SentenceTransformer(MODEL_ID)   # loaded once at startup, not per request
app = FastAPI(title="Condition-report embedding API")


class EmbedRequest(BaseModel):
    texts: list[str] = Field(min_length=1, max_length=32)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "model": MODEL_NAME, "dim": EXPECTED_DIM}


@app.post("/embed")
def embed(req: EmbedRequest) -> dict:
    if any(not t.strip() for t in req.texts):
        raise HTTPException(status_code=400, detail="texts must not be empty")
    if any(len(t) > MAX_CHARS for t in req.texts):
        raise HTTPException(status_code=400, detail=f"text too long (max {MAX_CHARS} characters)")
    vectors = model.encode(req.texts, normalize_embeddings=True)
    if vectors.shape[1] != EXPECTED_DIM:
        raise HTTPException(status_code=500, detail=f"model returned {vectors.shape[1]} dimensions")
    return {"model": MODEL_NAME, "dim": EXPECTED_DIM, "vectors": vectors.tolist()}
