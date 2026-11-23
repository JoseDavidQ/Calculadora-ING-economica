import { PER, UserError, toPeriodic, toEA, fromPeriodic } from '../lib/math.js';
import { money, num, pct, pctIn } from '../lib/format.js';
import { unitOptions, rateFields, readRate, readShape } from '../lib/fields.js';
import { sup, plAdj, describeRate, periodicStep } from '../lib/explain.js';

const has = (...xs) => (v) => xs.includes(v.calc);
const solvingRate = (v) => v.calc === 'tasa';

export default {
  id: 'interes-compuesto',
  label: 'Interés compuesto',
  intro:
    'En el interés compuesto los intereses se suman al capital en cada periodo, y el siguiente periodo ya genera intereses sobre ese valor mayor. Por eso el dinero crece cada vez más rápido.',
  guide: [
    'Elija qué quiere calcular (por ejemplo, cuánto tendrá al final).',
    'Escriba el capital, la tasa y el tiempo. Si su tasa dice «capitalizable», elija «Nominal anual».',
    'Presione «Calcular resultado» y revise cada paso de la explicación.',
  ],
  fields: [
    {
      id: 'calc', kind: 'choice', label: '¿Qué desea calcular?', default: 'monto',
      options: [
        { value: 'monto', label: 'El monto final', desc: 'Cuánto tendrá al terminar (valor futuro).' },
        { value: 'capital', label: 'El capital inicial', desc: 'Cuánto debe invertir hoy (valor presente).' },
        { value: 'tasa', label: 'La tasa de interés', desc: 'Qué tasa produjo ese crecimiento.' },
        { value: 'tiempo', label: 'El tiempo', desc: 'Cuánto tarda en llegar a un monto.' },
      ],
    },
    { kind: 'heading', id: 'h1', label: 'Sus datos' },
    {
      id: 'P', kind: 'money', label: 'Capital inicial', placeholder: 'Ej. 10.000.000', gt: 0,
      hint: 'El dinero con el que empieza.', showIf: (v) => v.calc !== 'capital',
    },
    {
      id: 'F', kind: 'money', label: 'Monto final', placeholder: 'Ej. 15.000.000', gt: 0,
      hint: 'El dinero que se tiene al final.', showIf: has('capital', 'tasa', 'tiempo'),
    },
    {
      id: 't', kind: 'number', label: 'Tiempo', placeholder: 'Ej. 3', gt: 0,
      hint: 'Cuánto dura la inversión o el préstamo.', showIf: (v) => v.calc !== 'tiempo',
    },
    {
      id: 'tUnit', kind: 'select', default: 'anual', options: unitOptions,
      label: (v) => (v.calc === 'tiempo' ? '¿En qué quiere ver el tiempo?' : '¿El tiempo está en…?'),
    },
    ...rateFields('r', {
      title: (v) => (solvingRate(v) ? '¿Cómo quiere ver la tasa?' : 'Su tasa de interés'),
      solving: solvingRate,
    }),
  ],
  example: { calc: 'monto', P: '10.000.000', t: '3', tUnit: 'anual', r: '24', rTipo: 'nominal', rPer: 'mensual', rModo: 'vencida' },

  compute(v) {
    const perT = PER[v.tUnit];
    const shape = readShape(v, 'r');
    const m = shape.m;
    const perC = Object.values(PER).find((p) => p.m === m);
    const steps = [];
    const rateStep = (spec) => periodicStep(spec);

    const periodsStep = (N, years) => {
      const lines = [];
      if (perT.m !== 1) lines.push(`Años = ${num(v.t)} ${perT.nouns} ÷ ${perT.m} = ${num(years, 6)} años`);
      lines.push(`n = ${num(years, 6)} años × ${m} = ${num(N, 6)} periodos ${plAdj(perC)}`);
      return {
        title: 'Contamos los periodos de capitalización',
        text: `Los intereses se suman al capital ${perC.adv}, es decir ${m} ${m === 1 ? 'vez' : 'veces'} al año. Multiplicamos los años por ese número.`,
        formula: lines.join('<br>'),
      };
    };

    if (v.calc === 'monto' || v.calc === 'capital') {
      const spec = readRate(v, 'r');
      const ip = toPeriodic(spec);
      const years = v.t / perT.m;
      const N = years * m;
      const growth = Math.pow(1 + ip, N);
      const ea = toEA(spec);
      const factorStep = {
        title: 'Calculamos el factor de crecimiento',
        text: 'Elevamos «1 + i» al número de periodos. Muestra cuántas veces crece el dinero.',
        formula: `${sup(`(1 + ${num(ip, 8)})`, num(N, 6))} = ${num(growth, 8)}`,
      };
      if (v.calc === 'monto') {
        const F = v.P * growth;
        steps.push(
          { title: 'Escribimos la fórmula', text: 'El monto es el capital multiplicado por el factor de crecimiento.', formula: `F = P × ${sup('(1 + i)', 'n')}` },
          rateStep(spec),
          periodsStep(N, years),
          factorStep,
          { title: 'Multiplicamos por el capital', text: 'Obtenemos el monto final.', formula: `F = ${money(v.P)} × ${num(growth, 8)} = ${money(F)}` },
        );
        return {
          headline: { eyebrow: 'Interés compuesto', label: 'Monto final', value: money(F) },
          summary: `Si invierte ${money(v.P)} al ${describeRate(spec)} durante ${num(v.t)} ${perT.nouns}, al final tendrá ${money(F)}: ${money(F - v.P)} son intereses.`,
          metrics: [
            { label: 'Capital inicial', value: money(v.P) },
            { label: 'Intereses ganados', value: money(F - v.P) },
            { label: 'Tasa efectiva anual', value: pct(ea, 4) },
          ],
          bar: { title: 'Del monto final', parts: [{ label: 'Capital', value: v.P }, { label: 'Intereses', value: F - v.P }] },
          steps,
        };
      }
      const P = v.F / growth;
      steps.push(
        { title: 'Escribimos la fórmula y despejamos el capital', text: 'Partimos de F = P × (1 + i)^n y pasamos el factor a dividir.', formula: `P = F ÷ ${sup('(1 + i)', 'n')}` },
        rateStep(spec),
        periodsStep(N, years),
        factorStep,
        { title: 'Dividimos el monto entre el factor', text: 'Así traemos el dinero del futuro al día de hoy.', formula: `P = ${money(v.F)} ÷ ${num(growth, 8)} = ${money(P)}` },
      );
      return {
        headline: { eyebrow: 'Interés compuesto', label: 'Capital inicial', value: money(P) },
        summary: `Para tener ${money(v.F)} dentro de ${num(v.t)} ${perT.nouns} con una tasa del ${describeRate(spec)}, debe invertir hoy ${money(P)}.`,
        metrics: [
          { label: 'Monto final', value: money(v.F) },
          { label: 'Intereses ganados', value: money(v.F - P) },
          { label: 'Tasa efectiva anual', value: pct(ea, 4) },
        ],
        bar: { title: 'Del monto final', parts: [{ label: 'Capital', value: P }, { label: 'Intereses', value: v.F - P }] },
        steps,
      };
    }

    if (!(v.F > v.P)) throw new UserError('El monto final debe ser mayor que el capital inicial para que haya intereses.');

    if (v.calc === 'tasa') {
      const years = v.t / perT.m;
      const N = years * m;
      const ratio = v.F / v.P;
      const ip = Math.pow(ratio, 1 / N) - 1;
      const out = fromPeriodic(ip, shape.kind, m, shape.mode);
      const ea = Math.pow(1 + ip, m) - 1;
      const outName =
        shape.kind === 'nominal'
          ? `nominal anual capitalizable ${perC.adv}${shape.mode === 'anticipada' ? ' (anticipada)' : ''}`
          : `efectiva ${perC.adj}${shape.mode === 'anticipada' ? ' anticipada' : ''}`;
      steps.push(
        { title: 'Escribimos la fórmula y despejamos la tasa', text: 'De F = P × (1 + i)^n despejamos i sacando la raíz n-ésima.', formula: `i = ${sup('(F ÷ P)', '1/n')} − 1` },
        periodsStep(N, years),
        { title: 'Calculamos la tasa efectiva de cada periodo', text: 'Dividimos el monto entre el capital y sacamos la raíz.', formula: `i = ${sup(`(${money(v.F)} ÷ ${money(v.P)})`, `1/${num(N, 6)}`)} − 1 = ${sup(num(ratio, 8), `1/${num(N, 6)}`)} − 1 = ${num(ip, 8)}` },
      );
      if (shape.mode === 'anticipada') {
        steps.push({ title: 'La pasamos a tasa anticipada', text: 'Pidió ver la tasa como anticipada.', formula: `i<sub>a</sub> = i ÷ (1 + i) = ${num(ip, 8)} ÷ ${num(1 + ip, 8)} = ${num(ip / (1 + ip), 8)}` });
      }
      if (shape.kind === 'nominal') {
        const base = shape.mode === 'anticipada' ? ip / (1 + ip) : ip;
        steps.push({ title: 'La pasamos a tasa nominal anual', text: `Multiplicamos por las ${m} veces que se capitaliza al año.`, formula: `j = ${num(base, 8)} × ${m} = ${pct(out, 6)}` });
      }
      steps.push({ title: 'Escribimos el resultado como porcentaje', text: 'Multiplicamos por 100.', formula: `${pct(out, 6)} ${outName}` });
      return {
        headline: { eyebrow: 'Interés compuesto', label: `Tasa ${shape.kind === 'nominal' ? 'nominal anual' : 'efectiva ' + perC.adj}`, value: pct(out, 4) },
        summary: `Para que ${money(v.P)} lleguen a ${money(v.F)} en ${num(v.t)} ${perT.nouns}, se necesita una tasa del ${pct(out, 4)} ${outName}.`,
        metrics: [
          { label: `Efectiva de cada ${perC.noun}`, value: pct(ip, 4) },
          { label: 'Efectiva anual (EA)', value: pct(ea, 4) },
          { label: 'Intereses ganados', value: money(v.F - v.P) },
        ],
        steps,
      };
    }

    // tiempo
    const spec = readRate(v, 'r');
    const ip = toPeriodic(spec);
    if (!(ip > 0)) throw new UserError('Para calcular el tiempo, la tasa debe ser mayor que cero.');
    const N = Math.log(v.F / v.P) / Math.log(1 + ip);
    const years = N / m;
    const tOut = years * perT.m;
    steps.push(
      { title: 'Escribimos la fórmula y despejamos el tiempo', text: 'De F = P × (1 + i)^n despejamos n usando logaritmos.', formula: 'n = ln(F ÷ P) ÷ ln(1 + i)' },
      rateStep(spec),
      { title: 'Calculamos el número de periodos', text: 'Usamos logaritmos naturales (la tecla «ln» de la calculadora).', formula: `n = ln(${money(v.F)} ÷ ${money(v.P)}) ÷ ln(1 + ${num(ip, 8)}) = ${num(Math.log(v.F / v.P), 8)} ÷ ${num(Math.log(1 + ip), 8)} = ${num(N, 4)} periodos` },
      { title: `Lo pasamos a ${perT.nouns}`, text: `Dividimos entre ${m} (los periodos por año) para tener años${perT.m !== 1 ? ` y multiplicamos por ${perT.m} para verlo en ${perT.nouns}` : ''}.`, formula: `${num(N, 4)} ÷ ${m} = ${num(years, 4)} años${perT.m !== 1 ? `<br>${num(years, 4)} × ${perT.m} = ${num(tOut, 4)} ${perT.nouns}` : ''}` },
    );
    return {
      headline: { eyebrow: 'Interés compuesto', label: 'Tiempo necesario', value: `${num(tOut, 2)} ${perT.nouns}` },
      summary: `Con una tasa del ${describeRate(spec)}, ${money(v.P)} tardan ${num(tOut, 2)} ${perT.nouns} (${num(years, 2)} años) en convertirse en ${money(v.F)}.`,
      metrics: [
        { label: 'Periodos de capitalización', value: num(N, 2) },
        { label: 'Intereses ganados', value: money(v.F - v.P) },
        { label: 'Tasa efectiva anual', value: pct(toEA(spec), 4) },
      ],
      steps,
    };
  },
};
