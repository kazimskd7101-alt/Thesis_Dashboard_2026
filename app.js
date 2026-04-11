const DATA = {
  dashboard: 'data/dashboard_master.csv',
  compare: 'data/final_compare_table.csv',
  ablation: 'data/ablation_summary.csv',
  tail: 'data/tail_grid_results.csv',
  optionB: 'data/optionB_tail_grid_results.csv',
  xaiSummary: 'data/gradcam_chart_vs_background_summary.csv',
  xaiDetail: 'data/gradcam_chart_vs_background_detail.csv',
  finalists: 'data/optionB_finalists.csv',
  rawIndexTest: 'data/test_raw_index.csv',
  rawIndexTrain: 'data/train_raw_index.csv',
  rawIndexVal: 'data/val_raw_index.csv',
  gradcamIndex: 'data/test_gradcam_index.csv'
};

const state = {
  data: {},
  rows: [],
  filtered: [],
  selected: null,
  charts: {},
  view: 'raw'
};

document.addEventListener('DOMContentLoaded', async () => {
  bindUI();
  await loadData();
  buildRows();
  populateContractFilter();
  updateStaticMetrics();
  applyFilters();
});

function bindUI() {
  document.getElementById('apply-filters').addEventListener('click', applyFilters);
  document.getElementById('reset-filters').addEventListener('click', resetFilters);

  document.querySelectorAll('.tab, .thumb-card').forEach(btn => {
    btn.addEventListener('click', () => setView(btn.dataset.view));
  });

  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
      document.querySelectorAll('.nav-link').forEach(n => n.classList.remove('active'));
      link.classList.add('active');
    });
  });
}

async function loadData() {
  const entries = Object.entries(DATA);
  const loaded = await Promise.all(entries.map(async ([key, path]) => [key, await loadCSV(path)]));
  loaded.forEach(([key, rows]) => state.data[key] = rows);
}

function loadCSV(path) {
  return new Promise(resolve => {
    Papa.parse(path, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: results => resolve(results.data || []),
      error: () => resolve([])
    });
  });
}

function buildRows() {
  const rawMap = {};
  [...(state.data.rawIndexTest || []), ...(state.data.rawIndexTrain || []), ...(state.data.rawIndexVal || [])].forEach(r => {
    rawMap[String(r.sample_id)] = r;
  });
  const gradMap = {};
  (state.data.gradcamIndex || []).forEach(r => gradMap[String(r.sample_id)] = r);

  state.rows = (state.data.dashboard || []).map(r => {
    const sampleId = String(r.sample_id);
    const raw = rawMap[sampleId] || {};
    const grad = gradMap[sampleId] || {};

    const confidence = normalizeConfidence(r.confidence_bucket || r.cnn_confidence);
    const signal = normalizeSignal(r.signal_bucket, r.cnn_pred, r.cnn_p_up);
    const xai = normalizeXai(r.xai_quality_bucket, r.heat_on_foreground, r.heat_on_background);
    const pUp = number(r.cnn_p_up);
    const fg = number(r.heat_on_foreground);
    const bg = number(r.heat_on_background);

    return {
      sampleId,
      contract: r.contract || raw.contract || grad.contract || 'NA',
      split: (r.split || raw.split || 'test').toLowerCase(),
      anchorTime: r.anchor_time || raw.anchor_ts || grad.anchor_ts || '',
      tradeDate: r.trade_date || extractDate(r.anchor_time || raw.anchor_ts || grad.anchor_ts || ''),
      labelUp: number(r.label_20),
      forwardReturn: number(r.forward_return_20 ?? raw.forward_return ?? grad.forward_return),
      pUp,
      confidence,
      signal,
      xai,
      correct: parseTruth(r.is_correct),
      errorType: r.error_type || '—',
      rankConfidence: number(r.rank_confidence),
      rankXai: number(r.rank_xai_quality),
      show: parseTruth(r.show_in_dashboard) !== false,
      fg,
      bg,
      rawSrc: resolveRawImage(r.image_path, raw.file),
      overlaySrc: resolveGradcamImage(r.gradcam_raw_path, grad.file_stem, 'overlay'),
      maskedSrc: resolveGradcamImage(r.gradcam_masked_path, grad.file_stem, 'masked'),
      heatSrc: resolveGradcamImage(r.gradcam_heat_path, grad.file_stem, 'heat')
    };
  }).sort(defaultSort);
}

