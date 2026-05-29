const HISTORY_KEY = "mango_showcase_history_v4";
const HISTORY_LIMIT = 8;

const el = {
  healthStatus: document.querySelector("#health-status"),
  healthDetails: document.querySelector("#health-details"),
  classList: document.querySelector("#class-list"),
  runHealthCheck: document.querySelector("#run-health-check"),
  form: document.querySelector("#predict-form"),
  uploadCard: document.querySelector("#upload-card"),
  fileInput: document.querySelector("#image-input"),
  confRange: document.querySelector("#conf-range"),
  confValue: document.querySelector("#conf-value"),
  imgszInput: document.querySelector("#imgsz-input"),
  annotatedInput: document.querySelector("#annotated-input"),
  submitButton: document.querySelector("#submit-button"),
  clearButton: document.querySelector("#clear-button"),
  exportJsonButton: document.querySelector("#export-json-button"),
  downloadAnnotatedButton: document.querySelector("#download-annotated-button"),
  clearHistoryButton: document.querySelector("#clear-history-button"),
  historyCount: document.querySelector("#history-count"),
  formStatus: document.querySelector("#form-status"),
  selectedPreview: document.querySelector("#selected-preview"),
  selectedPlaceholder: document.querySelector("#selected-placeholder"),
  selectedFileName: document.querySelector("#selected-file-name"),
  selectedFileMeta: document.querySelector("#selected-file-meta"),
  compareStage: document.querySelector("#compare-stage"),
  compareOriginalPreview: document.querySelector("#compare-original-preview"),
  compareAnnotatedPreview: document.querySelector("#compare-annotated-preview"),
  compareOverlay: document.querySelector("#compare-overlay"),
  comparePlaceholder: document.querySelector("#compare-placeholder"),
  compareHandle: document.querySelector("#compare-handle"),
  compareRange: document.querySelector("#compare-range"),
  comparePercent: document.querySelector("#compare-percent"),
  summaryPrimary: document.querySelector("#summary-primary"),
  summarySeverity: document.querySelector("#summary-severity"),
  summaryCount: document.querySelector("#summary-count"),
  summaryLatency: document.querySelector("#summary-latency"),
  classCounts: document.querySelector("#class-counts"),
  detectionRows: document.querySelector("#detection-rows"),
  riskBanner: document.querySelector("#risk-banner"),
  riskTitle: document.querySelector("#risk-title"),
  riskMessage: document.querySelector("#risk-message"),
  meterLabel: document.querySelector("#meter-label"),
  meterFill: document.querySelector("#risk-meter-fill"),
  decisionTitle: document.querySelector("#decision-title"),
  decisionText: document.querySelector("#decision-text"),
  historyList: document.querySelector("#history-list"),
};

let currentFile = null;
let currentOriginalPreview = "";
let currentAnnotatedPreview = "";
let currentResult = null;
let currentOriginalInfo = null;
let selectedHistoryId = "";
let isSubmitting = false;

function classLabel(name) {
  const known = {
    unripe: "未熟",
    ripe: "成熟",
    slight_rotten: "轻度腐烂",
    severe_rotten: "重度腐烂",
  };
  return known[name] || name || "-";
}

function severityLabel(rank) {
  if (rank >= 3) return "高风险";
  if (rank >= 2) return "中风险";
  if (rank >= 0) return "低风险";
  return "未定义";
}

function chip(text, variant = "") {
  const node = document.createElement("span");
  node.className = `chip ${variant}`.trim();
  node.textContent = text;
  return node;
}

function setStatus(message, state = "idle") {
  el.formStatus.textContent = message;
  el.formStatus.dataset.state = state;
}

function setImage(imgEl, placeholderEl, src, altText) {
  if (!imgEl || !placeholderEl) {
    return;
  }

  if (src) {
    imgEl.src = src;
    imgEl.alt = altText;
    placeholderEl.hidden = true;
    return;
  }

  imgEl.removeAttribute("src");
  placeholderEl.hidden = false;
}

