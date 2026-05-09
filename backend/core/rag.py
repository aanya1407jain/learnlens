import json
import os
import asyncio
import chromadb
from chromadb.config import Settings
from sentence_transformers import SentenceTransformer
from pathlib import Path

# Global state
_chroma_client = None
_collection = None
_embedding_model = None
_transcript_chunks = []

TRANSCRIPT_PATH = Path(__file__).parent.parent / "data" / "transcript.json"


def get_embedding_model():
    global _embedding_model
    if _embedding_model is None:
        _embedding_model = SentenceTransformer("all-MiniLM-L6-v2")
    return _embedding_model


def get_collection():
    return _collection


def get_transcript_chunks():
    return _transcript_chunks


async def initialize_rag():
    global _chroma_client, _collection, _transcript_chunks

    print("Initializing RAG system...")

    # Load transcript
    with open(TRANSCRIPT_PATH) as f:
        raw = json.load(f)

    # Chunk into 30s windows (already formatted)
    _transcript_chunks = raw
    print(f"Loaded {len(_transcript_chunks)} transcript chunks")

    # Init ChromaDB in-process
    _chroma_client = chromadb.Client(Settings(anonymized_telemetry=False))

    # Delete existing collection if exists
    try:
        _chroma_client.delete_collection("lecture_chunks")
    except Exception:
        pass

    _collection = _chroma_client.create_collection(
        name="lecture_chunks",
        metadata={"hnsw:space": "cosine"}
    )

    # Embed and store
    model = get_embedding_model()
    texts = [c["text"] for c in _transcript_chunks]
    embeddings = model.encode(texts).tolist()

    _collection.add(
        documents=texts,
        embeddings=embeddings,
        ids=[f"chunk_{i}" for i in range(len(texts))],
        metadatas=[{"start_sec": c["start_sec"], "end_sec": c["end_sec"]} for c in _transcript_chunks]
    )

    print(f"RAG initialized with {len(texts)} chunks")

    # Also init questions_log collection for batch doubt deduplication
    try:
        _chroma_client.delete_collection("questions_log")
    except Exception:
        pass
    _chroma_client.create_collection(
        name="questions_log",
        metadata={"hnsw:space": "cosine"}
    )

    print("RAG system ready!")


def retrieve_relevant_chunks(question: str, current_timestamp_sec: int = 0, top_k: int = 3) -> list:
    """Retrieve top_k relevant transcript chunks for a question."""
    model = get_embedding_model()
    query_embedding = model.encode([question]).tolist()

    results = _collection.query(
        query_embeddings=query_embedding,
        n_results=min(top_k, len(_transcript_chunks))
    )

    chunks = []
    for i, doc in enumerate(results["documents"][0]):
        meta = results["metadatas"][0][i]
        chunks.append({
            "text": doc,
            "start_sec": meta["start_sec"],
            "end_sec": meta["end_sec"]
        })

    return chunks


def embed_question(question: str) -> list:
    model = get_embedding_model()
    return model.encode([question]).tolist()[0]


def get_questions_collection():
    return _chroma_client.get_collection("questions_log")