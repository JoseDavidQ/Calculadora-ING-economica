// Textos del paso a paso que se repiten en varias pestañas.
import { PER, toPeriodic, toEA, periodicFromEA } from './math.js';
import { pct, num } from './format.js';

export const sup = (b, e) => `${b}<sup>${e}</sup>`;

/** Plural del adjetivo de un periodo: mensual -> mensuales, diaria -> diarias. */
export const plAdj = (p) => (p.adj.endsWith('a') ? p.adj + 's' : p.adj + 'es');

/** "24 % nominal anual capitalizable mensualmente", "2 % efectiva mensual"... */
export function describeRate(spec) {
  const per = Object.values(PER).find((p) => p.m === spec.m);
  const v = pct(spec.r, 4).replace(',00 %', ' %');
  const ant = spec.mode === 'anticipada';
  if (spec.kind === 'nominal') {
    return `${v} nominal anual capitalizable ${per.adv}${ant ? ' con intereses anticipados' : ''}`;
  }
  return `${v} efectiva ${per.adj}${ant ? ' anticipada' : ''}`;
}

/** Cómo se llega a la tasa efectiva vencida de UN periodo de la tasa. */
export function periodicStep(spec) {
  const per = Object.values(PER).find((p) => p.m === spec.m);
  const ip = toPeriodic(spec);
  const lines = [];
  let text;
  if (spec.kind === 'nominal') {
    const base = spec.r / spec.m;
    lines.push(`${spec.mode === 'anticipada' ? 'i<sub>a</sub>' : 'i'} = j ÷ m = ${num(spec.r, 6)} ÷ ${spec.m} = ${num(base, 8)}`);
    text = `Una tasa nominal se reparte entre las ${spec.m} veces que se capitaliza en el año (m = ${spec.m}). Eso da la tasa efectiva de cada ${per.noun}.`;
  } else {
    lines.push(`${spec.mode === 'anticipada' ? 'i<sub>a</sub>' : 'i'} = ${pct(spec.r, 4)} = ${num(spec.r, 8)}`);
    text = `La tasa ya viene como efectiva de cada ${per.noun}, así que solo la pasamos a número decimal (dividiendo entre 100).`;
  }
  if (spec.mode === 'anticipada') {
    const base = spec.kind === 'nominal' ? spec.r / spec.m : spec.r;
    lines.push(`i = i<sub>a</sub> ÷ (1 − i<sub>a</sub>) = ${num(base, 8)} ÷ (1 − ${num(base, 8)}) = ${num(ip, 8)}`);
    text += ' Como los intereses son anticipados, la llevamos a su equivalente vencida.';
  }
  return {
    title: `Hallamos la tasa efectiva de cada ${per.noun}`,
    text,
    formula: lines.join('<br>'),
  };
}

/**
 * Pasos para llegar a la tasa efectiva por periodo de pago `mp`.
 * Si la tasa viene en otro periodo (anualidad general), se pasa por la efectiva anual.
 */
export function ratePerPeriodSteps(spec, mp) {
  const own = periodicStep(spec);
  if (spec.m === mp) return [own];
  const per = Object.values(PER).find((p) => p.m === mp);
  const ip = toPeriodic(spec);
  const ea = toEA(spec);
  const out = periodicFromEA(ea, mp);
  return [
    own,
    {
      title: 'Llevamos la tasa a efectiva anual (EA)',
      text: 'Los pagos y la tasa no están en el mismo periodo, así que usamos la efectiva anual como puente para igualarlos.',
      formula: `EA = ${sup(`(1 + i)`, spec.m)} − 1 = ${sup(`(1 + ${num(ip, 8)})`, spec.m)} − 1 = ${pct(ea, 6)}`,
    },
    {
      title: `Convertimos la EA a tasa efectiva de cada ${per.noun}`,
      text: `Ahora sacamos la tasa que corresponde exactamente a un periodo ${per.adj} de pago.`,
      formula: `i = ${sup('(1 + EA)', `1/${mp}`)} − 1 = ${sup(`(1 + ${num(ea, 8)})`, `1/${mp}`)} − 1 = ${num(out, 8)}`,
    },
  ];
}