function updateSelectedInfo(name, meta) {
  el.selectedFileName.textContent = name || "尚未选择图片";
  el.selectedFileMeta.textContent =
    meta || "支持上传、拖拽和粘贴截图，检测前会先展示原图预览。";
}

function syncComparePosition() {
  if (!el.compareStage || !el.compareRange) {
    return;
  }
  const position = `${Number(el.compareRange.value || 50)}%`;
  el.compareStage.style.setProperty("--compare-position", position);
  if (el.comparePercent) {
    el.comparePercent.textContent = position;
  }
}

function updateCompareStage(originalSrc, annotatedSrc) {
  if (!el.compareStage) {
    return;
  }

  if (originalSrc) {
    el.compareOriginalPreview.src = originalSrc;
    el.compareOriginalPreview.alt = "原图预览";
  } else {
    el.compareOriginalPreview.removeAttribute("src");
  }

  if (annotatedSrc) {
    el.compareAnnotatedPreview.src = annotatedSrc;
    el.compareAnnotatedPreview.alt = "标注结果预览";
  } else {
    el.compareAnnotatedPreview.removeAttribute("src");
  }

  const hasOriginal = Boolean(originalSrc);
  const hasAnnotated = Boolean(annotatedSrc);
  el.comparePlaceholder.hidden = hasOriginal;
  el.compareOverlay.hidden = !hasAnnotated;
  el.compareHandle.hidden = !hasAnnotated;
  syncComparePosition();
}

function riskInfo(highestClass, containsRotten) {
  if (!highestClass) {
    return {
      title: "等待结果",
      message: "上传图片后，系统会将检测结果整理为可直接展示的摘要信息。",
      meter: 0,
      meterLabel: "尚未开始",
      riskClass: "risk-neutral",
    };
  }

  if (!containsRotten) {
    return {
      title: "建议继续观察",
      message: "当前未检测到腐烂类别，样本整体风险较低，可结合人工复核进一步确认。",
      meter: 24,
      meterLabel: "低风险",
      riskClass: "risk-low",
    };
  }

  if (highestClass === "slight_rotten") {
    return {
      title: "建议人工复查",
      message: "检测到轻度腐烂目标，建议在后续分拣或处理前进行人工确认。",
      meter: 58,
      meterLabel: "中风险",
      riskClass: "risk-medium",
    };
  }

  return {
    title: "建议优先剔除",
    message: "检测结果显示存在重度腐烂样本，建议标记为高风险并优先移除。",
    meter: 100,
    meterLabel: "高风险",
    riskClass: "risk-high",
  };
}

function resetSummary() {
  el.summaryPrimary.textContent = "-";
  el.summarySeverity.textContent = "-";
  el.summaryCount.textContent = "0";
  el.summaryLatency.textContent = "-";

  el.classCounts.innerHTML = "";
  el.classCounts.append(chip("等待检测", "muted"));

  const info = riskInfo(null, false);
  el.riskBanner.className = `risk-banner ${info.riskClass}`;
  el.riskTitle.textContent = "等待检测";
  el.riskMessage.textContent = info.message;
  el.meterLabel.textContent = info.meterLabel;
  el.meterFill.style.width = `${info.meter}%`;
  el.decisionTitle.textContent = info.title;
  el.decisionText.textContent = info.message;
}

function renderSummary(data) {
  const summary = data.summary || {};

  el.summaryPrimary.textContent = classLabel(summary.primary_class);
  el.summarySeverity.textContent = classLabel(summary.highest_severity_class);
  el.summaryCount.textContent = String(summary.detection_count || 0);
  el.summaryLatency.textContent = `${data.elapsed_ms} ms`;

  el.classCounts.innerHTML = "";
  const entries = Object.entries(summary.class_counts || {});
  if (!entries.length) {
    el.classCounts.append(chip("未返回类别统计", "muted"));
  } else {
    entries.forEach(([name, count]) => {
      const variant = String(name).includes("rotten") ? "alert" : "";
      el.classCounts.append(chip(`${classLabel(name)} × ${count}`, variant));
    });
  }

  const info = riskInfo(summary.highest_severity_class, summary.contains_rotten);
  el.riskBanner.className = `risk-banner ${info.riskClass}`;
  el.riskTitle.textContent = info.meterLabel;
  el.riskMessage.textContent =
    `最高风险类别：${classLabel(summary.highest_severity_class)}；主要类别：${classLabel(summary.primary_class)}。`;
  el.meterLabel.textContent = info.meterLabel;
  el.meterFill.style.width = `${info.meter}%`;
  el.decisionTitle.textContent = info.title;
  el.decisionText.textContent = info.message;
}

