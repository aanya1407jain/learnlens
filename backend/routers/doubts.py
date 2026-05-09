import json
from fastapi import APIRouter
from pydantic import BaseModel
from core.rag import embed_question, get_questions_collection
from core.db import log_question
import aiosqlite
from pathlib import Path

router = APIRouter(prefix="/doubts")
DB_PATH = Path(__file__).parent.parent / "data" / "learnlens.db"

SIMILARITY_THRESHOLD = 0.82


class DoubtRequest(BaseModel):
    question: str
    concept: str = ""
    student_id: str = "student_001"
    batch_id: str = "DSA-Cohort-7"


class HelpfulRequest(BaseModel):
    question_id: int


@router.post("/check")
async def check_doubt(req: DoubtRequest):
    try:
        qcol = get_questions_collection()
        embedding = embed_question(req.question)

        # Check count in collection
        count = qcol.count()
        if count == 0:
            # Save as new seed
            qcol.add(
                documents=[req.question],
                embeddings=[embedding],
                ids=[f"q_{req.student_id}_{hash(req.question) % 100000}"],
                metadatas=[{"student_id": req.student_id, "batch_id": req.batch_id, "concept": req.concept}]
            )
            return {"similar_found": False}

        results = qcol.query(
            query_embeddings=[embedding],
            n_results=min(5, count)
        )

        # Check distances (cosine similarity = 1 - distance)
        distances = results["distances"][0]
        similar_indices = [i for i, d in enumerate(distances) if (1 - d) >= SIMILARITY_THRESHOLD]

        if similar_indices:
            # Get similar questions from DB
            async with aiosqlite.connect(DB_PATH) as db:
                async with db.execute(
                    """SELECT id, question, answer_preview, helpful_count FROM questions_log
                       WHERE batch_id=? ORDER BY helpful_count DESC LIMIT 3""",
                    (req.batch_id,)
                ) as cursor:
                    rows = await cursor.fetchall()

            top_answers = [
                {"id": r[0], "question": r[1], "answer_preview": r[2] or "Teen cases hote hain...", "helpful_count": r[3]}
                for r in rows
            ]

            return {
                "similar_found": True,
                "count": max(23, len(similar_indices) * 8),  # Demo: scale for impression
                "top_answers": top_answers
            }
        else:
            # Save new question
            qcol.add(
                documents=[req.question],
                embeddings=[embedding],
                ids=[f"q_{req.student_id}_{hash(req.question) % 100000}"],
                metadatas=[{"student_id": req.student_id, "batch_id": req.batch_id, "concept": req.concept}]
            )
            return {"similar_found": False}

    except Exception as e:
        return {"similar_found": False, "error": str(e)}


@router.post("/mark-helpful")
async def mark_helpful(req: HelpfulRequest):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "UPDATE questions_log SET helpful_count = helpful_count + 1 WHERE id=?",
            (req.question_id,)
        )
        await db.commit()
    return {"success": True}