// Matemática financiera pura (sin interfaz). Todas las tasas son fracciones: 12 % = 0.12

export class UserError extends Error {}

/** Periodos: m = veces que cabe en un año (año comercial de 360 días). */
export const PERIODS = [
  { id: 'anual', m: 1, label: 'Anual', adj: 'anual', adv: 'anualmente', noun: 'año', nouns: 'años' },
  { id: 'semestral', m: 2, label: 'Semestral', adj: 'semestral', adv: 'semestralmente', noun: 'semestre', nouns: 'semestres' },
  { id: 'cuatrimestral', m: 3, label: 'Cuatrimestral', adj: 'cuatrimestral', adv: 'cuatrimestralmente', noun: 'cuatrimestre', nouns: 'cuatrimestres' },
  { id: 'trimestral', m: 4, label: 'Trimestral', adj: 'trimestral', adv: 'trimestralmente', noun: 'trimestre', nouns: 'trimestres' },
  { id: 'bimestral', m: 6, label: 'Bimestral', adj: 'bimestral', adv: 'bimestralmente', noun: 'bimestre', nouns: 'bimestres' },
  { id: 'mensual', m: 12, label: 'Mensual', adj: 'mensual', adv: 'mensualmente', noun: 'mes', nouns: 'meses' },
  { id: 'quincenal', m: 24, label: 'Quincenal', adj: 'quincenal', adv: 'quincenalmente', noun: 'quincena', nouns: 'quincenas' },
  { id: 'diaria', m: 360, label: 'Diaria', adj: 'diaria', adv: 'diariamente', noun: 'día', nouns: 'días' },
];
export const PER = Object.fromEntries(PERIODS.map((p) => [p.id, p]));

/* ---------------- Tasas ----------------
 * spec = { r: fracción escrita, kind: 'efectiva' | 'nominal', m: periodos por año, mode: 'vencida' | 'anticipada' }
 */

/** Tasa efectiva vencida de UN periodo (el de la tasa). */
export function toPeriodic(spec) {
  const base = spec.kind === 'nominal' ? spec.r / spec.m : spec.r;
  if (spec.mode === 'anticipada') {
    if (base >= 1) throw new UserError('Una tasa anticipada por periodo debe ser menor al 100 %.');
    return base / (1 - base);
  }
  return base;
}

/** Efectiva anual equivalente. */
export const toEA = (spec) => Math.pow(1 + toPeriodic(spec), spec.m) - 1;

/** Tasa efectiva vencida de un periodo que cabe `m` veces en el año, a partir de la EA. */
export const periodicFromEA = (ea, m) => Math.pow(1 + ea, 1 / m) - 1;

/** Tasa efectiva vencida por periodo de pago `mp`, venga como venga la tasa original. */
export function ratePerPeriod(spec, mp) {
  if (spec.m === mp) return toPeriodic(spec);
  return periodicFromEA(toEA(spec), mp);
}

/** Pasa una tasa efectiva vencida por periodo (ip) a la forma pedida. Devuelve fracción. */
export function fromPeriodic(ip, kind, m, mode) {
  const base = mode === 'anticipada' ? ip / (1 + ip) : ip;
  return kind === 'nominal' ? base * m : base;
}

/* ---------------- Interés simple y compuesto ---------------- */

export const simpleInterest = (P, i, n) => P * i * n;
export const simpleAmount = (P, i, n) => P * (1 + i * n);
export const compoundAmount = (P, ip, N) => P * Math.pow(1 + ip, N);

/* ---------------- Anualidades ---------------- */

export function pvFactor(i, n, tipo, k = 0) {
  const a = i === 0 ? n : (1 - Math.pow(1 + i, -n)) / i;
  if (tipo === 'anticipada') return a * (1 + i);
  if (tipo === 'diferida') return a * Math.pow(1 + i, -k);
  return a;
}

export function fvFactor(i, n, tipo) {
  const s = i === 0 ? n : (Math.pow(1 + i, n) - 1) / i;
  return tipo === 'anticipada' ? s * (1 + i) : s;
}

