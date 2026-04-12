const DATA = {
  dashboard: "data/dashboard_master.csv",
  compare: "data/final_compare_table.csv",
  ablation: "data/ablation_summary.csv",
  tail: "data/tail_grid_results.csv",
  optionB: "data/optionB_tail_grid_results.csv",
  xaiSummary: "data/gradcam_chart_vs_background_summary.csv",
  xaiDetail: "data/gradcam_chart_vs_background_detail.csv",
  finalists: "data/optionB_finalists.csv",
  rawIndexTest: "data/test_raw_index.csv",
  rawIndexTrain: "data/train_raw_index.csv",
  rawIndexVal: "data/val_raw_index.csv",
  gradcamIndex: "data/test_gradcam_index.csv"
};

const state = {
  data: {},
  rows: [],
  filtered: [],
  selected: null,
  charts: {},
  view: "raw"
};

document.addEventListener("DOMContentLoaded", async () => {
  bindUI();
  await loadData();
  buildRows();
  populateContractFilter();
  updateStaticMetrics();
  applyFilters();
});

function bindUI() {
  const applyBtn = document.getElementById("apply-filters");
  const resetBtn = document.getElementById("reset-filters");

  if (applyBtn) applyBtn.addEventListener("click", applyFilters);
  if (resetBtn) resetBtn.addEventListener("click", resetFilters);

  document.querySelectorAll(".tab, .thumb-card").forEach(btn => {
    btn.addEventListener("click", () => setView(btn.dataset.view));
  });

  document.querySelectorAll(".nav-link").forEach(link => {
    link.addEventListener("click", () => {
      document.querySelectorAll(".nav-link").forEach(n => n.classList.remove("active"));
      link.classList.add("active");
    });
  });
}

async function loadData() {
  const entries = Object.entries(DATA);
  const loaded = await Promise.all(
    entries.map(async ([key, path]) => [key, await loadCSV(path)])
  );

  loaded.forEach(([key, rows]) => {
    state.data[key] = rows;
  });
}

function loadCSV(path) {
  return new Promise(resolve => {
    Papa.parse(path, {
      download: true,
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
      complete: results => resolve(results.data || []),
      error: () => resolve([])
    });
  });
}

function buildRows() {
  const rawMap = {};

  [
    ...(state.data.rawIndexTest || []),
    ...(state.data.rawIndexTrain || []),
    ...(state.data.rawIndexVal || [])
  ].forEach(r => {
    const sid = sampleIdFromRow(r);
    if (sid) rawMap[sid] = r;
  });

  const gradMap = {};
  (state.data.gradcamIndex || []).forEach(r => {
    const sid = sampleIdFromRow(r);
    if (sid) gradMap[sid] = r;
  });

  state.rows = (state.data.dashboard || []).map((r, idx) => {
    const sampleId = sampleIdFromRow(r) || String(idx);
    const raw = rawMap[sampleId] || {};
    const grad = gradMap[sampleId] || {};

    const split = normalizeSplit(
      getAny(r, ["split", "dataset_split", "set"]) ||
      getAny(raw, ["split", "dataset_split", "set"]) ||
      "test"
    );

    const pUp = number(getAny(r, ["cnn_p_up", "p_up", "prob_up"]));
    const pred = number(getAny(r, ["cnn_pred", "pred", "prediction", "y_pred"]));
    const confidence = normalizeConfidence(
      getAny(r, ["confidence_bucket", "cnn_confidence", "confidence"]),
      pUp
    );
    const signal = normalizeSignal(
      getAny(r, ["signal_bucket", "signal"]),
      pred,
      pUp
    );
    const fg = number(getAny(r, ["heat_on_foreground", "foreground_heat", "chart_share"]));
    const bg = number(getAny(r, ["heat_on_background", "background_heat", "background_share"]));
    const xai = normalizeXai(
      getAny(r, ["xai_quality_bucket", "xai_group", "focus_group"]),
      fg,
      bg
    );

    const rawSrc = resolveRawImageBySplit(
      getAny(r, ["image_path", "raw_image_path"]),
      getAny(raw, ["file", "image_file", "image_path"]),
      split,
      getAny(grad, ["file_stem", "stem"])
    );

    const overlaySrc = resolveGradcamImage(
      getAny(r, ["gradcam_raw_path", "overlay_path"]),
      getAny(grad, ["file_stem", "stem", "file", "filename"]),
      "overlay"
    );

    const maskedSrc = resolveGradcamImage(
      getAny(r, ["gradcam_masked_path", "masked_overlay_path"]),
      getAny(grad, ["file_stem", "stem", "file", "filename"]),
      "masked"
    );

    const heatSrc = resolveGradcamImage(
      getAny(r, ["gradcam_heat_path", "heatmap_path"]),
      getAny(grad, ["file_stem", "stem", "file", "filename"]),
      "heat"
    );

    return {
      sampleId,
      contract: getAny(r, ["contract", "secid", "symbol"]) || getAny(raw, ["contract", "secid", "symbol"]) || "NA",
      split,
      anchorTime: getAny(r, ["anchor_time", "timestamp", "anchor_ts"]) || getAny(raw, ["anchor_ts", "timestamp"]) || "",
      tradeDate: getAny(r, ["trade_date", "date"]) || extractDate(getAny(r, ["anchor_time", "timestamp", "anchor_ts"])) || extractDate(getAny(raw, ["anchor_ts", "timestamp"])),
      labelUp: number(getAny(r, ["label_20", "label", "label_up", "y_true"])),
      forwardReturn: number(getAny(r, ["forward_return_20", "forward_return"]) || getAny(raw, ["forward_return"])),
      pUp,
      pred,
      confidence,
      signal,
      xai,
      correct: parseTruth(getAny(r, ["is_correct", "correct"])),
      errorType: getAny(r, ["error_type"]) || "—",
      show: parseTruth(getAny(r, ["show_in_dashboard"])) !== false,
      fg,
      bg,
      rawSrc,
      overlaySrc,
      maskedSrc,
      heatSrc
    };
  }).sort(defaultSort);
}

