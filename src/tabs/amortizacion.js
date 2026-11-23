import { PER, UserError, ratePerPeriod, schedule, annuityPayment } from '../lib/math.js';
import { money, num, pct, int } from '../lib/format.js';
import { periodOptions, rateFields, readRate } from '../lib/fields.js';
import { sup, plAdj, ratePerPeriodSteps, describeRate } from '../lib/explain.js';

const MAX_EXTRAS = 6;
const hay = (v) => v.hayExtra === 'si';
/** El bloque k se ve si hay pagos extraordinarios y la persona dijo «Sí, hay otra» en el bloque anterior. */
const visible = (k) => (v) => hay(v) && (k === 1 || v[`xMas${k - 1}`] === 'si');

function typedExtras(v) {
  const list = [];
  if (!hay(v)) return list;
  for (let k = 1; k <= MAX_EXTRAS; k++) {
    if (!visible(k)(v)) break;
    list.push({ k: v[`xN${k}`], monto: v[`xV${k}`] });
  }
  return list;
}

const extraFields = [];
for (let k = 1; k <= MAX_EXTRAS; k++) {
  const show = visible(k);
  extraFields.push(
    { kind: 'heading', id: `xH${k}`, label: `Pago extraordinario ${k}`, showIf: show },
    {
      id: `xN${k}`, kind: 'int', label: '¿En qué número de cuota?', placeholder: 'Ej. 4', min: 1,
      max: (v) => v.n - 1,
      maxMsg: (max, v) => (max < 1
        ? 'Con una sola cuota no hay dónde hacer un pago extraordinario.'
        : `Su préstamo tiene ${int(v.n)} cuotas: escriba un número entre 1 y ${int(max)}.`),
      hint: (v) => (v.n > 1
        ? `Su préstamo tiene ${int(v.n)} cuotas. Escriba un número de 1 a ${int(v.n - 1)}. Ej.: 4 es la cuarta cuota.`
        : 'Ej.: 4 es la cuarta cuota.'),
      showIf: show,
    },
    {
      id: `xV${k}`, kind: 'money', label: '¿De cuánto es el pago extraordinario?', placeholder: 'Ej. 3.000.000', gt: 0,
      hint: 'Es un pago adicional a la cuota normal de esa fecha. Todo se aplica a bajar la deuda.',
      showIf: show,
    },
  );
  if (k < MAX_EXTRAS) {
    extraFields.push({
      id: `xMas${k}`, kind: 'choice', cols: 2, label: '¿Hay alguna otra cuota extraordinaria?', default: 'no',
      options: [
        { value: 'no', label: 'No', desc: 'Eso es todo.' },
        { value: 'si', label: 'Sí', desc: 'Hay otra más.' },
      ],
      showIf: show,
    });
  }
}

