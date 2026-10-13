#!/usr/bin/env python3
"""
49-Agent Advanced Harness — Math Frequency Recursive Loop
Systems 23–26: Nested symmetry projectors C2 < D3 < D9 on Z/9Z,
residual dimension partition 4+3+1, zero-mode conservation,
Parseval residual energy, spectral view of residual silence.
"""

from __future__ import annotations
import json
import math
import random
import time
import threading
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from collections import defaultdict

# Optional rich for live dashboard
try:
    from rich.console import Console
    from rich.live import Live
    from rich.table import Table
    from rich.panel import Panel
    from rich.layout import Layout
    from rich.text import Text
    HAS_RICH = True
except ImportError:
    HAS_RICH = False

ROOT = Path(__file__).resolve().parent
LOG_DIR = ROOT / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)
STATUS_FILE = LOG_DIR / "status.json"

# ---------------------------------------------------------------------------
# Math Frequency core (Systems 23–26)
# ---------------------------------------------------------------------------

def nested_projectors_Z9(v: List[float]) -> Dict[str, Any]:
    """C2 < D3 < D9 projectors on Z/9Z (period-9 vector)."""
    n = 9
    if len(v) != n:
        v = (v + [0.0] * n)[:n]
    # C2: average of pairs (k, k+4.5 approx) — simple even/odd for demo
    c2 = [(v[i] + v[(i + 4) % n]) / 2.0 for i in range(n)]
    # D3: period-3 averaging
    d3 = []
    for i in range(n):
        d3.append((v[i] + v[(i + 3) % n] + v[(i + 6) % n]) / 3.0)
    # D9: full mean (zero-mode)
    mean = sum(v) / n
    d9 = [mean] * n
    residual = [v[i] - d9[i] for i in range(n)]
    # Residual energy partition heuristic 4+3+1
    energy = sum(r * r for r in residual)
    e4 = energy * 4 / 8
    e3 = energy * 3 / 8
    e1 = energy * 1 / 8
    return {
        "c2": c2,
        "d3": d3,
        "d9": d9,
        "zero_mode": mean,
        "residual": residual,
        "residual_energy": energy,
        "partition_4_3_1": (e4, e3, e1),
        "parseval_ok": abs(sum(x * x for x in v) - (n * mean * mean + energy)) < 1e-9,
    }


# ---------------------------------------------------------------------------
# Agent & Clan structures
# ---------------------------------------------------------------------------

CLANS = ["Symmetry", "Spectral", "Continuous", "Meta", "Residual", "Positivity", "Network"]
SUB_AGENTS = ["deep_mutator", "oracle_aligner", "explorer"]

@dataclass
class Hypothesis:
    id: str
    clan: str
    score: float
    payload: Dict[str, Any]
    generation: int
    status: str = "ECHO"  # CARRIER | ECHO | DISSIPATING

@dataclass
class Agent:
    id: str
    clan: str
    tokens: float = 3.0
    best: Optional[Hypothesis] = None
    peers: List[str] = field(default_factory=list)

@dataclass
class Blackboard:
    global_best: List[Hypothesis] = field(default_factory=list)
    clan_best: Dict[str, Hypothesis] = field(default_factory=dict)
    messages: List[str] = field(default_factory=list)

    def update(self, h: Hypothesis):
        # clan best
        cur = self.clan_best.get(h.clan)
        if cur is None or h.score > cur.score:
            self.clan_best[h.clan] = h
        # global top-3
        self.global_best.append(h)
        self.global_best = sorted(self.global_best, key=lambda x: -x.score)[:3]


# ---------------------------------------------------------------------------
# Harness
# ---------------------------------------------------------------------------

