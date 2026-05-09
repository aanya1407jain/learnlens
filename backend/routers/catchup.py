import json
import asyncio
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from core.llm import CATCHUP_PROMPT, stream_text
from core.db import add_watched_concept

router = APIRouter()


class CatchupRequest(BaseModel):
    concept_name: str
    language_pref: str = "hinglish"
    student_id: str = "student_001"
    week_number: int = 0


@router.post("/catchup")
async def catchup(req: CatchupRequest):
    prompt = CATCHUP_PROMPT.format(concept_name=req.concept_name)

    async def event_generator():
        try:
            async for chunk in stream_text(prompt, f"Explain {req.concept_name} for quick catch-up"):
                yield f"data: {json.dumps({'type': 'token', 'text': chunk})}\n\n"
                await asyncio.sleep(0)
            yield f"data: {json.dumps({'type': 'done'})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.post("/catchup/mark-done")
async def mark_done(student_id: str, concept: str, week_number: int = 0):
    await add_watched_concept(student_id, concept, week_number)
    return {"success": True, "message": f"'{concept}' marked as watched!"}