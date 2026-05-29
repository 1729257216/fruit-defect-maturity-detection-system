import * as React from "react";
import { createRoot } from "react-dom/client";
import htm from "htm";
import { AnimatePresence, motion } from "framer-motion";

const { useDeferredValue, useEffect, useMemo, useRef, useState } = React;
const html = htm.bind(React.createElement);
const premiumEase = [0.23, 1, 0.32, 1];

const CLASS_META = {
  unripe: { label: "未熟", badgeClass: "from-sky-500 to-cyan-400", border: "#38bdf8", glow: "rgba(56, 189, 248, 0.28)" },
  ripe: { label: "成熟", badgeClass: "from-emerald-400 to-green-500", border: "#22c55e", glow: "rgba(34, 197, 94, 0.28)" },
  slight_rotten: { label: "轻度腐烂", badgeClass: "from-amber-400 to-orange-500", border: "#f59e0b", glow: "rgba(245, 158, 11, 0.28)" },
  severe_rotten: { label: "腐烂变质", badgeClass: "from-rose-500 to-red-600", border: "#ef4444", glow: "rgba(239, 68, 68, 0.28)" },
  bruise_damage: { label: "磕碰损伤", badgeClass: "from-orange-400 to-amber-500", border: "#fb923c", glow: "rgba(251, 146, 60, 0.28)" },
};

const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

function labelForClass(name) {
  return CLASS_META[name]?.label || name || "未知缺陷";
}

function styleForClass(name) {
  return CLASS_META[name] || {
    label: labelForClass(name),
    badgeClass: "from-fuchsia-500 to-violet-500",
    border: "#8b5cf6",
    glow: "rgba(139, 92, 246, 0.26)",
  };
}

function confidenceText(value) {
  return `${Math.round(Number(value || 0) * 100)}%`;
}

async function fileToPreview(file) {
  const objectUrl = URL.createObjectURL(file);
  const image = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("图片预览生成失败"));
    img.src = objectUrl;
  });

  return {
    url: objectUrl,
    width: image.naturalWidth,
    height: image.naturalHeight,
    sizeKb: Math.max(1, Math.round(file.size / 1024)),
    name: file.name,
  };
}

async function requestPrediction(file) {
  const formData = new FormData();
  formData.append("image", file);

  const response = await fetch("/api/v1/predict?conf=0.25&imgsz=736&return_annotated=true", {
    method: "POST",
    body: formData,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.detail || "接口请求失败");
  }
  return payload;
}

function HeaderBar({ loading, result }) {
  const stateText = loading ? "分析中" : result ? "已完成" : "待开始";
  const stateClass = loading
    ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-200"
    : result
      ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
      : "border-white/10 bg-white/5 text-slate-300";

  return html`
    <${motion.header}
      initial=${{ opacity: 0, y: -18 }}
      animate=${{ opacity: 1, y: 0 }}
      transition=${{ duration: 0.5, ease: premiumEase }}
      className="neon-panel rounded-[30px] px-7 py-6"
    >
      <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-3 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-xs uppercase tracking-[0.35em] text-emerald-200">
            Fruit AI Detection Dashboard
          </div>
          <div>
            <h1 className="text-4xl font-semibold tracking-tight text-white xl:text-[44px]">
              基于深度学习的水果缺陷与成熟度检测系统
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
              面向毕设展示的暗色霓虹仪表盘界面，聚焦水果图像上传、接口分析过程可视化、缺陷定位标注与结果解释。
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/8 bg-white/5 px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">Theme</p>
            <p className="mt-2 text-sm font-medium text-white">Dark Neon</p>
          </div>
          <div className="rounded-2xl border border-white/8 bg-white/5 px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">Model State</p>
            <p className="mt-2 text-sm font-medium text-white">YOLO Detector</p>
          </div>
          <div className=${`rounded-2xl border px-4 py-3 ${stateClass}`}>
            <p className="text-[11px] uppercase tracking-[0.28em] opacity-70">Session</p>
            <p className="mt-2 text-sm font-medium">${stateText}</p>
          </div>
        </div>
      </div>
    </${motion.header}>
  `;
}

