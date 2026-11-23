import test from 'node:test';
import assert from 'node:assert/strict';
import {
  toPeriodic, toEA, ratePerPeriod, fromPeriodic, compoundAmount, simpleAmount,
  pvFactor, fvFactor, solveN, solveRate, schedule, annuityPayment,
} from '../src/lib/math.js';
import { parseNum } from '../src/lib/format.js';

const close = (a, b, eps = 1e-4) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);
const sum = (rows, key) => rows.reduce((s, r) => s + r[key], 0);

test('interés simple', () => close(simpleAmount(1000, 0.06, 2), 1120));

test('interés compuesto: 10.000 al 12% NM por 2 años', () => {
  const ip = toPeriodic({ r: 0.12, kind: 'nominal', m: 12, mode: 'vencida' });
  close(compoundAmount(10000, ip, 24), 12697.3465, 1e-3);
});

test('12% NM = 12,6825% EA', () => close(toEA({ r: 0.12, kind: 'nominal', m: 12, mode: 'vencida' }), 0.126825, 1e-6));

test('20% nominal trimestre anticipado -> EA 22,8%', () => {
  const spec = { r: 0.2, kind: 'nominal', m: 4, mode: 'anticipada' };
  close(toPeriodic(spec), 0.05 / 0.95, 1e-9);
  close(toEA(spec), Math.pow(1 + 0.05 / 0.95, 4) - 1, 1e-9);
});

test('ida y vuelta entre tasas', () => {
  const ea = 0.2;
  const ip = Math.pow(1 + ea, 1 / 4) - 1;
  for (const mode of ['vencida', 'anticipada']) {
    for (const kind of ['efectiva', 'nominal']) {
      const r = fromPeriodic(ip, kind, 4, mode);
      close(toEA({ r, kind, m: 4, mode }), ea, 1e-9);
    }
  }
});

test('anualidad vencida 1000, 1%, 12 pagos', () => {
  close(1000 * pvFactor(0.01, 12, 'vencida'), 11255.0774, 1e-3);
  close(1000 * fvFactor(0.01, 12, 'vencida'), 12682.5030, 1e-3);
});

test('anualidad anticipada y diferida', () => {
  close(1000 * pvFactor(0.01, 12, 'anticipada'), 11255.0774 * 1.01, 1e-3);
  close(1000 * pvFactor(0.01, 12, 'diferida', 3), 11255.0774 / Math.pow(1.01, 3), 1e-3);
});

test('anualidad general: cuotas mensuales con tasa 12% efectiva anual', () => {
  const i = ratePerPeriod({ r: 0.12, kind: 'efectiva', m: 1, mode: 'vencida' }, 12);
  close(i, Math.pow(1.12, 1 / 12) - 1, 1e-12);
});

test('despejar n y tasa devuelven los datos originales', () => {
  const A = 500, i = 0.015, n = 30;
  for (const tipo of ['vencida', 'anticipada', 'diferida']) {
    const vp = A * pvFactor(i, n, tipo, 4);
    close(solveN(vp, A, i, tipo, 4, 'vp'), n, 1e-6);
    close(solveRate(vp, A, n, tipo, 4, 'vp'), i, 1e-8);
  }
  for (const tipo of ['vencida', 'anticipada']) {
    const vf = A * fvFactor(i, n, tipo);
    close(solveN(vf, A, i, tipo, 0, 'vf'), n, 1e-6);
    close(solveRate(vf, A, n, tipo, 0, 'vf'), i, 1e-8);
  }
});

/* ---------- amortización ---------- */

test('amortización con cuota fija: 10.000 al 1% por 12 meses', () => {
  const { rows, cuota0 } = schedule({ P: 10000, i: 0.01, n: 12 });
  close(cuota0, 888.4879, 1e-3);
  assert.equal(rows.length, 12);
  assert.equal(rows.at(-1).fin, 0);
  close(sum(rows, 'abono'), 10000, 1e-6);
  rows.slice(0, -1).forEach((r) => close(r.cuota, cuota0, 1e-9));
});

test('cuota fija: 20.000.000 al 2% mensual en 12 cuotas = 1.891.191,93', () => {
  close(annuityPayment(20000000, 0.02, 12), 1891191.93, 0.01);
});

