const DATA_PATHS = {
  dashboard: "data/dashboard_master.csv",
  finalCompare: "data/final_compare_table.csv",
  ablation: "data/ablation_summary.csv",
  tailGrid: "data/tail_grid_results.csv",
  optionBTail: "data/optionB_tail_grid_results.csv",
  gradcamSummary: "data/gradcam_chart_vs_background_summary.csv",
  gradcamDetail: "data/gradcam_chart_vs_background_detail.csv",
  multiScale: "data/multi_scale_summary.csv",
  optionBFinalists: "data/optionB_finalists.csv",
  testGradcamIndex: "data/test_gradcam_index.csv",
  testRawIndex: "data/test_raw_index.csv",
  trainRawIndex: "data/train_raw_index.csv",
  valRawIndex: "data/val_raw_index.csv",
  checklist: "data/five_points_checklist.csv",
  manifest: "data/package_manifest.csv"
};

const state = {
  datasets: {},
  dashboardRows: [],
  filteredRows: [],
  selectedRow: null,
  filters: {
    contract: "all",
    split: "all",
    signal: "all",
    confidence: "all",
    xaiGroup: "all",
    date: "",
    search: ""
  }
};

document.addEventListener("DOMContentLoaded", async () => {
  bindNavigation();
  bindFilters();
  await loadAllDatasets();
  prepareDashboardRows();
  populateContractFilter();
  renderStaticTables();
  applyFiltersAndRender();
});

function bindNavigation() {
  document.querySelectorAll(".nav-link").forEach(link => {
    link.addEventListener("click", () => {
      document.querySelectorAll(".nav-link").forEach(x => x.classList.remove("active"));
      link.classList.add("active");
    });
  });
}

function bindFilters() {
  const contractEl = document.getElementById("filter-contract");
  const splitEl = document.getElementById("filter-split");
  const signalEl = document.getElementById("filter-signal");
  const confidenceEl = document.getElementById("filter-confidence");
  const xaiEl = document.getElementById("filter-xai-group");
  const dateEl = document.getElementById("filter-date");
  const searchEl = document.getElementById("filter-search");

  document.getElementById("apply-filters").addEventListener("click", () => {
    state.filters.contract = contractEl.value;
    state.filters.split = splitEl.value;
    state.filters.signal = signalEl.value;
    state.filters.confidence = confidenceEl.value;
    state.filters.xaiGroup = xaiEl.value;
    state.filters.date = dateEl.value;
    state.filters.search = searchEl.value.trim().toLowerCase();
    applyFiltersAndRender();
  });

  document.getElementById("reset-filters").addEventListener("click", () => {
    contractEl.value = "all";
    splitEl.value = "all";
    signalEl.value = "all";
    confidenceEl.value = "all";
    xaiEl.value = "all";
    dateEl.value = "";
    searchEl.value = "";

    state.filters = {
      contract: "all",
      split: "all",
      signal: "all",
      confidence: "all",
      xaiGroup: "all",
      date: "",
      search: ""
    };
    applyFiltersAndRender();
  });
}

async function loadAllDatasets() {
  const entries = Object.entries(DATA_PATHS);
  const results = await Promise.all(entries.map(async ([key, path]) => {
    const data = await loadCsvSafe(path);
    return [key, data];
  }));

  results.forEach(([key, data]) => {
    state.datasets[key] = data;
  });
}

function loadCsvSafe(path) {
  return new Promise(resolve => {
    Papa.parse(path, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: results => {
        if (results.errors && results.errors.length) {
          console.warn(`CSV parse warnings for ${path}`, results.errors);
        }
        resolve(results.data || []);
      },
      error: err => {
        console.warn(`Could not load ${path}`, err);
        resolve([]);
      }
    });
  });
}

