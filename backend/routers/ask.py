import json
import re
import asyncio
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from core.rag import retrieve_relevant_chunks
from core.llm import MODES, stream_text
from core.knowledge_graph import update_mastery
from core.db import log_question

router = APIRouter()


class AskRequest(BaseModel):
    question: str
    current_timestamp_sec: int = 0
    mode: str = "answer"
    conversation_history: list = []
    student_id: str = "student_001"
    batch_id: str = "DSA-Cohort-7"


@router.post("/ask")
async def ask(req: AskRequest):
    # Retrieve relevant chunks
    chunks = retrieve_relevant_chunks(req.question, req.current_timestamp_sec)
    context = "\n\n".join([f"[{c['start_sec']}s-{c['end_sec']}s]: {c['text']}" for c in chunks])

    system_prompt = MODES.get(req.mode, MODES["answer"])
    user_message = f"Lecture context:\n{context}\n\nStudent question: {req.question}"

    async def event_generator():
        full_response = ""
        try:
            async for chunk in stream_text(system_prompt, user_message, req.conversation_history):
                full_response += chunk
                yield f"data: {json.dumps({'type': 'token', 'text': chunk})}\n\n"
                await asyncio.sleep(0)

            # Parse concept tags from response
            concept_tags = re.findall(r'\[CONCEPT:([^\]]+)\]', full_response)
            if concept_tags:
                yield f"data: {json.dumps({'type': 'concepts', 'tags': concept_tags})}\n\n"

                # Update mastery for mentioned concepts
                for concept in concept_tags:
                    update_mastery(req.student_id, concept, "asked_question")

            # Log question to DB
            preview = full_response[:200].replace("\n", " ")
            await log_question(req.student_id, req.batch_id, req.question, concept_tags, "", preview)

            yield f"data: {json.dumps({'type': 'done'})}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")