function UploadPanel(props) {
  const {
    dragging,
    loading,
    preview,
    selectedFile,
    onBrowse,
    onDrop,
    onDragEnter,
    onDragLeave,
    onDragOver,
    onAnalyze,
  } = props;

  return html`
    <${motion.section}
      initial=${{ opacity: 0, y: 18 }}
      animate=${{ opacity: 1, y: 0 }}
      transition=${{ duration: 0.46, ease: premiumEase }}
      className="neon-panel rounded-[30px] p-6"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.34em] text-slate-500">Upload Area</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">图像输入与分析控制</h2>
        </div>
        <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-slate-300">
          支持拖拽与点击上传
        </div>
      </div>

      <${motion.label}
        onDrop=${onDrop}
        onDragEnter=${onDragEnter}
        onDragLeave=${onDragLeave}
        onDragOver=${onDragOver}
        whileHover=${loading ? {} : { y: -2, scale: 1.005 }}
        whileTap=${loading ? {} : { scale: 0.996 }}
        transition=${{ duration: 0.24, ease: premiumEase }}
        className=${[
          "dropzone-dark mt-6 flex min-h-[250px] cursor-pointer flex-col justify-between overflow-hidden rounded-[28px] border border-white/10 p-6",
          dragging ? "border-emerald-400/50 bg-emerald-400/10" : "hover:border-emerald-400/30",
          loading ? "pointer-events-none opacity-75" : "",
        ].join(" ")}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(34,197,94,0.14),transparent_44%)]"></div>
        <div className="relative z-10">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/10 text-3xl text-emerald-300">
            <span>+</span>
          </div>
          <h3 className="mt-5 text-2xl font-semibold text-white">
            ${preview ? "已载入待分析水果图像" : "拖拽水果图片到此处"}
          </h3>
          <p className="mt-3 text-sm leading-7 text-slate-300">
            ${preview
              ? "图片已完成预览加载。你可以点击 Analyze 按钮触发接口分析，并在中间结果舞台中查看扫描过程与定位结果。"
              : "该区域用于导入待检测水果图片。系统会在分析阶段展示雷达式扫描动画，分析完成后进入缺陷框选与结果解释视图。"}
          </p>
        </div>

        <div className="relative z-10 mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/8 bg-white/5 px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.26em] text-slate-500">File</p>
            <p className="mt-2 truncate text-sm text-white">${selectedFile?.name || "尚未选择"}</p>
          </div>
          <div className="rounded-2xl border border-white/8 bg-white/5 px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.26em] text-slate-500">Resolution</p>
            <p className="mt-2 text-sm text-white">${preview ? `${preview.width} × ${preview.height}` : "--"}</p>
          </div>
          <div className="rounded-2xl border border-white/8 bg-white/5 px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.26em] text-slate-500">Status</p>
            <p className="mt-2 text-sm text-white">${loading ? "分析中..." : preview ? "已就绪" : "待上传"}</p>
          </div>
        </div>

        <input type="file" accept="image/*" hidden onChange=${onBrowse} />
      </${motion.label}>

      <div className="mt-5 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="text-sm leading-7 text-slate-400">
          ${preview
            ? "已进入待分析状态。推荐点击 Analyze 进入正式演示链路。"
            : "请先上传水果图片，再启动分析。"}
        </div>

        <${motion.button}
          type="button"
          whileHover=${!preview || loading ? {} : { scale: 1.02, y: -1 }}
          whileTap=${!preview || loading ? {} : { scale: 0.985 }}
          transition=${{ duration: 0.2, ease: premiumEase }}
          disabled=${!preview || loading}
          data-state=${loading ? "loading" : preview ? "ready" : "disabled"}
          onClick=${onAnalyze}
          className="analyze-button inline-flex items-center justify-center gap-3 rounded-2xl px-7 py-4 text-sm font-semibold uppercase tracking-[0.22em] text-white disabled:cursor-not-allowed disabled:opacity-45"
        >
          <span className="relative z-10">${loading ? "Analyzing" : "Analyze"}</span>
        </${motion.button}>
      </div>
    </${motion.section}>
  `;
}