function defaultSort(a, b) {
  if (a.show !== b.show) return a.show ? -1 : 1;
  const conf = confidenceRank(b.confidence) - confidenceRank(a.confidence);
  if (conf !== 0) return conf;
  const xa = xaiRank(a.xai) - xaiRank(b.xai);
  if (xa !== 0) return xa;
  return (number(b.pUp) || 0) - (number(a.pUp) || 0);
}

function populateContractFilter() {
  const sel = document.getElementById('filter-contract');
  [...new Set(state.rows.map(r => r.contract).filter(Boolean))].sort().forEach(contract => {
    const opt = document.createElement('option');
    opt.value = contract;
    opt.textContent = contract;
    sel.appendChild(opt);
  });
}

function updateStaticMetrics() {
  const cmp = state.data.compare || [];
  const best = cmp.find(r => String(r.system || '').toLowerCase().includes('best_single')) || cmp[2];
  setText('kpi-best-full', formatMetric(best?.accuracy, 3, '0.587'));

  const tail = (state.data.tail || []).find(r => String(r.source || '').includes('single_I60') && String(r.tail_q_each_side) === '0.025');
  setText('kpi-best-tail', formatMetric(tail?.accuracy, 3, '0.688'));

  const strict = (state.data.finalists || []).find(r => String(r.source || '').includes('single_I120')) || (state.data.finalists || [])[0];
  setText('kpi-best-strict', formatMetric(strict?.accuracy, 3, '0.833'));
}

function applyFilters() {
  const filters = {
    contract: val('filter-contract'),
    split: val('filter-split'),
    signal: val('filter-signal'),
    confidence: val('filter-confidence'),
    xai: val('filter-xai'),
    date: val('filter-date'),
    search: val('filter-search').trim().toLowerCase()
  };

  state.filtered = state.rows.filter(r => {
    if (filters.contract !== 'all' && r.contract !== filters.contract) return false;
    if (filters.split !== 'all' && r.split !== filters.split) return false;
    if (filters.signal !== 'all' && r.signal !== filters.signal) return false;
    if (filters.confidence !== 'all' && r.confidence !== filters.confidence) return false;
    if (filters.xai !== 'all' && r.xai !== filters.xai) return false;
    if (filters.date && r.tradeDate !== filters.date) return false;
    if (filters.search) {
      const hay = [r.sampleId, r.contract, r.anchorTime, r.tradeDate, r.signal, r.confidence, r.xai].join(' ').toLowerCase();
      if (!hay.includes(filters.search)) return false;
    }
    return true;
  }).sort(defaultSort);

  renderQueue();
  selectRow(state.filtered[0] || null);
  setText('kpi-queue-size', String(state.filtered.length));
  setText('queue-summary-pill', `${state.filtered.length} surfaced case${state.filtered.length === 1 ? '' : 's'}`);
  renderCharts();
}

function resetFilters() {
  ['filter-contract','filter-split','filter-signal','filter-confidence','filter-xai'].forEach(id => document.getElementById(id).value = 'all');
  document.getElementById('filter-date').value = '';
  document.getElementById('filter-search').value = '';
  applyFilters();
}

function renderQueue() {
  const el = document.getElementById('queue-list');
  el.innerHTML = '';
  if (!state.filtered.length) {
    el.innerHTML = '<div class="queue-item"><div class="queue-title">No cases match the current filters.</div><div class="queue-sub">Relax the filters or upload more indexed images.</div></div>';
    return;
  }

  state.filtered.slice(0, 120).forEach((r, i) => {
    const item = document.createElement('button');
    item.className = 'queue-item' + (i === 0 ? ' active' : '');
    item.innerHTML = `
      <div class="queue-top">
        <div>
          <div class="queue-title">${escapeHTML(r.contract)} · ${escapeHTML(formatTs(r.anchorTime))}</div>
          <div class="queue-sub">sample ${escapeHTML(r.sampleId)} · P(up) ${formatMetric(r.pUp, 3, '—')}</div>
        </div>
        <span class="tag ${escapeHTML(r.confidence)}">${prettyConfidence(r.confidence)}</span>
      </div>
      <div class="queue-tags">
        <span class="tag ${escapeHTML(r.contract)}">${escapeHTML(r.contract)}</span>
        <span class="tag ${escapeHTML(r.split)}">${escapeHTML(r.split)}</span>
        <span class="tag ${escapeHTML(r.signal)}">${prettySignal(r.signal)}</span>
        <span class="tag ${escapeHTML(r.xai)}">${prettyXai(r.xai)}</span>
      </div>
    `;
    item.addEventListener('click', () => {
      document.querySelectorAll('.queue-item').forEach(x => x.classList.remove('active'));
      item.classList.add('active');
      selectRow(r);
    });
    el.appendChild(item);
  });
}

