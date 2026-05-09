import json
import asyncio
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from core.rag import get_transcript_chunks
from core.llm import MODES, stream_text

router = APIRouter()


class SummaryRequest(BaseModel):
    current_timestamp_sec: int = 0
    last_n_minutes: int = 5
    student_id: str = "student_001"


@router.post("/summary")
async def get_summary(req: SummaryRequest):
    chunks = get_transcript_chunks()
    window_start = max(0, req.current_timestamp_sec - req.last_n_minutes * 60)

    relevant = [c for c in chunks if c["start_sec"] >= window_start and c["end_sec"] <= req.current_timestamp_sec]
    if not relevant:
        relevant = chunks[:5]

    context = "\n".join([c["text"] for c in relevant])
    prompt = MODES["summary"].replace("{current_sec}", str(req.current_timestamp_sec))

    async def event_generator():
        try:
            async for chunk in stream_text(prompt, f"Summarize this lecture content:\n{context}"):
                yield f"data: {json.dumps({'type': 'token', 'text': chunk})}\n\n"
                await asyncio.sleep(0)
            yield f"data: {json.dumps({'type': 'done'})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")