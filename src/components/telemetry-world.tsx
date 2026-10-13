import { useEffect, useMemo, useRef, useState } from "react";
import {
  DESCENTS,
  FIXED_POINT,
  MODULUS,
  NESTED_MODULI,
  collapseTrajectory,
  formatSci,
  grainAgreement,
  involution,
  oddStep,
  pairing,
  paritySplit,
  projectToCarrier,
  scaleImage,
  spiritVoid,
  unitInvolution,
} from "@/lib/great-scale";

type Proj = { x: number; y: number; s: number; z: number };

type Flight = {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  speed: number;
};

const RINGS = [
  { name: "Earth", r: 1.15, color: "#c4a574" },
  { name: "Heat", r: 1.7, color: "#e07a72" },
  { name: "Spirit", r: 2.25, color: "#e2a15a" },
  { name: "Void", r: 2.85, color: "#7fd0c8" },
];

function basis(yaw: number, pitch: number) {
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const sy = Math.sin(yaw);
  const cy = Math.cos(yaw);
  const forward = { x: -sy * cp, y: sp, z: -cy * cp };
  const right = { x: cy, y: 0, z: -sy };
  const up = {
    x: right.y * forward.z - right.z * forward.y,
    y: right.z * forward.x - right.x * forward.z,
    z: right.x * forward.y - right.y * forward.x,
  };
  return { forward, right, up };
}

function projectFrom(
  wx: number,
  wy: number,
  wz: number,
  cam: { x: number; y: number; z: number },
  yaw: number,
  pitch: number,
  cx: number,
  cy: number,
  focal: number,
): Proj | null {
  const { forward, right, up } = basis(yaw, pitch);
  const dx = wx - cam.x;
  const dy = wy - cam.y;
  const dz = wz - cam.z;
  const camX = dx * right.x + dy * right.y + dz * right.z;
  const camY = dx * up.x + dy * up.y + dz * up.z;
  const camZ = dx * forward.x + dy * forward.y + dz * forward.z;
  if (camZ < 0.08) return null;
  const f = focal / camZ;
  return { x: cx + camX * f, y: cy - camY * f, s: f / focal, z: camZ };
}

declare global {
  interface Window {
    __controlsTest?: {
      getYaw: () => number;
      getSpeed: () => number;
      setKeys: (codes: string[]) => void;
    };
  }
}