function renderDetections(detections) {
  if (!Array.isArray(detections) || detections.length === 0) {
    el.detectionRows.innerHTML =
      '<tr><td colspan="5" class="empty-row">当前还没有检测结果。</td></tr>';
    return;
  }

  el.detectionRows.innerHTML = detections.map((item, index) => {
    const box = item.box || {};
    return [
      "<tr>",
      `<td>${index + 1}</td>`,
      `<td>${classLabel(item.class_name)}</td>`,
      `<td>${Number(item.confidence).toFixed(3)}</td>`,
      `<td>${severityLabel(Number(item.severity_rank))}</td>`,
      `<td>${box.x1 ?? "-"}, ${box.y1 ?? "-"} → ${box.x2 ?? "-"}, ${box.y2 ?? "-"}</td>`,
      "</tr>",
    ].join("");
  }).join("");
}

function readHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeHistory(history) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, HISTORY_LIMIT)));
}

function updateHistoryCount(history) {
  el.historyCount.textContent = `${history.length} 条记录`;
}

function renderHistory() {
  const history = readHistory();
  updateHistoryCount(history);
  el.historyList.innerHTML = "";

  if (!history.length) {
    el.historyList.innerHTML = '<article class="history-empty">暂无历史记录。</article>';
    return;
  }

  history.forEach((item) => {
    const node = document.createElement("article");
    node.className = `history-item ${item.id === selectedHistoryId ? "is-active" : ""}`.trim();
    node.innerHTML = `
      <div class="history-head">
        <strong>${item.filename || "未命名图片"}</strong>
        <button class="history-restore" type="button" data-history-id="${item.id}">恢复</button>
      </div>
      <div class="chips">
        <span class="chip">${classLabel(item.primaryClass)}</span>
        <span class="chip ${item.containsRotten ? "alert" : ""}">
          ${classLabel(item.highestSeverityClass)}
        </span>
      </div>
      <p class="history-meta">
        时间：${new Date(item.timestamp).toLocaleString("zh-CN", { hour12: false })}<br>
        目标数：${item.detectionCount} · 耗时：${item.elapsedMs} ms
      </p>
    `;
    el.historyList.append(node);
  });
}

function updateExportButtons() {
  const hasResult = Boolean(currentResult);
  el.exportJsonButton.disabled = !hasResult;
  el.downloadAnnotatedButton.disabled = !(hasResult && currentAnnotatedPreview);
}

function setCurrentResult(result) {
  currentResult = result;
  currentAnnotatedPreview = result.annotatedPreview || "";
  updateExportButtons();
}

async function compressPreviewDataUrl(dataUrl, maxEdge = 420, quality = 0.72) {
  if (!dataUrl) {
    return "";
  }

  const image = await loadImage(dataUrl);
  const scale = Math.min(1, maxEdge / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", quality);
}

async function buildHistoryEntry(data) {
  const [historyOriginalPreview, historyAnnotatedPreview] = await Promise.all([
    compressPreviewDataUrl(currentOriginalPreview, 420, 0.72),
    compressPreviewDataUrl(currentAnnotatedPreview, 420, 0.72),
  ]);

  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    timestamp: Date.now(),
    filename: data.filename,
    primaryClass: data.summary.primary_class,
    highestSeverityClass: data.summary.highest_severity_class,
    containsRotten: Boolean(data.summary.contains_rotten),
    detectionCount: data.summary.detection_count,
    elapsedMs: data.elapsed_ms,
    confidenceThreshold: data.confidence_threshold,
    imageSize: data.image_size,
    summary: data.summary,
    detections: data.detections || [],
    originalPreview: historyOriginalPreview,
    annotatedPreview: historyAnnotatedPreview,
    originalInfo: currentOriginalInfo,
  };
}

