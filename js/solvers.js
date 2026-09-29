/* ================= Forge — solveurs RDM (purs, testables) =================
   Aucune dépendance DOM / Three. Chargé avant main.js en navigateur ;
   require()-able en Node pour les tests unitaires. */

// Poutre sur deux appuis : charge ponctuelle {a,P} et/ou répartie {w}.
// Convention : dM/dx = V. Renvoie xs, V (effort tranchant), M (moment),
// y (flèche), et les extrema |·|.
function solveBeam(L, EI, point, udl) {
  const N = 200, dx = L / N;
  let sP = 0, sM = 0;
  if (point) { sP += point.P; sM += point.P * point.a; }
  if (udl) { const W = udl.w * L; sP += W; sM += W * (L / 2); }
  const RB = sM / L, RA = sP - RB, xs = [], V = [], M = [];
  for (let i = 0; i <= N; i++) {
    const x = L * i / N; xs.push(x);
    let v = RA; if (point && point.a <= x) v -= point.P; if (udl) v -= udl.w * x;
    let m = RA * x; if (point && point.a <= x) m -= point.P * (x - point.a); if (udl) m -= udl.w * x * (x / 2);
    V.push(v); M.push(m);
  }
  const k = M.map(m => m / EI), th = [0];
  for (let i = 1; i <= N; i++) th.push(th[i - 1] + (k[i - 1] + k[i]) / 2 * dx);
  const y0 = [0];
  for (let i = 1; i <= N; i++) y0.push(y0[i - 1] + (th[i - 1] + th[i]) / 2 * dx);
  const c1 = -y0[N] / L, y = xs.map((x, i) => y0[i] + c1 * x);
  let Mmax = { v: 0, i: 0 }, Vmax = { v: 0, i: 0 }, ymax = { v: 0, i: 0 };
  for (let i = 0; i <= N; i++) {
    if (Math.abs(M[i]) > Math.abs(Mmax.v)) Mmax = { v: M[i], i };
    if (Math.abs(V[i]) > Math.abs(Vmax.v)) Vmax = { v: V[i], i };
    if (Math.abs(y[i]) > Math.abs(ymax.v)) ymax = { v: y[i], i };
  }
  return { RA, RB, xs, V, M, y, N, Mmax, Vmax, ymax, L };
}

// Interpolation linéaire d'un tableau échantillonné sur [0,L] à l'abscisse x.
function interp(arr, L, x) {
  const N = arr.length - 1, t = Math.max(0, Math.min(N, x / L * N)), i = Math.floor(t), f = t - i;
  return arr[i] + (arr[Math.min(N, i + 1)] - arr[i]) * f;
}

// Treillis plan articulé : méthode des nœuds (résolution Gauss).
// nodes:[{x,y,support?}], members:[[a,b],…], loads:{i:[fx,fy]}.
function solveTruss(nodes, members, loads) {
  const j = nodes.length, m = members.length; const rdofs = [];
  nodes.forEach((n, i) => { if (n.support === 'pin') { rdofs.push([i, 0]); rdofs.push([i, 1]); } else if (n.support === 'roller') { rdofs.push([i, 1]); } });
  const nE = 2 * j, A = Array.from({ length: nE }, () => new Array(m + rdofs.length).fill(0)), b = new Array(nE).fill(0);
  members.forEach((mm, k) => { const [a, c] = mm, dx = nodes[c].x - nodes[a].x, dy = nodes[c].y - nodes[a].y, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L; A[2 * a][k] += ux; A[2 * a + 1][k] += uy; A[2 * c][k] -= ux; A[2 * c + 1][k] -= uy; });
  rdofs.forEach((rd, k) => { A[2 * rd[0] + rd[1]][m + k] += 1; });
  nodes.forEach((n, i) => { const f = loads[i] || [0, 0]; b[2 * i] -= f[0]; b[2 * i + 1] -= f[1]; });
  const M = A.map(r => r.slice()), y = b.slice(), n = nE;
  for (let col = 0, row = 0; col < M[0].length && row < n; col++) {
    let piv = row; for (let r = row + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    if (Math.abs(M[piv][col]) < 1e-9) continue;
    [M[row], M[piv]] = [M[piv], M[row]]; [y[row], y[piv]] = [y[piv], y[row]];
    const p = M[row][col]; for (let c = col; c < M[0].length; c++) M[row][c] /= p; y[row] /= p;
    for (let r = 0; r < n; r++) if (r !== row && Math.abs(M[r][col]) > 1e-12) { const f = M[r][col]; for (let c = col; c < M[0].length; c++) M[r][c] -= f * M[row][c]; y[r] -= f * y[row]; }
    row++;
  }
  return { forces: y.slice(0, m), reactions: y.slice(m) };
}

// Export CommonJS pour les tests Node ; ignoré en navigateur (module indéfini).
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { solveBeam, interp, solveTruss };
}