export default {
  id: 'amortizacion',
  label: 'Amortización',
  intro:
    'Amortizar es pagar una deuda poco a poco con cuotas iguales. La tabla de amortización muestra, en cada cuota, cuánto se va en intereses, cuánto reduce la deuda y cuánto saldo queda. También puede agregar pagos extraordinarios.',
  guide: [
    'Escriba el valor del préstamo, el número de cuotas y la tasa de interés.',
    'Si va a hacer un pago extra en alguna cuota, responda «Sí» en la última pregunta y escriba en qué cuota y de cuánto.',
    'Presione «Calcular resultado». Abajo aparecerá la tabla completa, que puede imprimir o descargar.',
  ],
  fields: [
    { id: 'P', kind: 'money', label: 'Valor del préstamo', placeholder: 'Ej. 20.000.000', gt: 0, hint: 'El dinero que se pidió prestado.' },
    { id: 'n', kind: 'int', label: 'Número de cuotas', placeholder: 'Ej. 16', min: 1, max: 600, hint: 'Cuántos pagos se harán en total (máximo 600).' },
    { id: 'freq', kind: 'select', label: '¿Cada cuánto se paga?', default: 'mensual', options: periodOptions },
    ...rateFields('t'),
    { kind: 'heading', id: 'hx', label: 'Pagos extraordinarios' },
    {
      id: 'hayExtra', kind: 'choice', cols: 2, label: '¿Va a haber alguna cuota extraordinaria?', default: 'no',
      options: [
        { value: 'no', label: 'No', desc: 'Solo las cuotas normales.' },
        { value: 'si', label: 'Sí', desc: 'Habrá un pago extra.' },
      ],
    },
    ...extraFields,
    {
      id: 'xModo', kind: 'choice', label: 'Con los pagos extraordinarios, ¿qué prefiere?', default: 'cuota',
      options: [
        { value: 'cuota', label: 'Reducir la cuota', desc: 'Se paga en el mismo número de cuotas, pero cada cuota baja.' },
        { value: 'plazo', label: 'Reducir el tiempo de pago', desc: 'La cuota sigue igual y la deuda se termina de pagar antes.' },
      ],
      showIf: hay,
    },
  ],
  example: {
    P: '20.000.000', n: '16', freq: 'mensual', t: '24', tTipo: 'nominal', tPer: 'mensual', tModo: 'vencida',
    hayExtra: 'si', xN1: '4', xV1: '3.000.000', xMas1: 'no', xModo: 'cuota',
  },

  compute(v) {
    const per = PER[v.freq];
    const spec = readRate(v, 't');
    const i = ratePerPeriod(spec, per.m);
    const n = v.n;

    const typed = typedExtras(v);
    const seen = new Set();
    for (const e of typed) {
      if (seen.has(e.k)) throw new UserError(`Escribió dos pagos extraordinarios en la cuota ${e.k}. Si son en la misma cuota, súmelos en un solo valor.`);
      seen.add(e.k);
    }
    typed.sort((a, b) => a.k - b.k);
    const modo = typed.length ? v.xModo : 'cuota';

    const base = schedule({ P: v.P, i, n });
    const plan = schedule({ P: v.P, i, n, extras: typed, modo });
    const { rows, cuota0, applied } = plan;
    const last = rows[rows.length - 1];
    const hasExtra = applied.length > 0;
    const cancelada = applied.some((a) => a.cancela);

    const sum = (list, key) => list.reduce((s, r) => s + r[key], 0);
    const totalCuotas = sum(rows, 'cuota');
    const totalInt = sum(rows, 'interes');
    const totalAbono = sum(rows, 'abono');
    const totalExtra = sum(rows, 'extra');
    const totalPagado = totalCuotas + totalExtra;
    const baseInt = sum(base.rows, 'interes');
    const ahorro = Math.max(0, baseInt - totalInt);
    const I_ = num(i, 8);

    // ----- avisos
    const notes = [];
    for (const e of typed) {
      const ap = applied.find((a) => a.k === e.k);
      if (!ap) {
        notes.push(`El pago extraordinario de la cuota ${e.k} no se aplicó: en ese momento la deuda ya estaba pagada.`);
      } else if (ap.cancela) {
        const usado = ap.monto < e.monto - 0.005 ? ` (se usan ${money(ap.monto)} de los ${money(e.monto)} escritos)` : '';
        notes.push(`El pago extraordinario de la cuota ${e.k} alcanza para pagar toda la deuda que faltaba${usado}. El crédito termina en esa cuota.`);
      }
    }

    // ----- paso a paso
    const steps = [];
    steps.push({
      title: 'Pagamos con cuota fija',
      text: 'Todas las cuotas valen lo mismo. Al comienzo casi todo lo que paga son intereses y, poco a poco, una parte mayor va a bajar la deuda (el capital).',
    });
    steps.push(...ratePerPeriodSteps(spec, per.m));
    steps.push(
      { title: 'Escribimos la fórmula de la cuota', text: 'Esta fórmula reparte la deuda en cuotas iguales.', formula: `A = P × i ÷ [1 − ${sup('(1 + i)', '−n')}]` },
      { title: 'Calculamos la cuota', text: 'Reemplazamos los datos del préstamo.', formula: `A = ${money(v.P)} × ${I_} ÷ [1 − ${sup(`(1 + ${I_})`, `−${n}`)}]<br>A = ${money(cuota0)}` },
    );
    const f1 = rows[0];
    steps.push({
      title: 'Hacemos la primera fila de la tabla',
      text: 'Interés = saldo × tasa. Abono a capital = cuota − interés. Saldo = saldo anterior − abono.',
      formula: `Interés = ${money(f1.ini)} × ${I_} = ${money(f1.interes)}<br>Abono = ${money(f1.cuota)} − ${money(f1.interes)} = ${money(f1.abono)}<br>Saldo = ${money(f1.ini)} − ${money(f1.abono)} = ${money(f1.ini - f1.abono)}`,
    });

    if (hasExtra) {
      const lines = applied.map((a) => {
        const r = rows[a.k - 1];
        const antes = r.fin + r.extra;
        return `Cuota ${a.k}: saldo después de pagar la cuota = ${money(antes)}<br>Saldo nuevo = ${money(antes)} − ${money(r.extra)} = ${money(r.fin)}`;
      });
      steps.push({
        title: applied.length === 1 ? 'Aplicamos el pago extraordinario' : 'Aplicamos los pagos extraordinarios',
        text: 'Un pago extraordinario se paga además de la cuota normal y va completo a bajar el capital, porque los intereses de esa cuota ya quedaron pagados. Por eso la deuda baja más rápido.',
        formula: lines.join('<br><br>'),
      });
      if (modo === 'cuota') {
        const lines2 = applied.filter((a) => !a.cancela).map((a) => {
          const r = rows[a.k - 1];
          const rest = n - a.k;
          return `Después de la cuota ${a.k} faltan ${rest} ${rest === 1 ? 'cuota' : 'cuotas'}<br>A′ = ${money(r.fin)} × ${I_} ÷ [1 − ${sup(`(1 + ${I_})`, `−${rest}`)}] = ${money(annuityPayment(r.fin, i, rest))}`;
        });
        if (lines2.length) {
          steps.push({
            title: 'Recalculamos una cuota más pequeña',
            text: 'Como ahora se debe menos, basta con pagar una cuota menor durante las cuotas que todavía faltan. La calculamos con el saldo actual.',
            formula: lines2.join('<br><br>'),
          });
        }
      } else if (!cancelada) {
        steps.push({
          title: 'Mantenemos la cuota y reducimos el tiempo',
          text: 'Seguimos pagando la misma cuota de siempre. Como la deuda es menor, se termina de pagar antes y la última cuota sale más pequeña.',
          formula: `Cuotas: ${int(n)} → ${int(rows.length)} (se ahorra ${int(n - rows.length)})<br>Última cuota (la ${int(rows.length)}) = saldo + interés = ${money(last.cuota)}`,
        });
      }
    }

    steps.push(
      {
        title: 'Repetimos hasta la última cuota',
        text: `Con cada nuevo saldo calculamos la fila siguiente (interés = saldo × tasa; abono = cuota − interés; saldo nuevo = saldo − abono${hasExtra ? ' − pago extraordinario' : ''}). Al final el saldo queda en cero.`,
        formula: `Saldo final = ${money(last.fin)}`,
      },
      {
        title: 'Sumamos todo lo que se paga',
        text: 'La diferencia entre lo que se paga y lo que se pidió son los intereses.',
        formula: `Total pagado = ${money(totalPagado)}<br>Intereses = ${money(totalPagado)} − ${money(v.P)} = ${money(totalInt)}${hasExtra ? `<br>Sin pagos extraordinarios serían ${money(baseInt)} de intereses: se ahorra ${money(ahorro)}.` : ''}`,
      },
    );

    // ----- resultado
    const metrics = [{ label: 'Valor del préstamo', value: money(v.P) }];
    if (hasExtra && !cancelada) {
      if (modo === 'cuota') {
        const ult = applied[applied.length - 1];
        metrics.push({ label: 'Cuota después del último pago extra', value: money(annuityPayment(rows[ult.k - 1].fin, i, n - ult.k)) });
      } else {
        metrics.push({ label: 'Número de cuotas', value: `${int(rows.length)} (en vez de ${int(n)})` }, { label: 'Última cuota', value: money(last.cuota) });
      }
    }
    metrics.push({ label: 'Total de intereses', value: money(totalInt) }, { label: 'Total que se paga', value: money(totalPagado) });
    if (hasExtra) metrics.push({ label: 'Intereses que se ahorra', value: money(ahorro) });
    metrics.push({ label: `Efectiva por ${per.noun}`, value: pct(i, 4) });

    let summary = `Un préstamo de ${money(v.P)} a ${int(n)} cuotas ${plAdj(per)}, con una tasa del ${describeRate(spec)}, tiene una cuota ${hasExtra ? 'inicial' : 'fija'} de ${money(cuota0)}.`;
    if (hasExtra) {
      summary += ` Con ${applied.length === 1 ? 'el pago extraordinario' : 'los pagos extraordinarios'} (${money(totalExtra)} en total) y reduciendo ${modo === 'cuota' ? 'la cuota' : 'el tiempo de pago'}, pagará ${money(totalInt)} de intereses: ${money(ahorro)} menos que sin ${applied.length === 1 ? 'él' : 'ellos'}.`;
      if (rows.length < n) summary += ` Terminará de pagar en la cuota ${int(rows.length)} en lugar de la ${int(n)}.`;
    } else {
      summary += ` En total pagará ${money(totalPagado)}, de los cuales ${money(totalInt)} son intereses.`;
    }

    // ----- tabla
    const cols = [
      { label: 'N.º', fmt: 'int', align: 'left' },
      { label: 'Saldo inicial', fmt: 'money' },
      { label: 'Cuota', fmt: 'money' },
      { label: 'Interés', fmt: 'money', tone: 'interest' },
      { label: 'Abono a capital', fmt: 'money', tone: 'capital' },
    ];
    if (hasExtra) cols.push({ label: 'Pago extraordinario', fmt: 'money', tone: 'extra' });
    cols.push({ label: 'Saldo final', fmt: 'money', strong: true });

    return {
      headline: { eyebrow: 'Amortización · cuota fija', label: `Cuota por ${per.noun}${hasExtra ? ' (inicial)' : ''}`, value: money(cuota0) },
      summary,
      metrics,
      notes,
      bar: { title: 'De todo lo que se paga', parts: [{ label: 'Capital', value: v.P }, { label: 'Intereses', value: totalInt }] },
      steps,
      table: {
        title: 'Tabla de amortización',
        subtitle: 'Cuánto se paga en cada cuota y cuánto queda de la deuda. Todos los valores están en pesos ($).',
        csvName: 'tabla-de-amortizacion.csv',
        columns: cols,
        rows: rows.map((r) => [r.k, r.ini, r.cuota, r.interes, r.abono, ...(hasExtra ? [r.extra > 0 ? r.extra : null] : []), r.fin]),
        totals: ['Total', null, totalCuotas, totalInt, totalAbono, ...(hasExtra ? [totalExtra] : []), null],
        rowFlags: rows.map((r) => r.extra > 0),
        legend: hasExtra ? 'Las filas resaltadas son las cuotas con pago extraordinario.' : null,
      },
    };
  },
};
