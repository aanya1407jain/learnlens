import json
import networkx as nx
from pathlib import Path

CURRICULUM_PATH = Path(__file__).parent.parent / "data" / "sheryians_curriculum.json"

# Global graph state (per student in production; single student for demo)
_graphs = {}


def build_base_graph() -> nx.DiGraph:
    """Build curriculum graph from JSON."""
    with open(CURRICULUM_PATH) as f:
        curriculum = json.load(f)

    G = nx.DiGraph()

    # Add nodes with week info
    concept_week = {}
    for week_data in curriculum["weeks"]:
        for concept in week_data["concepts"]:
            concept_week[concept] = week_data["week"]
            G.add_node(concept, week_number=week_data["week"], mastery=0.0, status="locked")

    # Add prerequisite edges
    for concept, prereqs in curriculum["prerequisites"].items():
        for prereq in prereqs:
            if prereq in G and concept in G:
                G.add_edge(prereq, concept)

    # Concepts with no prerequisites start as in_progress
    for node in G.nodes():
        preds = list(G.predecessors(node))
        if not preds:
            G.nodes[node]["status"] = "in_progress"
            G.nodes[node]["mastery"] = 0.5  # Assume some baseline

    return G


def get_graph(student_id: str) -> nx.DiGraph:
    if student_id not in _graphs:
        _graphs[student_id] = build_base_graph()
    return _graphs[student_id]


def update_mastery(student_id: str, concept: str, interaction_type: str) -> dict:
    G = get_graph(student_id)

    if concept not in G:
        # Find closest matching concept
        for node in G.nodes():
            if concept.lower() in node.lower() or node.lower() in concept.lower():
                concept = node
                break
        else:
            return {"updated": False, "reason": "concept_not_found"}

    current = G.nodes[concept]["mastery"]

    delta_map = {
        "asked_question": 0.05,
        "answered_correctly": 0.1,
        "rewound": -0.05,
        "skipped": -0.02,
        "quiz_correct": 0.1,
        "quiz_wrong": -0.03,
        "catchup_done": 0.08,
    }

    delta = delta_map.get(interaction_type, 0)
    new_mastery = max(0.1, min(1.0, current + delta))
    G.nodes[concept]["mastery"] = new_mastery

    # Update status
    if new_mastery >= 0.7:
        G.nodes[concept]["status"] = "mastered"
    elif new_mastery >= 0.1:
        G.nodes[concept]["status"] = "in_progress"

    # Cascade unlock check
    unlocked = []
    for node in G.nodes():
        if G.nodes[node]["status"] == "locked":
            preds = list(G.predecessors(node))
            if all(G.nodes[p]["mastery"] >= 0.7 for p in preds):
                G.nodes[node]["status"] = "in_progress"
                unlocked.append(node)

    return {
        "updated": True,
        "concept": concept,
        "old_mastery": current,
        "new_mastery": new_mastery,
        "newly_unlocked": unlocked
    }


def get_graph_data(student_id: str) -> dict:
    G = get_graph(student_id)

    nodes = []
    for node_id, data in G.nodes(data=True):
        nodes.append({
            "id": node_id,
            "week_number": data.get("week_number", 0),
            "mastery": data.get("mastery", 0.0),
            "status": data.get("status", "locked")
        })

    edges = []
    for u, v in G.edges():
        edges.append({"source": u, "target": v})

    return {"nodes": nodes, "edges": edges}


def get_weak_concepts(student_id: str, threshold: float = 0.5) -> list:
    G = get_graph(student_id)
    weak = []
    for node, data in G.nodes(data=True):
        if data.get("status") != "locked" and data.get("mastery", 0) < threshold:
            weak.append({"concept": node, "mastery": data["mastery"]})
    return sorted(weak, key=lambda x: x["mastery"])


def get_average_mastery_by_concept(student_ids: list) -> dict:
    """Batch analytics: average mastery across students."""
    concept_totals = {}
    concept_counts = {}

    for sid in student_ids:
        if sid in _graphs:
            for node, data in _graphs[sid].nodes(data=True):
                concept_totals[node] = concept_totals.get(node, 0) + data.get("mastery", 0)
                concept_counts[node] = concept_counts.get(node, 0) + 1

    return {
        concept: concept_totals[concept] / concept_counts[concept]
        for concept in concept_totals
    }