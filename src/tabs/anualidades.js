import {
  PER, UserError, ratePerPeriod, pvFactor, fvFactor, solveN, solveRate,
} from '../lib/math.js';
import { money, num, pct, int } from '../lib/format.js';
import { periodOptions, rateFields, readRate } from '../lib/fields.js';
import { sup, plAdj, describeRate, ratePerPeriodSteps } from '../lib/explain.js';

const isPerp = (v) => v.tipo === 'perpetua';
const needsTarget = (v) => ['cuota', 'n', 'i'].includes(v.calc);
const needsVP = (v) => needsTarget(v) && (isPerp(v) || v.base === 'vp');
const needsVF = (v) => needsTarget(v) && !isPerp(v) && v.base === 'vf';

const TIPO_NAME = {
  vencida: 'vencida',
  anticipada: 'anticipada',
  diferida: 'diferida',
  perpetua: 'perpetua',
};

export default {
  id: 'anualidades',
  label: 'Anualidades',
  intro:
    'Una anualidad es una serie de pagos iguales hechos cada cierto tiempo: cuotas de un crédito, un ahorro mensual, una pensión. Aquí puede calcular su valor presente, su valor futuro, la cuota, el número de pagos o la tasa.',
  guide: [
    'Elija el tipo de anualidad (vencida, anticipada, diferida o perpetua) y qué desea calcular.',
    'Escriba los datos que se piden. Si la tasa y los pagos tienen periodos distintos (anualidad general), el programa los iguala solo.',
    'Presione «Calcular resultado» y siga el paso a paso.',
  ],
  fields: [
    {
      id: 'tipo', kind: 'choice', label: '¿Qué tipo de anualidad es?', default: 'vencida',
      options: [
        { value: 'vencida', label: 'Vencida (ordinaria)', desc: 'Cada pago se hace al final del periodo. Es lo más común.' },
        { value: 'anticipada', label: 'Anticipada', desc: 'Cada pago se hace al comienzo del periodo.' },
        { value: 'diferida', label: 'Diferida', desc: 'Los pagos empiezan después de unos periodos de gracia, en los que no se paga.' },
        { value: 'perpetua', label: 'Perpetua', desc: 'Los pagos nunca se terminan.' },
      ],
    },
    {
      id: 'calc', kind: 'choice', label: '¿Qué desea calcular?', default: 'vp',
      options: [
        { value: 'vp', label: 'Valor presente', desc: 'Cuánto vale hoy toda la serie de pagos.' },
        { value: 'vf', label: 'Valor futuro', desc: 'Cuánto se acumula al final.', visible: (v) => !isPerp(v) },
        { value: 'cuota', label: 'El valor de la cuota', desc: 'Cuánto vale cada pago.' },
        { value: 'n', label: 'El número de pagos', desc: 'Cuántas cuotas se necesitan.', visible: (v) => !isPerp(v) },
        { value: 'i', label: 'La tasa de interés', desc: 'Qué tasa tiene la operación.' },
      ],
    },
    { kind: 'heading', id: 'h1', label: 'Sus datos' },
    {
      id: 'base', kind: 'choice', label: '¿Con qué dato lo calculamos?', default: 'vp',
      options: [
        { value: 'vp', label: 'Con el valor presente', desc: 'Lo que vale hoy.' },
        { value: 'vf', label: 'Con el valor futuro', desc: 'Lo que se acumula al final.' },
      ],
      showIf: (v) => needsTarget(v) && !isPerp(v),
    },
    { id: 'VP', kind: 'money', label: 'Valor presente', placeholder: 'Ej. 20.000.000', gt: 0, hint: 'Lo que vale hoy la serie de pagos (por ejemplo, el préstamo).', showIf: needsVP },
    { id: 'VF', kind: 'money', label: 'Valor futuro', placeholder: 'Ej. 30.000.000', gt: 0, hint: 'Lo que se tiene acumulado al final.', showIf: needsVF },
    { id: 'A', kind: 'money', label: 'Valor de cada cuota', placeholder: 'Ej. 500.000', gt: 0, hint: 'El pago que se repite en cada periodo.', showIf: (v) => v.calc !== 'cuota' },
    { id: 'n', kind: 'int', label: 'Número de pagos', placeholder: 'Ej. 24', min: 1, hint: 'Cuántas cuotas son en total.', showIf: (v) => v.calc !== 'n' && !isPerp(v) },
    { id: 'k', kind: 'int', label: 'Periodos de gracia', placeholder: 'Ej. 6', min: 1, hint: 'Cuántos periodos pasan antes del primer pago.', showIf: (v) => v.tipo === 'diferida' },
    { id: 'freq', kind: 'select', label: '¿Cada cuánto se hace el pago?', default: 'mensual', options: periodOptions },
    ...rateFields('t', { showIf: (v) => v.calc !== 'i' }),
  ],
  example: { tipo: 'vencida', calc: 'vp', A: '500.000', n: '24', freq: 'mensual', t: '24', tTipo: 'nominal', tPer: 'mensual', tModo: 'vencida' },

  compute(v) {
    const per = PER[v.freq];
    const tipo = v.tipo;
    const k = tipo === 'diferida' ? v.k : 0;
    const base = isPerp(v) ? 'vp' : v.base;
    const steps = [];

    // ----- tasa efectiva por periodo de pago
    let i;
    let spec = null;
    if (v.calc !== 'i') {
      spec = readRate(v, 't');
      i = ratePerPeriod(spec, per.m);
    }
    const target = base === 'vp' ? v.VP : v.VF;
    let A = v.A;
    let n = v.n;
    let VP;
    let VF;

    // ----- cálculo
    if (isPerp(v)) {
      if (v.calc === 'vp') {
        if (!(i > 0)) throw new UserError('En una perpetuidad la tasa debe ser mayor que cero.');
        VP = A / i;
      } else if (v.calc === 'cuota') {
        A = v.VP * i;
        VP = v.VP;
      } else {
        i = A / v.VP;
        VP = v.VP;
      }
    } else if (v.calc === 'vp') {
      VP = A * pvFactor(i, n, tipo, k);
    } else if (v.calc === 'vf') {
      VF = A * fvFactor(i, n, tipo);
    } else if (v.calc === 'cuota') {
      A = target / (base === 'vp' ? pvFactor(i, n, tipo, k) : fvFactor(i, n, tipo));
    } else if (v.calc === 'n') {
      n = solveN(target, A, i, tipo, k, base);
    } else {
      i = solveRate(target, A, n, tipo, k, base);
    }
    if (!isPerp(v)) {
      VP = VP ?? A * pvFactor(i, n, tipo, k);
      VF = VF ?? A * fvFactor(i, n, tipo);
    }
    const nShow = v.calc === 'n' ? Math.ceil(n - 1e-9) : n;

    // ----- paso 1: tipo
    const tipoText = {
      vencida: 'Es una anualidad vencida: cada pago se hace al final del periodo.',
      anticipada: 'Es una anualidad anticipada: cada pago se hace al comienzo del periodo, por eso gana un periodo más de interés.',
      diferida: `Es una anualidad diferida: durante los primeros ${k || 'k'} periodos no se paga nada (periodos de gracia) y luego empiezan los pagos.`,
      perpetua: 'Es una perpetuidad: los pagos se repiten para siempre, por eso solo existe valor presente.',
    }[tipo];
    const general = spec && spec.m !== per.m;
    steps.push({
      title: 'Identificamos el tipo de anualidad',
      text: tipoText + (general ? ' Además, la tasa y los pagos están en periodos distintos: es una anualidad general, y la tasa se debe igualar al periodo de pago.' : ''),
    });

    if (spec) steps.push(...ratePerPeriodSteps(spec, per.m));

    // ----- fórmula
    const A_ = (x) => num(x, 8);
    const aStr = (ii, nn) => `[1 − ${sup(`(1 + ${A_(ii)})`, `−${num(nn, 4)}`)}] ÷ ${A_(ii)}`;
    const sStr = (ii, nn) => `[${sup(`(1 + ${A_(ii)})`, num(nn, 4))} − 1] ÷ ${A_(ii)}`;
    const extraPV = (ii) => (tipo === 'anticipada' ? ` × (1 + ${A_(ii)})` : tipo === 'diferida' ? ` × ${sup(`(1 + ${A_(ii)})`, `−${k}`)}` : '');
    const extraFV = (ii) => (tipo === 'anticipada' ? ` × (1 + ${A_(ii)})` : '');
    const fPVsym = `[1 − ${sup('(1 + i)', '−n')}] ÷ i` + (tipo === 'anticipada' ? ' × (1 + i)' : tipo === 'diferida' ? ` × ${sup('(1 + i)', '−k')}` : '');
    const fFVsym = `[${sup('(1 + i)', 'n')} − 1] ÷ i` + (tipo === 'anticipada' ? ' × (1 + i)' : '');
    const fFVnote = tipo === 'diferida' ? ' (los periodos de gracia no cambian el valor futuro, porque en ellos no hay pagos)' : '';
    const kNote = tipo === 'diferida' ? ` En la fórmula, k = ${k} es el número de periodos de gracia.` : '';
    const gracia = tipo === 'diferida' ? `, que empiezan después de ${k} ${k === 1 ? 'periodo' : 'periodos'} de gracia` : '';

    let headline;
    let summary;
    const metrics = [];
    let bar = null;
    const freqTxt = per.adj;

    if (isPerp(v)) {
      steps.push({ title: 'Escribimos la fórmula', text: 'En una perpetuidad el valor presente es la cuota dividida entre la tasa de cada periodo.', formula: v.calc === 'vp' ? 'VP = A ÷ i' : v.calc === 'cuota' ? 'A = VP × i' : 'i = A ÷ VP' });
      if (v.calc === 'vp') {
        steps.push({ title: 'Calculamos el valor presente', text: 'Reemplazamos y dividimos.', formula: `VP = ${money(A)} ÷ ${A_(i)} = ${money(VP)}` });
        headline = { eyebrow: 'Anualidad perpetua', label: 'Valor presente', value: money(VP) };
        summary = `Para recibir ${money(A)} ${freqTxt === 'anual' ? 'cada año' : 'cada ' + per.noun} para siempre, con una tasa de ${pct(i, 4)} efectiva por ${per.noun}, hoy se necesitan ${money(VP)}.`;
      } else if (v.calc === 'cuota') {
        steps.push({ title: 'Calculamos la cuota', text: 'Multiplicamos el valor presente por la tasa.', formula: `A = ${money(VP)} × ${A_(i)} = ${money(A)}` });
        headline = { eyebrow: 'Anualidad perpetua', label: `Cuota por ${per.noun}`, value: money(A) };
        summary = `Con ${money(VP)} y una tasa de ${pct(i, 4)} por ${per.noun}, puede recibir ${money(A)} cada ${per.noun} para siempre.`;
      } else {
        steps.push({ title: 'Calculamos la tasa', text: 'Dividimos la cuota entre el valor presente.', formula: `i = ${money(A)} ÷ ${money(VP)} = ${A_(i)} = ${pct(i, 6)}` });
        headline = { eyebrow: 'Anualidad perpetua', label: `Tasa efectiva por ${per.noun}`, value: pct(i, 4) };
        summary = `Si ${money(VP)} generan ${money(A)} cada ${per.noun} para siempre, la tasa es del ${pct(i, 4)} efectiva por ${per.noun}.`;
      }
      metrics.push({ label: `Cuota por ${per.noun}`, value: money(A) }, { label: 'Valor presente', value: money(VP) }, { label: `Tasa efectiva por ${per.noun}`, value: pct(i, 4) });
    } else if (v.calc === 'vp') {
      steps.push(
        { title: 'Escribimos la fórmula del valor presente', text: 'Cada cuota se trae al día de hoy y se suman todas.' + kNote, formula: `VP = A × ${fPVsym}` },
        { title: 'Calculamos el factor', text: 'Es el número por el que se multiplica la cuota.', formula: `factor = ${aStr(i, n)}${extraPV(i)} = ${num(pvFactor(i, n, tipo, k), 8)}` },
        { title: 'Multiplicamos por la cuota', text: 'Obtenemos el valor presente.', formula: `VP = ${money(A)} × ${num(pvFactor(i, n, tipo, k), 8)} = ${money(VP)}` },
      );
      headline = { eyebrow: `Anualidad ${TIPO_NAME[tipo]}`, label: 'Valor presente', value: money(VP) };
      summary = `Recibir o pagar ${n} cuotas ${plAdj(per)} de ${money(A)}${gracia ? gracia + ',' : ''} equivale hoy a ${money(VP)}.`;
    } else if (v.calc === 'vf') {
      steps.push(
        { title: 'Escribimos la fórmula del valor futuro', text: `Cada cuota se lleva hasta el final y se suman todas${fFVnote}.`, formula: `VF = A × ${fFVsym}` },
        { title: 'Calculamos el factor', text: 'Es el número por el que se multiplica la cuota.', formula: `factor = ${sStr(i, n)}${extraFV(i)} = ${num(fvFactor(i, n, tipo), 8)}` },
        { title: 'Multiplicamos por la cuota', text: 'Obtenemos el valor futuro.', formula: `VF = ${money(A)} × ${num(fvFactor(i, n, tipo), 8)} = ${money(VF)}` },
      );
      headline = { eyebrow: `Anualidad ${TIPO_NAME[tipo]}`, label: 'Valor futuro', value: money(VF) };
      summary = `Si hace ${n} pagos ${plAdj(per)} de ${money(A)}, al final habrá acumulado ${money(VF)}.`;
    } else if (v.calc === 'cuota') {
      const f = base === 'vp' ? pvFactor(i, n, tipo, k) : fvFactor(i, n, tipo);
      steps.push(
        { title: 'Escribimos la fórmula y despejamos la cuota', text: `Partimos de la fórmula del valor ${base === 'vp' ? 'presente' : 'futuro'} y pasamos el factor a dividir${base === 'vf' ? fFVnote : ''}.${base === 'vp' ? kNote : ''}`, formula: base === 'vp' ? `A = VP ÷ {${fPVsym}}` : `A = VF ÷ {${fFVsym}}` },
        { title: 'Calculamos el factor', text: 'Es el mismo factor de siempre.', formula: `factor = ${base === 'vp' ? aStr(i, n) + extraPV(i) : sStr(i, n) + extraFV(i)} = ${num(f, 8)}` },
        { title: 'Dividimos', text: 'Obtenemos el valor de cada cuota.', formula: `A = ${money(target)} ÷ ${num(f, 8)} = ${money(A)}` },
      );
      headline = { eyebrow: `Anualidad ${TIPO_NAME[tipo]}`, label: `Cuota por ${per.noun}`, value: money(A) };
      summary = `Para ${base === 'vp' ? `pagar ${money(target)} hoy` : `reunir ${money(target)}`} en ${n} pagos ${plAdj(per)}${base === 'vp' ? gracia : ''}, cada cuota debe ser de ${money(A)}.`;
    } else if (v.calc === 'n') {
      const Ae = base === 'vp' ? (tipo === 'anticipada' ? A * (1 + i) : tipo === 'diferida' ? A * Math.pow(1 + i, -k) : A) : tipo === 'anticipada' ? A * (1 + i) : A;
      const needsAe = Ae !== A;
      steps.push({
        title: 'Escribimos la fórmula y despejamos n',
        text: 'Con logaritmos se puede sacar el número de pagos.' + (needsAe ? ' Aquí A′ es la cuota ajustada por el tipo de anualidad.' : '') + (base === 'vp' ? kNote : ''),
        formula: (base === 'vp' ? 'n = −ln[1 − VP × i ÷ A′] ÷ ln(1 + i)' : 'n = ln[1 + VF × i ÷ A′] ÷ ln(1 + i)') + (needsAe ? `<br>A′ = ${tipo === 'anticipada' ? 'A × (1 + i)' : 'A × (1 + i)<sup>−k</sup>'}` : ''),
      });
      if (needsAe) steps.push({ title: 'Ajustamos la cuota', text: 'Calculamos A′ con la tasa del periodo.', formula: `A′ = ${money(A)} × ${tipo === 'anticipada' ? `(1 + ${A_(i)})` : sup(`(1 + ${A_(i)})`, `−${k}`)} = ${money(Ae)}` });
      steps.push({
        title: 'Calculamos n',
        text: 'Reemplazamos y usamos la tecla «ln» de la calculadora.',
        formula: base === 'vp'
          ? `n = −ln[1 − ${money(target)} × ${A_(i)} ÷ ${money(Ae)}] ÷ ln(1 + ${A_(i)}) = ${num(n, 4)} pagos`
          : `n = ln[1 + ${money(target)} × ${A_(i)} ÷ ${money(Ae)}] ÷ ln(1 + ${A_(i)}) = ${num(n, 4)} pagos`,
      });
      if (Math.abs(n - Math.round(n)) > 1e-6) {
        steps.push({ title: 'Redondeamos', text: 'No se pueden hacer fracciones de pago, así que se necesitan pagos completos. El último pago sería un poco menor o mayor para ajustar.', formula: `n ≈ ${num(n, 4)} → ${nShow} pagos` });
      }
      headline = { eyebrow: `Anualidad ${TIPO_NAME[tipo]}`, label: 'Número de pagos', value: `${num(n, 2)} pagos` };
      summary = `Con cuotas de ${money(A)} ${plAdj(per)} se necesitan ${num(n, 2)} pagos (${nShow} completos) para ${base === 'vp' ? `pagar ${money(target)}` : `reunir ${money(target)}`}.`;
    } else {
      steps.push(
        { title: 'La tasa no se despeja con una fórmula', text: 'No existe una fórmula directa para la tasa. El programa prueba tasas cada vez más cercanas (método de bisección) hasta que el resultado coincida con sus datos.' + (base === 'vp' ? kNote : ''), formula: base === 'vp' ? `${money(target)} = ${money(A)} × ${fPVsym}` : `${money(target)} = ${money(A)} × ${fFVsym}` },
        { title: 'Tasa encontrada', text: `Es la tasa efectiva de cada ${per.noun}.`, formula: `i = ${A_(i)} = ${pct(i, 6)}` },
        { title: 'La llevamos a otras formas', text: 'Para compararla con otras tasas la pasamos a efectiva anual y a nominal anual.', formula: `EA = ${sup(`(1 + ${A_(i)})`, per.m)} − 1 = ${pct(Math.pow(1 + i, per.m) - 1, 6)}<br>j = ${A_(i)} × ${per.m} = ${pct(i * per.m, 6)} nominal anual` },
      );
      headline = { eyebrow: `Anualidad ${TIPO_NAME[tipo]}`, label: `Tasa efectiva por ${per.noun}`, value: pct(i, 4) };
      summary = `Con esos datos la tasa es del ${pct(i, 4)} efectiva por ${per.noun}, equivalente a ${pct(Math.pow(1 + i, per.m) - 1, 4)} efectiva anual.`;
    }

    if (!isPerp(v)) {
      const total = A * n;
      metrics.push({ label: `Cuota por ${per.noun}`, value: money(A) }, { label: 'Número de pagos', value: v.calc === 'n' ? num(n, 2) : int(n) });
      if (v.calc === 'vf' || (v.calc !== 'vp' && base === 'vf')) {
        metrics.push({ label: 'Valor futuro', value: money(VF) }, { label: 'Total de cuotas pagadas', value: money(total) }, { label: 'Intereses ganados', value: money(VF - total) });
        bar = { title: 'Del valor futuro', parts: [{ label: 'Lo que usted aporta', value: total }, { label: 'Intereses', value: Math.max(0, VF - total) }] };
      } else {
        metrics.push({ label: 'Valor presente', value: money(VP) }, { label: 'Total de cuotas', value: money(total) }, { label: 'Intereses incluidos', value: money(total - VP) });
        bar = { title: 'De la suma de todas las cuotas', parts: [{ label: 'Valor presente', value: VP }, { label: 'Intereses', value: Math.max(0, total - VP) }] };
      }
      if (spec) metrics.push({ label: `Efectiva por ${per.noun}`, value: pct(i, 4) });
      else metrics.push({ label: 'Efectiva anual (EA)', value: pct(Math.pow(1 + i, per.m) - 1, 4) });
    }

    return { headline, summary, metrics, bar, steps };
  },
};
