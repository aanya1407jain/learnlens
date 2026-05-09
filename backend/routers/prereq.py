from fastapi import APIRouter
from pydantic import BaseModel
from core.prereq_engine import detect_prereq_gaps
from core.db import get_watched_concepts
from core.rag import get_transcript_chunks

router = APIRouter()


class PrereqRequest(BaseModel):
    current_timestamp_sec: int = 0
    student_id: str = "student_001"
    batch_id: str = "DSA-Cohort-7"
    watched_concepts: list = []


@router.post("/prereq-check")
async def prereq_check(req: PrereqRequest):
    # Get transcript window around current timestamp
    chunks = get_transcript_chunks()
    window_start = max(0, req.current_timestamp_sec - 30)
    window_end = req.current_timestamp_sec + 30

    window_text = " ".join([
        c["text"] for c in chunks
        if c["start_sec"] >= window_start and c["end_sec"] <= window_end
    ])

    if not window_text:
        # Fallback: use nearest chunk
        nearest = min(chunks, key=lambda c: abs(c["start_sec"] - req.current_timestamp_sec), default=None)
        if nearest:
            window_text = nearest["text"]

    if not window_text:
        return {"gap_detected": False}

    # Get watched concepts from DB or request
    watched = req.watched_concepts
    if not watched:
        watched = await get_watched_concepts(req.student_id)

    result = await detect_prereq_gaps(window_text, watched)
    return result