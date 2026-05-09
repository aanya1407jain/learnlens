import json
import asyncio
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from core.llm import QUIZ_PROMPT, generate_text, stream_text, LANGUAGE_PREFIX
from core.knowledge_graph import get_weak_concepts
from core.sm2 import calculate_sm2, score_to_quality, get_next_due, sm2_feedback_message
from core.db import save_quiz_item, get_due_quiz_items, update_quiz_item

router = APIRouter(prefix="/quiz")


class GenerateQuizRequest(BaseModel):
    student_id: str = "student_001"
    batch_id: str = "DSA-Cohort-7"
    concept: str = ""


class AnswerRequest(BaseModel):
    item_id: int
    selected_idx: int
    student_id: str = "student_001"
    ef: float = 2.5
    interval_days: int = 1
    correct_idx: int = 0


@router.post("/generate")
async def generate_quiz(req: GenerateQuizRequest):
    concept = req.concept
    if not concept:
        weak = get_weak_concepts(req.student_id, threshold=0.6)
        if not weak:
            return {"error": "No weak concepts found. You're doing great!"}
        concept = weak[0]["concept"]

    prompt = QUIZ_PROMPT.format(concept=concept)
    try:
        raw = await generate_text(prompt, max_tokens=400)
        # Clean JSON
        raw = raw.strip()
        if "```" in raw:
            parts = raw.split("```")
            raw = parts[1] if len(parts) > 1 else parts[0]
            if raw.startswith("json"):
                raw = raw[4:]
        quiz_data = json.loads(raw.strip())
    except Exception as e:
        # Fallback demo question
        quiz_data = {
            "question": f"What is the time complexity of searching in a balanced BST?",
            "options": ["O(n)", "O(log n)", "O(n²)", "O(1)"],
            "correct_index": 1,
            "explanation": "In a balanced BST, each comparison eliminates half the nodes — similar to binary search. This gives O(log n) for average case."
        }

    # Save to DB
    await save_quiz_item(
        req.student_id, req.batch_id, concept,
        quiz_data["question"], quiz_data["options"],
        quiz_data["correct_index"], quiz_data.get("explanation", "")
    )

    return {
        "concept": concept,
        "question": quiz_data["question"],
        "options": quiz_data["options"],
        "correct_index": quiz_data["correct_index"],
        "explanation": quiz_data.get("explanation", "")
    }


@router.get("/due")
async def get_due(student_id: str = "student_001"):
    items = await get_due_quiz_items(student_id)
    return {"count": len(items), "items": items}


@router.post("/answer")
async def answer_quiz(req: AnswerRequest):
    is_correct = req.selected_idx == req.correct_idx
    quality = 4 if is_correct else 1

    new_ef, new_interval = calculate_sm2(req.ef, req.interval_days, quality)
    next_due = get_next_due(new_interval)

    await update_quiz_item(req.item_id, new_ef, new_interval, next_due)

    feedback = sm2_feedback_message(quality, new_interval)

    return {
        "correct": is_correct,
        "quality": quality,
        "new_ef": new_ef,
        "new_interval": new_interval,
        "next_due": next_due,
        "feedback": feedback
    }