test('pago extraordinario reduciendo la cuota: mismo plazo, cuota menor, todo se paga', () => {
  const { rows, applied, cuota0 } = schedule({ P: 20000000, i: 0.02, n: 16, extras: [{ k: 4, monto: 3000000 }], modo: 'cuota' });
  assert.equal(rows.length, 16);
  assert.equal(rows.at(-1).fin, 0);
  assert.equal(applied.length, 1);
  close(rows[3].extra, 3000000, 1e-9);
  // hasta la cuota 4 se paga la cuota original; desde la 5 una menor y constante
  close(rows[3].cuota, cuota0, 1e-9);
  assert.ok(rows[4].cuota < cuota0);
  close(rows[4].cuota, rows[14].cuota, 1e-6);
  close(sum(rows, 'abono') + sum(rows, 'extra'), 20000000, 1e-6);
  // el saldo después del extra coincide con el saldo del plan sin extra menos el extra
  close(rows[3].fin, rows[3].ini - rows[3].abono - 3000000, 1e-6);
});

test('pago extraordinario reduciendo el tiempo: misma cuota, menos pagos, última menor', () => {
  const { rows, cuota0 } = schedule({ P: 20000000, i: 0.02, n: 16, extras: [{ k: 4, monto: 3000000 }], modo: 'plazo' });
  assert.ok(rows.length < 16);
  assert.equal(rows.at(-1).fin, 0);
  rows.slice(0, -1).forEach((r) => close(r.cuota, cuota0, 1e-9));
  assert.ok(rows.at(-1).cuota <= cuota0 + 1e-6);
  close(sum(rows, 'abono') + sum(rows, 'extra'), 20000000, 1e-6);
});

test('los pagos extraordinarios ahorran intereses en los dos modos', () => {
  const base = schedule({ P: 20000000, i: 0.02, n: 16 });
  for (const modo of ['cuota', 'plazo']) {
    const plan = schedule({ P: 20000000, i: 0.02, n: 16, extras: [{ k: 4, monto: 3000000 }, { k: 9, monto: 1000000 }], modo });
    assert.ok(sum(plan.rows, 'interes') < sum(base.rows, 'interes'));
    close(sum(plan.rows, 'abono') + sum(plan.rows, 'extra'), 20000000, 1e-6);
    assert.equal(plan.applied.length, 2);
  }
});

test('un pago extraordinario que cubre toda la deuda termina el crédito', () => {
  const { rows, applied } = schedule({ P: 5000000, i: 0.02, n: 12, extras: [{ k: 2, monto: 999999999 }], modo: 'cuota' });
  assert.equal(rows.length, 2);
  assert.equal(rows.at(-1).fin, 0);
  assert.equal(applied[0].cancela, true);
  close(sum(rows, 'abono') + sum(rows, 'extra'), 5000000, 1e-6);
});

test('un pago extraordinario posterior al fin del crédito no se aplica', () => {
  const { rows, applied } = schedule({ P: 5000000, i: 0.02, n: 12, extras: [{ k: 2, monto: 4500000 }, { k: 11, monto: 100000 }], modo: 'plazo' });
  assert.ok(rows.length < 11);
  assert.equal(applied.length, 1);
  close(sum(rows, 'abono') + sum(rows, 'extra'), 5000000, 1e-6);
});

test('tasa cero: cuotas iguales', () => {
  const { rows } = schedule({ P: 1200, i: 0, n: 12 });
  rows.forEach((r) => close(r.cuota, 100, 1e-9));
  assert.equal(rows.at(-1).fin, 0);
});

test('lectura de números', () => {
  assert.equal(parseNum('1.500.000', { money: true }), 1500000);
  assert.equal(parseNum('15.000', { money: true }), 15000);
  assert.equal(parseNum('1.250,75', { money: true }), 1250.75);
  assert.equal(parseNum('2,5'), 2.5);
  assert.equal(parseNum('0.125'), 0.125);
  assert.equal(parseNum('$ 3.000.000,50', { money: true }), 3000000.5);
  assert.ok(Number.isNaN(parseNum('abc')));
  assert.ok(Number.isNaN(parseNum('')));
});
