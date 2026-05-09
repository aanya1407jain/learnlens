from fastapi import APIRouter
from pydantic import BaseModel
from core.knowledge_graph import get_graph_data, update_mastery, get_weak_concepts

router = APIRouter(prefix="/graph")


class UpdateRequest(BaseModel):
    student_id: str = "student_001"
    concept: str
    interaction_type: str


@router.get("")
async def get_graph(student_id: str = "student_001"):
    return get_graph_data(student_id)


@router.post("/update")
async def update_graph(req: UpdateRequest):
    result = update_mastery(req.student_id, req.concept, req.interaction_type)
    return result


@router.get("/weak")
async def get_weak(student_id: str = "student_001", threshold: float = 0.5):
    return get_weak_concepts(student_id, threshold)