function ScanStage({ preview }) {
  return html`
    <div className="result-stage-shell relative flex min-h-[560px] items-center justify-center overflow-hidden rounded-[30px] border border-cyan-400/20 bg-[#07131f]">
      ${preview?.url
        ? html`<img src=${preview.url} alt="待分析水果" className="absolute inset-0 h-full w-full object-contain opacity-30" />`
        : null}

      <div className="scan-grid-dark absolute inset-0 opacity-65"></div>
      <div className="absolute inset-x-10 top-10 bottom-10 rounded-[26px] border border-cyan-400/15"></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.1),transparent_58%)]"></div>

      <${motion.div}
        className="absolute inset-x-10 h-24 rounded-full bg-[radial-gradient(circle,rgba(34,211,238,0.22),transparent_70%)] blur-2xl"
        animate=${{ y: ["-8%", "82%", "-8%"] }}
        transition=${{ duration: 2.1, repeat: Infinity, ease: premiumEase }}
      />

      <${motion.div}
        className="absolute inset-x-10 h-[2px] bg-gradient-to-r from-transparent via-cyan-300 to-transparent shadow-[0_0_24px_rgba(34,211,238,0.9)]"
        animate=${{ y: ["12%", "88%", "12%"] }}
        transition=${{ duration: 1.9, repeat: Infinity, ease: premiumEase }}
      />

      <div className="relative z-10 flex flex-col items-center gap-7 text-center text-white">
        <div className="relative grid h-36 w-36 place-items-center rounded-full border border-cyan-300/25 bg-cyan-400/10">
          <span className="radar-ring absolute inset-0 rounded-full border border-cyan-300/35"></span>
          <span className="radar-ring delay-1 absolute inset-0 rounded-full border border-cyan-300/24"></span>
          <span className="radar-ring delay-2 absolute inset-0 rounded-full border border-cyan-300/18"></span>
          <${motion.div}
            className="absolute h-32 w-32 rounded-full bg-[conic-gradient(from_0deg,rgba(34,211,238,0.45),transparent_38%,transparent_100%)]"
            animate=${{ rotate: 360 }}
            transition=${{ duration: 2.8, repeat: Infinity, ease: "linear" }}
          />
          <div className="relative z-10 h-5 w-5 rounded-full bg-cyan-300 shadow-[0_0_28px_rgba(34,211,238,0.95)]"></div>
        </div>

        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.46em] text-cyan-200/70">Scanning Sequence</p>
          <h3 className="text-4xl font-semibold">扫描中</h3>
          <p className="mx-auto max-w-lg text-sm leading-7 text-slate-300">
            正在调用深度学习接口，对水果表面纹理、成熟度特征与疑似缺陷区域进行分析。本阶段动效用于解释“系统正在工作”，而不是装饰性闪烁。
          </p>
        </div>
      </div>
    </div>
  `;
}

function ReadyStage({ preview }) {
  return html`
    <div className="result-stage-shell relative flex min-h-[560px] items-center justify-center overflow-hidden rounded-[30px] border border-emerald-400/18 bg-[#071118]">
      <img src=${preview.url} alt="待分析水果" className="absolute inset-0 h-full w-full object-contain opacity-85" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(6,11,18,0.2),rgba(6,11,18,0.68))]"></div>
      <div className="absolute inset-x-10 bottom-10 rounded-[24px] border border-emerald-400/20 bg-[#061019]/82 p-6 backdrop-blur-md">
        <p className="text-[11px] uppercase tracking-[0.34em] text-emerald-200/70">Ready To Analyze</p>
        <h3 className="mt-3 text-3xl font-semibold text-white">图像已就绪，等待分析启动</h3>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
          当前舞台展示的是原始水果图像。点击左侧 Analyze 按钮后，界面将进入扫描态，随后展示缺陷边框、置信度与结果总结。
        </p>
      </div>
    </div>
  `;
}