async function appendHistory(data) {
  const history = readHistory();
  const entry = await buildHistoryEntry(data);
  history.unshift(entry);
  writeHistory(history);
  selectedHistoryId = entry.id;
  renderHistory();
}

function renderResultState(payload, originalPreview, annotatedPreview) {
  renderSummary(payload);
  renderDetections(payload.detections || []);
  setImage(el.selectedPreview, el.selectedPlaceholder, originalPreview, "已选图片预览");
  updateCompareStage(originalPreview, annotatedPreview);
  setCurrentResult({
    ...payload,
    originalPreview,
    annotatedPreview,
  });
}

function restoreHistoryItem(id) {
  const history = readHistory();
  const item = history.find((entry) => entry.id === id);
  if (!item) {
    setStatus("所选历史记录已不存在。", "error");
    return;
  }

  currentFile = null;
  currentResult = null;
  currentOriginalPreview = item.originalPreview || "";
  currentAnnotatedPreview = item.annotatedPreview || "";
  currentOriginalInfo = item.originalInfo || null;
  selectedHistoryId = item.id;
  el.fileInput.value = "";

  updateSelectedInfo(
    item.filename || "历史记录图片",
    currentOriginalInfo
      ? `图片信息：${currentOriginalInfo.width} × ${currentOriginalInfo.height}，约 ${currentOriginalInfo.sizeKB} KB。`
      : "已从历史记录恢复原图预览与检测结果。",
  );

  renderResultState(
    {
      filename: item.filename,
      elapsed_ms: item.elapsedMs,
      confidence_threshold: item.confidenceThreshold || Number(el.confRange.value),
      image_size: item.imageSize || Number(el.imgszInput.value),
      summary: item.summary,
      detections: item.detections,
    },
    item.originalPreview || "",
    item.annotatedPreview || "",
  );

  renderHistory();
  setStatus(`已恢复历史记录：${item.filename || "未命名图片"}`, "success");
}

function clearHistory() {
  localStorage.removeItem(HISTORY_KEY);
  selectedHistoryId = "";
  renderHistory();
  setStatus("历史记录已清空。", "idle");
}

function clearCurrent() {
  currentFile = null;
  currentOriginalPreview = "";
  currentAnnotatedPreview = "";
  currentResult = null;
  currentOriginalInfo = null;
  selectedHistoryId = "";
  el.fileInput.value = "";

  updateSelectedInfo("", "");
  setImage(el.selectedPreview, el.selectedPlaceholder, "", "已选图片预览");
  updateCompareStage("", "");
  renderDetections([]);
  resetSummary();
  updateExportButtons();
  renderHistory();
  setStatus("等待上传图片。", "idle");
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("读取所选图片失败。"));
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("解析所选图片失败。"));
    img.src = dataUrl;
  });
}

async function buildCompressedPreview(file) {
  const dataUrl = await readFileAsDataUrl(file);
  const image = await loadImage(dataUrl);
  const maxEdge = 1280;
  const scale = Math.min(1, maxEdge / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(image, 0, 0, width, height);
  return {
    dataUrl: canvas.toDataURL("image/jpeg", 0.9),
    width: image.width,
    height: image.height,
    sizeKB: Math.max(1, Math.round(file.size / 1024)),
  };
}

function validateImageFile(file) {
  if (!file) {
    throw new Error("请先选择一张图片。");
  }
  if (!String(file.type || "").startsWith("image/")) {
    throw new Error("仅支持图片文件。");
  }
}

async function readApiPayload(response) {
  const raw = await response.text();
  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw);
  } catch {
    return { detail: raw };
  }
}

