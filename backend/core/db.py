import aiosqlite
import json
from pathlib import Path
from datetime import date

DB_PATH = Path(__file__).parent.parent / "data" / "learnlens.db"

CREATE_SQL = """
CREATE TABLE IF NOT EXISTS students (
    id TEXT PRIMARY KEY,
    name TEXT,
    batch_id TEXT,
    language_pref TEXT DEFAULT 'hinglish',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS watch_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id TEXT,
    concept TEXT,
    week_number INTEGER,
    watched_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS quiz_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id TEXT,
    batch_id TEXT,
    concept TEXT,
    question TEXT,
    options_json TEXT,
    correct_idx INTEGER,
    explanation TEXT,
    ef REAL DEFAULT 2.5,
    interval_days INTEGER DEFAULT 1,
    next_due DATE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS questions_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id TEXT,
    batch_id TEXT,
    question TEXT,
    concept_tags TEXT,
    embedding_id TEXT,
    helpful_count INTEGER DEFAULT 0,
    answer_preview TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS confusion_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id TEXT,
    batch_id TEXT,
    lecture_id TEXT,
    timestamp_sec INTEGER,
    bucket_5s INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
"""


async def init_db():
    async with aiosqlite.connect(DB_PATH) as db:
        for stmt in CREATE_SQL.strip().split(";"):
            stmt = stmt.strip()
            if stmt:
                await db.execute(stmt)
        await db.commit()

    # Seed demo student
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT OR IGNORE INTO students (id, name, batch_id, language_pref) VALUES (?,?,?,?)",
            ("student_001", "Aanya", "DSA-Cohort-7", "hinglish")
        )
        # Seed some watch history
        demo_watched = [
            ("student_001", "Arrays", 2),
            ("student_001", "Time Complexity", 1),
            ("student_001", "Big-O Notation", 1),
            ("student_001", "BST Basics", 7),
            ("student_001", "BST Insert", 7),
        ]
        for sid, concept, week in demo_watched:
            await db.execute(
                "INSERT OR IGNORE INTO watch_history (student_id, concept, week_number) VALUES (?,?,?)",
                (sid, concept, week)
            )
        # Seed confusion events for demo
        confusion_demo = [
            ("student_001", "DSA-Cohort-7", "lecture_007", 600, 120),
            ("student_001", "DSA-Cohort-7", "lecture_007", 630, 126),
            ("student_001", "DSA-Cohort-7", "lecture_007", 660, 132),
            ("student_002", "DSA-Cohort-7", "lecture_007", 630, 126),
            ("student_003", "DSA-Cohort-7", "lecture_007", 630, 126),
            ("student_002", "DSA-Cohort-7", "lecture_007", 660, 132),
        ]
        for row in confusion_demo:
            await db.execute(
                "INSERT OR IGNORE INTO confusion_events (student_id, batch_id, lecture_id, timestamp_sec, bucket_5s) VALUES (?,?,?,?,?)",
                row
            )
        await db.commit()


async def get_watched_concepts(student_id: str) -> list:
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute(
            "SELECT DISTINCT concept FROM watch_history WHERE student_id = ?", (student_id,)
        ) as cursor:
            rows = await cursor.fetchall()
    return [r[0] for r in rows]


async def add_watched_concept(student_id: str, concept: str, week_number: int = 0):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT INTO watch_history (student_id, concept, week_number) VALUES (?,?,?)",
            (student_id, concept, week_number)
        )
        await db.commit()


async def log_question(student_id: str, batch_id: str, question: str, concept_tags: list, embedding_id: str = "", answer_preview: str = ""):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT INTO questions_log (student_id, batch_id, question, concept_tags, embedding_id, answer_preview) VALUES (?,?,?,?,?,?)",
            (student_id, batch_id, question, json.dumps(concept_tags), embedding_id, answer_preview)
        )
        await db.commit()


async def log_confusion(student_id: str, batch_id: str, lecture_id: str, timestamp_sec: int):
    bucket = (timestamp_sec // 5) * 5
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT INTO confusion_events (student_id, batch_id, lecture_id, timestamp_sec, bucket_5s) VALUES (?,?,?,?,?)",
            (student_id, batch_id, lecture_id, timestamp_sec, bucket)
        )
        await db.commit()


async def get_confusion_peaks(batch_id: str, lecture_id: str) -> list:
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute(
            """SELECT bucket_5s, COUNT(*) as cnt FROM confusion_events
               WHERE batch_id=? AND lecture_id=?
               GROUP BY bucket_5s ORDER BY cnt DESC LIMIT 10""",
            (batch_id, lecture_id)
        ) as cursor:
            rows = await cursor.fetchall()
    peaks = []
    for bucket, cnt in rows:
        mins = bucket // 60
        secs = bucket % 60
        peaks.append({
            "timestamp_sec": bucket,
            "label": f"{mins:02d}:{secs:02d}",
            "rewind_count": cnt,
            "concept": "BST Delete" if 600 <= bucket <= 700 else "BST Basics"
        })
    return peaks


async def get_top_questions(batch_id: str, limit: int = 5) -> list:
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute(
            """SELECT question, COUNT(*) as cnt FROM questions_log
               WHERE batch_id=? GROUP BY question ORDER BY cnt DESC LIMIT ?""",
            (batch_id, limit)
        ) as cursor:
            rows = await cursor.fetchall()
    return [{"question": r[0], "count": r[1]} for r in rows]


async def save_quiz_item(student_id: str, batch_id: str, concept: str, question: str,
                          options: list, correct_idx: int, explanation: str):
    options_json = json.dumps(options)
    next_due = date.today().isoformat()
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            """INSERT INTO quiz_items (student_id, batch_id, concept, question, options_json,
               correct_idx, explanation, ef, interval_days, next_due)
               VALUES (?,?,?,?,?,?,?,2.5,1,?)""",
            (student_id, batch_id, concept, question, options_json, correct_idx, explanation, next_due)
        )
        await db.commit()


async def get_due_quiz_items(student_id: str) -> list:
    today = date.today().isoformat()
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute(
            """SELECT id, concept, question, options_json, correct_idx, explanation, ef, interval_days
               FROM quiz_items WHERE student_id=? AND next_due<=? ORDER BY next_due""",
            (student_id, today)
        ) as cursor:
            rows = await cursor.fetchall()
    items = []
    for row in rows:
        items.append({
            "id": row[0], "concept": row[1], "question": row[2],
            "options": json.loads(row[3]), "correct_idx": row[4],
            "explanation": row[5], "ef": row[6], "interval_days": row[7]
        })
    return items


async def update_quiz_item(item_id: int, new_ef: float, new_interval: int, next_due: str):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "UPDATE quiz_items SET ef=?, interval_days=?, next_due=? WHERE id=?",
            (new_ef, new_interval, next_due, item_id)
        )
        await db.commit()