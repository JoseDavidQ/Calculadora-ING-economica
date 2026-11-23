import { parseNum, moneyInput, money, plain, int, pct } from './lib/format.js';
import { UserError } from './lib/math.js';

const NUMERIC = ['money', 'number', 'int', 'percent'];
const SITE = 'Calculadora de ingeniería económica';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const val = (x, v) => (typeof x === 'function' ? x(v) : x);

export function createApp(tabs) {
  const nav = $('#tabs');
  const panel = $('#panel');
  const results = $('#results');
  const state = { tab: tabs[0], raw: {}, last: {}, cents: {} };

  /* ---------- valores ---------- */
  const rawOf = (tab) => (state.raw[tab.id] ??= defaults(tab));
  function defaults(tab) {
    const o = {};
    for (const f of tab.fields) {
      if (f.kind === 'heading') continue;
      o[f.id] = f.default ?? '';
    }
    return o;
  }
  function parsed(tab) {
    const raw = rawOf(tab);
    const v = {};
    for (const f of tab.fields) {
      if (f.kind === 'heading') continue;
      v[f.id] = NUMERIC.includes(f.kind) ? parseNum(raw[f.id], { money: f.kind === 'money' }) : raw[f.id];
    }
    return v;
  }
  const visibleOptions = (f, v) => (f.options || []).filter((o) => !o.visible || o.visible(v));

  /* ---------- pestañas ---------- */
  function renderTabs() {
    nav.innerHTML = tabs
      .map(
        (t, i) => `<button type="button" role="tab" class="tab" id="tab-${t.id}" data-tab="${t.id}" aria-controls="results" aria-selected="false" tabindex="-1">
          <span class="tab-n" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span><span class="tab-t">${t.label}</span></button>`,
      )
      .join('');
    nav.addEventListener('click', (e) => {
      const b = e.target.closest('[data-tab]');
      if (b) select(tabs.find((t) => t.id === b.dataset.tab), true);
    });
    nav.addEventListener('keydown', (e) => {
      const i = tabs.indexOf(state.tab);
      let j = null;
      if (e.key === 'ArrowRight') j = (i + 1) % tabs.length;
      if (e.key === 'ArrowLeft') j = (i - 1 + tabs.length) % tabs.length;
      if (j !== null) {
        e.preventDefault();
        select(tabs[j], true);
        $(`#tab-${tabs[j].id}`).focus();
      }
    });
  }

  function select(tab, pushHash) {
    state.tab = tab;
    $$('.tab', nav).forEach((b) => {
      const on = b.dataset.tab === tab.id;
      b.setAttribute('aria-selected', on);
      b.tabIndex = on ? 0 : -1;
    });
    if (pushHash) history.replaceState(null, '', '#' + tab.id);
    document.title = `${tab.label} · ${SITE}`;
    renderForm();
    if (state.last[tab.id]) renderResult(state.last[tab.id]);
    else renderEmpty();
  }

  /* ---------- formulario ---------- */
  function fieldHTML(f, tab) {
    if (f.kind === 'heading') return `<h3 class="group" data-field="${f.id}"></h3>`;
    const id = `f-${f.id}`;
    const hint = '<p class="hint" data-hint></p>';
    const err = `<p class="ferr" data-err hidden role="alert"></p>`;
    if (f.kind === 'choice') {
      return `<fieldset class="field" data-field="${f.id}"><legend data-label></legend><div class="choices${f.cols === 2 ? ' cols2' : ''}">
        ${f.options
          .map(
            (o) => `<label class="choice" data-opt="${o.value}"><input type="radio" name="${tab.id}-${f.id}" value="${o.value}" data-fid="${f.id}">
              <span class="choice-body"><b>${o.label}</b><small>${o.desc || ''}</small></span></label>`,
          )
          .join('')}</div>${hint}</fieldset>`;
    }
    if (f.kind === 'select') {
      return `<div class="field" data-field="${f.id}"><label for="${id}" data-label></label>
        <div class="select-wrap"><select id="${id}" data-fid="${f.id}">
        ${f.options.map((o) => `<option value="${o.value}">${o.label}</option>`).join('')}</select></div>${hint}</div>`;
    }
    const pre = f.kind === 'money' ? '<span class="affix">$</span>' : '';
    const suf = f.kind === 'percent' ? '<span class="affix suf">%</span>' : '';
    return `<div class="field" data-field="${f.id}"><label for="${id}" data-label></label>
      <div class="inputwrap">${pre}<input id="${id}" data-fid="${f.id}" data-kind="${f.kind}" type="text" inputmode="decimal" autocomplete="off" spellcheck="false" placeholder="${f.placeholder || ''}">${suf}</div>
      ${hint}${err}</div>`;
  }

  function renderForm() {
    const tab = state.tab;
    panel.innerHTML = `
      <div class="panel-head">
        <p class="eyebrow">Paso 1</p>
        <h2 id="panel-title">Escriba sus datos</h2>
        <p class="sub">Complete las casillas y luego presione el botón azul.</p>
      </div>
      <form id="form" novalidate>
        ${tab.fields.map((f) => fieldHTML(f, tab)).join('')}
        <div id="form-error" class="form-error" role="alert" hidden></div>
        <div class="form-actions">
          <button type="submit" class="btn primary">Calcular resultado</button>
          <div class="row2">
            <button type="button" class="btn ghost" data-act="example">Cargar un ejemplo</button>
            <button type="button" class="btn ghost" data-act="clear">Borrar datos</button>
          </div>
        </div>
      </form>`;
    const form = $('#form');
    // valores guardados -> casillas
    const raw = rawOf(tab);
    for (const f of tab.fields) {
      if (f.kind === 'heading') continue;
      if (f.kind === 'choice') {
        const r = $(`input[name="${tab.id}-${f.id}"][value="${raw[f.id]}"]`, form);
        if (r) r.checked = true;
      } else {
        const el = $(`#f-${f.id}`, form);
        if (el) el.value = raw[f.id];
      }
    }
    refresh();

    form.addEventListener('input', onChange);
    form.addEventListener('change', onChange);
    form.addEventListener('focusout', (e) => {
      const el = e.target;
      if (el.dataset?.kind === 'money') {
        const n = parseNum(el.value, { money: true });
        if (Number.isFinite(n)) {
          el.value = moneyInput(n);
          rawOf(tab)[el.dataset.fid] = el.value;
        }
      }
    });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      calculate();
    });
    form.addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'example') loadExample();
      if (act === 'clear') clearAll();
    });
  }

  function onChange(e) {
    const fid = e.target.dataset?.fid;
    if (!fid) return;
    rawOf(state.tab)[fid] = e.target.value;
    const wrap = e.target.closest('.field');
    const err = $('[data-err]', wrap || document);
    if (err) err.hidden = true;
    wrap?.classList.remove('invalid');
    $('#form-error').hidden = true;
    refresh();
  }

  /** Muestra/oculta casillas y actualiza textos que dependen de otras respuestas. */
  function refresh() {
    const tab = state.tab;
    const form = $('#form');
    if (!form) return;
    const raw = rawOf(tab);
    // las opciones elegidas deben seguir siendo válidas
    for (let pass = 0; pass < 3; pass++) {
      let changed = false;
      const v = parsed(tab);
      for (const f of tab.fields) {
        if (f.kind !== 'choice') continue;
        const ok = visibleOptions(f, v).some((o) => o.value === raw[f.id]);
        if (!ok) {
          raw[f.id] = visibleOptions(f, v)[0]?.value ?? raw[f.id];
          changed = true;
        }
      }
      if (!changed) break;
    }
    const v = parsed(tab);
    for (const f of tab.fields) {
      const el = $(`[data-field="${f.id}"]`, form);
      if (!el) continue;
      const show = f.showIf ? f.showIf(v) : true;
      el.hidden = !show;
      if (!show) continue;
      const label = val(f.label, v);
      if (f.kind === 'heading') {
        el.textContent = label;
        continue;
      }
      const lab = $('[data-label]', el);
      if (lab) lab.textContent = label;
      const hint = $('[data-hint]', el);
      if (hint) {
        const h = val(f.hint, v);
        hint.textContent = h || '';
        hint.hidden = !h;
      }
      if (f.kind === 'choice') {
        for (const o of f.options) {
          const optEl = $(`[data-opt="${o.value}"]`, el);
          const ok = !o.visible || o.visible(v);
          optEl.hidden = !ok;
          const r = $('input', optEl);
          r.checked = raw[f.id] === o.value;
          optEl.classList.toggle('on', r.checked);
        }
      }
    }
  }

  /* ---------- validación y cálculo ---------- */
  function validate() {
    const tab = state.tab;
    const v = parsed(tab);
    const raw = rawOf(tab);
    const bad = [];
    for (const f of tab.fields) {
      if (!NUMERIC.includes(f.kind)) continue;
      if (f.showIf && !f.showIf(v)) continue;
      const x = v[f.id];
      const gt = val(f.gt, v);
      const min = val(f.min, v);
      const max = val(f.max, v);
      let msg = '';
      if (String(raw[f.id]).trim() === '') msg = 'Escriba este dato.';
      else if (!Number.isFinite(x)) msg = 'Escriba solo números. Para decimales use coma o punto.';
      else if (f.kind === 'int' && !Number.isInteger(x)) msg = 'Escriba un número entero, sin decimales.';
      else if (gt !== undefined && !(x > gt)) msg = gt === 0 ? 'Debe ser un número mayor que cero.' : `Debe ser mayor que ${gt}.`;
      else if (min !== undefined && !(x >= min)) msg = min === 0 ? 'No puede ser negativo.' : `Debe ser ${min} o más.`;
      else if (Number.isFinite(max) && !(x <= max)) msg = f.maxMsg ? f.maxMsg(max, v) : `No puede ser mayor que ${max}.`;
      const el = $(`[data-field="${f.id}"]`);
      const err = $('[data-err]', el);
      el.classList.toggle('invalid', !!msg);
      if (err) {
        err.textContent = msg;
        err.hidden = !msg;
      }
      if (msg) bad.push(f);
    }
    return { v, bad };
  }

  function calculate() {
    const tab = state.tab;
    const { v, bad } = validate();
    const box = $('#form-error');
    if (bad.length) {
      box.textContent = `Revise ${bad.length === 1 ? 'la casilla marcada en rojo' : 'las casillas marcadas en rojo'} y vuelva a presionar «Calcular resultado».`;
      box.hidden = false;
      $(`#f-${bad[0].id}`)?.focus();
      return;
    }
    box.hidden = true;
    try {
      const res = tab.compute(v);
      state.last[tab.id] = res;
      renderResult(res);
      focusResults();
    } catch (err) {
      if (err instanceof UserError) {
        box.textContent = err.message;
        box.hidden = false;
        box.scrollIntoView({ block: 'center', behavior: 'smooth' });
      } else {
        console.error(err);
        box.textContent = 'No se pudo calcular con esos datos. Revise los valores e inténtelo de nuevo.';
        box.hidden = false;
      }
    }
  }

  function loadExample() {
    const tab = state.tab;
    state.raw[tab.id] = { ...defaults(tab), ...tab.example };
    renderForm();
    calculate();
  }

  function clearAll() {
    const tab = state.tab;
    state.raw[tab.id] = defaults(tab);
    delete state.last[tab.id];
    renderForm();
    renderEmpty();
    $('#form input[type="text"]')?.focus();
  }

  function focusResults() {
    const h = $('#results [data-focus]');
    const narrow = window.matchMedia('(max-width: 1100px)').matches;
    if (h) {
      h.focus({ preventScroll: true });
      if (narrow) h.scrollIntoView({ behavior: 'smooth', block: 'start' });
      else window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  /* ---------- resultados ---------- */
  function renderEmpty() {
    const tab = state.tab;
    const i = tabs.indexOf(tab) + 1;
    results.innerHTML = `
      <div class="pair">
        <article class="card intro">
          <p class="eyebrow">Tema ${i} de ${tabs.length}</p>
          <h2 data-focus tabindex="-1">${tab.label}</h2>
          <p class="lead">${tab.intro}</p>
        </article>
        <article class="card guide">
          <h3>Cómo usar esta pestaña</h3>
          <ol class="guide-list">${tab.guide.map((g, n) => `<li><span class="num">${n + 1}</span><p>${g}</p></li>`).join('')}</ol>
          <p class="tip"><b>¿Quiere ver cómo funciona?</b> Presione «Cargar un ejemplo» y se llenarán las casillas solas.</p>
        </article>
      </div>`;
  }

  function barHTML(bar) {
    const total = bar.parts.reduce((s, p) => s + p.value, 0);
    if (!(total > 0)) return '';
    const cls = ['a', 'b', 'c'];
    return `<section class="card bar" aria-label="${bar.title}">
      <h3>${bar.title}</h3>
      <div class="bar-track" role="img" aria-label="${bar.parts.map((p) => `${p.label}: ${pct(p.value / total, 1)}`).join(', ')}">
        ${bar.parts.map((p, k) => `<span class="seg ${cls[k]}" style="width:${(p.value / total) * 100}%"></span>`).join('')}
      </div>
      <ul class="legend">${bar.parts.map((p, k) => `<li><i class="dot ${cls[k]}"></i><span>${p.label}</span><b>${money(p.value)}</b><em>${pct(p.value / total, 1)}</em></li>`).join('')}</ul>
    </section>`;
  }

  // En la tabla el dinero va sin el signo $ para que quepan todas las columnas.
  const cell = (c, x, compact) => (x === null ? '' : c.fmt === 'int' ? int(x) : c.fmt === 'money' ? (compact ? int(x) : plain(x)) : x);

  function tableHTML(t, compact = false) {
    const al = (c) => (c.align === 'left' ? 'l' : '');
    return `<section class="card table-card" data-compact="${compact ? 1 : 0}">
      <div class="table-head"><div><h3>${t.title}</h3><p class="sub">${t.subtitle}</p></div>
        <div class="no-print table-actions">
          <button type="button" class="btn small" data-res="cents">${compact ? 'Mostrar centavos' : 'Ocultar centavos'}</button>
          <button type="button" class="btn small" data-res="csv">Descargar para Excel</button>
        </div></div>
      <div class="table-wrap${t.rows.length > 24 ? ' tall' : ''}" tabindex="0" role="region" aria-label="${t.title}">
      <table><thead><tr>${t.columns.map((c) => `<th scope="col" class="${al(c)}">${c.label}</th>`).join('')}</tr></thead>
      <tbody>${t.rows
        .map(
          (r, n) => `<tr class="${t.rowFlags && t.rowFlags[n] ? 'has-extra' : ''}">${r
            .map((x, j) => `<td class="${al(t.columns[j])} ${t.columns[j].tone || ''} ${t.columns[j].strong ? 'strong' : ''}">${cell(t.columns[j], x, compact)}</td>`)
            .join('')}</tr>`,
        )
        .join('')}</tbody>
      <tfoot><tr>${t.totals.map((x, j) => `<td class="${al(t.columns[j])} ${t.columns[j].tone || ''}">${typeof x === 'string' ? x : cell(t.columns[j], x, compact)}</td>`).join('')}</tr></tfoot></table></div>
      ${t.legend ? `<p class="table-note"><i class="swatch" aria-hidden="true"></i>${t.legend}</p>` : ''}
      ${compact ? '<p class="table-note">Los valores se muestran redondeados al peso para que quepan en pantalla. Los cálculos usan todos los decimales y el archivo de Excel trae los centavos.</p>' : ''}</section>`;
  }

  function renderResult(r) {
    renderResultHTML(r);
    layoutTable();
  }

  function renderResultHTML(r) {
    results.innerHTML = `
      <div class="lead-row">
        <article class="hero">
          <p class="eyebrow">${r.headline.eyebrow}</p>
          <h2 class="hero-label" data-focus tabindex="-1">${r.headline.label}</h2>
          <p class="hero-value">${r.headline.value}</p>
          <p class="summary">${r.summary}</p>
        </article>
        <section class="metrics" aria-label="Datos del resultado">
          ${r.metrics.map((m) => `<div class="metric"><span>${m.label}</span><b>${m.value}</b></div>`).join('')}
        </section>
      </div>
      ${r.notes && r.notes.length ? `<aside class="notice" role="note"><b>Tenga en cuenta</b><ul>${r.notes.map((n) => `<li>${n}</li>`).join('')}</ul></aside>` : ''}
      ${r.bar ? barHTML(r.bar) : ''}
      ${r.table ? tableHTML(r.table, state.cents[state.tab.id] === false) : ''}
      <section class="card steps">
        <div class="steps-head"><h3>Explicación paso a paso</h3><p class="sub">Así se obtiene el resultado con sus datos.</p></div>
        <ol>${r.steps
          .map(
            (s, k) => `<li><span class="num">${k + 1}</span><div><h4>${s.title}</h4>${s.text ? `<p>${s.text}</p>` : ''}${s.formula ? `<div class="formula">${s.formula}</div>` : ''}</div></li>`,
          )
          .join('')}</ol>
      </section>
      <div class="no-print result-actions">
        <button type="button" class="btn ghost" data-res="print">Imprimir o guardar en PDF</button>
        <button type="button" class="btn ghost" data-res="top">Volver a las casillas</button>
      </div>`;
  }

  results.addEventListener('click', (e) => {
    const act = e.target.closest('[data-res]')?.dataset.res;
    if (act === 'print') window.print();
    if (act === 'top') {
      $('#panel-title')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      $('#form input[type="text"]:not([hidden])')?.focus({ preventScroll: true });
    }
    if (act === 'csv') downloadCSV(state.last[state.tab.id]?.table);
    if (act === 'cents') toggleCents();
  });

  function downloadCSV(t) {
    if (!t) return;
    const f = (c, x) => (x === null ? '' : c.fmt === 'int' ? String(x) : c.fmt === 'money' ? x.toFixed(2).replace('.', ',') : x);
    const lines = [t.columns.map((c) => c.label).join(';')];
    for (const r of t.rows) lines.push(r.map((x, j) => f(t.columns[j], x)).join(';'));
    lines.push(t.totals.map((x, j) => (typeof x === 'string' ? x : f(t.columns[j], x))).join(';'));
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = t.csvName;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  /* ---------- tabla: que quepa sin deslizar de lado ---------- */
  function setTable(compact) {
    const r = state.last[state.tab.id];
    const old = $('.table-card', results);
    if (r?.table && old) old.outerHTML = tableHTML(r.table, compact);
  }

  /** Si la persona no eligió, muestra centavos y, si no cabe, pasa a pesos enteros. */
  function layoutTable() {
    const r = state.last[state.tab.id];
    if (!r?.table || state.cents[state.tab.id] !== undefined) return;
    setTable(false);
    const wrap = $('.table-wrap', results);
    if (wrap && wrap.scrollWidth > wrap.clientWidth + 1) setTable(true);
  }

  function toggleCents() {
    const card = $('.table-card', results);
    if (!card) return;
    const wasCompact = card.dataset.compact === '1';
    state.cents[state.tab.id] = wasCompact; // true = la persona quiere ver centavos
    setTable(!wasCompact);
  }

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(layoutTable, 200);
  });

  /* ---------- arranque ---------- */
  renderTabs();
  const fromHash = tabs.find((t) => '#' + t.id === location.hash);
  select(fromHash || tabs[0], false);
  window.addEventListener('hashchange', () => {
    const t = tabs.find((x) => '#' + x.id === location.hash);
    if (t && t !== state.tab) select(t, false);
  });
}