function selectRow(row) {
  state.selected = row;
  renderStudio();
}

function renderStudio() {
  const r = state.selected;
  if (!r) {
    setText('selected-title', 'No case selected');
    setText('selected-subtitle', 'Choose a surfaced case from the signal queue.');
    ['chip-contract','chip-split','chip-signal','chip-confidence','chip-xai'].forEach(id => setText(id, '—'));
    ['evidence-prob','evidence-fwd','evidence-correct','evidence-error','evidence-fg','evidence-bg'].forEach(id => setText(id, '—'));
    setText('decision-note', 'No decision note available.');
    document.getElementById('case-action-pill').textContent = 'Awaiting selection';
    document.getElementById('case-action-pill').className = 'case-action';
    updateMainImage('');
    updateThumb('thumb-raw', '');
    updateThumb('thumb-overlay', '');
    updateThumb('thumb-masked', '');
    updateThumb('thumb-heat', '');
    setBar('fg-bar', 0);
    setBar('bg-bar', 0);
    return;
  }

  setText('selected-title', `${r.contract} · ${formatTs(r.anchorTime)}`);
  setText('selected-subtitle', `${prettySignal(r.signal)} support · ${prettyConfidence(r.confidence)} confidence · ${prettyXai(r.xai)}`);
  setText('chip-contract', r.contract);
  setText('chip-split', r.split);
  setText('chip-signal', prettySignal(r.signal));
  setText('chip-confidence', prettyConfidence(r.confidence));
  setText('chip-xai', prettyXai(r.xai));

  setText('evidence-prob', formatMetric(r.pUp, 3, '—'));
  setText('evidence-fwd', formatSigned(r.forwardReturn));
  setText('evidence-correct', r.correct === null ? '—' : (r.correct ? 'Yes' : 'No'));
  setText('evidence-error', r.errorType || '—');
  setText('evidence-fg', formatMetric(r.fg, 3, '—'));
  setText('evidence-bg', formatMetric(r.bg, 3, '—'));
  setBar('fg-bar', Math.max(0, Math.min(100, (r.fg || 0) * 100)));
  setBar('bg-bar', Math.max(0, Math.min(100, (r.bg || 0) * 100)));

  const action = recommendAction(r);
  const actionEl = document.getElementById('case-action-pill');
  actionEl.textContent = action.label;
  actionEl.className = `case-action ${action.kind}`;
  setText('decision-note', action.note);

  updateThumb('thumb-raw', r.rawSrc);
  updateThumb('thumb-overlay', r.overlaySrc);
  updateThumb('thumb-masked', r.maskedSrc);
  updateThumb('thumb-heat', r.heatSrc);
  setView(state.view);
}

function setView(view) {
  state.view = view;
  document.querySelectorAll('.tab').forEach(btn => btn.classList.toggle('active', btn.dataset.view === view));
  document.querySelectorAll('.thumb-card').forEach(btn => btn.classList.toggle('active', btn.dataset.view === view));

  const r = state.selected;
  if (!r) return updateMainImage('');
  const src = view === 'raw' ? r.rawSrc : view === 'overlay' ? r.overlaySrc : view === 'masked' ? r.maskedSrc : r.heatSrc;
  updateMainImage(src);
}

function updateMainImage(src) {
  const img = document.getElementById('main-image');
  const empty = document.getElementById('main-image-empty');
  if (!src) {
    img.style.display = 'none';
    img.removeAttribute('src');
    empty.style.display = 'grid';
    empty.textContent = 'No image available yet. Upload the corresponding PNG/JPG into the expected assets folder.';
    return;
  }
  img.style.display = 'block';
  img.src = src;
  img.onerror = () => {
    img.style.display = 'none';
    empty.style.display = 'grid';
    empty.textContent = `Missing asset: ${src}`;
  };
  img.onload = () => {
    empty.style.display = 'none';
  };
}