/** Número de pagos (puede salir con decimales). kind: 'vp' | 'vf'. */
export function solveN(target, A, i, tipo, k, kind) {
  if (i === 0) return target / A;
  if (kind === 'vp') {
    const Ae = tipo === 'anticipada' ? A * (1 + i) : tipo === 'diferida' ? A * Math.pow(1 + i, -k) : A;
    const x = 1 - (target * i) / Ae;
    if (x <= 0) throw new UserError('Con esa cuota y esa tasa nunca se alcanza a pagar ese valor presente: la cuota es menor que los intereses.');
    return -Math.log(x) / Math.log(1 + i);
  }
  const Ae = tipo === 'anticipada' ? A * (1 + i) : A;
  return Math.log(1 + (target * i) / Ae) / Math.log(1 + i);
}

/** Tasa efectiva por periodo de pago que cumple el factor. Método de bisección. */
export function solveRate(target, A, n, tipo, k, kind) {
  const ratio = target / A;
  const f = (i) => (kind === 'vp' ? pvFactor(i, n, tipo, k) : fvFactor(i, n, tipo)) - ratio;
  if (Math.abs(ratio - n) < 1e-9) return 0;
  if (kind === 'vp' && ratio > n) throw new UserError('El valor presente no puede ser mayor que la suma de todas las cuotas con una tasa positiva. Revise los datos.');
  if (kind === 'vf' && ratio < n) throw new UserError('El valor futuro no puede ser menor que la suma de todas las cuotas con una tasa positiva. Revise los datos.');
  let lo = 1e-12;
  let hi = 50;
  if (f(lo) * f(hi) > 0) throw new UserError('No se pudo encontrar la tasa con esos datos. Revise los valores.');
  for (let it = 0; it < 300; it++) {
    const mid = (lo + hi) / 2;
    if (f(lo) * f(mid) <= 0) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
}

/* ---------------- Amortización (cuota fija) ---------------- */

/** Cuota fija que paga un préstamo P en n cuotas con tasa i por periodo. */
export const annuityPayment = (P, i, n) => (i === 0 ? P / n : (P * i) / (1 - Math.pow(1 + i, -n)));

const EPS = 0.005; // media centavo

/**
 * Tabla de amortización con cuota fija y pagos extraordinarios opcionales.
 *
 * extras: [{ k, monto }]  -> pago adicional hecho junto con la cuota número k (1 a n-1).
 *   Todo el pago extraordinario va a capital.
 * modo: 'cuota'  -> después de cada pago extraordinario se recalcula una cuota menor
 *                   para las cuotas que faltan (el plazo no cambia).
 *       'plazo'  -> la cuota se mantiene y la deuda termina antes (la última cuota es menor).
 *
 * Devuelve { rows, cuota0, applied } donde applied lista los pagos extraordinarios que sí se usaron.
 */
export function schedule({ P, i, n, extras = [], modo = 'cuota' }) {
  const cuota0 = annuityPayment(P, i, n);
  const extraAt = new Map(extras.map((e) => [e.k, e.monto]));
  const rows = [];
  const applied = [];
  let saldo = P;
  let cuota = cuota0;
  for (let k = 1; k <= n && saldo > EPS; k++) {
    const interes = saldo * i;
    const ultima = k === n || saldo + interes <= cuota + EPS;
    const pago = ultima ? saldo + interes : cuota;
    const abono = pago - interes;
    let fin = ultima ? 0 : saldo - abono;
    let extra = 0;
    if (!ultima && extraAt.has(k)) {
      extra = Math.min(extraAt.get(k), fin);
      fin -= extra;
      let cancela = false;
      if (fin <= EPS) {
        extra += fin; // lo que sobra de centavos se absorbe en el pago extraordinario
        fin = 0;
        cancela = true;
      }
      applied.push({ k, monto: extra, cancela });
    }
    rows.push({ k, ini: saldo, cuota: pago, interes, abono, extra, fin });
    saldo = fin;
    if (extra > 0 && modo === 'cuota' && saldo > EPS) cuota = annuityPayment(saldo, i, n - k);
  }
  return { rows, cuota0, applied };
}