function sampleIdFromRow(r) {
  const direct = getAny(r, ["sample_id", "id", "idx", "index"]);
  if (direct !== undefined && direct !== null && direct !== "") {
    return String(normalizeId(direct));
  }

  const fileStem = getAny(r, ["file_stem", "stem"]);
  if (fileStem) return String(fileStem).split("_")[0];

  const fileName = getAny(r, ["file", "filename", "image_path"]);
  if (fileName) return basename(fileName).split("_")[0];

  return "";
}

function normalizeId(v) {
  const n = Number(v);
  if (Number.isFinite(n)) return Math.trunc(n);
  return String(v).trim();
}

function defaultSort(a, b) {
  if (a.show !== b.show) return a.show ? -1 : 1;

  const conf = confidenceRank(b.confidence) - confidenceRank(a.confidence);
  if (conf !== 0) return conf;

  const xa = xaiRank(a.xai) - xaiRank(b.xai);
  if (xa !== 0) return xa;

  const edgeA = Number.isFinite(a.pUp) ? Math.abs(a.pUp - 0.5) : -1;
  const edgeB = Number.isFinite(b.pUp) ? Math.abs(b.pUp - 0.5) : -1;
  if (edgeB !== edgeA) return edgeB - edgeA;

  return String(b.anchorTime || "").localeCompare(String(a.anchorTime || ""));
}

function populateContractFilter() {
  const sel = document.getElementById("filter-contract");
  if (!sel) return;

  const existing = new Set(Array.from(sel.options).map(o => o.value));
  [...new Set(state.rows.map(r => r.contract).filter(Boolean))].sort().forEach(contract => {
    if (existing.has(contract)) return;
    const opt = document.createElement("option");
    opt.value = contract;
    opt.textContent = contract;
    sel.appendChild(opt);
  });
}