function updateThumb(id, src) {
  const img = document.getElementById(id);
  if (!img) return;
  if (!src) {
    img.removeAttribute('src');
    img.style.display = 'none';
    return;
  }
  img.style.display = 'block';
  img.src = src;
  img.onerror = () => {
    img.removeAttribute('src');
    img.style.display = 'none';
  };
}

function renderCharts() {
  destroyCharts();

  renderFullSampleChart();
  renderTailChart();
  renderXaiChart();
  renderQueueChart();
}

function renderFullSampleChart() {
  const rows = (state.data.compare || []).map(r => ({
    label: prettySystem(r.system),
    bal: number(r.balanced_accuracy),
    auc: number(r.roc_auc)
  }));

  state.charts.full = new Chart(document.getElementById('chart-fullsample'), {
    type: 'bar',
    data: {
      labels: rows.map(r => r.label),
      datasets: [
        { label: 'Balanced accuracy', data: rows.map(r => r.bal), backgroundColor: 'rgba(99,214,255,0.72)', borderRadius: 8 },
        { label: 'ROC-AUC', data: rows.map(r => r.auc), backgroundColor: 'rgba(255,202,87,0.72)', borderRadius: 8 }
      ]
    },
    options: chartOptions(0.40, 0.65)
  });
}

function renderTailChart() {
  const rows = (state.data.tail || []).map(r => ({
    x: number(r.coverage) * 100,
    y: number(r.balanced_accuracy),
    source: prettySystem(r.source)
  })).filter(r => isFinite(r.x) && isFinite(r.y));

  const optionB = (state.data.optionB || []).map(r => ({
    x: number(r.coverage) * 100,
    y: number(r.balanced_accuracy),
    source: prettySystem(r.source)
  })).filter(r => isFinite(r.x) && isFinite(r.y));

  state.charts.tail = new Chart(document.getElementById('chart-tail'), {
    type: 'scatter',
    data: {
      datasets: [
        {
          label: 'Main tail grid',
          data: rows,
          backgroundColor: 'rgba(25,211,162,0.85)'
        },
        {
          label: 'Strict finalists',
          data: optionB,
          backgroundColor: 'rgba(255,95,122,0.9)'
        }
      ]
    },
    options: {
      ...baseChartOptions(),
      scales: {
        x: axisConfig('Coverage (%)', 0, 12),
        y: axisConfig('Balanced accuracy', 0.45, 0.90)
      },
      parsing: false,
      plugins: {
        ...tooltipLegend(),
        tooltip: {
          callbacks: {
            label: ctx => `${ctx.raw.source}: ${ctx.raw.x.toFixed(1)}% · ${ctx.raw.y.toFixed(3)}`
          }
        }
      }
    }
  });
}

function renderXaiChart() {
  const detail = state.data.xaiDetail || [];
  let summaryRows = [];
  if (detail.length) {
    const groups = {};
    detail.forEach(r => {
      const key = normalizeXai(r.focus_group, r.foreground_heat, r.background_heat);
      if (!groups[key]) groups[key] = { key, n: 0, fg: 0, bg: 0 };
      groups[key].n += 1;
      groups[key].fg += number(r.foreground_heat) || 0;
      groups[key].bg += number(r.background_heat) || 0;
    });
    summaryRows = Object.values(groups).map(g => ({
      label: prettyXai(g.key),
      fg: g.fg / g.n,
      bg: g.bg / g.n
    }));
  } else {
    summaryRows = (state.data.xaiSummary || []).map(r => ({
      label: prettyXai(normalizeXai(r.focus_group, r.avg_fg_heat, r.avg_bg_heat)),
      fg: number(r.avg_fg_heat),
      bg: number(r.avg_bg_heat)
    }));
  }

  state.charts.xai = new Chart(document.getElementById('chart-xai'), {
    type: 'bar',
    data: {
      labels: summaryRows.map(r => r.label),
      datasets: [
        { label: 'Foreground', data: summaryRows.map(r => r.fg), backgroundColor: 'rgba(99,214,255,0.78)', borderRadius: 8 },
        { label: 'Background', data: summaryRows.map(r => r.bg), backgroundColor: 'rgba(255,141,78,0.78)', borderRadius: 8 }
      ]
    },
    options: chartOptions(0, 1.0)
  });
}

