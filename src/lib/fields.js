// Piezas de formulario reutilizables por las pestañas.
import { PERIODS, PER } from './math.js';

export const periodOptions = PERIODS.map((p) => ({ value: p.id, label: p.label }));
export const unitOptions = PERIODS.map((p) => ({
  value: p.id,
  label: p.nouns[0].toUpperCase() + p.nouns.slice(1),
}));

const always = () => true;
const never = () => false;

/**
 * Grupo de campos para una tasa de interés.
 * prefix: p. ej. 'tasa' -> ids tasa, tasaTipo, tasaPer, tasaModo
 * opts.solving(v): true cuando la tasa es lo que se está calculando (no se escribe el valor).
 */
export function rateFields(prefix, opts = {}) {
  const {
    value = true,
    showIf = always,
    title = 'Su tasa de interés',
    periodLabel,
    solving = never,
  } = opts;
  const fields = [];
  if (title !== null) fields.push({ kind: 'heading', id: prefix + 'H', label: title, showIf });
  if (value) {
    fields.push({
      id: prefix,
      kind: 'percent',
      label: 'Tasa de interés (%)',
      placeholder: 'Ej. 24',
      min: 0,
      hint: 'Escriba solo el número, sin el signo %. Puede usar coma o punto para los decimales.',
      showIf: (v) => showIf(v) && !solving(v),
    });
  }
  fields.push(
    {
      id: prefix + 'Tipo',
      kind: 'choice',
      label: (v) => (!value || solving(v) ? '¿Qué clase de tasa quiere obtener?' : '¿Qué clase de tasa es?'),
      options: [
        { value: 'efectiva', label: 'Efectiva', desc: 'El porcentaje ya corresponde al periodo. Ej.: 2 % mensual.' },
        { value: 'nominal', label: 'Nominal anual', desc: 'Es una tasa anual que se capitaliza varias veces. Ej.: 24 % anual capitalizable cada mes.' },
      ],
      default: 'efectiva',
      showIf,
    },
    {
      id: prefix + 'Per',
      kind: 'select',
      label:
        periodLabel ||
        ((v) => (v[prefix + 'Tipo'] === 'nominal' ? '¿Cada cuánto se capitalizan los intereses?' : '¿De qué periodo es la tasa?')),
      options: periodOptions,
      default: 'anual',
      showIf,
    },
    {
      id: prefix + 'Modo',
      kind: 'select',
      label: '¿Los intereses se cobran…?',
      options: [
        { value: 'vencida', label: 'Al final del periodo (vencida, lo más común)' },
        { value: 'anticipada', label: 'Al inicio del periodo (anticipada)' },
      ],
      default: 'vencida',
      showIf,
    },
  );
  return fields;
}

/** Forma de la tasa sin el valor (para conversiones de destino). */
export const readShape = (v, p) => ({ kind: v[p + 'Tipo'], m: PER[v[p + 'Per']].m, mode: v[p + 'Modo'] });

/** Tasa completa leída del formulario (el valor escrito en % pasa a fracción). */
export const readRate = (v, p) => ({ r: v[p] / 100, ...readShape(v, p) });
