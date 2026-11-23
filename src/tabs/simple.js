import { PER, UserError } from '../lib/math.js';
import { money, num, pct, pctIn } from '../lib/format.js';
import { periodOptions, unitOptions } from '../lib/fields.js';

const has = (...xs) => (v) => xs.includes(v.calc);

export default {
  id: 'interes-simple',
  label: 'Interés simple',
  intro:
    'En el interés simple los intereses se calculan siempre sobre el capital inicial: no se suman al capital para generar más intereses. Cada periodo se gana exactamente lo mismo.',
  guide: [
    'Elija qué quiere calcular (por ejemplo, el monto final).',
    'Escriba los datos que le piden en las casillas de la derecha. Las demás casillas se ocultan solas.',
    'Presione el botón azul «Calcular resultado» y lea el paso a paso.',
  ],
  fields: [
    {
      id: 'calc', kind: 'choice', label: '¿Qué desea calcular?', default: 'monto',
      options: [
        { value: 'monto', label: 'El monto final', desc: 'Capital + intereses al terminar.' },
        { value: 'interes', label: 'El interés ganado o pagado', desc: 'Solo la ganancia, sin el capital.' },
        { value: 'capital', label: 'El capital inicial', desc: 'Cuánto había que invertir al comienzo.' },
        { value: 'tasa', label: 'La tasa de interés', desc: 'Qué porcentaje se aplicó.' },
        { value: 'tiempo', label: 'El tiempo', desc: 'Cuánto tarda en llegar a un monto.' },
      ],
    },
    { kind: 'heading', id: 'h1', label: 'Sus datos' },
    {
      id: 'P', kind: 'money', label: 'Capital inicial', placeholder: 'Ej. 5.000.000', gt: 0,
      hint: 'El dinero con el que se empieza (prestado o invertido).', showIf: has('monto', 'interes', 'tasa', 'tiempo'),
    },
    {
      id: 'F', kind: 'money', label: 'Monto final', placeholder: 'Ej. 5.600.000', gt: 0,
      hint: 'Lo que se tiene al final: capital más intereses.', showIf: has('capital', 'tasa', 'tiempo'),
    },
    {
      id: 'i', kind: 'percent', label: 'Tasa de interés (%)', placeholder: 'Ej. 6', gt: 0,
      hint: 'Escriba solo el número, sin el signo %.', showIf: (v) => v.calc !== 'tasa',
    },
    {
      id: 'iPer', kind: 'select', default: 'anual', options: periodOptions,
      label: (v) => (v.calc === 'tasa' ? '¿Cómo quiere ver la tasa?' : '¿La tasa es de qué periodo?'),
      hint: 'Ej.: «6 % anual» se escribe 6 y se elige Anual.',
    },
    {
      id: 'n', kind: 'number', label: 'Tiempo', placeholder: 'Ej. 18', gt: 0,
      hint: 'Cuánto dura el préstamo o la inversión.', showIf: (v) => v.calc !== 'tiempo',
    },
    {
      id: 'nUnit', kind: 'select', default: 'mensual', options: unitOptions,
      label: (v) => (v.calc === 'tiempo' ? '¿En qué quiere ver el tiempo?' : '¿El tiempo está en…?'),
      hint: 'Se usa el año comercial: 12 meses de 30 días = 360 días.',
    },
  ],
  example: { calc: 'monto', P: '5.000.000', i: '6', iPer: 'anual', n: '18', nUnit: 'mensual' },

  compute(v) {
    const perR = PER[v.iPer];
    const perT = PER[v.nUnit];
    const ratio = perR.m / perT.m; // unidades de tiempo -> periodos de la tasa
    const steps = [];
    const timeStep = (n, nr) => {
      if (perR.m === perT.m) return null;
      const op = ratio >= 1 ? `× ${num(ratio)}` : `÷ ${num(1 / ratio)}`;
      return {
        title: 'Igualamos el tiempo con la tasa',
        text: `La tasa es por ${perR.noun} y el tiempo está en ${perT.nouns}. Para multiplicar, ambos deben estar en el mismo periodo.`,
        formula: `n = ${num(n)} ${perT.nouns} ${op} = ${num(nr)} ${perR.nouns}`,
      };
    };
    const push = (...s) => s.filter(Boolean).forEach((x) => steps.push(x));

    if (v.calc === 'monto' || v.calc === 'interes') {
      const i = v.i / 100;
      const nr = v.n * ratio;
      const I = v.P * i * nr;
      const F = v.P + I;
      push(
        { title: 'Escribimos la fórmula', text: 'El interés simple es el capital por la tasa por el tiempo. El monto es el capital más ese interés.', formula: 'I = P × i × n<br>F = P + I' },
        { title: 'Pasamos la tasa a decimal', text: 'Dividimos el porcentaje entre 100.', formula: `i = ${num(v.i)} ÷ 100 = ${num(i, 8)} por ${perR.noun}` },
        timeStep(v.n, nr),
        { title: 'Calculamos el interés', text: 'Multiplicamos capital, tasa y tiempo.', formula: `I = ${money(v.P)} × ${num(i, 8)} × ${num(nr)} = ${money(I)}` },
        { title: 'Sumamos el interés al capital', text: 'Así obtenemos el monto final.', formula: `F = ${money(v.P)} + ${money(I)} = ${money(F)}` },
      );
      const isMonto = v.calc === 'monto';
      return {
        headline: { eyebrow: 'Interés simple', label: isMonto ? 'Monto final' : 'Interés', value: money(isMonto ? F : I) },
        summary: `Si presta o invierte ${money(v.P)} al ${pctIn(v.i)} ${perR.adj} simple durante ${num(v.n)} ${perT.nouns}, gana ${money(I)} de intereses y al final tiene ${money(F)}.`,
        metrics: [
          { label: 'Capital inicial', value: money(v.P) },
          { label: 'Interés total', value: money(I) },
          { label: `Interés cada ${perR.noun}`, value: money(v.P * i) },
        ],
        bar: { title: 'Del monto final', parts: [{ label: 'Capital', value: v.P }, { label: 'Interés', value: I }] },
        steps,
      };
    }

    if (v.calc === 'capital') {
      const i = v.i / 100;
      const nr = v.n * ratio;
      const P = v.F / (1 + i * nr);
      push(
        { title: 'Escribimos la fórmula y despejamos el capital', text: 'Partimos del monto F = P × (1 + i × n) y pasamos el paréntesis a dividir.', formula: 'F = P × (1 + i × n)<br>P = F ÷ (1 + i × n)' },
        { title: 'Pasamos la tasa a decimal', text: 'Dividimos el porcentaje entre 100.', formula: `i = ${num(v.i)} ÷ 100 = ${num(i, 8)} por ${perR.noun}` },
        timeStep(v.n, nr),
        { title: 'Calculamos el capital', text: 'Reemplazamos y dividimos.', formula: `P = ${money(v.F)} ÷ (1 + ${num(i, 8)} × ${num(nr)}) = ${money(v.F)} ÷ ${num(1 + i * nr, 8)} = ${money(P)}` },
      );
      return {
        headline: { eyebrow: 'Interés simple', label: 'Capital inicial', value: money(P) },
        summary: `Para tener ${money(v.F)} dentro de ${num(v.n)} ${perT.nouns} con una tasa del ${pctIn(v.i)} ${perR.adj} simple, necesita empezar con ${money(P)}.`,
        metrics: [
          { label: 'Monto final', value: money(v.F) },
          { label: 'Interés ganado', value: money(v.F - P) },
        ],
        bar: { title: 'Del monto final', parts: [{ label: 'Capital', value: P }, { label: 'Interés', value: v.F - P }] },
        steps,
      };
    }

    // tasa o tiempo: hace falta que el monto supere al capital
    if (!(v.F > v.P)) throw new UserError('El monto final debe ser mayor que el capital inicial para que haya intereses.');
    const I = v.F - v.P;

    if (v.calc === 'tasa') {
      const nr = v.n * ratio;
      const i = I / (v.P * nr);
      push(
        { title: 'Escribimos la fórmula y despejamos la tasa', text: 'De F = P × (1 + i × n) despejamos i.', formula: 'i = (F ÷ P − 1) ÷ n' },
        { title: 'Hallamos el interés ganado', text: 'Es la diferencia entre el monto final y el capital.', formula: `I = ${money(v.F)} − ${money(v.P)} = ${money(I)}` },
        timeStep(v.n, nr),
        { title: 'Calculamos la tasa', text: 'Reemplazamos los valores.', formula: `i = (${money(v.F)} ÷ ${money(v.P)} − 1) ÷ ${num(nr)} = ${num(i, 8)}` },
        { title: 'Pasamos la tasa a porcentaje', text: 'Multiplicamos por 100.', formula: `i = ${num(i, 8)} × 100 = ${pct(i, 6)} ${perR.adj}` },
      );
      return {
        headline: { eyebrow: 'Interés simple', label: `Tasa ${perR.adj}`, value: pct(i, 4) },
        summary: `Para que ${money(v.P)} se conviertan en ${money(v.F)} en ${num(v.n)} ${perT.nouns}, la tasa de interés simple debe ser del ${pct(i, 4)} ${perR.adj}.`,
        metrics: [
          { label: 'Interés ganado', value: money(I) },
          { label: 'Tasa anual simple equivalente', value: pct(i * perR.m, 4) },
        ],
        steps,
      };
    }

    // tiempo
    const i = v.i / 100;
    const nr = I / (v.P * i);
    const n = nr / ratio;
    push(
      { title: 'Escribimos la fórmula y despejamos el tiempo', text: 'De F = P × (1 + i × n) despejamos n.', formula: 'n = (F ÷ P − 1) ÷ i' },
      { title: 'Pasamos la tasa a decimal', text: 'Dividimos el porcentaje entre 100.', formula: `i = ${num(v.i)} ÷ 100 = ${num(i, 8)} por ${perR.noun}` },
      { title: 'Calculamos el tiempo', text: `Da el resultado en ${perR.nouns}, que es el periodo de la tasa.`, formula: `n = (${money(v.F)} ÷ ${money(v.P)} − 1) ÷ ${num(i, 8)} = ${num(nr, 6)} ${perR.nouns}` },
      perR.m !== perT.m
        ? { title: `Lo pasamos a ${perT.nouns}`, text: 'Así lo ve en el periodo que eligió.', formula: `n = ${num(nr, 6)} ${perR.nouns} ${ratio >= 1 ? `÷ ${num(ratio)}` : `× ${num(1 / ratio)}`} = ${num(n, 6)} ${perT.nouns}` }
        : null,
    );
    return {
      headline: { eyebrow: 'Interés simple', label: 'Tiempo necesario', value: `${num(n, 2)} ${perT.nouns}` },
      summary: `Con una tasa del ${pctIn(v.i)} ${perR.adj} simple, ${money(v.P)} tardan ${num(n, 2)} ${perT.nouns} en convertirse en ${money(v.F)}.`,
      metrics: [
        { label: 'Interés ganado', value: money(I) },
        { label: 'Equivale a (años)', value: `${num(nr / perR.m, 4)} años` },
      ],
      steps,
    };
  },
};