function renderQueueChart() {
  const confs = ['very_high', 'high', 'medium', 'low'];
  const counts = confs.map(c => state.filtered.filter(r => r.confidence === c).length);
  const signals = ['long','short','watch'].map(s => state.filtered.filter(r => r.signal === s).length);

  state.charts.queue = new Chart(document.getElementById('chart-queue'), {
    type: 'bar',
    data: {
      labels: ['Very high', 'High', 'Medium', 'Low', 'Long', 'Short', 'Watch'],
      datasets: [{
        label: 'Count',
        data: [...counts, ...signals],
        backgroundColor: [
          'rgba(25,211,162,0.78)',
          'rgba(76,214,162,0.68)',
          'rgba(255,202,87,0.76)',
          'rgba(255,95,122,0.78)',
          'rgba(25,211,162,0.78)',
          'rgba(255,95,122,0.78)',
          'rgba(255,202,87,0.76)'
        ],
        borderRadius: 8
      }]
    },
    options: chartOptions(0, Math.max(5, ...counts, ...signals) + 2, 'Count')
  });
}

function destroyCharts() {
  Object.values(state.charts).forEach(chart => chart && chart.destroy && chart.destroy());
  state.charts = {};
}

function chartOptions(min, max, yLabel='Metric') {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: tooltipLegend(),
    scales: {
      x: {
        ticks: { color: '#bed0ea', font: { family: 'Inter', size: 11 } },
        grid: { color: 'rgba(255,255,255,0.04)' }
      },
      y: axisConfig(yLabel, min, max)
    }
  };
}

function axisConfig(label, min, max) {
  return {
    min, max,
    ticks: { color: '#bed0ea', font: { family: 'Inter', size: 11 } },
    title: { display: true, text: label, color: '#97aac8', font: { family: 'Inter', size: 11, weight: '600' } },
    grid: { color: 'rgba(255,255,255,0.05)' }
  };
}

function baseChartOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: tooltipLegend()
  };
}

function tooltipLegend() {
  return {
    legend: {
      labels: { color: '#edf4ff', font: { family: 'Inter', size: 11, weight: '600' } }
    },
    tooltip: {
      backgroundColor: 'rgba(8,16,29,0.96)',
      titleColor: '#edf4ff',
      bodyColor: '#edf4ff',
      borderColor: 'rgba(99,214,255,0.18)',
      borderWidth: 1
    }
  };
}

function recommendAction(row) {
  if (!row) return { label: 'Awaiting selection', kind: '', note: 'No case selected.' };
  if ((row.confidence === 'very_high' || row.confidence === 'high') && (row.xai === 'chart-led' || row.xai === 'mixed')) {
    return {
      label: row.signal === 'short' ? 'High-priority short review' : row.signal === 'long' ? 'High-priority long review' : 'High-priority review',
      kind: row.signal,
      note: `Surface this case to the analyst queue. Confidence is ${prettyConfidence(row.confidence).toLowerCase()} and XAI is ${prettyXai(row.xai).toLowerCase()}. Use the overlay to verify whether the highlighted region follows the price path rather than broad background structure.`
    };
  }
  if (row.xai === 'background-heavy' || row.confidence === 'medium') {
    return {
      label: 'Review with caution',
      kind: 'watch',
      note: 'This case may still be useful, but the support signal should not be escalated without visual confirmation because either confidence is not extreme or the explanation remains background-heavy.'
    };
  }
  return {
    label: 'Abstain / deprioritize',
    kind: 'watch',
    note: 'Do not elevate this case as a surfaced trading-support candidate. Keep it visible for audit and comparison, but treat it as a non-actionable interior-score or low-trust case.'
  };
}

function resolveRawImage(pathValue, fileValue) {
  const file = basename(pathValue) || fileValue || '';
  return file ? `assets/raw/${file}` : '';
}

function resolveGradcamImage(pathValue, fileStem, kind) {
  let file = basename(pathValue);
  if (!file && fileStem) {
    if (kind === 'overlay') file = `${fileStem}_overlay.png`;
    if (kind === 'masked') file = `${fileStem}_masked_overlay.png`;
    if (kind === 'heat') file = `${fileStem}_heatmap.png`;
  }
  if (!file) return '';
  const dir = kind === 'overlay' ? 'assets/gradcam/overlay' : kind === 'masked' ? 'assets/gradcam/masked' : 'assets/gradcam/heat';
  return `${dir}/${file}`;
}

function basename(p) {
  if (!p) return '';
  return String(p).split('/').pop();
}

