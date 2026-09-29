/* Tests unitaires des solveurs — node --test test/solvers.test.js
   Cas analytiques connus de RDM. Aucun navigateur requis. */
const test = require('node:test');
const assert = require('node:assert');
const { solveBeam, interp, solveTruss } = require('../js/solvers.js');

const EI = 1e6, close = (a, b, t = 1e-6) => assert.ok(Math.abs(a - b) <= t * (1 + Math.abs(b)), `${a} ≈ ${b}`);

test('poutre appuyée — charge ponctuelle centrée : M_max = P·L/4', () => {
  const L = 6, P = 1000;
  const s = solveBeam(L, EI, { a: L / 2, P }, null);
  close(s.RA, P / 2); close(s.RB, P / 2);
  close(Math.abs(s.Mmax.v), P * L / 4, 1e-3);   // 1500 N·m
  close(Math.abs(s.Vmax.v), P / 2, 1e-3);
});

test('poutre appuyée — charge excentrée : réactions et M au point', () => {
  const L = 8, P = 1200, a = 2;
  const s = solveBeam(L, EI, { a, P }, null);
  close(s.RB, P * a / L, 1e-6);          // P·a/L
  close(s.RA, P * (L - a) / L, 1e-6);    // P·(L−a)/L
  const Mtheo = P * a * (L - a) / L;      // moment au droit de la charge
  close(interp(s.M, L, a), Mtheo, 1e-2);
});

test('poutre appuyée — charge répartie : M_max = w·L²/8', () => {
  const L = 5, w = 2000;
  const s = solveBeam(L, EI, null, { w });
  close(s.RA, w * L / 2, 1e-6); close(s.RB, w * L / 2, 1e-6);
  close(Math.abs(s.Mmax.v), w * L * L / 8, 1e-2);  // wL²/8
});

test('convention dM/dx = V : V change de signe là où M est maximal', () => {
  const L = 6, P = 1000;
  const s = solveBeam(L, EI, { a: L / 2, P }, null);
  const iM = s.Mmax.i;                              // indice du moment max
  assert.ok(s.V[Math.max(0, iM - 2)] > 0, 'V > 0 avant le max (M croissant)');
  assert.ok(s.V[Math.min(s.N, iM + 2)] < 0, 'V < 0 après le max (M décroissant)');
});

test('interp : interpolation linéaire correcte', () => {
  const arr = [0, 10, 20, 30, 40], L = 4;   // pente 10/unité
  close(interp(arr, L, 0), 0); close(interp(arr, L, 2), 20); close(interp(arr, L, 3.5), 35);
});

test('treillis triangle symétrique : réactions verticales = P/2', () => {
  const nodes = [
    { x: 0, y: 0, support: 'pin' },
    { x: 4, y: 0, support: 'roller' },
    { x: 2, y: 2 },
  ];
  const members = [[0, 2], [1, 2], [0, 1]];
  const loads = { 2: [0, -1000] };                 // 1000 N vers le bas au sommet
  const { reactions } = solveTruss(nodes, members, loads);
  // reactions = [R0x, R0y, R1y] selon l'ordre des ddl bloqués
  close(reactions[0], 0, 1e-6);                     // pas d'effort horizontal
  close(reactions[1], 500, 1e-3);                   // R0y = P/2
  close(reactions[2], 500, 1e-3);                   // R1y = P/2
});
