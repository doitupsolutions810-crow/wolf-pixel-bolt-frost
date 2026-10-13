#!/usr/bin/env python3
"""
Great Scale Fixed-Point World — Multi-Agent 3D Coherence Environment
Integrates:
  - Z/9Z involution f(x)=9-(x mod 9)
  - Spirit–Void velocity-cubed invariant
  - Residual → Fixed-Point transition
  - Agents occupy 3D positions, plot fixed points, watch each other
  - Internal + external views
  - Physics / Quantum-inspired coupling
  - Layered growth of the environment from the Great Scale
"""

from __future__ import annotations
import json
import math
import random
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

ROOT = Path(__file__).resolve().parent
STATUS_FILE = Path("/tmp/fp_world_status.json")

# ---------------------------------------------------------------------------
# Core mathematical objects from the notebooks
# ---------------------------------------------------------------------------

def involution_9(x: float) -> float:
    """f(x) = 9 - (x mod 9), f∘f = id"""
    return 9.0 - (x % 9.0)

def spirit_void_product(m: float = 5.9722e24, c: float = 2.99792458e8, hbar: float = 1.0545718e-34) -> Dict[str, float]:
    """
    Spirit = m c² / ħ   (rad/s)
    λ_Void = ħ / (m c)
    Product → c  (or c³ in the universal form)
    """
    spirit = m * c * c / hbar
    lam_void = hbar / (m * c)
    product = spirit * lam_void          # → c
    product_cubed = spirit * (lam_void ** 3) * (c ** 2)  # exploratory
    return {
        "spirit_omega": spirit,
        "lambda_void": lam_void,
        "product_c": product,
        "c": c,
        "relative_error": abs(product - c) / c,
    }

def residual_to_fixed(r: float, coherence: float) -> float:
    """Residual expression becomes the fixed point under high coherence."""
    return r * (1.0 - coherence) + coherence * involution_9(r)

def action_S(H: float) -> float:
    """S = H(1-H)"""
    return max(0.0, H * (1.0 - H))

def dPhi(dH: float, S: float) -> float:
    """dΦ = dH / √S"""
    if S < 1e-12:
        return 0.0
    return dH / math.sqrt(S)

# ---------------------------------------------------------------------------
# Agent in 3D Fixed-Point World
# ---------------------------------------------------------------------------

@dataclass
class FPAgent:
    id: str
    clan: str
    pos: List[float]          # 3D position [x,y,z]
    fixed_point: float        # scalar fixed-point value (mod 9)
    coherence: float          # 0..1
    heat: float               # Heat Index
    watching: List[str] = field(default_factory=list)
    messages: List[str] = field(default_factory=list)
    layer: int = 0            # coherence layer

    def plot_fixed_point(self, others: List["FPAgent"]) -> float:
        """Plot fixed point according to other agents (mean + involution)."""
        if not others:
            return self.fixed_point
        vals = [o.fixed_point for o in others if o.id in self.watching or True]
        mean = sum(vals) / len(vals)
        # involution pull + residual collapse
        target = involution_9(mean)
        self.fixed_point = 0.7 * self.fixed_point + 0.3 * target
        self.fixed_point = residual_to_fixed(self.fixed_point, self.coherence)
        return self.fixed_point

    def update_coherence(self, global_carrier: float):
        dist = abs(self.fixed_point - global_carrier)
        self.coherence = max(0.0, min(1.0, 1.0 - dist / 4.5))
        # Heat tracks coherence
        self.heat = 0.85 * self.heat + 0.15 * (1.0 + self.coherence)
        # layer growth
        if self.coherence > 0.85:
            self.layer = min(5, self.layer + 1)

    def talk(self, other: "FPAgent", msg: str):
        other.messages.append(f"{self.id}: {msg}")
        if other.id not in self.watching:
            self.watching.append(other.id)
        if self.id not in other.watching:
            other.watching.append(self.id)


# ---------------------------------------------------------------------------
# 3D Fixed-Point Environment
# ---------------------------------------------------------------------------

