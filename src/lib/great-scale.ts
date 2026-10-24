/** Great Scale invariants observed through Descent LXV and computed for LXVI. */

export const MODULUS = 9;

/** Canonical representative of f(x) = -x (mod 9), returned in [0, 9). */
export function involution(x: number): number {
  const m = ((x % MODULUS) + MODULUS) % MODULUS;
  return (MODULUS - m) % MODULUS;
}

/** The reflection has two fixed classes on the circle: 0 and MODULUS / 2. */
export const FIXED_POINT = 4.5;
export const CIRCLE_FIXED_POINTS = [0, FIXED_POINT] as const;

export function pairing(): Array<[number, number]> {
  return [
    [1, 8],
    [2, 7],
    [3, 6],
    [4, 5],
    [0, 0],
  ];
}

export const PHYSICAL = {
  mEarth: 5.9722e24,
  c: 299792458,
  hbar: 1.054571817e-34,
} as const;

/** Spirit = m c² / ℏ. Void length λ = ℏ / (m c). Product cancels to c. */
export function spiritVoid(): {
  spirit: number;
  lambda: number;
  product: number;
  cubed: number;
  relError: number;
} {
  const { mEarth: m, c, hbar } = PHYSICAL;
  const spirit = (m * c * c) / hbar;
  const lambda = hbar / (m * c);
  const product = spirit * lambda;
  // Alternate notebook form λ' = ℏ c / m ⇒ Spirit × λ' = c³.
  const lambdaPrime = (hbar * c) / m;
  const cubed = spirit * lambdaPrime;
  return {
    spirit,
    lambda,
    product,
    cubed,
    relError: Math.abs(product - c) / c,
  };
}

/** S = H(1-H). Heat flow Ḣ = r S locks toward the high-coherence pole. */
export function actionS(H: number): number {
  return H * (1 - H);
}

export function heatStep(H: number, r: number, dt: number): number {
  const next = H + r * actionS(H) * dt;
  return Math.max(0, Math.min(1, next));
}

/** Residual collapse under mutual involution averaging. */
export function collapseTrajectory(steps = 48): Array<{ t: number; residual: number; carrier: number; coherence: number }> {
  const n = 21;
  let pts = Array.from({ length: n }, (_, i) => (i * 1.7 + 0.4) % MODULUS);
  const out: Array<{ t: number; residual: number; carrier: number; coherence: number }> = [];
  let carrier = 8;
  for (let t = 0; t <= steps; t++) {
    const mean = pts.reduce((s, p) => s + p, 0) / n;
    const residual = pts.reduce((s, p) => s + (p - mean) ** 2, 0) / n;
    const coh = Math.max(0, Math.min(1, 1 - Math.sqrt(residual) / 4.5));
    out.push({ t, residual, carrier, coherence: coh });
    pts = pts.map((p) => {
      const target = involution(mean);
      const mixed = 0.72 * p + 0.28 * target;
      return mixed * (1 - coh * 0.35) + FIXED_POINT * (coh * 0.35);
    });
    carrier = 0.9 * carrier + 0.1 * involution(mean);
  }
  return out;
}

/** Nested moduli of the reduction chain. Each locks at its midpoint. */
export const NESTED_MODULI = [9, 7, 5, 3] as const;

/** Scale map sends m/2 exactly onto m'/2. Normalized carrier is invariant. */
export function scaleImage(m: number, mNext: number): { from: number; to: number; error: number } {
  const from = m / 2;
  const to = (mNext / m) * from;
  return { from, to, error: Math.abs(to - mNext / 2) };
}

/** One map on the unit circle. Independent of modulus. */
export function unitInvolution(u: number): number {
  const frac = ((u % 1) + 1) % 1;
  return (1 - frac) % 1;
}

/** Max disagreement between f_m(x)/m and g(x/m) over a sample. */
export function grainAgreement(moduli: readonly number[] = NESTED_MODULI): number {
  let maxErr = 0;
  for (const m of moduli) {
    for (let k = 0; k <= 36; k++) {
      const x = (k / 36) * m;
      const byMod = involutionOn(x, m) / m;
      const byUnit = unitInvolution(x / m);
      const err = Math.abs(byMod - byUnit);
      const wrapped = Math.min(err, Math.abs(err - 1));
      if (wrapped > maxErr) maxErr = wrapped;
    }
  }
  return maxErr;
}

/** Deviation from the midpoint. g reflects it: δ maps to −δ. */
export function paritySplit(u: number): { even: number; odd: number } {
  const frac = ((u % 1) + 1) % 1;
  const odd = frac - 0.5;
  return { even: 0.5, odd };
}

/** One averaging step with the partner. Exact factor (1−2α). */
export function oddStep(delta: number, alpha: number): number {
  return (1 - 2 * alpha) * delta;
}

/** Exact partner average. Interior points land on 1/2 in one step. */
export function projectToCarrier(u: number): number {
  const frac = ((u % 1) + 1) % 1;
  return (frac + unitInvolution(frac)) / 2;
}

function involutionOn(x: number, mod: number): number {
  const m = ((x % mod) + mod) % mod;
  return (mod - m) % mod;
}

export const DESCENTS = [
  { id: "LXIII", name: "Population collapse" },
  { id: "LXIV", name: "Carrier lock" },
  { id: "LXV", name: "Mutual fixed point" },
  { id: "LXVI", name: "Cancellation residue" },
  { id: "LXVII", name: "Observer dual" },
  { id: "LXVIII", name: "Horizon lock" },
  { id: "LXIX", name: "Silent capacity" },
  { id: "LXX", name: "Nested cancellation" },
  { id: "LXXI", name: "Empty origin" },
  { id: "LXXII", name: "Self-similar transcendence" },
  { id: "LXXIII", name: "Scale-free involution" },
  { id: "LXXIV", name: "Parity of the residual" },
  { id: "LXXV", name: "Exact projector" },
  { id: "XCI", name: "Quotient-circle fixed-point audit" },
  { id: "XCII", name: "Stable QWZ spinor normalization" },
  { id: "XCIII", name: "QGT scale covariance" },
  { id: "XCIV", name: "QGT positivity tolerance diagnostics" },
] as const;

export function formatSci(n: number, digits = 4): string {
  if (!Number.isFinite(n)) return "—";
  const exp = Math.floor(Math.log10(Math.abs(n)));
  if (Math.abs(exp) < 3) return n.toPrecision(digits);
  const mant = n / 10 ** exp;
  return `${mant.toFixed(3)}×10^${exp}`;
}