function prepareDashboardRows() {
  const rawRows = state.datasets.dashboard || [];

  const gradcamSummary = indexByFlexibleKey(state.datasets.gradcamSummary || []);
  const gradcamDetail = indexByFlexibleKey(state.datasets.gradcamDetail || []);
  const testGradcamIndex = indexByFlexibleKey(state.datasets.testGradcamIndex || []);
  const testRawIndex = indexByFlexibleKey(state.datasets.testRawIndex || []);
  const trainRawIndex = indexByFlexibleKey(state.datasets.trainRawIndex || []);
  const valRawIndex = indexByFlexibleKey(state.datasets.valRawIndex || []);

  state.dashboardRows = rawRows.map((row, idx) => {
    const sampleId = getSampleId(row, idx);
    const split = normalizeSplit(getAny(row, ["split", "dataset_split", "set", "bucket_split"]));
    const contract = getAny(row, ["contract", "secid", "ticker", "symbol"]) || "NA";
    const timestamp = getAny(row, ["timestamp", "anchor_time", "anchor_ts", "begin", "datetime", "dt"]) || "";
    const dateOnly = extractDate(timestamp) || getAny(row, ["trade_date", "date"]) || "";
    const confidenceBucket = normalizeConfidence(getAny(row, [
      "confidence_bucket",
      "confidence_group",
      "conf_bucket",
      "bucket_confidence",
      "confidence"
    ]));
    const signalBucket = normalizeSignal(getAny(row, [
      "signal_bucket",
      "signal",
      "position_signal",
      "decision_signal"
    ]));
    const xaiSummary = gradcamSummary[sampleId] || {};
    const xaiDetail = gradcamDetail[sampleId] || {};
    const xaiGroup = inferXaiGroup(row, xaiSummary, xaiDetail);

    const splitIndex = split === "train"
      ? trainRawIndex[sampleId]
      : split === "val"
        ? valRawIndex[sampleId]
        : testRawIndex[sampleId];

    const gradcamIndexRow = testGradcamIndex[sampleId] || {};

    return {
      ...row,
      __sampleId: sampleId,
      __split: split,
      __contract: contract,
      __timestamp: timestamp,
      __date: dateOnly,
      __confidenceBucket: confidenceBucket,
      __signalBucket: signalBucket,
      __xaiGroup: xaiGroup,
      __accuracyProxy: parseNumber(getAny(row, ["is_correct", "correct", "hit"])),

      __rawImage: getAny(splitIndex || row, ["image_path", "raw_image_path", "raw_path", "img_path"]) || "",
      __overlayImage: getAny(gradcamIndexRow || row, ["overlay_path", "gradcam_overlay_path", "overlay_image_path"]) || "",
      __maskedImage: getAny(gradcamIndexRow || row, ["masked_overlay_path", "gradcam_masked_overlay_path", "masked_path"]) || "",
      __heatmapImage: getAny(gradcamIndexRow || row, ["heatmap_path", "gradcam_heatmap_path", "heatmap_image_path"]) || "",

      __probUp: parseNumber(getAny(row, ["p_up", "prob_up", "cnn_prob_up", "score", "probability"])),
      __pred: getAny(row, ["pred", "prediction", "y_pred", "cnn_pred"]),
      __true: getAny(row, ["y_true", "label", "target", "y"]),
      __xaiForeground: parseNumber(getAny({ ...xaiSummary, ...xaiDetail }, [
        "chart_share",
        "foreground_share",
        "chart_focus",
        "foreground_focus"
      ])),
      __xaiBackground: parseNumber(getAny({ ...xaiSummary, ...xaiDetail }, [
        "background_share",
        "background_focus"
      ]))
    };
  });

  if (!state.dashboardRows.length) {
    state.dashboardRows = buildFallbackDemoRows();
  }
}

function populateContractFilter() {
  const contractEl = document.getElementById("filter-contract");
  const contracts = [...new Set(state.dashboardRows.map(r => r.__contract).filter(Boolean))].sort();
  contracts.forEach(contract => {
    const option = document.createElement("option");
    option.value = contract;
    option.textContent = contract;
    contractEl.appendChild(option);
  });
}

function renderStaticTables() {
  const finalCompare = state.datasets.finalCompare || [];
  if (!finalCompare.length) return;

  const tbody = document.querySelector("#table-fullsample tbody");
  if (!tbody) return;

  tbody.innerHTML = "";

  finalCompare.slice(0, 8).forEach(row => {
    const tr = document.createElement("tr");

    const system = getAny(row, ["system", "model", "name", "variant"]) || "Unknown";
    const acc = formatMetric(getAny(row, ["acc", "accuracy"]));
    const bal = formatMetric(getAny(row, ["bal_acc", "balanced_accuracy", "balanced_acc"]));
    const auc = formatMetric(getAny(row, ["roc_auc", "auc"]));

    tr.innerHTML = `
      <td>${escapeHtml(system)}</td>
      <td class="metric">${acc}</td>
      <td class="metric">${bal}</td>
      <td class="metric">${auc}</td>
    `;
    tbody.appendChild(tr);
  });
}