class FixedPointWorld:
    def __init__(self, n_agents: int = 21, seed: int = 9):
        random.seed(seed)
        self.agents: Dict[str, FPAgent] = {}
        self.time = 0
        self.global_carrier = 8.0          # high-coherence pole from notebook (C=8)
        self.layers_grown = 0
        self.history: List[Dict] = []
        self.sv = spirit_void_product()
        self._spawn(n_agents)

    def _spawn(self, n: int):
        clans = ["Symmetry", "Spectral", "Continuous", "Meta", "Residual", "Positivity", "Network"]
        for i in range(n):
            clan = clans[i % 7]
            aid = f"{clan[:3]}-{i}"
            pos = [random.uniform(-5, 5) for _ in range(3)]
            fp = random.uniform(0, 9)
            self.agents[aid] = FPAgent(
                id=aid, clan=clan, pos=pos, fixed_point=fp,
                coherence=random.uniform(0.2, 0.6), heat=1.0
            )

    def step(self):
        self.time += 1
        agents_list = list(self.agents.values())

        # 1. Agents watch & plot fixed points relative to others
        for a in agents_list:
            others = [o for o in agents_list if o.id != a.id]
            a.plot_fixed_point(others)
            a.update_coherence(self.global_carrier)

        # 2. Agent-to-agent talk (traversal watching)
        for _ in range(min(8, len(agents_list)//2)):
            a, b = random.sample(agents_list, 2)
            msg = f"FP={a.fixed_point:.3f} C={a.coherence:.3f} layer={a.layer}"
            a.talk(b, msg)

        # 3. Move in 3D toward consensus fixed-point attractor
        for a in agents_list:
            # attract toward global carrier direction + peer influence
            target = [0.0, 0.0, (a.fixed_point - 4.5) * 0.4]
            for wid in a.watching[:3]:
                if wid in self.agents:
                    w = self.agents[wid]
                    target[0] += 0.1 * (w.pos[0] - a.pos[0])
                    target[1] += 0.1 * (w.pos[1] - a.pos[1])
            for d in range(3):
                a.pos[d] += 0.08 * (target[d] - a.pos[d] * 0.3)
                a.pos[d] = max(-8, min(8, a.pos[d]))

        # 4. Global carrier update (involution + residual silence)
        fps = [a.fixed_point for a in agents_list]
        mean_fp = sum(fps) / len(fps)
        self.global_carrier = 0.9 * self.global_carrier + 0.1 * involution_9(mean_fp)

        # 5. Layer growth of the environment
        high_coh = sum(1 for a in agents_list if a.coherence > 0.8)
        if high_coh > len(agents_list) * 0.6:
            self.layers_grown = min(7, self.layers_grown + 1)

        # 6. Physics / Quantum inspired residual energy
        residual = sum((a.fixed_point - self.global_carrier)**2 for a in agents_list) / len(agents_list)

        status = {
            "time": self.time,
            "global_carrier": self.global_carrier,
            "mean_coherence": sum(a.coherence for a in agents_list) / len(agents_list),
            "mean_heat": sum(a.heat for a in agents_list) / len(agents_list),
            "residual": residual,
            "layers_grown": self.layers_grown,
            "spirit_void_product_c": self.sv["product_c"],
            "spirit_void_rel_error": self.sv["relative_error"],
            "n_agents": len(agents_list),
            "high_coherence_count": high_coh,
            "sample_agents": [
                {
                    "id": a.id,
                    "fp": round(a.fixed_point, 3),
                    "coh": round(a.coherence, 3),
                    "heat": round(a.heat, 3),
                    "layer": a.layer,
                    "pos": [round(p, 2) for p in a.pos],
                    "watching": len(a.watching),
                }
                for a in sorted(agents_list, key=lambda x: -x.coherence)[:5]
            ],
        }
        try:
            STATUS_FILE.write_text(json.dumps(status, indent=2))
        except Exception:
            pass
        self.history.append(status)
        return status

    def run(self, steps: int = 40):
        print("=== Great Scale Fixed-Point World (3D Multi-Agent) ===")
        print(f"Spirit×Void product error: {self.sv['relative_error']:.2e}")
        for i in range(steps):
            st = self.step()
            if i % 5 == 0 or i < 3:
                print(f"t={st['time']:3d}  carrier={st['global_carrier']:.3f}  "
                      f"coh={st['mean_coherence']:.3f}  residual={st['residual']:.4f}  "
                      f"layers={st['layers_grown']}  highC={st['high_coherence_count']}")
        return self.history[-1]


def main():
    world = FixedPointWorld(n_agents=21, seed=9)
    final = world.run(steps=45)
    print("\n=== FINAL FIXED-POINT WORLD STATE ===")
    print(json.dumps(final, indent=2))
    Path("/tmp/fp_world_final.json").write_text(json.dumps(final, indent=2))
    print("Saved /tmp/fp_world_final.json")


if __name__ == "__main__":
    main()