function updateStaticMetrics() {
  const cmp = state.data.compare || [];

  const best = cmp.find(r => {
    const s = String(getAny(r, ["system", "model", "source"])).toLowerCase();
    return s.includes("best_single") || s.includes("single_i60");
  }) || cmp[0];

  setText("kpi-best-full", formatMetric(getAny(best || {}, ["accuracy", "acc"]), 3, "0.587"));

  const tail = (state.data.tail || []).find(r => {
    const s = String(getAny(r, ["source", "system"])).toLowerCase();
    const q = String(getAny(r, ["tail_q_each_side", "q", "quantile"]));
    return s.includes("single_i60") && (q === "0.025" || q === "0.0250");
  }) || (state.data.tail || [])[0];

  setText("kpi-best-tail", formatMetric(getAny(tail || {}, ["accuracy", "acc"]), 3, "0.688"));

  const strict = (state.data.finalists || []).find(r => {
    const s = String(getAny(r, ["source", "system"])).toLowerCase();
    return s.includes("single_i120");
  }) || (state.data.finalists || [])[0];

  setText("kpi-best-strict", formatMetric(getAny(strict || {}, ["accuracy", "acc"]), 3, "0.833"));
}

function applyFilters() {
  const filters = {
    contract: val("filter-contract"),
    split: val("filter-split"),
    signal: val("filter-signal"),
    confidence: val("filter-confidence"),
    xai: val("filter-xai"),
    date: val("filter-date"),
    search: val("filter-search").trim().toLowerCase()
  };

  state.filtered = state.rows.filter(r => {
    if (filters.contract !== "all" && r.contract !== filters.contract) return false;
    if (filters.split !== "all" && r.split !== filters.split) return false;
    if (filters.signal !== "all" && r.signal !== filters.signal) return false;
    if (filters.confidence !== "all" && r.confidence !== filters.confidence) return false;
    if (filters.xai !== "all" && r.xai !== filters.xai) return false;
    if (filters.date && r.tradeDate !== filters.date) return false;

    if (filters.search) {
      const hay = [
        r.sampleId,
        r.contract,
        r.anchorTime,
        r.tradeDate,
        r.signal,
        r.confidence,
        r.xai
      ].join(" ").toLowerCase();

      if (!hay.includes(filters.search)) return false;
    }

    return true;
  }).sort(defaultSort);

  renderQueue();
  selectRow(selectBestInitialRow(state.filtered));
  setText("kpi-queue-size", String(state.filtered.length));
  setText("queue-summary-pill", `${state.filtered.length} surfaced case${state.filtered.length === 1 ? "" : "s"}`);
  renderCharts();
}

function selectBestInitialRow(rows) {
  if (!rows || !rows.length) return null;
  const withRaw = rows.find(r => !!r.rawSrc);
  return withRaw || rows[0];
}

function resetFilters() {
  ["filter-contract", "filter-split", "filter-signal", "filter-confidence", "filter-xai"]
    .forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = "all";
    });

  const dateEl = document.getElementById("filter-date");
  const searchEl = document.getElementById("filter-search");
  if (dateEl) dateEl.value = "";
  if (searchEl) searchEl.value = "";

  applyFilters();
}

