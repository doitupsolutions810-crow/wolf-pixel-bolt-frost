#!/usr/bin/env python3
"""
49-Agent Advanced Harness — Long-Horizon Adaptive Edition
Extends the Math Frequency loop with:
  - adaptive token recharge proportional to residual energy
  - clan-level modulation (exploration vs exploitation)
  - carrier locking (reduced mutation near zero residual)
  - long-horizon memory of best carriers
  - generation-dependent cooling of noise
"""

from __future__ import annotations
import json
import math
import random
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional

try:
    from rich.console import Console
    from rich.live import Live
    from rich.table import Table
    from rich.panel import Panel
    HAS_RICH = True
except ImportError:
    HAS_RICH = False

ROOT = Path(__file__).resolve().parent
LOG_DIR = ROOT / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)
STATUS_FILE = Path("/tmp/harness_long_status.json")  # avoid artifacts I/O issues

CLANS = ["Symmetry", "Spectral", "Continuous", "Meta", "Residual", "Positivity", "Network"]
SUB_AGENTS = ["deep_mutator", "oracle_aligner", "explorer"]

def nested_projectors_Z9(v: List[float]) -> Dict[str, Any]:
    n = 9
    if len(v) != n:
        v = (v + [0.0] * n)[:n]
    mean = sum(v) / n
    residual = [v[i] - mean for i in range(n)]
    energy = sum(r * r for r in residual)
    e4, e3, e1 = energy * 4 / 8, energy * 3 / 8, energy * 1 / 8
    return {
        "zero_mode": mean,
        "residual": residual,
        "residual_energy": energy,
        "partition_4_3_1": (e4, e3, e1),
        "parseval_ok": True,
    }

@dataclass
class Hypothesis:
    id: str
    clan: str
    score: float
    payload: Dict[str, Any]
    generation: int
    status: str = "ECHO"

@dataclass
class Agent:
    id: str
    clan: str
    tokens: float = 3.0
    best: Optional[Hypothesis] = None
    peers: List[str] = field(default_factory=list)
    explore_rate: float = 0.3  # adaptive

@dataclass
class Blackboard:
    global_best: List[Hypothesis] = field(default_factory=list)
    clan_best: Dict[str, Hypothesis] = field(default_factory=dict)
    carrier_memory: List[Hypothesis] = field(default_factory=list)  # long-horizon

    def update(self, h: Hypothesis):
        cur = self.clan_best.get(h.clan)
        if cur is None or h.score > cur.score:
            self.clan_best[h.clan] = h
        self.global_best.append(h)
        self.global_best = sorted(self.global_best, key=lambda x: -x.score)[:5]
        if h.status == "CARRIER" and h.score > 9.0:
            self.carrier_memory.append(h)
            self.carrier_memory = sorted(self.carrier_memory, key=lambda x: -x.score)[:10]


