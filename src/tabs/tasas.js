import { PER, toPeriodic, toEA, periodicFromEA, fromPeriodic } from '../lib/math.js';
import { num, pct } from '../lib/format.js';
import { rateFields, readRate, readShape } from '../lib/fields.js';
import { sup, describeRate, periodicStep } from '../lib/explain.js';

const perOf = (m) => Object.values(PER).find((p) => p.m === m);

export default {
  id: 'tasas',
  label: 'Tasas de conversión',
  intro:
    'Una misma tasa se puede escribir de muchas formas: efectiva o nominal, vencida o anticipada, anual o mensual. Aquí las convertimos entre sí. Todas pasan por la efectiva anual (EA), que es la que permite compararlas.',
  guide: [
    'En «La tasa que conoce» escriba el porcentaje y diga cómo viene expresada.',
    'En «Convertir a» elija cómo quiere verla.',
    'Presione «Calcular resultado». Verá cada conversión paso a paso.',
  ],
  fields: [
    ...rateFields('o', { title: 'La tasa que conoce' }),
    { kind: 'heading', id: 'hd', label: 'Convertir a…' },
    ...rateFields('d', {
      value: false,
      title: null,
      periodLabel: (v) => (v.dTipo === 'nominal' ? '¿Cada cuánto se capitaliza?' : '¿De qué periodo la quiere?'),
    }),
  ],
  example: { o: '24', oTipo: 'nominal', oPer: 'mensual', oModo: 'vencida', dTipo: 'efectiva', dPer: 'anual', dModo: 'vencida' },

  compute(v) {
    const o = readRate(v, 'o');
    const d = readShape(v, 'd');
    const perO = perOf(o.m);
    const perD = perOf(d.m);
    const ipO = toPeriodic(o);
    const ea = toEA(o);
    const ipD = periodicFromEA(ea, d.m);
    const out = fromPeriodic(ipD, d.kind, d.m, d.mode);

    const target = describeRate({ r: out, ...d });
    const steps = [
      {
        title: 'Partimos de la tasa que usted conoce',
        text: 'Esta es la tasa de origen, tal como la escribió.',
        formula: describeRate(o),
      },
      periodicStep(o),
      {
        title: 'La llevamos a efectiva anual (EA)',
        text: 'La EA es el punto de encuentro: dos tasas son equivalentes si tienen la misma EA.',
        formula: `EA = ${sup('(1 + i)', o.m)} − 1 = ${sup(`(1 + ${num(ipO, 8)})`, o.m)} − 1 = ${pct(ea, 6)}`,
      },
      {
        title: `Hallamos la tasa efectiva de cada ${perD.noun}`,
        text: `Hacemos el camino inverso: de la EA a la tasa efectiva vencida de un periodo ${perD.adj}.`,
        formula: `i = ${sup('(1 + EA)', `1/${d.m}`)} − 1 = ${sup(`(1 + ${num(ea, 8)})`, `1/${d.m}`)} − 1 = ${num(ipD, 8)}`,
      },
    ];
    let ia = ipD;
    if (d.mode === 'anticipada') {
      ia = ipD / (1 + ipD);
      steps.push({
        title: 'La pasamos a anticipada',
        text: 'Como la quiere anticipada, restamos lo que se cobra por adelantado.',
        formula: `i<sub>a</sub> = i ÷ (1 + i) = ${num(ipD, 8)} ÷ (1 + ${num(ipD, 8)}) = ${num(ia, 8)}`,
      });
    }
    if (d.kind === 'nominal') {
      steps.push({
        title: 'La pasamos a nominal anual',
        text: `Multiplicamos por las ${d.m} veces que se capitaliza en el año.`,
        formula: `j = ${num(ia, 8)} × ${d.m} = ${num(out, 8)}`,
      });
    }
    steps.push({
      title: 'Escribimos el resultado como porcentaje',
      text: 'Multiplicamos por 100.',
      formula: `${pct(out, 6)} → ${target}`,
    });

    const small = Math.abs(out - o.r) < 1e-12 && o.kind === d.kind && o.m === d.m && o.mode === d.mode;
    return {
      headline: { eyebrow: 'Tasa convertida', label: d.kind === 'nominal' ? `Nominal anual, ${perD.adv}${d.mode === 'anticipada' ? ' anticipada' : ''}` : `Efectiva ${perD.adj}${d.mode === 'anticipada' ? ' anticipada' : ''}`, value: pct(out, 4) },
      summary: small
        ? 'Eligió la misma forma de origen y de destino, por eso la tasa no cambia.'
        : `${describeRate(o)} es equivalente a ${target}. Las dos producen exactamente el mismo rendimiento en un año.`,
      metrics: [
        { label: 'Efectiva anual (EA)', value: pct(ea, 4) },
        { label: `Efectiva vencida de cada ${perD.noun}`, value: pct(ipD, 4) },
        { label: 'Tasa de origen', value: pct(o.r, 4) },
      ],
      steps,
    };
  },
};