async function selectFile(file, source) {
  validateImageFile(file);

  currentFile = file;
  currentResult = null;
  currentAnnotatedPreview = "";
  selectedHistoryId = "";

  const preview = await buildCompressedPreview(file);
  currentOriginalPreview = preview.dataUrl;
  currentOriginalInfo = preview;

  updateSelectedInfo(
    file.name,
    `图片信息：${preview.width} × ${preview.height}，约 ${preview.sizeKB} KB。`,
  );
  setImage(el.selectedPreview, el.selectedPlaceholder, currentOriginalPreview, "已选图片预览");
  updateCompareStage(currentOriginalPreview, "");
  resetSummary();
  renderDetections([]);
  updateExportButtons();
  renderHistory();

  const sourceLabel = {
    clipboard: "剪贴板",
    "drag-and-drop": "拖拽上传",
    "file-upload": "本地上传",
  };
  setStatus(`已选择图片（${sourceLabel[source] || source}）：${file.name}，正在自动开始检测...`, "idle");
  await runPrediction();
}

function createDownload(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function exportCurrentResult() {
  if (!currentResult) {
    setStatus("当前没有可导出的检测结果。", "error");
    return;
  }

  const payload = {
    filename: currentResult.filename,
    confidence_threshold: currentResult.confidence_threshold,
    image_size: currentResult.image_size,
    elapsed_ms: currentResult.elapsed_ms,
    summary: currentResult.summary,
    detections: currentResult.detections,
  };

  createDownload(
    `${(currentResult.filename || "mango-result").replace(/\.[^.]+$/, "")}_检测结果.json`,
    JSON.stringify(payload, null, 2),
    "application/json",
  );
  setStatus("检测结果已导出为 JSON。", "success");
}

function downloadAnnotatedImage() {
  if (!currentAnnotatedPreview) {
    setStatus("当前没有可下载的结果图。", "error");
    return;
  }

  const link = document.createElement("a");
  link.href = currentAnnotatedPreview;
  link.download = `${(currentResult?.filename || "mango-result").replace(/\.[^.]+$/, "")}_标注结果.jpg`;
  document.body.append(link);
  link.click();
  link.remove();
  setStatus("结果图已下载。", "success");
}

async function loadClasses() {
  try {
    const response = await fetch("/api/v1/classes");
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.detail || `HTTP ${response.status}`);
    }

    el.classList.innerHTML = "";
    const classes = data.classes || [];
    if (!classes.length) {
      el.classList.append(chip("未读取到类别", "muted"));
      return;
    }

    classes.forEach((name) => {
      el.classList.append(chip(classLabel(name)));
    });
  } catch {
    el.classList.innerHTML = "";
    el.classList.append(chip("类别加载失败", "muted"));
  }
}

async function runHealthCheck() {
  el.healthStatus.textContent = "检测中...";
  el.healthDetails.textContent = "正在检查后端服务与模型权重。";

  try {
    const response = await fetch("/health");
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.detail || `HTTP ${response.status}`);
    }

    el.healthStatus.textContent = data.model_available ? "服务已就绪" : "服务已启动，但缺少权重";
    el.healthDetails.textContent = `权重路径：${data.model_weights}`;
  } catch (error) {
    el.healthStatus.textContent = "检测失败";
    el.healthDetails.textContent = error.message || "未知错误";
  }
}

async function runPrediction() {
  if (isSubmitting) {
    return;
  }
  if (!currentFile) {
    setStatus("请先选择一张图片。", "error");
    return;
  }

  const formData = new FormData();
  formData.append("image", currentFile);

  const params = new URLSearchParams({
    conf: el.confRange.value,
    imgsz: el.imgszInput.value,
    return_annotated: String(el.annotatedInput.checked),
  });

  isSubmitting = true;
  el.submitButton.disabled = true;
  setStatus("图片已上传，正在等待模型推理...", "idle");
  updateCompareStage(currentOriginalPreview, "");

  try {
    const response = await fetch(`/api/v1/predict?${params.toString()}`, {
      method: "POST",
      body: formData,
    });
    const data = await readApiPayload(response);
    if (!response.ok) {
      throw new Error(data.detail || `HTTP ${response.status}`);
    }

    const annotatedPreview = data.annotated_image_base64
      ? `data:image/jpeg;base64,${data.annotated_image_base64}`
      : "";

    currentAnnotatedPreview = annotatedPreview;
    renderResultState(data, currentOriginalPreview, annotatedPreview);

    try {
      await appendHistory(data);
      setStatus(
        `检测完成：共识别 ${data.summary.detection_count} 个目标，耗时 ${data.elapsed_ms} ms。`,
        "success",
      );
    } catch {
      setStatus(
        `检测已完成，但历史记录保存失败。当前结果仍可查看与导出。`,
        "error",
      );
    }
  } catch (error) {
    currentAnnotatedPreview = "";
    currentResult = null;
    updateCompareStage(currentOriginalPreview, "");
    resetSummary();
    renderDetections([]);
    updateExportButtons();
    setStatus(error.message || "检测失败。", "error");
  } finally {
    isSubmitting = false;
    el.submitButton.disabled = false;
  }
}