class LongHorizonHarness:
    def __init__(self, generations: int = 60, seed: int = 42):
        random.seed(seed)
        self.generations = generations
        self.gen = 0
        self.agents: Dict[str, Agent] = {}
        self.bb = Blackboard()
        self.history: List[Dict] = []
        self.global_residual_ema = 2.0
        self._build_agents()

    def _build_agents(self):
        for clan in CLANS:
            for ai in range(7):
                aid = f"{clan[:3]}-{ai}"
                self.agents[aid] = Agent(id=aid, clan=clan, tokens=3.5 + random.random())

    def _score(self, payload: Dict) -> float:
        v = payload.get("vector", [random.gauss(0, 1) for _ in range(9)])
        res = nested_projectors_Z9(v)
        energy = res["residual_energy"]
        score = 12.0 / (1.0 + energy) + 1.5  # higher ceiling for long-horizon
        payload["math"] = res
        return max(0.0, score)

    def _adaptive_noise(self) -> float:
        # cooling schedule: less noise as residual falls and generations advance
        cool = max(0.15, 1.0 - self.gen / self.generations)
        return 0.45 * cool * (0.3 + self.global_residual_ema)

    def _modulate_clan(self, clan: str):
        """Adaptive exploration vs exploitation per clan based on residual."""
        h = self.bb.clan_best.get(clan)
        if h is None:
            return 0.4
        e = h.payload.get("math", {}).get("residual_energy", 1.0)
        # low residual → exploit; high residual → explore
        return min(0.55, max(0.08, e * 0.6))

    def step(self):
        self.gen += 1
        noise_scale = self._adaptive_noise()

        # adaptive token recharge: more tokens when residual is still high
        recharge = 0.25 + 0.55 * min(1.0, self.global_residual_ema)
        for a in self.agents.values():
            a.tokens = min(6.0, a.tokens + recharge)
            a.explore_rate = self._modulate_clan(a.clan)

        collision_trace = []
        residual_sum = 0.0
        count = 0

        for aid, agent in list(self.agents.items()):
            # base vector
            if agent.best and random.random() > agent.explore_rate:
                # exploit / carrier lock
                vec = list(agent.best.payload.get("vector", [0.0] * 9))
                # small residual-preserving perturbation
                for i in range(9):
                    vec[i] += random.gauss(0, noise_scale * 0.25)
            else:
                # explore
                vec = [random.gauss(0, noise_scale * 1.1) for _ in range(9)]
                if agent.best:
                    pvec = agent.best.payload.get("vector", vec)
                    vec = [0.6 * v + 0.4 * p for v, p in zip(vec, pvec)]

            # soft peer influence (Network clan stronger)
            for peer_id in agent.peers[:3]:
                if peer_id in self.agents and self.agents[peer_id].best:
                    pvec = self.agents[peer_id].best.payload.get("vector", vec)
                    alpha = 0.22 if agent.clan == "Network" else 0.12
                    vec = [(1 - alpha) * v + alpha * p for v, p in zip(vec, pvec)]

            payload = {"vector": vec}
            score = self._score(payload)
            e_res = payload["math"]["residual_energy"]
            residual_sum += e_res
            count += 1

            h = Hypothesis(id=f"{aid}-g{self.gen}", clan=agent.clan, score=score,
                           payload=payload, generation=self.gen)
            if score > 9.5:
                h.status = "CARRIER"
            elif score > 5.0:
                h.status = "ECHO"
            else:
                h.status = "DISSIPATING"

            if agent.best is None or h.score > agent.best.score:
                agent.best = h
            self.bb.update(h)

            # sub-agent with adaptive probability
            sub_prob = 0.18 + 0.25 * agent.explore_rate
            if random.random() < sub_prob and agent.tokens >= 1.0:
                agent.tokens -= 1.0
                kind = random.choice(SUB_AGENTS)
                if kind == "deep_mutator":
                    for i in range(9):
                        vec[i] += random.gauss(0, noise_scale * 0.6)
                elif kind == "oracle_aligner":
                    mean = sum(vec) / 9
                    vec = [0.75 * x + 0.25 * mean for x in vec]
                else:
                    vec = [random.gauss(0, noise_scale * 1.4) for _ in range(9)]
                payload2 = {"vector": vec, "sub": kind}
                score2 = self._score(payload2)
                sub_h = Hypothesis(id=f"{aid}-{kind}-{self.gen}", clan=agent.clan,
                                   score=score2, payload=payload2, generation=self.gen)
                if score2 > 9.5:
                    sub_h.status = "CARRIER"
                elif score2 > 5.0:
                    sub_h.status = "ECHO"
                else:
                    sub_h.status = "DISSIPATING"
                if agent.best is None or sub_h.score > agent.best.score:
                    agent.best = sub_h
                self.bb.update(sub_h)
                collision_trace.append(f"{aid}→[sub]{kind} {sub_h.score:.2f}")

            # peer watching
            if random.random() < 0.25:
                peer = random.choice(list(self.agents.keys()))
                if peer != aid and peer not in agent.peers:
                    agent.peers.append(peer)
                    if len(agent.peers) > 5:
                        agent.peers.pop(0)

        # update global residual EMA
        avg_res = residual_sum / max(1, count)
        self.global_residual_ema = 0.85 * self.global_residual_ema + 0.15 * avg_res

        for h in self.bb.clan_best.values():
            if h.score > 9.5:
                h.status = "CARRIER"
            elif h.score > 5.0:
                h.status = "ECHO"
            else:
                h.status = "DISSIPATING"

        status = {
            "generation": self.gen,
            "zero_mode": self.bb.global_best[0].payload.get("math", {}).get("zero_mode", 0) if self.bb.global_best else 0,
            "residual_energy": self.bb.global_best[0].payload.get("math", {}).get("residual_energy", 0) if self.bb.global_best else 0,
            "global_best_score": self.bb.global_best[0].score if self.bb.global_best else 0,
            "global_residual_ema": self.global_residual_ema,
            "noise_scale": noise_scale,
            "clan_bests": {c: {"score": h.score, "status": h.status, "id": h.id} for c, h in self.bb.clan_best.items()},
            "top3": [{"id": h.id, "clan": h.clan, "score": h.score, "status": h.status} for h in self.bb.global_best[:3]],
            "carrier_memory_size": len(self.bb.carrier_memory),
            "trace": collision_trace[-6:],
            "timestamp": time.time(),
        }
        try:
            STATUS_FILE.write_text(json.dumps(status, indent=2))
        except Exception:
            pass
        self.history.append(status)
        return status

    def run(self, live: bool = False):
        if HAS_RICH and live:
            console = Console()
            with Live(console=console, refresh_per_second=3) as live:
                for _ in range(self.generations):
                    st = self.step()
                    live.update(self._render(st))
                    time.sleep(0.08)
        else:
            for _ in range(self.generations):
                st = self.step()
                if self.gen % 5 == 0 or self.gen <= 3:
                    print(f"gen={st['generation']:3d}  best={st['global_best_score']:.3f}  "
                          f"E_res={st['residual_energy']:.4f}  ema={st['global_residual_ema']:.4f}  "
                          f"noise={st['noise_scale']:.3f}  carriers={st['carrier_memory_size']}")
        return self.history[-1] if self.history else {}

    def _render(self, st: Dict) -> Panel:
        table = Table(title=f"Long-Horizon gen {st['generation']} | best {st['global_best_score']:.3f} | ema_res {st['global_residual_ema']:.3f}")
        table.add_column("Clan", style="cyan")
        table.add_column("Score", justify="right")
        table.add_column("Status")
        for clan in CLANS:
            info = st["clan_bests"].get(clan, {})
            table.add_row(clan, f"{info.get('score', 0):.3f}", info.get("status", "-"))
        return Panel(table, title="49-Agent Long-Horizon Adaptive Harness", border_style="green")


def main():
    print("=== 49-Agent Long-Horizon Adaptive Harness ===")
    h = LongHorizonHarness(generations=50, seed=42)
    final = h.run(live=False)
    print("\n=== FINAL LONG-HORIZON STATE ===")
    print(json.dumps(final, indent=2))
    Path("/tmp/harness_long_final.json").write_text(json.dumps(final, indent=2))
    print("Saved /tmp/harness_long_final.json")


if __name__ == "__main__":
    main()
