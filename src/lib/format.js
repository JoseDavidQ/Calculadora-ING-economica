// Formato y lectura de números al estilo colombiano: 1.234.567,89

const make = (min, max) =>
  new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: min,
    maximumFractionDigits: max,
    useGrouping: 'always',
  });

const f2 = make(2, 2);
const f0 = make(0, 0);
const cache = {};
const fmtr = (min, max) => (cache[min + '-' + max] ??= make(min, max));

/** $1.234,56 */
export const money = (x) => (x < 0 ? '-' : '') + '$' + f2.format(Math.abs(x));

/** 1.234,56 (dinero sin el signo $, para tablas). */
export const plain = (x) => (x < 0 ? '-' : '') + f2.format(Math.abs(x));

/** Número con hasta `max` decimales, sin ceros sobrantes. */
export const num = (x, max = 6) => fmtr(0, max).format(x);

/** Número entero con separador de miles. */
export const int = (x) => f0.format(x);

/** Fracción -> porcentaje (0.1268 -> "12,68 %"). */
export const pct = (frac, d = 4) => fmtr(Math.min(2, d), d).format(frac * 100) + ' %';

/** Porcentaje ya escrito por el usuario (12.5 -> "12,5 %"). */
export const pctIn = (p) => fmtr(0, 6).format(p) + ' %';

/**
 * Lee lo que escribe la persona. Acepta coma o punto decimal.
 * En campos de dinero, "15.000" se entiende como quince mil.
 */
export function parseNum(raw, { money: isMoney = false } = {}) {
  if (raw == null) return NaN;
  let s = String(raw).trim().replace(/[\s$% ]/g, '');
  if (!s) return NaN;
  const c = s.lastIndexOf(',');
  const d = s.lastIndexOf('.');
  if (c > -1 && d > -1) {
    s = c > d ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (c > -1) {
    s = (s.match(/,/g).length > 1) ? s.replace(/,/g, '') : s.replace(',', '.');
  } else if (d > -1) {
    const dots = s.match(/\./g).length;
    const afterLast = s.length - d - 1;
    if (dots > 1 || (isMoney && afterLast === 3)) s = s.replace(/\./g, '');
  }
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(s)) return NaN;
  return parseFloat(s);
}

/** Formato "bonito" para mostrar dentro de la casilla de dinero al salir de ella. */
export const moneyInput = (x) => fmtr(0, 2).format(x);

export const esc = (s) =>
  String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
