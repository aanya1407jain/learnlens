from datetime import date, timedelta


def calculate_sm2(ef: float, interval: int, quality: int) -> tuple[float, int]:
    """
    SM-2 algorithm.
    quality: 0-5 (5 = perfect recall, 0 = complete blackout)
    Returns: (new_ef, new_interval_days)
    """
    new_ef = ef + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
    new_ef = max(1.3, new_ef)

    if quality < 3:
        # Failed — reset interval
        new_interval = 1
    else:
        if interval == 1:
            new_interval = 6
        elif interval == 6:
            new_interval = round(interval * ef)
        else:
            new_interval = round(interval * ef)

    return new_ef, new_interval


def score_to_quality(score_10: int) -> int:
    """Convert 0-10 score to 0-5 SM-2 quality."""
    return min(5, score_10 // 2)


def get_next_due(interval_days: int) -> str:
    return (date.today() + timedelta(days=interval_days)).isoformat()


def is_due(next_due_str: str) -> bool:
    try:
        next_due = date.fromisoformat(next_due_str)
        return date.today() >= next_due
    except Exception:
        return True


def sm2_feedback_message(quality: int, next_interval: int) -> str:
    """Generate Hinglish feedback for quiz result."""
    if quality >= 4:
        return f"Ekdum sahi! Bahut accha. Agli revision {next_interval} din baad hogi. 🎉"
    elif quality == 3:
        return f"Almost there! Thoda aur practice karo. Agli revision {next_interval} din baad. 💪"
    else:
        return f"Koi baat nahi — practice se perfect hoga. Kal phir try karna! 🔁"