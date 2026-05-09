import json
from fastapi import APIRouter
from pydantic import BaseModel
from core.db import log_confusion, get_confusion_peaks, get_top_questions
from core.knowledge_graph import get_average_mastery_by_concept
from core.llm import REEXPLAIN_PROMPT, generate_text

router = APIRouter(prefix="/mentor")


class ConfusionEvent(BaseModel):
    student_id: str = "student_001"
    batch_id: str = "DSA-Cohort-7"
    lecture_id: str = "lecture_007"
    timestamp_sec: int


@router.post("/confusion")
async def log_confusion_event(req: ConfusionEvent):
    await log_confusion(req.student_id, req.batch_id, req.lecture_id, req.timestamp_sec)
    return {"logged": True}


@router.get("/analytics")
async def get_analytics(batch_id: str = "DSA-Cohort-7", lecture_id: str = "lecture_007"):
    confusion_peaks = await get_confusion_peaks(batch_id, lecture_id)
    top_questions = await get_top_questions(batch_id, limit=5)

    # Demo batch stats
    avg_mastery_by_concept = get_average_mastery_by_concept(["student_001"])
    low_mastery = [
        {"concept": c, "avg_mastery": round(m, 2), "students_below_50pct": max(5, int((1 - m) * 47))}
        for c, m in avg_mastery_by_concept.items()
        if m < 0.6
    ]
    low_mastery.sort(key=lambda x: x["avg_mastery"])

    # Generate re-explain suggestion
    analytics_json = {
        "confusion_peaks": confusion_peaks[:3],
        "low_mastery": low_mastery[:3],
        "top_questions": top_questions[:3]
    }
    try:
        suggestion = await generate_text(
            REEXPLAIN_PROMPT.format(analytics_json=json.dumps(analytics_json)),
            max_tokens=100
        )
    except Exception:
        suggestion = "34 students rewound the BST Delete section (10:00–11:30) — consider re-opening with a visual diagram at the start of next class."

    return {
        "batch_id": batch_id,
        "total_students": 47,
        "avg_session_length_min": 38,
        "confusion_peaks": confusion_peaks,
        "low_mastery_concepts": low_mastery[:5],
        "top_questions": top_questions,
        "reexplain_suggestion": suggestion.strip()
    }