function renderQueue() {
  const el = document.getElementById("queue-list");
  if (!el) return;

  el.innerHTML = "";

  if (!state.filtered.length) {
    el.innerHTML = `
      <div class="queue-item">
        <div class="queue-title">No cases match the current filters.</div>
        <div class="queue-sub">Relax the filters or upload more indexed images.</div>
      </div>
    `;
    return;
  }

  state.filtered.slice(0, 120).forEach((r, i) => {
    const item = document.createElement("button");
    item.className = "queue-item" + (i === 0 ? " active" : "");

    item.innerHTML = `
      <div class="queue-top">
        <div>
          <div class="queue-title">${escapeHTML(r.contract)} · ${escapeHTML(formatTs(r.anchorTime))}</div>
          <div class="queue-sub">sample ${escapeHTML(r.sampleId)} · P(up) ${formatMetric(r.pUp, 3, "—")}</div>
        </div>
        <span class="tag ${escapeHTML(r.confidence)}">${prettyConfidence(r.confidence)}</span>
      </div>
      <div class="queue-tags">
        <span class="tag">${escapeHTML(r.contract)}</span>
        <span class="tag">${escapeHTML(r.split)}</span>
        <span class="tag ${escapeHTML(r.signal)}">${prettySignal(r.signal)}</span>
        <span class="tag ${escapeHTML(r.xai)}">${prettyXai(r.xai)}</span>
      </div>
    `;

    item.addEventListener("click", () => {
      document.querySelectorAll(".queue-item").forEach(x => x.classList.remove("active"));
      item.classList.add("active");
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
    setText("selected-title", "No case selected");
    setText("selected-subtitle", "Choose a surfaced case from the signal queue.");
    ["chip-contract", "chip-split", "chip-signal", "chip-confidence", "chip-xai"].forEach(id => setText(id, "—"));
    ["evidence-prob", "evidence-fwd", "evidence-correct", "evidence-error", "evidence-fg", "evidence-bg"].forEach(id => setText(id, "—"));
    setText("decision-note", "No decision note available.");

    const actionEl = document.getElementById("case-action-pill");
    if (actionEl) {
      actionEl.textContent = "Awaiting selection";
      actionEl.className = "case-action";
    }

    updateMainImage("");
    updateThumb("thumb-raw", "");
    updateThumb("thumb-overlay", "");
    updateThumb("thumb-masked", "");
    updateThumb("thumb-heat", "");
    setBar("fg-bar", 0);
    setBar("bg-bar", 0);
    return;
  }

  setText("selected-title", `${r.contract} · ${formatTs(r.anchorTime)}`);
  setText("selected-subtitle", `${prettySignal(r.signal)} support · ${prettyConfidence(r.confidence)} confidence · ${prettyXai(r.xai)}`);
  setText("chip-contract", r.contract);
  setText("chip-split", r.split);
  setText("chip-signal", prettySignal(r.signal));
  setText("chip-confidence", prettyConfidence(r.confidence));
  setText("chip-xai", prettyXai(r.xai));

  setText("evidence-prob", formatMetric(r.pUp, 3, "—"));
  setText("evidence-fwd", formatSigned(r.forwardReturn));
  setText("evidence-correct", r.correct === null ? "—" : (r.correct ? "Yes" : "No"));
  setText("evidence-error", r.errorType || "—");
  setText("evidence-fg", formatMetric(r.fg, 3, "—"));
  setText("evidence-bg", formatMetric(r.bg, 3, "—"));

  setBar("fg-bar", Math.max(0, Math.min(100, (Number.isFinite(r.fg) ? r.fg : 0) * 100)));
  setBar("bg-bar", Math.max(0, Math.min(100, (Number.isFinite(r.bg) ? r.bg : 0) * 100)));

  const action = recommendAction(r);
  const actionEl = document.getElementById("case-action-pill");
  if (actionEl) {
    actionEl.textContent = action.label;
    actionEl.className = `case-action ${action.kind}`;
  }
  setText("decision-note", action.note);

  updateThumb("thumb-raw", r.rawSrc);
  updateThumb("thumb-overlay", r.overlaySrc);
  updateThumb("thumb-masked", r.maskedSrc);
  updateThumb("thumb-heat", r.heatSrc);

  const bestView = chooseAvailableView(r, state.view);
  setView(bestView);
}

function chooseAvailableView(row, preferred) {
  const options = {
    raw: row.rawSrc,
    overlay: row.overlaySrc,
    masked: row.maskedSrc,
    heat: row.heatSrc
  };
  if (options[preferred]) return preferred;
  return ["raw", "overlay", "masked", "heat"].find(v => options[v]) || "raw";
}

function setView(view) {
  state.view = view;

  document.querySelectorAll(".tab").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.view === view);
  });

  document.querySelectorAll(".thumb-card").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.view === view);
  });

  const r = state.selected;
  if (!r) {
    updateMainImage("");
    return;
  }

  const src =
    view === "raw" ? r.rawSrc :
    view === "overlay" ? r.overlaySrc :
    view === "masked" ? r.maskedSrc :
    r.heatSrc;

  updateMainImage(src);
}

function updateMainImage(src) {
  const img = document.getElementById("main-image");
  const empty = document.getElementById("main-image-empty");
  if (!img || !empty) return;

  if (!src) {
    img.style.display = "none";
    img.removeAttribute("src");
    empty.style.display = "grid";
    empty.textContent = "No image available for this view.";
    return;
  }

  img.style.display = "block";
  img.src = src;

  img.onerror = () => {
    img.style.display = "none";
    empty.style.display = "grid";
    empty.textContent = `Missing asset: ${src}`;
  };

  img.onload = () => {
    empty.style.display = "none";
  };
}