function EmptyStage() {
  return html`
    <div className="result-stage-shell grid min-h-[560px] place-items-center rounded-[30px] border border-dashed border-white/12 bg-[#071118] p-10 text-center">
      <div className="space-y-4">
        <p className="text-xs uppercase tracking-[0.38em] text-slate-500">Results Grid</p>
        <h3 className="text-3xl font-semibold text-white">等待输入水果图像</h3>
        <p className="mx-auto max-w-xl text-sm leading-7 text-slate-400">
          上传区域用于导入水果图片，结果舞台用于展示扫描态和检测态。这个单屏布局适合毕设答辩时在同一界面集中展示主要功能。
        </p>
      </div>
    </div>
  `;
}

function DetectionStage({ preview, detections, hoveredId, setHoveredId, imageSize }) {
  const [tooltip, setTooltip] = useState(null);

  useEffect(() => {
    if (!hoveredId) {
      setTooltip(null);
      return;
    }

    const current = detections.find((item, index) => `${item.class_name}-${index}` === hoveredId);
    if (!current) {
      setTooltip(null);
      return;
    }

    const { box } = current;
    setTooltip({
      id: hoveredId,
      left: ((box.x1 + box.x2) / 2 / imageSize.width) * 100,
      top: (box.y1 / imageSize.height) * 100,
      item: current,
    });
  }, [detections, hoveredId, imageSize.height, imageSize.width]);

  return html`
    <div className="result-stage-shell rounded-[30px] border border-white/10 bg-[#071118] p-4">
      <div className="relative overflow-hidden rounded-[24px] bg-[#02060d]">
        <img src=${preview.url} alt="检测结果原图" className="block w-full rounded-[24px]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,13,0.04),rgba(2,6,13,0.28))]"></div>

        <div className="absolute inset-0">
          ${detections.map((item, index) => {
            const { box } = item;
            const meta = styleForClass(item.class_name);
            const id = `${item.class_name}-${index}`;

            return html`
              <${motion.button}
                key=${id}
                type="button"
                whileHover=${{ scale: 1.01 }}
                transition=${{ duration: 0.18, ease: premiumEase }}
                className="absolute rounded-[18px] border-2"
                style=${{
                  left: `${(box.x1 / imageSize.width) * 100}%`,
                  top: `${(box.y1 / imageSize.height) * 100}%`,
                  width: `${((box.x2 - box.x1) / imageSize.width) * 100}%`,
                  height: `${((box.y2 - box.y1) / imageSize.height) * 100}%`,
                  borderColor: meta.border,
                  boxShadow: hoveredId === id ? `0 0 0 4px ${meta.glow}, inset 0 0 28px ${meta.glow}` : `0 0 18px ${meta.glow}`,
                }}
                onMouseEnter=${() => setHoveredId(id)}
                onMouseLeave=${() => setHoveredId(null)}
                onFocus=${() => setHoveredId(id)}
                onBlur=${() => setHoveredId(null)}
              >
                <span
                  className="absolute left-3 top-3 rounded-full px-3 py-1 text-[11px] font-semibold text-white shadow-[0_0_16px_rgba(0,0,0,0.3)]"
                  style=${{ backgroundColor: meta.border }}
                >
                  ${labelForClass(item.class_name)}
                </span>
                <span className="sr-only">${labelForClass(item.class_name)} ${confidenceText(item.confidence)}</span>
              </${motion.button}>
            `;
          })}

          <${AnimatePresence}>
            ${tooltip
              ? html`
                  <${motion.div}
                    key=${tooltip.id}
                    initial=${{ opacity: 0, y: 8, scale: 0.97 }}
                    animate=${{ opacity: 1, y: 0, scale: 1 }}
                    exit=${{ opacity: 0, y: 8, scale: 0.97 }}
                    transition=${{ duration: 0.18, ease: premiumEase }}
                    className="defect-tooltip neon-tooltip absolute z-20 w-max max-w-[230px] rounded-2xl px-4 py-3 text-left"
                    style=${{ left: `${tooltip.left}%`, top: `${tooltip.top}%` }}
                  >
                    <p className="text-[11px] uppercase tracking-[0.28em] text-slate-400">Defect Insight</p>
                    <p className="mt-2 text-sm font-semibold text-white">${labelForClass(tooltip.item.class_name)}</p>
                    <p className="mt-1 text-sm text-slate-300">置信度：${confidenceText(tooltip.item.confidence)}</p>
                  </${motion.div}>
                `
              : null}
          </${AnimatePresence}>
        </div>
      </div>
    </div>
  `;
}