class AgentHarness:
    def __init__(self, generations: int = 40, seed: int = 42):
        random.seed(seed)
        self.generations = generations
        self.gen = 0
        self.agents: Dict[str, Agent] = {}
        self.bb = Blackboard()
        self.history: List[Dict] = []
        self._build_agents()

    def _build_agents(self):
        for ci, clan in enumerate(CLANS):
            for ai in range(7):
                aid = f"{clan[:3]}-{ai}"
                self.agents[aid] = Agent(id=aid, clan=clan, tokens=3.0 + random.random())

    def _score_hypothesis(self, payload: Dict) -> float:
        """Score against Math Frequency invariants."""
        v = payload.get("vector", [random.gauss(0, 1) for _ in range(9)])
        res = nested_projectors_Z9(v)
        # Prefer low residual energy + zero-mode conservation + Parseval
        energy = res["residual_energy"]
        zero = abs(res["zero_mode"])
        parseval = 1.0 if res["parseval_ok"] else 0.0
        # Higher score = closer to carrier (low residual, stable zero-mode)
        score = 10.0 / (1.0 + energy) + 2.0 * parseval - 0.1 * zero
        payload["math"] = res
        return max(0.0, score)

    def _spawn_subagent(self, agent: Agent, kind: str) -> Optional[Hypothesis]:
        if agent.tokens < 1.0:
            return None
        agent.tokens -= 1.0
        # simple mutation / alignment / exploration
        base = agent.best.payload if agent.best else {"vector": [random.gauss(0, 1) for _ in range(9)]}
        vec = list(base.get("vector", [0.0] * 9))
        if kind == "deep_mutator":
            for i in range(9):
                vec[i] += random.gauss(0, 0.3)
        elif kind == "oracle_aligner":
            mean = sum(vec) / 9
            vec = [0.7 * x + 0.3 * mean for x in vec]
        else:  # explorer
            vec = [random.gauss(0, 1.2) for _ in range(9)]
        payload = {"vector": vec, "sub": kind}
        score = self._score_hypothesis(payload)
        hid = f"{agent.id}-{kind}-{self.gen}"
        return Hypothesis(id=hid, clan=agent.clan, score=score, payload=payload, generation=self.gen)

    def step(self):
        self.gen += 1
        # token recharge
        for a in self.agents.values():
            a.tokens = min(5.0, a.tokens + 0.4)

        collision_trace = []
        for aid, agent in self.agents.items():
            # local hypothesis
            vec = [random.gauss(0, 1) for _ in range(9)]
            if agent.best:
                # soft peer influence
                for peer_id in agent.peers[:2]:
                    if peer_id in self.agents and self.agents[peer_id].best:
                        pvec = self.agents[peer_id].best.payload.get("vector", vec)
                        vec = [0.85 * v + 0.15 * p for v, p in zip(vec, pvec)]
            payload = {"vector": vec}
            score = self._score_hypothesis(payload)
            h = Hypothesis(id=f"{aid}-g{self.gen}", clan=agent.clan, score=score,
                           payload=payload, generation=self.gen)
            # status classification
            if score > 6.5:
                h.status = "CARRIER"
            elif score > 3.5:
                h.status = "ECHO"
            else:
                h.status = "DISSIPATING"
            if agent.best is None or h.score > agent.best.score:
                agent.best = h
            self.bb.update(h)

            # occasional sub-agent call
            if random.random() < 0.25 and agent.tokens >= 1.0:
                kind = random.choice(SUB_AGENTS)
                sub_h = self._spawn_subagent(agent, kind)
                if sub_h:
                    if agent.best is None or sub_h.score > agent.best.score:
                        agent.best = sub_h
                    self.bb.update(sub_h)
                    collision_trace.append(f"{aid} → [sub]{kind} score={sub_h.score:.3f}")

            # soft peer watching
            if random.random() < 0.3:
                peer = random.choice(list(self.agents.keys()))
                if peer != aid and peer not in agent.peers:
                    agent.peers.append(peer)
                    if len(agent.peers) > 4:
                        agent.peers.pop(0)

        # status classification refinement for clan bests
        for clan, h in self.bb.clan_best.items():
            if h.score > 6.5:
                h.status = "CARRIER"
            elif h.score > 3.5:
                h.status = "ECHO"
            else:
                h.status = "DISSIPATING"

        # write status
        status = {
            "generation": self.gen,
            "zero_mode": self.bb.global_best[0].payload.get("math", {}).get("zero_mode", 0) if self.bb.global_best else 0,
            "residual_energy": self.bb.global_best[0].payload.get("math", {}).get("residual_energy", 0) if self.bb.global_best else 0,
            "global_best_score": self.bb.global_best[0].score if self.bb.global_best else 0,
            "clan_bests": {c: {"score": h.score, "status": h.status, "id": h.id} for c, h in self.bb.clan_best.items()},
            "top3": [{"id": h.id, "clan": h.clan, "score": h.score, "status": h.status} for h in self.bb.global_best],
            "trace": collision_trace[-8:],
            "timestamp": time.time(),
        }
        STATUS_FILE.write_text(json.dumps(status, indent=2))
        self.history.append(status)
        return status

    def run(self, live: bool = True):
        if HAS_RICH and live:
            console = Console()
            with Live(console=console, refresh_per_second=4) as live:
                for _ in range(self.generations):
                    st = self.step()
                    live.update(self._render(st))
                    time.sleep(0.15)
        else:
            for _ in range(self.generations):
                st = self.step()
                print(f"gen={st['generation']:3d}  best={st['global_best_score']:.3f}  "
                      f"zero={st['zero_mode']:.4f}  E_res={st['residual_energy']:.4f}")
                time.sleep(0.05)
        return self.history[-1] if self.history else {}

    def _render(self, st: Dict) -> Panel:
        table = Table(title=f"Generation {st['generation']}  |  Global best {st['global_best_score']:.3f}")
        table.add_column("Clan", style="cyan")
        table.add_column("Score", justify="right")
        table.add_column("Status")
        table.add_column("ID")
        for clan in CLANS:
            info = st["clan_bests"].get(clan, {})
            table.add_row(clan, f"{info.get('score', 0):.3f}", info.get("status", "-"), info.get("id", "-")[:18])
        top = "\n".join(f"  {t['score']:.3f}  {t['status']:12s}  {t['clan']}/{t['id']}" for t in st["top3"])
        trace = "\n".join(st.get("trace", [])[-5:]) or "(no recent sub-calls)"
        body = f"{table}\n\n[TOP-3]\n{top}\n\n[TRACE]\n{trace}"
        return Panel(body, title="49-Agent Math Frequency Harness", border_style="green")


def main():
    print("Starting 49-Agent Advanced Harness (Math Frequency Recursive Loop)...")
    print(f"Status stream → {STATUS_FILE}")
    harness = AgentHarness(generations=36, seed=23)
    final = harness.run(live=HAS_RICH)
    print("\n=== Final status ===")
    print(json.dumps(final, indent=2))
    print(f"\nHarness complete. Logs written to {STATUS_FILE}")


if __name__ == "__main__":
    main()