function applyFiltersAndRender() {
  state.filteredRows = state.dashboardRows.filter(row => {
    if (state.filters.contract !== "all" && row.__contract !== state.filters.contract) return false;
    if (state.filters.split !== "all" && row.__split !== state.filters.split) return false;
    if (state.filters.signal !== "all" && row.__signalBucket !== state.filters.signal) return false;
    if (state.filters.confidence !== "all" && row.__confidenceBucket !== state.filters.confidence) return false;
    if (state.filters.xaiGroup !== "all" && row.__xaiGroup !== state.filters.xaiGroup) return false;
    if (state.filters.date && row.__date !== state.filters.date) return false;

    if (state.filters.search) {
      const haystack = [
        row.__sampleId,
        row.__contract,
        row.__timestamp,
        row.__date,
        row.model,
        row.variant,
        row.system
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (!haystack.includes(state.filters.search)) return false;
    }

    return true;
  });

  sortRowsForDashboard(state.filteredRows);
  renderSampleList();
  selectRow(state.filteredRows[0] || null);
  updateTopKpis();
}

function sortRowsForDashboard(rows) {
  rows.sort((a, b) => {
    const confOrder = confidenceRank(b.__confidenceBucket) - confidenceRank(a.__confidenceBucket);
    if (confOrder !== 0) return confOrder;

    const probOrder = (safeNumber(b.__probUp) - safeNumber(a.__probUp));
    if (probOrder !== 0) return probOrder;

    return String(a.__timestamp).localeCompare(String(b.__timestamp));
  });
}

function renderSampleList() {
  const listEl = document.getElementById("sample-list");
  if (!listEl) return;

  listEl.innerHTML = "";

  if (!state.filteredRows.length) {
    listEl.innerHTML = `
      <div class="sample-card">
        <div class="sample-title">No matching rows</div>
        <div class="sample-subtitle">Adjust filters or add dashboard CSV data.</div>
      </div>
    `;
    return;
  }

  state.filteredRows.slice(0, 250).forEach((row, idx) => {
    const card = document.createElement("div");
    card.className = "sample-card";
    if (idx === 0) card.classList.add("active");

    const title = `${row.__contract} · ${row.__timestamp || row.__date || row.__sampleId}`;
    const subtitle = [
      getAny(row, ["model", "variant", "system"]) || "dashboard case",
      row.__sampleId
    ].filter(Boolean).join(" · ");

    card.innerHTML = `
      <div class="sample-top">
        <div>
          <div class="sample-title">${escapeHtml(title)}</div>
          <div class="sample-subtitle">${escapeHtml(subtitle)}</div>
        </div>
        <span class="conf-pill ${escapeHtml(row.__confidenceBucket)}">${prettyConfidence(row.__confidenceBucket)}</span>
      </div>
      <div class="sample-meta">
        <span class="contract-pill">${escapeHtml(row.__contract)}</span>
        <span class="split-pill">${escapeHtml(row.__split)}</span>
        <span class="signal-pill ${escapeHtml(row.__signalBucket)}">${prettySignal(row.__signalBucket)}</span>
        <span class="quality-pill ${escapeHtml(row.__xaiGroup)}">${prettyXai(row.__xaiGroup)}</span>
      </div>
    `;

    card.addEventListener("click", () => {
      [...listEl.querySelectorAll(".sample-card")].forEach(el => el.classList.remove("active"));
      card.classList.add("active");
      selectRow(row);
    });

    listEl.appendChild(card);
  });
}

function selectRow(row) {
  state.selectedRow = row;
  updateInspector(row);
}

function updateInspector(row) {
  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value || "—";
  };

  if (!row) {
    setText("viewer-sample-id", "—");
    setText("viewer-contract-time", "—");
    setText("viewer-model-signal", "—");
    setText("viewer-confidence-xai", "—");
    setImage("viewer-main-image", "");
    setImage("viewer-raw-image", "");
    setImage("viewer-overlay-image", "");
    setImage("viewer-masked-image", "");
    setImage("viewer-heatmap-image", "");
    return;
  }

  setText("viewer-sample-id", row.__sampleId);
  setText("viewer-contract-time", `${row.__contract} · ${row.__timestamp || row.__date || "NA"}`);
  setText(
    "viewer-model-signal",
    `${getAny(row, ["model", "variant", "system"]) || "artifact"} · ${prettySignal(row.__signalBucket)}`
  );
  setText(
    "viewer-confidence-xai",
    `${prettyConfidence(row.__confidenceBucket)} · ${prettyXai(row.__xaiGroup)}`
  );

  setImage("viewer-main-image", row.__rawImage || row.__overlayImage || "");
  setImage("viewer-raw-image", row.__rawImage);
  setImage("viewer-overlay-image", row.__overlayImage);
  setImage("viewer-masked-image", row.__maskedImage);
  setImage("viewer-heatmap-image", row.__heatmapImage);
}

function setImage(id, path) {
  const el = document.getElementById(id);
  if (!el) return;

  if (!path) {
    el.removeAttribute("src");
    el.alt = "Image unavailable";
    el.style.display = "none";
    return;
  }

  el.style.display = "block";
  el.src = path;
  el.onerror = () => {
    el.removeAttribute("src");
    el.style.display = "none";
  };
}