function extractDate(ts) {
  const m = String(ts || '').match(/\d{4}-\d{2}-\d{2}/);
  return m ? m[0] : '';
}

function formatTs(ts) {
  return String(ts || '').replace('T', ' ');
}

function normalizeConfidence(v) {
  const s = String(v || '').toLowerCase();
  if (s.includes('very') && s.includes('high')) return 'very_high';
  if (s.includes('high')) return 'high';
  if (s.includes('medium')) return 'medium';
  if (s.includes('low')) return 'low';
  const n = number(v);
  if (isFinite(n)) {
    if (n >= 0.9) return 'very_high';
    if (n >= 0.75) return 'high';
    if (n >= 0.6) return 'medium';
    return 'low';
  }
  return 'medium';
}

function normalizeSignal(bucket, pred, pUp) {
  const s = String(bucket || '').toLowerCase();
  if (s.includes('long')) return 'long';
  if (s.includes('short')) return 'short';
  if (s.includes('watch')) return 'watch';
  const p = number(pUp);
  if (isFinite(p)) {
    if (p >= 0.7) return 'long';
    if (p <= 0.3) return 'short';
  }
  const pr = number(pred);
  if (pr === 1) return 'long';
  if (pr === 0) return 'short';
  return 'watch';
}

function normalizeXai(bucket, fg, bg) {
  const s = String(bucket || '').toLowerCase();
  if (s.includes('chart')) return 'chart-led';
  if (s.includes('background')) return 'background-heavy';
  if (s.includes('mixed')) return 'mixed';
  const f = number(fg), b = number(bg);
  if (isFinite(f) && isFinite(b)) {
    if (f >= 0.22 && f >= b * 0.22) return 'chart-led';
    if (f >= 0.10) return 'mixed';
    return 'background-heavy';
  }
  return 'mixed';
}

function confidenceRank(v) {
  return { very_high: 4, high: 3, medium: 2, low: 1 }[v] || 0;
}
function xaiRank(v) {
  return { 'chart-led': 1, mixed: 2, 'background-heavy': 3 }[v] || 2;
}

function prettyConfidence(v) {
  return ({ very_high: 'Very High', high: 'High', medium: 'Medium', low: 'Low' }[v]) || v;
}
function prettySignal(v) {
  return ({ long: 'Long', short: 'Short', watch: 'Watch' }[v]) || v;
}
function prettyXai(v) {
  return ({ 'chart-led': 'Chart-led', mixed: 'Mixed', 'background-heavy': 'Background-heavy' }[v]) || v;
}
function prettySystem(v) {
  const s = String(v || '');
  if (s.includes('best_single_fullsample') || s.includes('single_I60')) return 'Single I60 OHLC';
  if (s.includes('multiscale_fullsample') || s.includes('multi_20_60')) return 'Multi 20+60 Rich';
  if (s.includes('best_tail_rule')) return 'I60 Tail Rule';
  if (s.includes('single_I120')) return 'Single I120';
  if (s.includes('gated') && s.includes('ma0_vol0')) return 'Gated 20+60+120';
  if (s.includes('gated') && s.includes('ma1_vol1')) return 'Gated Rich';
  if (s.includes('numeric')) return 'Numeric logistic';
  if (s.includes('simple_momentum')) return 'Momentum sign';
  if (s.includes('hog')) return 'HOG I120';
  if (s.includes('haar')) return 'HAAR-like';
  return s.replaceAll('_', ' ');
}

function parseTruth(v) {
  if (v === '' || v === undefined || v === null) return null;
  const s = String(v).toLowerCase();
  if (['1','true','yes'].includes(s)) return true;
  if (['0','false','no'].includes(s)) return false;
  return null;
}

function setBar(id, pct) {
  const el = document.getElementById(id);
  if (el) el.style.width = `${pct}%`;
}

function val(id) { return document.getElementById(id).value; }
function setText(id, text) { const el = document.getElementById(id); if (el) el.textContent = text; }
function number(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}
function formatMetric(v, digits=3, fallback='—') {
  const n = number(v);
  return Number.isFinite(n) ? n.toFixed(digits) : fallback;
}
function formatSigned(v) {
  const n = number(v);
  return Number.isFinite(n) ? `${n > 0 ? '+' : ''}${n.toFixed(4)}` : '—';
}
function escapeHTML(v) {
  return String(v ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'", '&#039;');
}