async function handleSubmit(event) {
  event.preventDefault();
  await runPrediction();
}

function handlePaste(event) {
  const items = Array.from(event.clipboardData?.items || []);
  const imageItem = items.find((item) => item.type.startsWith("image/"));
  if (!imageItem) {
    return;
  }

  event.preventDefault();
  const blob = imageItem.getAsFile();
  if (!blob) {
    setStatus("无法读取剪贴板中的图片。", "error");
    return;
  }

  const extension = blob.type.includes("png") ? "png" : "jpg";
  const file = new File([blob], `clipboard-${Date.now()}.${extension}`, { type: blob.type });
  selectFile(file, "clipboard").catch((error) => {
    setStatus(error.message || "使用粘贴图片失败。", "error");
  });
}

function onDragOver(event) {
  event.preventDefault();
  el.uploadCard.classList.add("is-dragover");
}

function onDragLeave(event) {
  event.preventDefault();
  if (!el.uploadCard.contains(event.relatedTarget)) {
    el.uploadCard.classList.remove("is-dragover");
  }
}

function onDrop(event) {
  event.preventDefault();
  el.uploadCard.classList.remove("is-dragover");
  const files = Array.from(event.dataTransfer?.files || []);
  const file = files.find((item) => String(item.type || "").startsWith("image/"));
  if (!file) {
    setStatus("请拖入一张 JPG 或 PNG 图片。", "error");
    return;
  }

  selectFile(file, "drag-and-drop").catch((error) => {
    setStatus(error.message || "使用拖拽图片失败。", "error");
  });
}

function bindEvents() {
  el.confRange.addEventListener("input", () => {
    el.confValue.textContent = Number(el.confRange.value).toFixed(2);
  });

  el.compareRange.addEventListener("input", syncComparePosition);

  el.fileInput.addEventListener("change", () => {
    const file = el.fileInput.files?.[0];
    if (!file) {
      setStatus("等待上传图片。", "idle");
      return;
    }

    selectFile(file, "file-upload").catch((error) => {
      setStatus(error.message || "选择图片失败。", "error");
    });
  });

  el.uploadCard.addEventListener("dragover", onDragOver);
  el.uploadCard.addEventListener("dragleave", onDragLeave);
  el.uploadCard.addEventListener("drop", onDrop);

  window.addEventListener("dragover", (event) => event.preventDefault());
  window.addEventListener("drop", (event) => event.preventDefault());
  window.addEventListener("paste", handlePaste);

  el.runHealthCheck.addEventListener("click", runHealthCheck);
  el.form.addEventListener("submit", handleSubmit);
  el.clearButton.addEventListener("click", clearCurrent);
  el.exportJsonButton.addEventListener("click", exportCurrentResult);
  el.downloadAnnotatedButton.addEventListener("click", downloadAnnotatedImage);
  el.clearHistoryButton.addEventListener("click", clearHistory);

  el.historyList.addEventListener("click", (event) => {
    const target = event.target.closest("[data-history-id]");
    if (!target) {
      return;
    }
    restoreHistoryItem(target.dataset.historyId);
  });
}

function init() {
  bindEvents();
  renderHistory();
  updateExportButtons();
  syncComparePosition();
  loadClasses();

  const history = readHistory();
  if (history.length) {
    restoreHistoryItem(history[0].id);
    return;
  }

  resetSummary();
  renderDetections([]);
}

init();