function updateTopKpis() {
  // Default thesis values from retained evidence
  setText("kpi-best-full-acc", "0.587");
  setText("kpi-best-full-balacc", "0.559");
  setText("kpi-best-full-auc", "0.580");

  setText("kpi-tail-acc", "0.688");
  setText("kpi-tail-balacc", "0.695");
  setText("kpi-tail-coverage", "5.1%");

  setText("kpi-optionb-acc", "0.833");
  setText("kpi-optionb-balacc", "0.834");
  setText("kpi-optionb-coverage", "~2.0%");

  // If filtered rows exist, enrich some view state
  const total = state.filteredRows.length;
  const chartFocused = state.filteredRows.filter(r => r.__xaiGroup === "chart").length;
  const backgroundFocused = state.filteredRows.filter(r => r.__xaiGroup === "background").length;

  const xaiNote = chartFocused > backgroundFocused ? "Mixed+" : "Broad";
  setText("kpi-xai-note", xaiNote);
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function getSampleId(row, idx = 0) {
  return String(getAny(row, [
    "sample_id",
    "id",
    "row_id",
    "case_id",
    "sample",
    "idx",
    "index"
  ]) || idx);
}

function indexByFlexibleKey(rows) {
  const out = {};
  rows.forEach((row, idx) => {
    const key = getSampleId(row, idx);
    out[key] = row;
  });
  return out;
}

function getAny(obj, keys) {
  if (!obj) return "";
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(obj, key) && obj[key] !== undefined && obj[key] !== null && obj[key] !== "") {
      return obj[key];
    }
  }
  return "";
}

function parseNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const cleaned = String(value).replace(/[%,$]/g, "").trim();
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

function safeNumber(value) {
  return Number.isFinite(value) ? value : -999999;
}

function formatMetric(value) {
  const num = parseNumber(value);
  if (num === null) return "—";
  return num.toFixed(3);
}

function extractDate(value) {
  if (!value) return "";
  const s = String(value);
  const match = s.match(/\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : "";
}

function normalizeSplit(value) {
  const v = String(value || "").toLowerCase();
  if (v.includes("train")) return "train";
  if (v.includes("val")) return "val";
  if (v.includes("test")) return "test";
  return "test";
}

function normalizeConfidence(value) {
  const v = String(value || "").toLowerCase().trim();
  if (!v) return "medium";
  if (v.includes("very") && v.includes("high")) return "very_high";
  if (v === "high") return "high";
  if (v.includes("medium") || v.includes("mid")) return "medium";
  if (v.includes("low")) return "low";
  return v.replace(/\s+/g, "_");
}

function normalizeSignal(value) {
  const v = String(value || "").toLowerCase().trim();
  if (!v) return "watch";
  if (v.includes("long") || v.includes("buy") || v === "1" || v === "up") return "long";
  if (v.includes("short") || v.includes("sell") || v === "-1" || v === "down") return "short";
  return "watch";
}

function inferXaiGroup(row, summary, detail) {
  const explicit = String(getAny(row, [
    "xai_group",
    "attention_group",
    "chart_vs_background_group",
    "gradcam_group"
  ]) || "").toLowerCase();

  if (explicit.includes("chart")) return "chart";
  if (explicit.includes("background")) return "background";
  if (explicit.includes("mixed")) return "mixed";

  const chart = parseNumber(getAny({ ...summary, ...detail }, [
    "chart_share",
    "foreground_share",
    "chart_focus",
    "foreground_focus"
  ]));
  const bg = parseNumber(getAny({ ...summary, ...detail }, [
    "background_share",
    "background_focus"
  ]));

  if (chart !== null && bg !== null) {
    if (chart >= 0.5) return "chart";
    if (chart >= 0.2 && chart < 0.5) return "mixed";
    return "background";
  }

  return "mixed";
}

function confidenceRank(value) {
  const map = {
    very_high: 4,
    high: 3,
    medium: 2,
    low: 1
  };
  return map[value] || 0;
}

function prettyConfidence(value) {
  const map = {
    very_high: "Very High",
    high: "High",
    medium: "Medium",
    low: "Low"
  };
  return map[value] || value || "Unknown";
}

function prettySignal(value) {
  const map = {
    long: "Long",
    short: "Short",
    watch: "Watch"
  };
  return map[value] || value || "Watch";
}

function prettyXai(value) {
  const map = {
    chart: "Chart-focused",
    mixed: "Mixed",
    background: "Background-focused"
  };
  return map[value] || value || "Mixed";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function buildFallbackDemoRows() {
  return [
    {
      __sampleId: "demo-1",
      __split: "test",
      __contract: "SiZ5",
      __timestamp: "2025-10-13 14:15:00",
      __date: "2025-10-13",
      __confidenceBucket: "very_high",
      __signalBucket: "long",
      __xaiGroup: "mixed",
      __rawImage: "assets/demo_raw.png",
      __overlayImage: "assets/demo_overlay.png",
      __maskedImage: "assets/demo_masked.png",
      __heatmapImage: "assets/demo_heatmap.png",
      __probUp: 0.93,
      model: "Single I60 OHLC"
    }
  ];
}
