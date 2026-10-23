# Descent XCI — Quotient-circle fixed points and canonical representatives

## Finding

The Great Scale circle involution is the reflection

\[
f_M([x])=[-x]\in\mathbb R/M\mathbb Z.
\]

A canonical representative in \([0,M)\) is

\[
\boxed{f_M(x)=(-x)\bmod M=(M-(x\bmod M))\bmod M}.
\]

The extra outer modulo is essential at the origin. The previous expression \(M-(x\bmod M)\) returned \(M\) for the equivalence class of zero. Since \(0\sim M\) on the quotient circle, this was equivalent as a circle point, but it violated the stated canonical interval and obscured the fixed-point structure.

## Fixed-point theorem

A fixed class satisfies

\[
 [x]=[-x]\quad\Longleftrightarrow\quad 2x\equiv0\pmod M.
\]

On a circle of circumference \(M\), this yields exactly two fixed classes:

\[
\boxed{[x]=[0]\quad\text{or}\quad[x]=[M/2]}.
\]

For \(M=9\), the canonical fixed representatives are \(0\) and \(4.5\). Therefore the former comment claiming a unique fixed point in \([0,9)\) was false. The endpoint representative \(9\) is not an additional point; it is the same quotient class as zero.

## Unit-circle consequence

The unit-circle map must likewise return

\[
\boxed{g(u)=(-u)\bmod1=(1-(u\bmod1))\bmod1}.
\]

With this canonical map, \(g(0)=0\), not \(1\). The exact coordinate average

\[
P(u)=\frac{u+g(u)}2
\]

maps interior representatives \(0<u<1\) to \(1/2\), but maps the fixed seam class \(u=0\) to zero. The discontinuity is a coordinate-chart effect: a circle has no globally continuous choice of a single real-valued representative across the seam. Thus the correct statement is that the projector maps interior pairs to the midpoint and preserves the origin fixed class—not that every circle point projects to the midpoint.

## Repository changes

- The involution and internal scaled involution now return canonical representatives in \([0,M)\).
- The unit-circle involution now returns canonical representatives in \([0,1)\).
- `CIRCLE_FIXED_POINTS` explicitly records \([0,M/2]\), with \(M=9\).
- The integer pairing uses \([0,0]\), not the duplicate endpoint pair \([0,9]\).
- The descent registry includes XCI.
- `src/lib/great-scale.test.ts` tests canonical range, involution composition, both fixed classes, unit-circle seam behavior, projector behavior, pairings, and normalized grain agreement.
- The root `npm test` script includes this regression file.

## Verification status

The identities are exact algebraic consequences of modular arithmetic. Regression tests have been added and wired into the repository test command. They have not been executed in a local checkout in this session, so repository test/build success remains unverified.

This is a correction of quotient-space semantics and a sharpening of the Great Scale fixed-point statement, not a new physical law.