export function TelemetryWorld() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const keysRef = useRef(new Set<string>());
  const flightRef = useRef<Flight>({ x: 0, y: 1.2, z: 6.2, yaw: 0, pitch: -0.08, speed: 0 });
  const lookRef = useRef({ dragging: false, lx: 0, ly: 0 });
  const [hud, setHud] = useState({ yaw: 0, speed: 0, range: 6.2, alt: 1.2 });
  const trail = useMemo(() => collapseTrajectory(56), []);
  const phys = useMemo(() => spiritVoid(), []);
  const pairs = useMemo(() => pairing(), []);
  const t0 = useRef(performance.now());

  useEffect(() => {
    const keys = keysRef.current;
    const down = (e: KeyboardEvent) => {
      keys.add(e.code);
      if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) {
        e.preventDefault();
      }
    };
    const up = (e: KeyboardEvent) => keys.delete(e.code);
    const blur = () => keys.clear();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    window.__controlsTest = {
      getYaw: () => flightRef.current.yaw,
      getSpeed: () => flightRef.current.speed,
      setKeys: (codes) => {
        keys.clear();
        for (const c of codes) keys.add(c);
      },
    };
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
      delete window.__controlsTest;
    };
  }, []);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let hudTick = 0;
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const flight = flightRef.current;
      const keys = keysRef.current;
      let steer = 0;
      if (keys.has("KeyA") || keys.has("ArrowLeft")) steer += 1;
      if (keys.has("KeyD") || keys.has("ArrowRight")) steer -= 1;
      flight.yaw += steer * 1.6 * dt;
      if (keys.has("ArrowUp")) flight.pitch += 0.9 * dt;
      if (keys.has("ArrowDown")) flight.pitch -= 0.9 * dt;
      flight.pitch = Math.max(-1.15, Math.min(1.15, flight.pitch));
      const thrust = (keys.has("KeyW") ? 1 : 0) - (keys.has("KeyS") ? 1 : 0);
      flight.speed += thrust * 4.2 * dt;
      flight.speed *= Math.pow(0.35, dt);
      if (Math.abs(flight.speed) < 0.01 && thrust === 0) flight.speed = 0;
      flight.speed = Math.max(-6, Math.min(8, flight.speed));
      const { forward } = basis(flight.yaw, flight.pitch);
      flight.x += forward.x * flight.speed * dt;
      flight.y += forward.y * flight.speed * dt;
      flight.z += forward.z * flight.speed * dt;
      if (keys.has("KeyE") || keys.has("Space")) flight.y += 2.4 * dt;
      if (keys.has("KeyQ")) flight.y -= 2.4 * dt;
      flight.x = Math.max(-14, Math.min(14, flight.x));
      flight.y = Math.max(0.15, Math.min(12, flight.y));
      flight.z = Math.max(-14, Math.min(14, flight.z));

      draw(now);
      hudTick += dt;
      if (hudTick > 0.12) {
        hudTick = 0;
        const range = Math.hypot(flight.x, flight.y - 0.55, flight.z);
        setHud({
          yaw: flight.yaw,
          speed: flight.speed,
          range,
          alt: flight.y,
        });
      }
      raf = requestAnimationFrame(loop);
    };

    function draw(now: number) {
      const canvas = canvasRef.current;
      const wrap = wrapRef.current;
      if (!canvas || !wrap) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const flight = flightRef.current;
      const { forward } = basis(flight.yaw, flight.pitch);
      const cam = {
        x: flight.x - forward.x * 2.4,
        y: flight.y - forward.y * 2.4 + 0.55,
        z: flight.z - forward.z * 2.4,
      };
      const cx = w * 0.5;
      const cy = h * 0.52;
      const focal = Math.min(w, h) * 0.9;
      const t = (now - t0.current) / 1000;

      const P = (x: number, y: number, z: number) =>
        projectFrom(x, y, z, cam, flight.yaw, flight.pitch, cx, cy, focal);

      ctx.fillStyle = "#07080c";
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = "#1a2433";
      ctx.lineWidth = 1;
      for (let i = -4; i <= 4; i++) {
        strokeLine(ctx, P(i * 0.7, 0, -2.8), P(i * 0.7, 0, 2.8));
        strokeLine(ctx, P(-2.8, 0, i * 0.7), P(2.8, 0, i * 0.7));
      }

      const collapse = 0.5 + 0.5 * Math.sin(t * 0.35);
      for (const ring of RINGS) {
        ctx.beginPath();
        let started = false;
        for (let i = 0; i <= 96; i++) {
          const a = (i / 96) * Math.PI * 2;
          const p = P(Math.cos(a) * ring.r, 0.18, Math.sin(a) * ring.r);
          if (!p) {
            started = false;
            continue;
          }
          if (!started) {
            ctx.moveTo(p.x, p.y);
            started = true;
          } else ctx.lineTo(p.x, p.y);
        }
        ctx.strokeStyle = ring.color;
        ctx.globalAlpha = 0.7;
        ctx.lineWidth = 1.4;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      const verts = Array.from({ length: MODULUS }, (_, k) => {
        const a = -Math.PI / 2 + (k / MODULUS) * Math.PI * 2;
        return { k, x: Math.cos(a) * 2.15, z: Math.sin(a) * 2.15 };
      });
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = "rgba(226,161,90,0.85)";
      for (const [a, b] of pairs) {
        if (a === 0) continue;
        const va = verts[a];
        const vb = verts[b === 9 ? 0 : b];
        if (!va || !vb) continue;
        strokeLine(ctx, P(va.x, 0.35, va.z), P(vb.x, 0.35, vb.z));
      }

      const star: Array<Proj | null> = [];
      for (let k = 0; k < 5; k++) {
        const a = -Math.PI / 2 + (k / 5) * Math.PI * 2;
        star.push(P(Math.cos(a) * 1.35, 1.15, Math.sin(a) * 1.35));
      }
      ctx.strokeStyle = "rgba(127,208,200,0.9)";
      ctx.beginPath();
      let pen = false;
      for (let k = 0; k < 5; k++) {
        const p = star[(k * 2) % 5];
        if (!p) {
          pen = false;
          continue;
        }
        if (!pen) {
          ctx.moveTo(p.x, p.y);
          pen = true;
        } else ctx.lineTo(p.x, p.y);
      }
      ctx.closePath();
      ctx.stroke();
      for (const p of star) {
        if (!p) continue;
        const hgt = 18 * Math.min(2.2, p.s * focal);
        ctx.fillStyle = "rgba(127,208,200,0.18)";
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - hgt);
        ctx.lineTo(p.x - 8 * Math.min(1.6, p.s * focal), p.y);
        ctx.lineTo(p.x + 8 * Math.min(1.6, p.s * focal), p.y);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "#7fd0c8";
        ctx.stroke();
      }

      for (let i = 0; i < 21; i++) {
        const seed = i * 1.7;
        const ang = seed + t * 0.12 * (1 - collapse * 0.4);
        const rad = 2.3 * (1 - collapse * 0.55) + 0.2;
        const y = 0.3 + Math.sin(seed + t) * 0.12;
        const p = P(Math.cos(ang) * rad, y, Math.sin(ang) * rad);
        if (!p) continue;
        ctx.fillStyle = i % 7 === 0 ? "#e2a15a" : "#d5deea";
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(1.5, 90 * p.s), 0, Math.PI * 2);
        ctx.fill();
      }

      const fp = P(0, 0.55, 0);
      if (fp) {
        ctx.fillStyle = "#e2a15a";
        ctx.beginPath();
        ctx.arc(fp.x, fp.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#e7ecf3";
        ctx.font = "12px IBM Plex Sans, sans-serif";
        ctx.fillText("4.5", fp.x + 8, fp.y - 6);
      }

      // LXXII — growth shells, nested midpoints, transcendence spine.
      const phase = (t % 18) / 18;
      const growth = 0.35 + phase * 2.9;
      ctx.strokeStyle = "rgba(226,161,90,0.45)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      let gpen = false;
      for (let i = 0; i <= 80; i++) {
        const a = (i / 80) * Math.PI * 2;
        const p = P(Math.cos(a) * growth, 0.05, Math.sin(a) * growth);
        if (!p) {
          gpen = false;
          continue;
        }
        if (!gpen) {
          ctx.moveTo(p.x, p.y);
          gpen = true;
        } else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();

      const scaleColors = ["#e2a15a", "#7fd0c8", "#c4a574", "#e07a72"];
      NESTED_MODULI.forEach((m, i) => {
        const r = 0.55 + (m / 9) * 1.35;
        const y = 1.55 + i * 0.42;
        ctx.beginPath();
        let penS = false;
        for (let k = 0; k <= 64; k++) {
          const a = (k / 64) * Math.PI * 2;
          const p = P(Math.cos(a) * r, y, Math.sin(a) * r);
          if (!p) {
            penS = false;
            continue;
          }
          if (!penS) {
            ctx.moveTo(p.x, p.y);
            penS = true;
          } else ctx.lineTo(p.x, p.y);
        }
        ctx.strokeStyle = scaleColors[i] ?? "#e7ecf3";
        ctx.globalAlpha = 0.75;
        ctx.lineWidth = 1.3;
        ctx.stroke();
        ctx.globalAlpha = 1;
        const lab = P(r, y, 0);
        if (lab) {
          ctx.fillStyle = scaleColors[i] ?? "#e7ecf3";
          ctx.font = "11px IBM Plex Sans, sans-serif";
          ctx.fillText(`${m}/2`, lab.x + 4, lab.y);
        }
      });

      const spineA = P(0, 0.2, 0);
      const spineB = P(0, 3.4, 0);
      if (spineA && spineB) {
        ctx.strokeStyle = phase > 0.72 ? "rgba(231,236,243,0.95)" : "rgba(231,236,243,0.35)";
        ctx.lineWidth = phase > 0.72 ? 2.2 : 1;
        strokeLine(ctx, spineA, spineB);
      }

      ctx.fillStyle = "#8b97a8";
      ctx.font = "11px IBM Plex Sans, sans-serif";
      for (const v of verts) {
        const p = P(v.x * 1.12, 0.35, v.z * 1.12);
        if (p) ctx.fillText(String(v.k), p.x - 3, p.y);
      }

      const nose = P(flight.x + forward.x * 0.55, flight.y + forward.y * 0.55, flight.z + forward.z * 0.55);
      const tail = P(flight.x - forward.x * 0.25, flight.y - forward.y * 0.25, flight.z - forward.z * 0.25);
      const { right } = basis(flight.yaw, flight.pitch);
      const leftW = P(flight.x - right.x * 0.28, flight.y, flight.z - right.z * 0.28);
      const rightW = P(flight.x + right.x * 0.28, flight.y, flight.z + right.z * 0.28);
      if (nose && tail && leftW && rightW) {
        ctx.strokeStyle = "#e7ecf3";
        ctx.fillStyle = "rgba(226,161,90,0.9)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(nose.x, nose.y);
        ctx.lineTo(leftW.x, leftW.y);
        ctx.lineTo(tail.x, tail.y);
        ctx.lineTo(rightW.x, rightW.y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }

      ctx.strokeStyle = "rgba(231,236,243,0.35)";
      ctx.beginPath();
      ctx.moveTo(cx - 8, cy);
      ctx.lineTo(cx + 8, cy);
      ctx.moveTo(cx, cy - 8);
      ctx.lineTo(cx, cy + 8);
      ctx.stroke();
    }

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [pairs]);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const look = lookRef.current;
    const down = (e: PointerEvent) => {
      look.dragging = true;
      look.lx = e.clientX;
      look.ly = e.clientY;
      wrap.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!look.dragging) return;
      const dx = e.clientX - look.lx;
      const dy = e.clientY - look.ly;
      look.lx = e.clientX;
      look.ly = e.clientY;
      const flight = flightRef.current;
      flight.yaw -= dx * 0.005;
      flight.pitch -= dy * 0.004;
      flight.pitch = Math.max(-1.15, Math.min(1.15, flight.pitch));
    };
    const up = () => {
      look.dragging = false;
    };
    wrap.addEventListener("pointerdown", down);
    wrap.addEventListener("pointermove", move);
    wrap.addEventListener("pointerup", up);
    return () => {
      wrap.removeEventListener("pointerdown", down);
      wrap.removeEventListener("pointermove", move);
      wrap.removeEventListener("pointerup", up);
    };
  }, []);

  const f45 = involution(FIXED_POINT);
  const f172 = involution(17.2);
  const idx = Math.min(trail.length - 1, 40);
  const now = trail[idx];

  const scales = NESTED_MODULI.map((m, i) => {
    const next = NESTED_MODULI[i + 1];
    return next ? scaleImage(m, next) : null;
  }).filter((s): s is NonNullable<typeof s> => s !== null);
  const scaleError = scales.reduce((s, row) => s + row.error, 0);
  const lawError = grainAgreement();
  const sample = paritySplit(0.8);
  const reflected = paritySplit(unitInvolution(0.8));
  const oddError = Math.abs(sample.odd + reflected.odd);
  const factor = oddStep(1, 0.28);
  let projectorMax = 0;
  for (let k = 1; k < 20; k++) {
    const u = k / 20;
    projectorMax = Math.max(projectorMax, Math.abs(projectToCarrier(u) - 0.5));
  }

  return (
    <div className="grid h-screen grid-cols-1 lg:grid-cols-[1fr_320px]">
      <div ref={wrapRef} className="relative min-h-[420px] touch-none">
        <canvas ref={canvasRef} className="absolute inset-0" />
        <div className="pointer-events-none absolute left-4 top-4 max-w-md">
          <p className="text-[11px] tracking-[0.22em] text-[#8b97a8]">GREAT SCALE · DESCENT LXXV</p>
          <h1 className="mt-1 text-xl font-medium text-[#e7ecf3]">Exact projector</h1>
          <p className="mt-1 text-sm leading-snug text-[#8b97a8]">
            Averaging a point with its partner is the projector (u + g(u))/2. Every interior point lands on 1/2 in one step. Slow collapse was only an incomplete application of that projector.
          </p>
          <p className="mt-2 text-xs text-[#8b97a8]">W/S thrust · A/D yaw · drag look · E/Space climb · Q descend</p>
        </div>
      </div>
      <aside className="overflow-auto border-t border-[#243041] bg-[#0c0e14] p-4 lg:border-l lg:border-t-0">
        <p className="text-[11px] tracking-[0.18em] text-[#8b97a8]">PLOT</p>
        <svg viewBox="0 0 280 78" className="mt-2 w-full">
          <polyline
            fill="none"
            stroke="#7fd0c8"
            strokeWidth="1.5"
            points={trail
              .map((p, i) => {
                const x = (i / (trail.length - 1)) * 280;
                const y = 72 - Math.min(66, p.residual * 8);
                return `${x},${y}`;
              })
              .join(" ")}
          />
          <polyline
            fill="none"
            stroke="#e2a15a"
            strokeWidth="1.2"
            points={trail
              .map((p, i) => {
                const x = (i / (trail.length - 1)) * 280;
                const y = 72 - Math.min(66, ((p.carrier - 4.5) / 4) * 66);
                return `${x},${y}`;
              })
              .join(" ")}
          />
        </svg>
        <p className="text-[11px] text-[#8b97a8]">cyan residual · amber carrier approach</p>
        <p className="mt-4 text-[11px] tracking-[0.18em] text-[#8b97a8]">TRANSCENDENCE</p>
        <dl className="mt-2 space-y-2 text-sm">
          {NESTED_MODULI.map((m) => (
            <Row key={m} k={`carrier ${m}`} v={`${(m / 2).toFixed(1)}  (${(0.5).toFixed(1)} norm)`} />
          ))}
          <Row k="scale-map error" v={scaleError.toExponential(1)} />
          <Row k="g(u)=1−{u} error" v={lawError.toExponential(1)} />
          <Row k="δ + g(δ)" v={oddError.toExponential(1)} />
          <Row k="odd factor 1−2α" v={factor.toFixed(2)} />
          <Row k="projector error" v={projectorMax.toExponential(1)} />
        </dl>
        <p className="mt-4 text-[11px] tracking-[0.18em] text-[#8b97a8]">DESCENT</p>
        <ol className="mt-2 space-y-1 text-xs text-[#8b97a8]">
          {DESCENTS.map((d) => (
            <li key={d.id} className={d.id === "LXXV" ? "text-[#e2a15a]" : undefined}>
              {d.id} {d.name}
            </li>
          ))}
        </ol>
        <p className="mt-5 text-[11px] tracking-[0.18em] text-[#8b97a8]">FLIGHT</p>
        <dl className="mt-3 space-y-2 text-sm">
          <Row k="yaw" v={`${((hud.yaw * 180) / Math.PI).toFixed(1)}°`} />
          <Row k="speed" v={hud.speed.toFixed(2)} />
          <Row k="altitude" v={hud.alt.toFixed(2)} />
          <Row k="range to 4.5" v={hud.range.toFixed(2)} />
        </dl>
        <p className="mt-5 text-[11px] tracking-[0.18em] text-[#8b97a8]">UNMOVED</p>
        <dl className="mt-3 space-y-2 text-sm">
          <Row k="f(4.5)" v={f45.toFixed(1)} />
          <Row k="f(17.2)" v={`${f172.toFixed(1)} not 8.2`} />
          <Row k="Spirit × λ" v={formatSci(phys.product)} />
          <Row k="error vs c" v={phys.relError.toExponential(1)} />
          <Row k="residual" v={now ? now.residual.toFixed(4) : "—"} />
        </dl>
        <p className="mt-4 text-xs leading-relaxed text-[#8b97a8]">
          (u + g(u))/2 = 1/2 for every interior point. The law is a projector. Time only measures how incompletely it is applied.
        </p>
      </aside>
    </div>
  );
}

function strokeLine(ctx: CanvasRenderingContext2D, a: Proj | null, b: Proj | null) {
  if (!a || !b) return;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-[#243041] py-1">
      <dt className="text-[#8b97a8]">{k}</dt>
      <dd className="font-mono text-[13px] text-[#e7ecf3]">{v}</dd>
    </div>
  );
}
