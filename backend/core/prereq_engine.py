import json
from pathlib import Path
from core.llm import generate_text, EXTRACT_CONCEPTS_PROMPT

CURRICULUM_PATH = Path(__file__).parent.parent / "data" / "sheryians_curriculum.json"

# Build concept -> week mapping
def _build_concept_week_map():
    with open(CURRICULUM_PATH) as f:
        curriculum = json.load(f)
    mapping = {}
    for week_data in curriculum["weeks"]:
        for concept in week_data["concepts"]:
            mapping[concept.lower()] = {"concept": concept, "week": week_data["week"]}
    return mapping


CONCEPT_WEEK_MAP = _build_concept_week_map()


def _match_concept(mentioned: str) -> dict | None:
    """Fuzzy match a mentioned concept to curriculum concept."""
    mentioned_lower = mentioned.lower().strip()
    
    # Exact match
    if mentioned_lower in CONCEPT_WEEK_MAP:
        return CONCEPT_WEEK_MAP[mentioned_lower]
    
    # Partial match
    for key, val in CONCEPT_WEEK_MAP.items():
        if mentioned_lower in key or key in mentioned_lower:
            return val
    
    return None


async def detect_prereq_gaps(
    transcript_window: str,
    watched_concepts: list,
    language_pref: str = "hinglish"
) -> dict:
    """
    Extract concepts from transcript window, compare against watched concepts.
    Returns gap info if any prerequisite is missing.
    """
    prompt = EXTRACT_CONCEPTS_PROMPT.format(transcript_window=transcript_window)
    
    try:
        raw = await generate_text(prompt, max_tokens=200)
        # Clean up response - extract JSON array
        raw = raw.strip()
        if "```" in raw:
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        mentioned_concepts = json.loads(raw)
    except Exception:
        return {"gap_detected": False}

    watched_lower = [w.lower() for w in watched_concepts]

    for concept_name in mentioned_concepts:
        matched = _match_concept(concept_name)
        if matched is None:
            continue

        # Check if student has watched this
        is_watched = any(
            matched["concept"].lower() in w or w in matched["concept"].lower()
            for w in watched_lower
        )

        if not is_watched:
            week = matched["week"]
            severity = "high" if week <= 3 else "medium"

            if language_pref == "hinglish":
                message = f"Bhai, professor yahan '{matched['concept']}' assume kar rahe hain — tumne abhi tak Week {week} cover nahi ki!"
            else:
                message = f"The professor assumed knowledge of {matched['concept']} (Week {week}) — you haven't covered it yet."

            return {
                "gap_detected": True,
                "missing_concept": matched["concept"],
                "week_number": week,
                "severity": severity,
                "message_hi": f"Bhai, professor yahan '{matched['concept']}' assume kar rahe hain — tumne abhi tak Week {week} cover nahi ki!",
                "message_en": f"The professor assumed knowledge of {matched['concept']} (Week {week}) — you haven't covered it yet."
            }

    return {"gap_detected": False}