function MetricsPanel({ preview, result, loading, error }) {
  const detectionCount = result?.summary?.detection_count || 0;
  const primary = labelForClass(result?.summary?.primary_class);
  const highest = labelForClass(result?.summary?.highest_severity_class);
  const containsRotten = Boolean(result?.summary?.contains_rotten);

  return html`
    <div className="grid gap-5 xl:grid-rows-[auto_auto_1fr]">
      <${motion.section}
        initial=${{ opacity: 0, y: 18 }}
        animate=${{ opacity: 1, y: 0 }}
        transition=${{ duration: 0.44, delay: 0.06, ease: premiumEase }}
        className="neon-panel rounded-[30px] p-6"
      >
        <p className="text-[11px] uppercase tracking-[0.34em] text-slate-500">Results Grid</p>
        <h2 className="mt-2 text-2xl font-semibold text-white">检测摘要总览</h2>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <div className="metric-card">
            <p className="metric-label">检测目标数</p>
            <p className="metric-value">${loading ? "--" : detectionCount}</p>
          </div>
          <div className="metric-card metric-card-ripe">
            <p className="metric-label">主要类别</p>
            <p className="metric-value text-[26px]">${loading ? "分析中" : primary}</p>
          </div>
          <div className=${`metric-card ${containsRotten ? "metric-card-defect" : ""}`}>
            <p className="metric-label">最高风险类别</p>
            <p className="metric-value text-[24px]">${loading ? "--" : highest}</p>
          </div>
          <div className="metric-card">
            <p className="metric-label">接口耗时</p>
            <p className="metric-value text-[24px]">${result?.elapsed_ms ? `${result.elapsed_ms}ms` : loading ? "..." : "--"}</p>
          </div>
        </div>
      </${motion.section}>

      <${motion.section}
        initial=${{ opacity: 0, y: 18 }}
        animate=${{ opacity: 1, y: 0 }}
        transition=${{ duration: 0.44, delay: 0.12, ease: premiumEase }}
        className="neon-panel rounded-[30px] p-6"
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.34em] text-slate-500">Image Meta</p>
            <h3 className="mt-2 text-xl font-semibold text-white">图像元信息</h3>
          </div>
          ${preview
            ? html`<span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">${preview.sizeKb} KB</span>`
            : null}
        </div>

        <dl className="mt-5 space-y-3 text-sm text-slate-300">
          <div className="meta-row">
            <dt>文件名</dt>
            <dd>${preview?.name || "尚未上传"}</dd>
          </div>
          <div className="meta-row">
            <dt>分辨率</dt>
            <dd>${preview ? `${preview.width} × ${preview.height}` : "--"}</dd>
          </div>
          <div className="meta-row">
            <dt>模式</dt>
            <dd>${loading ? "扫描分析中" : result ? "结果已返回" : "待输入"}</dd>
          </div>
        </dl>
      </${motion.section}>

      <${motion.section}
        initial=${{ opacity: 0, y: 18 }}
        animate=${{ opacity: 1, y: 0 }}
        transition=${{ duration: 0.44, delay: 0.18, ease: premiumEase }}
        className="neon-panel rounded-[30px] p-6"
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.34em] text-slate-500">Detection List</p>
            <h3 className="mt-2 text-xl font-semibold text-white">缺陷明细</h3>
          </div>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
            ${loading ? "处理中" : `${detectionCount} 项`}
          </span>
        </div>

        <div className="mt-5 space-y-3">
          ${error
            ? html`
                <${motion.div}
                  initial=${{ opacity: 0, x: -8 }}
                  animate=${{ opacity: 1, x: [0, -4, 4, -2, 0] }}
                  transition=${{ duration: 0.36, ease: premiumEase }}
                  className="rounded-2xl border border-red-400/20 bg-red-500/8 px-4 py-3 text-sm text-red-200"
                >
                  ${error}
                </${motion.div}>
              `
            : null}

          ${!loading && !error && result?.detections?.length
            ? result.detections.map((item, index) => {
                const meta = styleForClass(item.class_name);
                return html`
                  <${motion.div}
                    key=${`${item.class_name}-${index}`}
                    initial=${{ opacity: 0, x: 14 }}
                    animate=${{ opacity: 1, x: 0 }}
                    transition=${{ duration: 0.24, delay: index * 0.04, ease: premiumEase }}
                    className="rounded-2xl border border-white/8 bg-white/5 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className=${`inline-flex rounded-full bg-gradient-to-r px-3 py-1 text-xs font-semibold text-white ${meta.badgeClass}`}>
                          ${labelForClass(item.class_name)}
                        </span>
                        <p className="mt-3 text-sm leading-6 text-slate-300">
                          坐标：(${Math.round(item.box.x1)}, ${Math.round(item.box.y1)}) -
                          (${Math.round(item.box.x2)}, ${Math.round(item.box.y2)})
                        </p>
                      </div>
                      <span className="text-lg font-semibold text-white">${confidenceText(item.confidence)}</span>
                    </div>
                  </${motion.div}>
                `;
              })
            : html`
                <div className="rounded-2xl border border-dashed border-white/10 bg-white/4 px-4 py-8 text-center text-sm leading-7 text-slate-400">
                  ${loading ? "结果列表将随分析完成后出现。" : "上传图片并点击 Analyze 后，这里将按网格方式展示所有检测目标。"}
                </div>
              `}
        </div>
      </${motion.section}>
    </div>
  `;
}

function App() {
  const [dragging, setDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hoveredId, setHoveredId] = useState(null);
  const objectUrlRef = useRef("");

  useEffect(() => () => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
    }
  }, []);

  const deferredResult = useDeferredValue(result);
  const imageSize = useMemo(() => {
    if (deferredResult?.width && deferredResult?.height) {
      return { width: deferredResult.width, height: deferredResult.height };
    }
    if (preview?.width && preview?.height) {
      return { width: preview.width, height: preview.height };
    }
    return { width: 1, height: 1 };
  }, [deferredResult?.height, deferredResult?.width, preview?.height, preview?.width]);

  async function prepareFile(file) {
    if (!file || !String(file.type || "").startsWith("image/")) {
      setError("请上传有效的水果图片文件。");
      return;
    }

    try {
      setError("");
      setResult(null);
      setHoveredId(null);
      setLoading(false);

      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }

      const nextPreview = await fileToPreview(file);
      objectUrlRef.current = nextPreview.url;
      setSelectedFile(file);
      setPreview(nextPreview);
    } catch (err) {
      setError(err.message || "图片载入失败，请重新选择。");
    }
  }

  async function analyzeCurrent() {
    if (!selectedFile || loading) {
      return;
    }

    try {
      setError("");
      setLoading(true);
      setResult(null);
      setHoveredId(null);

      const [payload] = await Promise.all([requestPrediction(selectedFile), wait(2000)]);
      setResult(payload);
    } catch (err) {
      setError(err.message || "检测失败，请稍后重试。");
    } finally {
      setLoading(false);
    }
  }

  function onBrowse(event) {
    const file = event.target.files?.[0];
    if (file) {
      prepareFile(file);
    }
    event.target.value = "";
  }

  function onDrop(event) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      prepareFile(file);
    }
  }

  function onDragEnter(event) {
    event.preventDefault();
    setDragging(true);
  }

  function onDragLeave(event) {
    event.preventDefault();
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setDragging(false);
    }
  }

  function onDragOver(event) {
    event.preventDefault();
  }

  return html`
    <div className="dashboard-dark relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 opacity-80">
        <div className="dashboard-gridline absolute inset-0"></div>
      </div>

      <main className="relative mx-auto min-h-screen max-w-[1680px] px-6 py-8 lg:px-10">
        <div className="space-y-6">
          <${HeaderBar} loading=${loading} result=${deferredResult} />

          <div className="grid gap-6 xl:grid-cols-[400px_minmax(0,1fr)_360px]">
            <${UploadPanel}
              dragging=${dragging}
              loading=${loading}
              preview=${preview}
              selectedFile=${selectedFile}
              onBrowse=${onBrowse}
              onDrop=${onDrop}
              onDragEnter=${onDragEnter}
              onDragLeave=${onDragLeave}
              onDragOver=${onDragOver}
              onAnalyze=${analyzeCurrent}
            />

            <${motion.section}
              initial=${{ opacity: 0, y: 18 }}
              animate=${{ opacity: 1, y: 0 }}
              transition=${{ duration: 0.48, delay: 0.06, ease: premiumEase }}
              className="neon-panel rounded-[30px] p-6"
            >
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.34em] text-slate-500">Results Grid</p>
                  <h2 className="mt-2 text-3xl font-semibold text-white">检测结果舞台</h2>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-right">
                  <p className="text-[11px] uppercase tracking-[0.26em] text-slate-500">Current State</p>
                  <p className="mt-1 text-lg font-semibold text-white">${loading ? "Analyzing" : deferredResult ? "Detected" : preview ? "Ready" : "Idle"}</p>
                </div>
              </div>

              <${AnimatePresence} mode="wait">
                ${loading
                  ? html`
                      <${motion.div}
                        key="loading"
                        initial=${{ opacity: 0, scale: 0.986 }}
                        animate=${{ opacity: 1, scale: 1 }}
                        exit=${{ opacity: 0, scale: 0.986 }}
                        transition=${{ duration: 0.24, ease: premiumEase }}
                      >
                        <${ScanStage} preview=${preview} />
                      </${motion.div}>
                    `
                  : preview && deferredResult
                    ? html`
                        <${motion.div}
                          key="detected"
                          initial=${{ opacity: 0, y: 10 }}
                          animate=${{ opacity: 1, y: 0 }}
                          exit=${{ opacity: 0, y: -10 }}
                          transition=${{ duration: 0.28, ease: premiumEase }}
                        >
                          <${DetectionStage}
                            preview=${preview}
                            detections=${deferredResult.detections || []}
                            hoveredId=${hoveredId}
                            setHoveredId=${setHoveredId}
                            imageSize=${imageSize}
                          />
                        </${motion.div}>
                      `
                    : preview
                      ? html`
                          <${motion.div}
                            key="ready"
                            initial=${{ opacity: 0 }}
                            animate=${{ opacity: 1 }}
                            exit=${{ opacity: 0 }}
                            transition=${{ duration: 0.22, ease: premiumEase }}
                          >
                            <${ReadyStage} preview=${preview} />
                          </${motion.div}>
                        `
                      : html`
                          <${motion.div}
                            key="empty"
                            initial=${{ opacity: 0 }}
                            animate=${{ opacity: 1 }}
                            exit=${{ opacity: 0 }}
                            transition=${{ duration: 0.22, ease: premiumEase }}
                          >
                            <${EmptyStage} />
                          </${motion.div}>
                        `}
              </${AnimatePresence}>
            </${motion.section}>

            <${MetricsPanel} preview=${preview} result=${deferredResult} loading=${loading} error=${error} />
          </div>
        </div>
      </main>
    </div>
  `;
}

createRoot(document.getElementById("root")).render(html`<${App} />`);