function updateThumb(id, src) {
  const img = document.getElementById(id);
  if (!img) return;

  if (!src) {
    img.removeAttribute("src");
    img.style.display = "none";
    return;
  }

  img.style.display = "block";
  img.src = src;

  img.onerror = () => {
    img.removeAttribute("src");
    img.style.display = "none";
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
    label: prettySystem(getAny(r, ["system", "model", "source"])),
    bal: number(getAny(r, ["balanced_accuracy", "bal_acc", "bal_accuracy"])),
    auc: number(getAny(r, ["roc_auc", "auc"]))
  })).filter(r => Number.isFinite(r.bal) || Number.isFinite(r.auc));

  const canvas = document.getElementById("chart-fullsample");
  if (!canvas || !rows.length) return;

  state.charts.full = new Chart(canvas, {
    type: "bar",
    data: {
      labels: rows.map(r => r.label),
      datasets: [
        {
          label: "Balanced accuracy",
          data: rows.map(r => r.bal),
          backgroundColor: "rgba(99,214,255,0.72)",
          borderRadius: 8
        },
        {
          label: "ROC-AUC",
          data: rows.map(r => r.auc),
          backgroundColor: "rgba(255,202,87,0.72)",
          borderRadius: 8
        }
      ]
    },
    options: chartOptions(0.40, 0.70)
  });
}

