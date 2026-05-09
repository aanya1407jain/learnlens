from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import ask, summary, graph, prereq, catchup, quiz, doubts, mentor
from core.rag import initialize_rag
from core.db import init_db

app = FastAPI(title="LearnLens API — Sheryians Edition")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    print("Starting LearnLens backend...")
    await init_db()
    await initialize_rag()
    print("LearnLens ready!")


@app.get("/health")
async def health():
    return {"status": "ok", "message": "LearnLens API is running"}


app.include_router(ask.router)
app.include_router(summary.router)
app.include_router(graph.router)
app.include_router(prereq.router)
app.include_router(catchup.router)
app.include_router(quiz.router)
app.include_router(doubts.router)
app.include_router(mentor.router)