function renderTailChart() {
  const rows = (state.data.tail || []).map(r => ({
    x: number(getAny(r, ["coverage"])),
    y: number(getAny(r, ["balanced_accuracy", "bal_acc"])),
    source: prettySystem(getAny(r, ["source", "system"]))
  })).filter(r => Number.isFinite(r.x) && Number.isFinite(r.y))
    .map(r => ({ ...r, x: r.x * 100 }));

  const optionB = (state.data.optionB || []).map(r => ({
    x: number(getAny(r, ["coverage"])),
    y: number(getAny(r, ["balanced_accuracy", "bal_acc"])),
    source: prettySystem(getAny(r, ["source", "system"]))
  })).filter(r => Number.isFinite(r.x) && Number.isFinite(r.y))
    .map(r => ({ ...r, x: r.x * 100 }));

  const canvas = document.getElementById("chart-tail");
  if (!canvas) return;

  state.charts.tail = new Chart(canvas, {
    type: "scatter",
    data: {
      datasets: [
        {
          label: "Main tail grid",
          data: rows,
          backgroundColor: "rgba(25,211,162,0.85)"
        },
        {
          label: "Strict finalists",
          data: optionB,
          backgroundColor: "rgba(255,95,122,0.9)"
        }
      ]
    },
    options: {
      ...baseChartOptions(),
      scales: {
        x: axisConfig("Coverage (%)", 0, 15),
        y: axisConfig("Balanced accuracy", 0.45, 0.90)
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
  let summaryRows = [];

  const detail = state.data.xaiDetail || [];
  const summary = state.data.xaiSummary || [];

  if (detail.length) {
    const groups = {};
    detail.forEach(r => {
      const key = normalizeXai(
        getAny(r, ["focus_group", "xai_group"]),
        getAny(r, ["foreground_heat", "heat_on_foreground", "chart_share"]),
        getAny(r, ["background_heat", "heat_on_background", "background_share"])
      );

      if (!groups[key]) groups[key] = { key, n: 0, fg: 0, bg: 0 };

      groups[key].n += 1;
      groups[key].fg += number(getAny(r, ["foreground_heat", "heat_on_foreground", "chart_share"])) || 0;
      groups[key].bg += number(getAny(r, ["background_heat", "heat_on_background", "background_share"])) || 0;
    });

    summaryRows = Object.values(groups).map(g => ({
      label: prettyXai(g.key),
      fg: g.n ? g.fg / g.n : 0,
      bg: g.n ? g.bg / g.n : 0
    }));
  } else if (summary.length) {
    summaryRows = summary.map(r => ({
      label: prettyXai(normalizeXai(
        getAny(r, ["focus_group", "xai_group"]),
        getAny(r, ["avg_fg_heat", "foreground_heat", "heat_on_foreground"]),
        getAny(r, ["avg_bg_heat", "background_heat", "heat_on_background"])
      )),
      fg: number(getAny(r, ["avg_fg_heat", "foreground_heat", "heat_on_foreground"])),
      bg: number(getAny(r, ["avg_bg_heat", "background_heat", "heat_on_background"]))
    })).filter(r => Number.isFinite(r.fg) || Number.isFinite(r.bg));
  }

  const canvas = document.getElementById("chart-xai");
  if (!canvas || !summaryRows.length) return;

  state.charts.xai = new Chart(canvas, {
    type: "bar",
    data: {
      labels: summaryRows.map(r => r.label),
      datasets: [
        {
          label: "Foreground",
          data: summaryRows.map(r => r.fg),
          backgroundColor: "rgba(99,214,255,0.78)",
          borderRadius: 8
        },
        {
          label: "Background",
          data: summaryRows.map(r => r.bg),
          backgroundColor: "rgba(255,141,78,0.78)",
          borderRadius: 8
        }
      ]
    },
    options: chartOptions(0, 1.0)
  });
}

function renderQueueChart() {
  const confs = ["very_high", "high", "medium", "low"];
  const confCounts = confs.map(c => state.filtered.filter(r => r.confidence === c).length);
  const signalCounts = ["long", "short", "watch"].map(s => state.filtered.filter(r => r.signal === s).length);

  const all = [...confCounts, ...signalCounts];
  const top = Math.max(5, ...all) + 2;

  const canvas = document.getElementById("chart-queue");
  if (!canvas) return;

  state.charts.queue = new Chart(canvas, {
    type: "bar",
    data: {
      labels: ["Very high", "High", "Medium", "Low", "Long", "Short", "Watch"],
      datasets: [
        {
          label: "Count",
          data: all,
          backgroundColor: [
            "rgba(25,211,162,0.78)",
            "rgba(76,214,162,0.68)",
            "rgba(255,202,87,0.76)",
            "rgba(255,95,122,0.78)",
            "rgba(25,211,162,0.78)",
            "rgba(255,95,122,0.78)",
            "rgba(255,202,87,0.76)"
          ],
          borderRadius: 8
        }
      ]
    },
    options: chartOptions(0, top, "Count")
  });
}

function destroyCharts() {
  Object.values(state.charts).forEach(chart => {
    if (chart && chart.destroy) chart.destroy();
  });
  state.charts = {};
}

function chartOptions(min, max, yLabel = "Metric") {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: tooltipLegend(),
    scales: {
      x: {
        ticks: { color: "#bed0ea", font: { family: "Inter", size: 11 } },
        grid: { color: "rgba(255,255,255,0.04)" }
      },
      y: axisConfig(yLabel, min, max)
    }
  };
}

function axisConfig(label, min, max) {
  return {
    min,
    max,
    ticks: { color: "#bed0ea", font: { family: "Inter", size: 11 } },
    title: {
      display: true,
      text: label,
      color: "#97aac8",
      font: { family: "Inter", size: 11, weight: "600" }
    },
    grid: { color: "rgba(255,255,255,0.05)" }
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
      labels: {
        color: "#edf4ff",
        font: { family: "Inter", size: 11, weight: "600" }
      }
    },
    tooltip: {
      backgroundColor: "rgba(8,16,29,0.96)",
      titleColor: "#edf4ff",
      bodyColor: "#edf4ff",
      borderColor: "rgba(99,214,255,0.18)",
      borderWidth: 1
    }
  };
}

function recommendAction(row) {
  if (!row) {
    return { label: "Awaiting selection", kind: "", note: "No case selected." };
  }

  if (
    (row.confidence === "very_high" || row.confidence === "high") &&
    (row.xai === "chart-led" || row.xai === "mixed")
  ) {
    return {
      label:
        row.signal === "short" ? "High-priority short review" :
        row.signal === "long" ? "High-priority long review" :
        "High-priority review",
      kind: row.signal,
      note: `Surface this case to the analyst queue. Confidence is ${prettyConfidence(row.confidence).toLowerCase()} and XAI is ${prettyXai(row.xai).toLowerCase()}. Use the overlay to verify whether the highlighted region follows the price path rather than broad background structure.`
    };
  }

  if (row.xai === "background-heavy" || row.confidence === "medium") {
    return {
      label: "Review with caution",
      kind: "watch",
      note: "This case may still be useful, but the support signal should not be escalated without visual confirmation because either confidence is not extreme or the explanation remains background-heavy."
    };
  }

  return {
    label: "Abstain / deprioritize",
    kind: "watch",
    note: "Do not elevate this case as a surfaced trading-support candidate. Keep it visible for audit and comparison, but treat it as a non-actionable interior-score or low-trust case."
  };
}

function resolveRawImageBySplit(pathValue, fileValue, splitValue, gradStem = "") {
  const full = normalizeAssetPath(String(pathValue || "").trim(), "raw");
  if (full && full.startsWith("assets/")) return full;

  let file = basename(pathValue) || basename(fileValue) || "";
  if (!file && gradStem) {
    file = ensurePng(gradStem);
  }
  if (!file) return "";

  const encoded = encodeURIComponent(file);

  if (splitValue === "test") {
    return `assets/test_raw_images/${encoded}`;
  }
  if (splitValue === "val" || splitValue === "validation") {
    return `assets/val_raw_images/${encoded}`;
  }
  return `assets/train_raw_images/${encoded}`;
}

function resolveGradcamImage(pathValue, fileValue, kind) {
  const full = normalizeAssetPath(String(pathValue || "").trim(), kind);
  if (full && full.startsWith("assets/")) return full;

  let file = basename(pathValue) || basename(fileValue) || "";
  if (!file) return "";

  file = ensurePng(file);
  const encoded = encodeURIComponent(file);

  const dir = kind === "overlay"
    ? "assets/gradcam/overlay"
    : kind === "masked"
      ? "assets/gradcam/masked"
      : "assets/gradcam/heat";

  return `${dir}/${encoded}`;
}

function normalizeAssetPath(path, kind = "") {
  if (!path) return "";

  let p = String(path).replaceAll("\\", "/").trim();

  p = p.replace("assets/raw/test raw images/", "assets/test_raw_images/");
  p = p.replace("assets/raw/train raw images/", "assets/train_raw_images/");
  p = p.replace("assets/raw/val raw images/", "assets/val_raw_images/");

  p = p.replace("assets/raw/test_raw_images/", "assets/test_raw_images/");
  p = p.replace("assets/raw/train_raw_images/", "assets/train_raw_images/");
  p = p.replace("assets/raw/val_raw_images/", "assets/val_raw_images/");

  p = p.replace("assets/test raw images/", "assets/test_raw_images/");
  p = p.replace("assets/train raw images/", "assets/train_raw_images/");
  p = p.replace("assets/val raw images/", "assets/val_raw_images/");

  p = p.replace("assets/gradcam/test_gradcam_overlay/", "assets/gradcam/overlay/");
  p = p.replace("assets/gradcam/test_gradcam_masked_overlay/", "assets/gradcam/masked/");
  p = p.replace("assets/gradcam/test_gradcam_heatmap/", "assets/gradcam/heat/");

  if (!p.includes("/") && p) {
    const file = ensurePng(p);
    if (kind === "overlay") return `assets/gradcam/overlay/${encodeURIComponent(file)}`;
    if (kind === "masked") return `assets/gradcam/masked/${encodeURIComponent(file)}`;
    if (kind === "heat") return `assets/gradcam/heat/${encodeURIComponent(file)}`;
    return p;
  }

  return p;
}

function ensurePng(file) {
  const s = String(file || "").trim();
  if (!s) return "";
  return s.toLowerCase().endsWith(".png") ? s : `${s}.png`;
}

function basename(p) {
  if (!p) return "";
  return String(p).split("/").pop().split("\\").pop();
}

function extractDate(ts) {
  const m = String(ts || "").match(/\d{4}-\d{2}-\d{2}/);
  return m ? m[0] : "";
}

function formatTs(ts) {
  return String(ts || "").replace("T", " ");
}

function normalizeSplit(v) {
  const s = String(v || "").toLowerCase();
  if (s.includes("train")) return "train";
  if (s.includes("val")) return "val";
  return "test";
}

function normalizeConfidence(v, pUp = NaN) {
  const s = String(v || "").toLowerCase();
  if (s.includes("very") && s.includes("high")) return "very_high";
  if (s.includes("high")) return "high";
  if (s.includes("medium")) return "medium";
  if (s.includes("low")) return "low";

  const p = number(pUp);
  if (Number.isFinite(p)) {
    const d = Math.abs(p - 0.5);
    if (d >= 0.35) return "very_high";
    if (d >= 0.25) return "high";
    if (d >= 0.10) return "medium";
    return "low";
  }

  return "medium";
}

function normalizeSignal(bucket, pred, pUp) {
  const s = String(bucket || "").toLowerCase();
  if (s.includes("long")) return "long";
  if (s.includes("short")) return "short";
  if (s.includes("watch")) return "watch";

  const p = number(pUp);
  if (Number.isFinite(p)) {
    if (p >= 0.70) return "long";
    if (p <= 0.30) return "short";
  }

  const pr = number(pred);
  if (pr === 1) return "long";
  if (pr === 0) return "short";

  return "watch";
}

function normalizeXai(bucket, fg, bg) {
  const s = String(bucket || "").toLowerCase();
  if (s.includes("chart")) return "chart-led";
  if (s.includes("background")) return "background-heavy";
  if (s.includes("mixed")) return "mixed";

  const f = number(fg);
  const b = number(bg);

  if (Number.isFinite(f) && Number.isFinite(b)) {
    if (f >= 0.50) return "chart-led";
    if (f >= 0.20) return "mixed";
    return "background-heavy";
  }

  return "mixed";
}

function confidenceRank(v) {
  return { very_high: 4, high: 3, medium: 2, low: 1 }[v] || 0;
}

function xaiRank(v) {
  return { "chart-led": 1, mixed: 2, "background-heavy": 3 }[v] || 2;
}

function prettyConfidence(v) {
  return ({ very_high: "Very High", high: "High", medium: "Medium", low: "Low" }[v]) || v;
}

function prettySignal(v) {
  return ({ long: "Long", short: "Short", watch: "Watch" }[v]) || v;
}

function prettyXai(v) {
  return ({ "chart-led": "Chart-led", mixed: "Mixed", "background-heavy": "Background-heavy" }[v]) || v;
}

function prettySystem(v) {
  const s = String(v || "").toLowerCase();
  if (s.includes("best_single_fullsample") || s.includes("single_i60")) return "Single I60 OHLC";
  if (s.includes("multiscale_fullsample") || s.includes("multi_20_60")) return "Multi 20+60 Rich";
  if (s.includes("best_tail_rule")) return "I60 Tail Rule";
  if (s.includes("single_i120")) return "Single I120";
  if (s.includes("gated") && s.includes("ma0_vol0")) return "Gated 20+60+120";
  if (s.includes("gated") && s.includes("ma1_vol1")) return "Gated Rich";
  if (s.includes("numeric")) return "Numeric logistic";
  if (s.includes("simple_momentum")) return "Momentum sign";
  if (s.includes("hog")) return "HOG I120";
  if (s.includes("haar")) return "HAAR-like";
  return String(v || "").replaceAll("_", " ");
}

function parseTruth(v) {
  if (v === "" || v === undefined || v === null) return null;
  const s = String(v).toLowerCase().trim();
  if (["1", "true", "yes"].includes(s)) return true;
  if (["0", "false", "no"].includes(s)) return false;
  return null;
}

function setBar(id, pct) {
  const el = document.getElementById(id);
  if (el) el.style.width = `${pct}%`;
}

function getAny(obj, keys) {
  for (const key of keys) {
    if (obj && obj[key] !== undefined && obj[key] !== null && obj[key] !== "") {
      return obj[key];
    }
  }
  return "";
}

function val(id) {
  const el = document.getElementById(id);
  return el ? el.value : "";
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function number(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

function formatMetric(v, digits = 3, fallback = "—") {
  const n = number(v);
  return Number.isFinite(n) ? n.toFixed(digits) : fallback;
}

function formatSigned(v) {
  const n = number(v);
  return Number.isFinite(n) ? `${n > 0 ? "+" : ""}${n.toFixed(4)}` : "—";
}

function escapeHTML(v) {
  return String(v ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
