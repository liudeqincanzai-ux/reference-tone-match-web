"use strict";

const dom = {
  refsInput: document.getElementById("refsInput"),
  targetsInput: document.getElementById("targetsInput"),
  folderInput: document.getElementById("folderInput"),
  pickRefsBtn: document.getElementById("pickRefsBtn"),
  pickTargetsBtn: document.getElementById("pickTargetsBtn"),
  pickFolderBtn: document.getElementById("pickFolderBtn"),
  clearRefsBtn: document.getElementById("clearRefsBtn"),
  clearTargetsBtn: document.getElementById("clearTargetsBtn"),
  refsList: document.getElementById("refsList"),
  targetsList: document.getElementById("targetsList"),
  modeSelect: document.getElementById("modeSelect"),
  strengthRange: document.getElementById("strengthRange"),
  strengthValue: document.getElementById("strengthValue"),
  localRange: document.getElementById("localRange"),
  localValue: document.getElementById("localValue"),
  skinProtectInput: document.getElementById("skinProtectInput"),
  sizeSelect: document.getElementById("sizeSelect"),
  formatSelect: document.getElementById("formatSelect"),
  qualityRange: document.getElementById("qualityRange"),
  qualityValue: document.getElementById("qualityValue"),
  themeToggle: document.getElementById("themeToggle"),
  lutInputs: [document.getElementById("lut1Input"), document.getElementById("lut2Input")],
  lutSelects: [document.getElementById("lut1Select"), document.getElementById("lut2Select")],
  pickLutBtns: [document.getElementById("pickLut1Btn"), document.getElementById("pickLut2Btn")],
  clearLutBtns: [document.getElementById("clearLut1Btn"), document.getElementById("clearLut2Btn")],
  deleteLutBtns: [document.getElementById("deleteLut1Btn"), document.getElementById("deleteLut2Btn")],
  lutNames: [document.getElementById("lut1Name"), document.getElementById("lut2Name")],
  lutAmountRanges: [document.getElementById("lut1AmountRange"), document.getElementById("lut2AmountRange")],
  lutAmountValues: [document.getElementById("lut1AmountValue"), document.getElementById("lut2AmountValue")],
  lutLibraryCount: document.getElementById("lutLibraryCount"),
  statusLine: document.getElementById("statusLine"),
  progressBar: document.getElementById("progressBar"),
  processBtn: document.getElementById("processBtn"),
  restoreBtn: document.getElementById("restoreBtn"),
  downloadBtn: document.getElementById("downloadBtn"),
  downloadAllBtn: document.getElementById("downloadAllBtn"),
  copyParamsBtn: document.getElementById("copyParamsBtn"),
  pasteParamsBtn: document.getElementById("pasteParamsBtn"),
  syncParamsBtn: document.getElementById("syncParamsBtn"),
  refPreview: document.getElementById("refPreview"),
  targetPreview: document.getElementById("targetPreview"),
  beforeCanvas: document.getElementById("beforeCanvas"),
  resultCanvas: document.getElementById("resultCanvas"),
  compareStage: document.getElementById("compareStage"),
  compareHandle: document.getElementById("compareHandle"),
  refThumbs: document.getElementById("refThumbs"),
  targetThumbs: document.getElementById("targetThumbs"),
  resultThumbs: document.getElementById("resultThumbs"),
  resultList: document.getElementById("resultList"),
  refEmpty: document.getElementById("refEmpty"),
  targetEmpty: document.getElementById("targetEmpty"),
  resultEmpty: document.getElementById("resultEmpty"),
  hslPanels: document.getElementById("hslPanels"),
};

const state = {
  references: [],
  targets: [],
  outputs: [],
  refStats: null,
  activeOutput: null,
  activeRefIndex: 0,
  activeTargetIndex: 0,
  activeOutputIndex: -1,
  targetParams: [],
  copiedParams: null,
  liveTimer: null,
  liveBusy: false,
  liveQueued: false,
  previewTimer: null,
  previewBusy: false,
  previewQueued: false,
  previewRevision: 0,
  compareDragging: false,
  comparePosition: 50,
  previewUrls: {
    ref: null,
    target: null,
  },
  thumbUrls: {
    refs: [],
    targets: [],
  },
  userLuts: [
    { id: "", name: "", lut: null },
    { id: "", name: "", lut: null },
  ],
  lutLibrary: [],
  previewView: {
    scale: 1,
    x: 0,
    y: 0,
    dragging: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
  },
  busy: false,
};

const MAX_ANALYZE_SAMPLES = 320000;
const MAX_REFERENCE_EDGE = 1800;
const CHUNK_PIXELS = 70000;
const MAX_LIVE_PREVIEW_EDGE = 1600;
const LUT_GRID_SIZE = 17;
const USER_LUT_LIMIT = 50;
const LUT_DB_NAME = "reference-tone-match-luts";
const LUT_DB_VERSION = 1;
const LUT_STORE_NAME = "luts";
const RAW_EXTENSIONS = new Set(["arw", "orf", "rw2", "raf", "cr2", "cr3", "nef", "dng", "srw", "pef", "3fr", "rwl"]);
const DECODE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "avif", "gif", "bmp", "heic", "heif"]);
const HSL_CHANNELS = ["red", "orange", "yellow", "green", "aqua", "blue", "purple", "magenta"];
const HSL_CENTERS = {
  red: 0,
  orange: 30 / 360,
  yellow: 58 / 360,
  green: 120 / 360,
  aqua: 170 / 360,
  blue: 220 / 360,
  purple: 272 / 360,
  magenta: 318 / 360,
};
const HSL_LABELS = {
  red: "红色",
  orange: "橙色",
  yellow: "黄色",
  green: "绿色",
  aqua: "浅绿色",
  blue: "蓝色",
  purple: "紫色",
  magenta: "洋红",
};
const HSL_AXES = [
  { key: "h", title: "色相", hint: "Hue" },
  { key: "s", title: "饱和度", hint: "Saturation" },
  { key: "l", title: "明度", hint: "Luminance" },
];
const SAMPLE_APPEND_CHUNK = 12000;
const THEME_STORAGE_KEY = "reference-tone-match-theme";

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function applyTheme(theme) {
  const nextTheme = theme === "dark" ? "dark" : "light";
  document.body.dataset.theme = nextTheme;
  if (dom.themeToggle) {
    dom.themeToggle.textContent = nextTheme === "dark" ? "日间模式" : "夜间模式";
    dom.themeToggle.setAttribute("aria-pressed", String(nextTheme === "dark"));
  }
  try {
    localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  } catch (error) {
    // Ignore private browsing storage failures.
  }
}

function initialTheme() {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "dark" || stored === "light") return stored;
  } catch (error) {
    // Ignore private browsing storage failures.
  }
  return "light";
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function fileExtension(file) {
  const name = file?.name || "";
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : "";
}

function isRawFile(file) {
  return RAW_EXTENSIONS.has(fileExtension(file));
}

function canBrowserDecode(file) {
  if (!file) return false;
  if (isRawFile(file)) return false;
  const ext = fileExtension(file);
  return file.type.startsWith("image/") || DECODE_EXTENSIONS.has(ext);
}

function defaultHsl() {
  const hsl = {};
  for (const channel of HSL_CHANNELS) {
    hsl[channel] = { h: 0, s: 0, l: 0 };
  }
  return hsl;
}

function defaultParams() {
  return {
    mode: "normal",
    strength: 1,
    localStrength: 0.45,
    skinProtect: true,
    adjustments: {
      temperature: 0,
      tint: 0,
      exposure: 0,
      contrast: 0,
      highlights: 0,
      shadows: 0,
      whites: 0,
      blacks: 0,
      vibrance: 0,
      saturation: 0,
    },
    hsl: defaultHsl(),
    userLutIds: ["", ""],
    userLutAmounts: [100, 100],
  };
}

function hueCss(channel, shift = 0, saturation = 76, lightness = 48) {
  const hue = Math.round((((HSL_CENTERS[channel] + shift) % 1 + 1) % 1) * 360);
  return `hsl(${hue} ${saturation}% ${lightness}%)`;
}

function hslGradient(channel, axis) {
  if (axis === "h") {
    return `linear-gradient(90deg, ${hueCss(channel, -36 / 360, 82, 46)}, ${hueCss(channel, -18 / 360, 82, 48)}, ${hueCss(channel, 0, 82, 50)}, ${hueCss(channel, 18 / 360, 82, 48)}, ${hueCss(channel, 36 / 360, 82, 46)})`;
  }
  if (axis === "s") {
    return `linear-gradient(90deg, hsl(${Math.round(HSL_CENTERS[channel] * 360)} 0% 48%), ${hueCss(channel, 0, 42, 48)}, ${hueCss(channel, 0, 96, 48)})`;
  }
  return `linear-gradient(90deg, ${hueCss(channel, 0, 64, 20)}, ${hueCss(channel, 0, 70, 50)}, ${hueCss(channel, 0, 78, 78)})`;
}

function adjustmentGradient(param) {
  switch (param) {
    case "temperature":
      return "linear-gradient(90deg, #2f6fb2 0%, #b8c4bc 50%, #d7b22c 100%)";
    case "tint":
      return "linear-gradient(90deg, #48a35d 0%, #b8c4bc 50%, #c04a9b 100%)";
    case "vibrance":
      return "linear-gradient(90deg, #8d9690 0%, #aeb8b2 42%, #2a7f62 68%, #c9312b 100%)";
    case "saturation":
      return "linear-gradient(90deg, #8f9692 0%, #aeb8b2 42%, #d6ad2d 62%, #31a58f 76%, #c9312b 100%)";
    case "exposure":
    case "highlights":
    case "whites":
      return "linear-gradient(90deg, #303634 0%, #aeb8b2 50%, #f5f2df 100%)";
    case "shadows":
    case "blacks":
      return "linear-gradient(90deg, #111614 0%, #78837d 50%, #d7ded8 100%)";
    case "contrast":
      return "linear-gradient(90deg, #7d8580 0%, #b8c4bc 50%, #202422 100%)";
    default:
      return "linear-gradient(90deg, #6f7872 0%, #b8c4bc 50%, #26735a 100%)";
  }
}

function rangePercent(input) {
  const min = Number(input.min || 0);
  const max = Number(input.max || 100);
  return ((Number(input.value) - min) / Math.max(1, max - min)) * 100;
}

function signedValue(value, decimals = 0) {
  const numeric = Number(value);
  const text = decimals > 0 ? numeric.toFixed(decimals) : String(Math.round(numeric));
  return numeric > 0 ? `+${text}` : text;
}

function renderHslControls() {
  if (!dom.hslPanels) return;
  dom.hslPanels.innerHTML = "";
  for (const axis of HSL_AXES) {
    const section = document.createElement("div");
    section.className = "hsl-section";
    const title = document.createElement("div");
    title.className = "hsl-section-title";
    title.innerHTML = `<strong>${axis.title}</strong><span>${axis.hint}</span>`;
    section.appendChild(title);

    for (const channel of HSL_CHANNELS) {
      const row = document.createElement("label");
      row.className = "hsl-row";

      const name = document.createElement("span");
      name.className = "hsl-name";
      name.innerHTML = `<span class="swatch ${channel}"></span>${HSL_LABELS[channel]}`;

      const track = document.createElement("span");
      track.className = "hsl-track";
      track.style.setProperty("--track-gradient", hslGradient(channel, axis.key));

      const current = document.createElement("span");
      current.className = "hsl-current";
      current.dataset.hslBubbleFor = `${channel}-${axis.key}`;
      current.textContent = "0";

      const rowValue = document.createElement("span");
      rowValue.className = "hsl-row-value";
      rowValue.dataset.hslValueFor = `${channel}-${axis.key}`;
      rowValue.textContent = "0";

      const input = document.createElement("input");
      input.className = "hsl-slider";
      input.type = "range";
      input.min = "-100";
      input.max = "100";
      input.value = "0";
      input.dataset.channel = channel;
      input.dataset.axis = axis.key;
      input.setAttribute("aria-label", `${HSL_LABELS[channel]}${axis.title}`);

      track.append(current, input);
      row.append(name, track, rowValue);
      section.appendChild(row);
    }

    dom.hslPanels.appendChild(section);
  }
}

function appendSamples(target, samples) {
  for (let i = 0; i < samples.length; i += SAMPLE_APPEND_CHUNK) {
    const end = Math.min(samples.length, i + SAMPLE_APPEND_CHUNK);
    for (let j = i; j < end; j += 1) {
      target.push(samples[j]);
    }
  }
}

function ensureTargetParams() {
  while (state.targetParams.length < state.targets.length) {
    state.targetParams.push(defaultParams());
  }
  if (state.targetParams.length > state.targets.length) {
    state.targetParams.length = state.targets.length;
  }
}

function clamp01(value) {
  return clamp(value, 0, 1);
}

function mix(a, b, t) {
  return a * (1 - t) + b * t;
}

function luma(r, g, b) {
  return r * 0.2126 + g * 0.7152 + b * 0.0722;
}

function srgbUnitToLinear(value) {
  const v = clamp01(value);
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function linearUnitToSrgb(value) {
  const v = clamp01(value);
  return v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
}

function srgbByteToLinear(value) {
  return srgbUnitToLinear(value / 255);
}

function linearUnitToSrgbByte(value) {
  return Math.round(clamp01(linearUnitToSrgb(value)) * 255);
}

function getSrgb2dContext(canvas, options = {}) {
  try {
    return canvas.getContext("2d", { colorSpace: "srgb", ...options }) || canvas.getContext("2d", options);
  } catch {
    return canvas.getContext("2d", options);
  }
}

function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / Math.max(0.000001, edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function rgbToHsv(r, g, b) {
  const maxValue = Math.max(r, g, b);
  const minValue = Math.min(r, g, b);
  const delta = maxValue - minValue;
  let h = 0;
  if (delta > 0.00001) {
    if (maxValue === r) h = ((g - b) / delta) % 6;
    else if (maxValue === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
    h /= 6;
    if (h < 0) h += 1;
  }
  const s = maxValue <= 0 ? 0 : delta / maxValue;
  return { h, s, v: maxValue };
}

function hsvToRgb(h, s, v) {
  const wrapped = ((h % 1) + 1) % 1;
  const i = Math.floor(wrapped * 6);
  const f = wrapped * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  switch (i % 6) {
    case 0:
      return [v, t, p];
    case 1:
      return [q, v, p];
    case 2:
      return [p, v, t];
    case 3:
      return [p, q, v];
    case 4:
      return [t, p, v];
    default:
      return [v, p, q];
  }
}

function modeParams(mode) {
  if (mode === "deep") return { toneWeight: 1.10, colorWeight: 0.96, satWeight: 0.88, hueWeight: 0.78, maxToneDelta: 0.34, maxColorRatio: 1.50 };
  if (mode === "strong") return { toneWeight: 0.98, colorWeight: 0.86, satWeight: 0.76, hueWeight: 0.66, maxToneDelta: 0.30, maxColorRatio: 1.42 };
  if (mode === "soft") return { toneWeight: 0.64, colorWeight: 0.58, satWeight: 0.50, hueWeight: 0.40, maxToneDelta: 0.20, maxColorRatio: 1.28 };
  return { toneWeight: 0.86, colorWeight: 0.76, satWeight: 0.66, hueWeight: 0.56, maxToneDelta: 0.26, maxColorRatio: 1.36 };
}

function referenceLiftIntent(refStats, targetStats) {
  const midKeyRef = smoothstep(0.15, 0.34, refStats.lumaMedian) * 0.72;
  const brightKeyRef = smoothstep(0.52, 0.78, refStats.lumaP90) * 0.28;
  const highKeyRef = clamp(midKeyRef + brightKeyRef, 0, 1);
  const targetNeedsLift = smoothstep(0.025, 0.17, refStats.lumaMedian - targetStats.lumaMedian);
  const softerContrast = smoothstep(0.02, 0.18, targetStats.tonalWidth - refStats.tonalWidth);
  return clamp(highKeyRef * targetNeedsLift * (0.76 + softerContrast * 0.24), 0, 1);
}

function referenceSaturationIntent(refStats, targetStats) {
  const refHasColor = smoothstep(0.24, 0.58, refStats.satP60);
  const needsColor = smoothstep(0.04, 0.24, refStats.satP60 - targetStats.satP60);
  return clamp(refHasColor * needsColor, 0, 1);
}

function fitRgbToLuma(r, g, b, targetY) {
  const y = luma(r, g, b);
  const deltas = [r - y, g - y, b - y];
  let scale = 1;
  for (const delta of deltas) {
    const value = targetY + delta;
    if (value > 1 && delta > 0) scale = Math.min(scale, (1 - targetY) / Math.max(0.000001, delta));
    if (value < 0 && delta < 0) scale = Math.min(scale, targetY / Math.max(0.000001, -delta));
  }
  scale = clamp01(scale);
  return [
    clamp01(targetY + deltas[0] * scale),
    clamp01(targetY + deltas[1] * scale),
    clamp01(targetY + deltas[2] * scale),
  ];
}

function scaleChroma(r, g, b, targetY, scale) {
  const y = luma(r, g, b);
  return fitRgbToLuma(y + (r - y) * scale, y + (g - y) * scale, y + (b - y) * scale, targetY);
}

function skinRgbFromStats(y, redGreen, greenBlue) {
  const chromaScale = smoothstep(0.12, 0.42, y) * (1 - smoothstep(0.82, 0.96, y));
  const rg = clamp(redGreen, -0.015, 0.17) * chromaScale;
  const gb = clamp(greenBlue, 0.015, 0.15) * chromaScale;
  const g = y - 0.2126 * rg + 0.0722 * gb;
  return [g + rg, g, g - gb].map(clamp01);
}

function refineSkinTone(r, g, b, skinConfidence, refStats, targetStats, strength, highlightMask) {
  if (skinConfidence <= 0.001 || refStats.skinSampleCount < 80) return [r, g, b];
  const currentY = luma(r, g, b);
  const sourceHsv = rgbToHsv(r, g, b);
  const highlightSkin = smoothstep(0.56, 0.90, currentY);
  const targetRg = targetStats.skinSampleCount >= 80 ? targetStats.skinRedGreen : clamp(r - g, 0.02, 0.14);
  const targetGb = targetStats.skinSampleCount >= 80 ? targetStats.skinGreenBlue : clamp(g - b, 0.02, 0.13);
  const desiredRg = clamp(targetRg + (refStats.skinRedGreen - targetRg) * strength * 0.52, 0.018, 0.15);
  const desiredGb = clamp(targetGb + (refStats.skinGreenBlue - targetGb) * strength * 0.62, 0.025, 0.14);
  const targetSkin = skinRgbFromStats(currentY, desiredRg, desiredGb);
  const pinkBias = smoothstep(330 / 360, 350 / 360, sourceHsv.h) + smoothstep(0, 12 / 360, sourceHsv.h) * (1 - smoothstep(22 / 360, 38 / 360, sourceHsv.h));
  const axisWeight = skinConfidence * strength * (0.30 + 0.22 * highlightSkin + 0.16 * clamp(pinkBias, 0, 1)) * (1 - highlightMask * 0.12);

  let tr = mix(r, targetSkin[0], axisWeight);
  let tg = mix(g, targetSkin[1], axisWeight);
  let tb = mix(b, targetSkin[2], axisWeight);
  const nextY = luma(tr, tg, tb);
  const desat = skinConfidence * smoothstep(0.52, 0.92, nextY) * 0.14;
  tr = nextY + (tr - nextY) * (1 - desat);
  tg = nextY + (tg - nextY) * (1 - desat);
  tb = nextY + (tb - nextY) * (1 - desat);
  return fitRgbToLuma(tr, tg, tb, nextY || currentY);
}

function softSkinConfidence(r, g, b, hsv, y) {
  const hd = hsv.h * 360;
  const hueMask = smoothstep(5, 16, hd) * (1 - smoothstep(62, 82, hd));
  const satMask = smoothstep(0.035, 0.12, hsv.s) * (1 - smoothstep(0.70, 0.90, hsv.s));
  const lumaMask = smoothstep(0.10, 0.22, y) * (1 - smoothstep(0.90, 0.99, y));
  const rb = smoothstep(-0.005, 0.14, r - b);
  const gb = smoothstep(-0.06, 0.12, g - b);
  const rg = 1 - smoothstep(0.24, 0.44, Math.abs(r - g));
  return clamp(Math.pow(Math.max(0, hueMask * satMask * lumaMask * rb * gb * rg), 0.45), 0, 1);
}

function isLikelySkin(r, g, b, hsv, y) {
  const hd = hsv.h * 360;
  return y > 0.18 && y < 0.88 && hsv.s > 0.08 && hsv.s < 0.68 && hd >= 12 && hd <= 58 && r > g * 0.92 && g > b * 0.72;
}

function redAccentConfidence(hsv, y) {
  const hd = hsv.h * 360;
  const redWrap = Math.min(hd, 360 - hd);
  const trueRed = 1 - smoothstep(10, 28, redWrap);
  const coral = smoothstep(8, 18, hd) * (1 - smoothstep(38, 52, hd));
  const magenta = smoothstep(342, 350, hd) * (1 - smoothstep(358, 360, hd)) * 0.58;
  const hueMask = clamp(Math.max(trueRed, coral, magenta), 0, 1);
  const satMask = smoothstep(0.22, 0.52, hsv.s);
  const lumaMask = smoothstep(0.06, 0.16, y) * (1 - smoothstep(0.93, 0.99, y));
  return clamp(Math.pow(Math.max(0, hueMask * satMask * lumaMask), 0.58), 0, 1);
}

function warmColorConfidence(hsv, y) {
  const hd = hsv.h * 360;
  const redWrap = Math.min(hd, 360 - hd);
  const red = 1 - smoothstep(16, 38, redWrap);
  const orange = smoothstep(12, 24, hd) * (1 - smoothstep(50, 72, hd));
  const magenta = smoothstep(334, 346, hd) * (1 - smoothstep(358, 360, hd));
  const hueMask = clamp(Math.max(red, orange, magenta), 0, 1);
  const satMask = smoothstep(0.14, 0.46, hsv.s);
  const lumaMask = smoothstep(0.04, 0.16, y) * (1 - smoothstep(0.94, 0.995, y));
  return clamp(Math.pow(Math.max(0, hueMask * satMask * lumaMask), 0.62), 0, 1);
}

function blueAccentConfidence(hsv, y) {
  const hd = hsv.h * 360;
  const hueMask = smoothstep(188, 205, hd) * (1 - smoothstep(238, 258, hd));
  return clamp(Math.pow(Math.max(0, hueMask * smoothstep(0.22, 0.58, hsv.s) * smoothstep(0.10, 0.25, y) * (1 - smoothstep(0.90, 0.985, y))), 0.65), 0, 1);
}

function skyBlueConfidence(hsv, y) {
  const hd = hsv.h * 360;
  const hueMask = smoothstep(188, 202, hd) * (1 - smoothstep(232, 252, hd));
  return clamp(Math.pow(Math.max(0, hueMask * smoothstep(0.035, 0.18, hsv.s) * (1 - smoothstep(0.78, 0.98, hsv.s)) * smoothstep(0.44, 0.64, y) * (1 - smoothstep(0.96, 0.995, y))), 0.62), 0, 1);
}

function greenPlantConfidence(hsv, y) {
  const hd = hsv.h * 360;
  const hueMask = smoothstep(66, 84, hd) * (1 - smoothstep(156, 178, hd));
  return clamp(Math.pow(Math.max(0, hueMask * smoothstep(0.10, 0.34, hsv.s) * smoothstep(0.05, 0.16, y) * (1 - smoothstep(0.88, 0.975, y))), 0.60), 0, 1);
}

function shadowZoneConfidence(hsv, y) {
  return clamp((1 - smoothstep(0.16, 0.42, y)) * (0.62 + 0.38 * (1 - smoothstep(0.55, 0.88, hsv.s))), 0, 1);
}

function highlightZoneConfidence(hsv, y) {
  return clamp(smoothstep(0.72, 0.93, y) * (0.55 + 0.45 * (1 - smoothstep(0.22, 0.56, hsv.s))), 0, 1);
}

function quantileSorted(sorted, q) {
  if (!sorted.length) return 0;
  const pos = clamp01(q) * (sorted.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  const t = pos - lo;
  return sorted[lo] * (1 - t) + sorted[hi] * t;
}

function median(values, fallback) {
  if (!values.length) return fallback;
  values.sort((a, b) => a - b);
  return quantileSorted(values, 0.5);
}

function quantile(values, q, fallback) {
  if (!values.length) return fallback;
  values.sort((a, b) => a - b);
  return quantileSorted(values, q);
}

function smooth(values, passes) {
  let out = values.slice();
  for (let pass = 0; pass < passes; pass += 1) {
    const next = out.slice();
    for (let i = 0; i < out.length; i += 1) {
      const a = out[Math.max(0, i - 2)];
      const b = out[Math.max(0, i - 1)];
      const c = out[i];
      const d = out[Math.min(out.length - 1, i + 1)];
      const e = out[Math.min(out.length - 1, i + 2)];
      next[i] = (a + 2 * b + 3 * c + 2 * d + e) / 9;
    }
    out = next;
  }
  return out;
}

function smoothCircular(values, passes) {
  let out = values.slice();
  const n = out.length;
  for (let pass = 0; pass < passes; pass += 1) {
    const next = out.slice();
    for (let i = 0; i < n; i += 1) {
      next[i] = (out[(i + n - 2) % n] + 2 * out[(i + n - 1) % n] + 3 * out[i] + 2 * out[(i + 1) % n] + out[(i + 2) % n]) / 9;
    }
    out = next;
  }
  return out;
}

function smoothRows(rows, passes) {
  let out = rows.map((row) => row.slice());
  for (let pass = 0; pass < passes; pass += 1) {
    const next = out.map((row) => row.slice());
    for (let i = 0; i < out.length; i += 1) {
      for (let ch = 0; ch < 3; ch += 1) {
        next[i][ch] = (
          out[Math.max(0, i - 2)][ch] +
          2 * out[Math.max(0, i - 1)][ch] +
          3 * out[i][ch] +
          2 * out[Math.min(out.length - 1, i + 1)][ch] +
          out[Math.min(out.length - 1, i + 2)][ch]
        ) / 9;
      }
    }
    out = next;
  }
  return out;
}

function circularMean(values, fallback) {
  if (!values.length) return fallback;
  let x = 0;
  let y = 0;
  for (const hue of values) {
    const angle = hue * Math.PI * 2;
    x += Math.cos(angle);
    y += Math.sin(angle);
  }
  if (Math.abs(x) + Math.abs(y) < 0.000001) return fallback;
  const hue = Math.atan2(y, x) / (Math.PI * 2);
  return hue < 0 ? hue + 1 : hue;
}

function interpCurve(xp, fp, x) {
  if (!xp.length || !fp.length) return x;
  if (x <= xp[0]) return fp[0];
  if (x >= xp[xp.length - 1]) return fp[fp.length - 1];
  let lo = 0;
  let hi = xp.length - 1;
  while (hi - lo > 1) {
    const mid = (hi + lo) >> 1;
    if (xp[mid] <= x) lo = mid;
    else hi = mid;
  }
  const t = (x - xp[lo]) / Math.max(0.000001, xp[hi] - xp[lo]);
  return mix(fp[lo], fp[hi], t);
}

function interpRow(rows, x) {
  if (!rows.length) return [1, 1, 1];
  const scaled = clamp01(x) * (rows.length - 1);
  const i = Math.floor(scaled);
  const j = Math.min(rows.length - 1, i + 1);
  const t = scaled - i;
  return [mix(rows[i][0], rows[j][0], t), mix(rows[i][1], rows[j][1], t), mix(rows[i][2], rows[j][2], t)];
}

function interpCircular(values, hue) {
  if (!values.length) return 1;
  const n = values.length;
  const scaled = (((hue % 1) + 1) % 1) * n;
  const i = Math.floor(scaled) % n;
  const j = (i + 1) % n;
  return mix(values[i], values[j], scaled - Math.floor(scaled));
}

function samplesFromImageData(imageData, maxSamples) {
  const data = imageData.data;
  const pixelCount = imageData.width * imageData.height;
  const step = Math.max(1, Math.ceil(pixelCount / maxSamples));
  const samples = [];
  for (let p = 0; p < pixelCount; p += step) {
    const idx = p * 4;
    const a = data[idx + 3] / 255;
    if (a < 0.86) continue;
    const r = srgbByteToLinear(data[idx]);
    const g = srgbByteToLinear(data[idx + 1]);
    const b = srgbByteToLinear(data[idx + 2]);
    const y = luma(r, g, b);
    if (y < 0.015 || y > 0.985) continue;
    const value = Math.max(r, g, b);
    const minValue = Math.min(r, g, b);
    const hsv = rgbToHsv(r, g, b);
    samples.push({ r, g, b, y, sat: value - minValue, hue: hsv.h, hsvSat: hsv.s, value });
  }
  return samples;
}

function buildStats(samples) {
  if (samples.length < 16) throw new Error("可分析像素太少，请换一张更清晰的参考图。");

  const ySorted = [];
  const satSorted = [];
  const allR = [];
  const allG = [];
  const allB = [];
  const skinHues = [];
  const skinSats = [];
  const skinValues = [];
  const skinLumas = [];
  const skinRedGreen = [];
  const skinGreenBlue = [];
  const warmSats = [];
  const warmValues = [];
  const redHues = [];
  const redSats = [];
  const redValues = [];
  const blueHues = [];
  const blueSats = [];
  const blueValues = [];
  const skySats = [];
  const skyValues = [];
  const greenHues = [];
  const greenSats = [];
  const greenValues = [];
  const shadowSats = [];
  const shadowValues = [];
  const highlightSats = [];
  const hslBuckets = {};
  for (const channel of HSL_CHANNELS) {
    hslBuckets[channel] = { hues: [], sats: [], values: [] };
  }

  for (const sample of samples) {
    ySorted.push(sample.y);
    satSorted.push(sample.hsvSat);
    allR.push(sample.r);
    allG.push(sample.g);
    allB.push(sample.b);
    const hsv = { h: sample.hue, s: sample.hsvSat, v: sample.value };
    for (const channel of HSL_CHANNELS) {
      if (hslChannelWeight(channel, sample.hue, sample.hsvSat) >= 0.34) {
        hslBuckets[channel].hues.push(sample.hue);
        hslBuckets[channel].sats.push(sample.hsvSat);
        hslBuckets[channel].values.push(sample.value);
      }
    }
    const skin = softSkinConfidence(sample.r, sample.g, sample.b, hsv, sample.y);
    if (skin >= 0.42) {
      skinHues.push(sample.hue);
      skinSats.push(sample.hsvSat);
      skinValues.push(sample.value);
      skinLumas.push(sample.y);
      skinRedGreen.push(sample.r - sample.g);
      skinGreenBlue.push(sample.g - sample.b);
    }
    if (warmColorConfidence(hsv, sample.y) >= 0.26) {
      warmSats.push(sample.hsvSat);
      warmValues.push(sample.value);
    }
    if (redAccentConfidence(hsv, sample.y) >= 0.30) {
      redHues.push(sample.hue);
      redSats.push(sample.hsvSat);
      redValues.push(sample.value);
    }
    if (blueAccentConfidence(hsv, sample.y) >= 0.30) {
      blueHues.push(sample.hue);
      blueSats.push(sample.hsvSat);
      blueValues.push(sample.value);
    }
    if (skyBlueConfidence(hsv, sample.y) >= 0.28) {
      skySats.push(sample.hsvSat);
      skyValues.push(sample.value);
    }
    if (greenPlantConfidence(hsv, sample.y) >= 0.30) {
      greenHues.push(sample.hue);
      greenSats.push(sample.hsvSat);
      greenValues.push(sample.value);
    }
    if (shadowZoneConfidence(hsv, sample.y) >= 0.58) {
      shadowSats.push(sample.hsvSat);
      shadowValues.push(sample.value);
    }
    if (highlightZoneConfidence(hsv, sample.y) >= 0.58) highlightSats.push(sample.hsvSat);
  }

  ySorted.sort((a, b) => a - b);
  satSorted.sort((a, b) => a - b);
  const quantiles = [];
  for (let i = 0; i <= 256; i += 1) quantiles.push(quantileSorted(ySorted, i / 256));
  quantiles[0] = 0;
  quantiles[256] = 1;
  const smoothQuantiles = smooth(quantiles, 4);
  smoothQuantiles[0] = 0;
  smoothQuantiles[256] = 1;
  for (let i = 1; i < smoothQuantiles.length; i += 1) smoothQuantiles[i] = Math.max(smoothQuantiles[i - 1], smoothQuantiles[i]);

  const fallbackRgb = [median(allR, 0.5), median(allG, 0.5), median(allB, 0.5)];
  const fallbackY = Math.max(0.0001, luma(fallbackRgb[0], fallbackRgb[1], fallbackRgb[2]));
  let fallbackRatio = fallbackRgb.map((value) => value / fallbackY);
  const ratioY = Math.max(0.0001, luma(fallbackRatio[0], fallbackRatio[1], fallbackRatio[2]));
  fallbackRatio = fallbackRatio.map((value) => value / ratioY);

  const balanceRows = [];
  for (let bin = 0; bin < 17; bin += 1) {
    const lo = bin / 17;
    const hi = (bin + 1) / 17;
    const rs = [];
    const gs = [];
    const bs = [];
    for (const sample of samples) {
      if (sample.y >= lo && sample.y <= hi) {
        rs.push(sample.r);
        gs.push(sample.g);
        bs.push(sample.b);
      }
    }
    let ratio = fallbackRatio.slice();
    if (rs.length >= 40) {
      const rgb = [median(rs, fallbackRgb[0]), median(gs, fallbackRgb[1]), median(bs, fallbackRgb[2])];
      const yy = Math.max(0.0001, luma(rgb[0], rgb[1], rgb[2]));
      ratio = [rgb[0] / yy, rgb[1] / yy, rgb[2] / yy];
      const rowY = Math.max(0.0001, luma(ratio[0], ratio[1], ratio[2]));
      ratio = ratio.map((value) => clamp(value / rowY, 0.65, 1.55));
    }
    balanceRows.push(ratio);
  }

  const fallbackSat = quantileSorted(satSorted, 0.6);
  const fallbackValue = Math.max(fallbackRgb[0], fallbackRgb[1], fallbackRgb[2]);
  const hueSatRows = [];
  const hueValueRows = [];
  for (let bin = 0; bin < 12; bin += 1) {
    const sats = [];
    const vals = [];
    for (const sample of samples) {
      if (sample.hsvSat < 0.045) continue;
      if (Math.floor(sample.hue * 12) % 12 === bin) {
        sats.push(sample.hsvSat);
        vals.push(sample.value);
      }
    }
    hueSatRows.push(median(sats, fallbackSat));
    hueValueRows.push(median(vals, fallbackValue));
  }

  const p25 = quantileSorted(ySorted, 0.25);
  const p75 = quantileSorted(ySorted, 0.75);
  const p10 = quantileSorted(ySorted, 0.10);
  const p90 = quantileSorted(ySorted, 0.90);
  const stats = {
    quantiles: smoothQuantiles,
    balanceRows: smoothRows(balanceRows, 4),
    hueSatRows: smoothCircular(hueSatRows, 3),
    hueValueRows: smoothCircular(hueValueRows, 3),
    satP60: fallbackSat,
    lumaP10: p10,
    lumaMedian: quantileSorted(ySorted, 0.5),
    lumaP90: p90,
    contrast: Math.max(0.05, p75 - p25),
    tonalWidth: Math.max(0.08, p90 - p10),
    skinHue: skinHues.length >= 80 ? median(skinHues, 26 / 360) : 26 / 360,
    skinSat: skinSats.length >= 80 ? clamp(median(skinSats, 0.22), 0.06, 0.44) : 0.22,
    skinValue: skinValues.length >= 80 ? clamp(quantile(skinValues, 0.58, 0.62), 0.16, 0.94) : 0.62,
    skinLuma: skinLumas.length >= 80 ? clamp(quantile(skinLumas, 0.58, 0.46), 0.12, 0.86) : quantileSorted(ySorted, 0.55),
    skinRedGreen: skinRedGreen.length >= 80 ? clamp(median(skinRedGreen, 0.06), -0.01, 0.18) : 0.06,
    skinGreenBlue: skinGreenBlue.length >= 80 ? clamp(median(skinGreenBlue, 0.065), 0.015, 0.18) : 0.065,
    skinSampleCount: skinHues.length,
    warmSampleCount: warmSats.length,
    redHue: redHues.length >= 40 ? circularMean(redHues, 0) : 0,
    redSampleCount: redSats.length,
    blueHue: blueHues.length >= 40 ? circularMean(blueHues, 212 / 360) : 212 / 360,
    blueSampleCount: blueSats.length,
    skySampleCount: skySats.length,
    greenHue: greenHues.length >= 40 ? circularMean(greenHues, 112 / 360) : 112 / 360,
    greenSampleCount: greenSats.length,
    shadowSampleCount: shadowSats.length,
    highlightSampleCount: highlightSats.length,
    sampleCount: samples.length,
  };

  if (warmSats.length >= 80) {
    stats.warmSatP75 = clamp(quantile(warmSats, 0.75, 0.36), 0.10, 0.92);
    stats.warmSatP90 = clamp(quantile(warmSats, 0.90, 0.52), 0.16, 0.98);
    stats.warmValueP90 = clamp(quantile(warmValues, 0.90, 0.72), 0.12, 0.98);
  } else {
    stats.warmSatP75 = clamp(stats.satP60 * 1.55 + 0.12, 0.18, 0.62);
    stats.warmSatP90 = clamp(stats.satP60 * 2.10 + 0.18, 0.28, 0.78);
    stats.warmValueP90 = clamp(stats.lumaMedian + stats.contrast * 1.15 + 0.16, 0.32, 0.92);
  }

  stats.redSatP70 = redSats.length >= 40 ? clamp(quantile(redSats, 0.70, stats.warmSatP75), 0.18, 0.95) : clamp(stats.warmSatP75 * 1.08, 0.26, 0.82);
  stats.redSatP88 = redSats.length >= 40 ? clamp(quantile(redSats, 0.88, stats.warmSatP90), 0.24, 0.98) : clamp(stats.warmSatP90 * 1.02, 0.34, 0.90);
  stats.redValueP65 = redValues.length >= 40 ? clamp(quantile(redValues, 0.65, stats.warmValueP90), 0.12, 0.98) : clamp(stats.warmValueP90 * 0.92, 0.24, 0.86);
  stats.blueSatP75 = blueSats.length >= 40 ? clamp(quantile(blueSats, 0.75, fallbackSat), 0.10, 0.92) : clamp(fallbackSat * 1.20 + 0.08, 0.18, 0.72);
  stats.blueValueP70 = blueValues.length >= 40 ? clamp(quantile(blueValues, 0.70, 0.62), 0.16, 0.98) : clamp(quantileSorted(ySorted, 0.70) + 0.08, 0.34, 0.90);
  stats.skySatP70 = skySats.length >= 60 ? clamp(quantile(skySats, 0.70, 0.22), 0.04, 0.58) : 0.22;
  stats.skyValueP70 = skyValues.length >= 60 ? clamp(quantile(skyValues, 0.70, 0.78), 0.42, 0.98) : 0.78;
  stats.greenSatP75 = greenSats.length >= 40 ? clamp(quantile(greenSats, 0.75, fallbackSat), 0.12, 0.88) : clamp(fallbackSat * 1.25 + 0.06, 0.20, 0.72);
  stats.greenValueP70 = greenValues.length >= 40 ? clamp(quantile(greenValues, 0.70, 0.52), 0.12, 0.94) : clamp(quantileSorted(ySorted, 0.60) + 0.04, 0.24, 0.78);
  stats.shadowSatP70 = shadowSats.length >= 80 ? clamp(quantile(shadowSats, 0.70, fallbackSat), 0.015, 0.48) : clamp(fallbackSat * 0.70 + 0.035, 0.04, 0.32);
  stats.shadowValueP50 = shadowValues.length >= 80 ? clamp(quantile(shadowValues, 0.50, 0.20), 0.02, 0.55) : clamp(quantileSorted(ySorted, 0.18), 0.04, 0.34);
  stats.highlightSatP70 = highlightSats.length >= 80 ? clamp(quantile(highlightSats, 0.70, 0.10), 0.005, 0.38) : 0.10;
  stats.hslProfiles = {};
  for (const channel of HSL_CHANNELS) {
    const bucket = hslBuckets[channel];
    stats.hslProfiles[channel] = {
      count: bucket.hues.length,
      hue: bucket.hues.length >= 24 ? circularMean(bucket.hues, HSL_CENTERS[channel]) : HSL_CENTERS[channel],
      sat: bucket.sats.length >= 24 ? clamp(median(bucket.sats, fallbackSat), 0.015, 0.98) : clamp(fallbackSat, 0.04, 0.70),
      value: bucket.values.length >= 24 ? clamp(quantile(bucket.values, 0.58, fallbackValue), 0.02, 0.98) : clamp(fallbackValue, 0.08, 0.92),
    };
  }
  return stats;
}

function analyzeImageData(imageData) {
  return buildStats(samplesFromImageData(imageData, MAX_ANALYZE_SAMPLES));
}

function createToneMapper(refStats, targetStats, settings, params) {
  const toneCurve = [];
  const strength = settings.strength;
  const liftIntent = referenceLiftIntent(refStats, targetStats);
  const medianShift = clamp(refStats.lumaMedian - targetStats.lumaMedian, -0.18, 0.18) * params.toneWeight * (0.22 + liftIntent * 0.24);
  const contrastScale = clamp(Math.pow(refStats.tonalWidth / Math.max(0.08, targetStats.tonalWidth), 0.42), 0.78, 1.34);
  const localBoost = 0.72 + settings.localStrength * 0.28;
  const lowContrastRef = clamp((targetStats.tonalWidth - refStats.tonalWidth) / Math.max(0.12, targetStats.tonalWidth), 0, 1);
  const brightRefLift = clamp(refStats.lumaMedian - targetStats.lumaMedian, 0, 0.28);
  for (let i = 0; i <= 256; i += 1) {
    const srcY = targetStats.quantiles[i];
    const q = i / 256;
    const refY = refStats.quantiles[i];
    const midMask = Math.max(0, Math.sin(Math.PI * srcY));
    const directMatch = srcY + (refY - srcY) * params.toneWeight * localBoost;
    let filmY = 0.5 + (srcY - 0.5) * (1 + (contrastScale - 1) * params.toneWeight * 0.62);
    filmY += medianShift;
    let styleY = mix(filmY, directMatch, 0.58);
    styleY += liftIntent * midMask * (1 - smoothstep(0.82, 0.98, srcY)) * params.toneWeight * localBoost * 0.082;
    const edgeGuard = 0.62 + 0.38 * midMask;
    const toneZone = smoothstep(0.30, 0.88, srcY);
    const liftGuard = 1 - clamp(toneZone * (0.28 + lowContrastRef * 0.26 + brightRefLift * (0.64 - liftIntent * 0.28)), 0, 0.50);
    const deltaLimit = params.maxToneDelta * edgeGuard * (0.58 + 0.26 * (1 - Math.abs(q - 0.5) * 2));
    if (styleY > srcY) {
      const maxLift = deltaLimit * liftGuard * (0.72 - 0.26 * smoothstep(0.52, 0.92, srcY));
      styleY = Math.min(styleY, srcY + maxLift);
    }
    const protectedY = clamp(styleY, srcY - deltaLimit * 0.88, srcY + deltaLimit);
    toneCurve.push(clamp01(srcY + (protectedY - srcY) * strength));
  }
  toneCurve[0] = 0;
  toneCurve[256] = 1;
  for (let i = 1; i < toneCurve.length; i += 1) toneCurve[i] = Math.max(toneCurve[i - 1], toneCurve[i]);
  return toneCurve;
}

function buildLocalMap(imageData, gridSize = 28) {
  const { width, height, data } = imageData;
  const gridW = Math.min(gridSize, width);
  const gridH = Math.min(gridSize, height);
  const values = new Float32Array(gridW * gridH);
  const counts = new Uint32Array(gridW * gridH);
  for (let y = 0; y < height; y += 1) {
    const gy = Math.min(gridH - 1, Math.floor((y * gridH) / height));
    for (let x = 0; x < width; x += 1) {
      const gx = Math.min(gridW - 1, Math.floor((x * gridW) / width));
      const idx = gy * gridW + gx;
      const p = (y * width + x) * 4;
      values[idx] += luma(srgbByteToLinear(data[p]), srgbByteToLinear(data[p + 1]), srgbByteToLinear(data[p + 2]));
      counts[idx] += 1;
    }
  }
  for (let i = 0; i < values.length; i += 1) values[i] = counts[i] ? values[i] / counts[i] : 0.5;
  for (let pass = 0; pass < 4; pass += 1) {
    const next = new Float32Array(values);
    for (let gy = 0; gy < gridH; gy += 1) {
      for (let gx = 0; gx < gridW; gx += 1) {
        let sum = 0;
        let count = 0;
        for (let oy = -1; oy <= 1; oy += 1) {
          for (let ox = -1; ox <= 1; ox += 1) {
            const x2 = clamp(gx + ox, 0, gridW - 1);
            const y2 = clamp(gy + oy, 0, gridH - 1);
            sum += values[y2 * gridW + x2];
            count += 1;
          }
        }
        next[gy * gridW + gx] = sum / count;
      }
    }
    values.set(next);
  }
  return { values, gridW, gridH, width, height };
}

function sampleLocalMap(map, x, y) {
  if (!map || !map.values.length) return 0.5;
  const fx = clamp((x / Math.max(1, map.width - 1)) * (map.gridW - 1), 0, map.gridW - 1);
  const fy = clamp((y / Math.max(1, map.height - 1)) * (map.gridH - 1), 0, map.gridH - 1);
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const x1 = Math.min(map.gridW - 1, x0 + 1);
  const y1 = Math.min(map.gridH - 1, y0 + 1);
  const tx = fx - x0;
  const ty = fy - y0;
  const a = map.values[y0 * map.gridW + x0];
  const b = map.values[y0 * map.gridW + x1];
  const c = map.values[y1 * map.gridW + x0];
  const d = map.values[y1 * map.gridW + x1];
  return mix(mix(a, b, tx), mix(c, d, tx), ty);
}

function matchPixel(r, g, b, a, refStats, targetStats, toneCurve, settings, params, localY, localWeight) {
  const y = luma(r, g, b);
  const hsv = rgbToHsv(r, g, b);
  const mappedY = interpCurve(targetStats.quantiles, toneCurve, y);
  const strength = settings.strength;
  const skinConfidence = settings.skinProtect ? softSkinConfidence(r, g, b, hsv, y) : 0;
  const skinProtect = settings.skinProtect && isLikelySkin(r, g, b, hsv, y) ? 0.45 : 1;
  const redConfidence = redAccentConfidence(hsv, y) * (1 - skinConfidence * 0.88);
  const highlightMask = clamp((y - 0.58) / 0.42, 0, 1);
  const shadowMask = clamp((0.36 - y) / 0.36, 0, 1);
  let desiredY = mappedY;

  if (localWeight > 0) {
    const localDelta = y - localY;
    const contrastRatio = clamp(Math.pow(refStats.contrast / Math.max(0.05, targetStats.contrast), 0.35), 0.78, 1.28);
    desiredY = clamp01(mappedY + localDelta * (contrastRatio - 1) * localWeight * 0.28);
  }

  if (desiredY > y && redConfidence > 0.001) {
    const sourceBright = smoothstep(0.42, 0.88, y);
    const allowedLift = 0.004 + 0.014 * (1 - sourceBright);
    desiredY = y + Math.min(desiredY - y, allowedLift);
  }

  let [tr, tg, tb] = fitRgbToLuma(r, g, b, desiredY);
  const tonedY = desiredY;

  const satIntent = referenceSaturationIntent(refStats, targetStats);
  const globalSatFactor = clamp(Math.pow(Math.max(0.02, refStats.satP60) / Math.max(0.02, targetStats.satP60), 0.24), 0.84, 1.12 + satIntent * 0.06);
  const refHueSat = Math.max(0.02, interpCircular(refStats.hueSatRows, hsv.h));
  const targetHueSat = Math.max(0.02, interpCircular(targetStats.hueSatRows, hsv.h));
  const hueSatFactor = clamp(Math.pow(refHueSat / targetHueSat, 0.18), 0.90, 1.10 + satIntent * 0.05);
  const materialGuard = 1 - clamp(redConfidence * 0.68 + skinConfidence * 0.46 + highlightMask * 0.22, 0, 0.76);
  const satTarget = globalSatFactor * (1 + (hueSatFactor - 1) * params.hueWeight);
  let satFactor = 1 + (satTarget - 1) * strength * params.satWeight * skinProtect * materialGuard;
  if (highlightMask > 0.001) satFactor *= 1 - highlightMask * strength * 0.045;
  [tr, tg, tb] = scaleChroma(tr, tg, tb, tonedY, satFactor);

  const srcRatio = interpRow(targetStats.balanceRows, y);
  const refRatio = interpRow(refStats.balanceRows, y);
  const zoneWeight = 1 - clamp(highlightMask * 0.34 + shadowMask * 0.14 + redConfidence * 0.42 + skinConfidence * 0.48, 0, 0.82);
  const effectiveColorWeight = params.colorWeight * strength * skinProtect * zoneWeight;
  const correction = [
    clamp(refRatio[0] / Math.max(0.0001, srcRatio[0]), 1 / params.maxColorRatio, params.maxColorRatio),
    clamp(refRatio[1] / Math.max(0.0001, srcRatio[1]), 1 / params.maxColorRatio, params.maxColorRatio),
    clamp(refRatio[2] / Math.max(0.0001, srcRatio[2]), 1 / params.maxColorRatio, params.maxColorRatio),
  ];
  tr *= 1 + (correction[0] - 1) * effectiveColorWeight;
  tg *= 1 + (correction[1] - 1) * effectiveColorWeight;
  tb *= 1 + (correction[2] - 1) * effectiveColorWeight;
  [tr, tg, tb] = fitRgbToLuma(tr, tg, tb, tonedY);

  if (redConfidence > 0.001) {
    const outHsv = rgbToHsv(tr, tg, tb);
    const redSatCeiling = clamp(Math.min(refStats.redSatP70 + 0.035, hsv.s + 0.055), 0.30, 0.72);
    const redSatFloor = clamp(hsv.s * 0.84, 0.12, 0.66);
    const redTargetSat = clamp(refStats.redSatP70, redSatFloor, redSatCeiling);
    const controlledSat = mix(outHsv.s, redTargetSat, redConfidence * strength * 0.58);
    const redValueTarget = clamp(refStats.redValueP65, hsv.v - 0.045, hsv.v + 0.025);
    const controlledValue = mix(outHsv.v, redValueTarget, redConfidence * strength * 0.28);
    [tr, tg, tb] = hsvToRgb(mix(outHsv.h, refStats.redHue, redConfidence * strength * 0.08), controlledSat, controlledValue);
    const maxRedY = y + (0.004 + 0.010 * (1 - smoothstep(0.36, 0.82, y)));
    [tr, tg, tb] = fitRgbToLuma(tr, tg, tb, Math.min(tonedY, maxRedY));
  }

  if (skinConfidence > 0.001) {
    const skinBlend = skinConfidence * strength * 0.16;
    tr = mix(tr, r, skinBlend);
    tg = mix(tg, g, skinBlend);
    tb = mix(tb, b, skinBlend);
    [tr, tg, tb] = fitRgbToLuma(tr, tg, tb, tonedY);
  }

  return [clamp01(tr), clamp01(tg), clamp01(tb), a];
}

function hueDistance(a, b) {
  const d = Math.abs(a - b);
  return Math.min(d, 1 - d);
}

function circularDelta(fromHue, toHue) {
  let delta = toHue - fromHue;
  if (delta > 0.5) delta -= 1;
  if (delta < -0.5) delta += 1;
  return delta;
}

function hslChannelWeight(channel, hue, sat) {
  const center = HSL_CENTERS[channel];
  const distance = hueDistance(hue, center);
  const width = channel === "red" ? 28 / 360 : 34 / 360;
  const mask = 1 - smoothstep(width * 0.55, width, distance);
  return clamp(mask * smoothstep(0.025, 0.18, sat), 0, 1);
}

function hslProfileConfidence(refProfile, targetProfile) {
  const refWeight = smoothstep(10, 90, refProfile?.count || 0);
  const targetWeight = smoothstep(10, 90, targetProfile?.count || 0);
  return clamp(0.25 + 0.75 * refWeight * targetWeight, 0, 1);
}

function protectMaterialTone(srcY, targetY, hsv, greenConfidence, skinConfidence, strength, liftIntent = 0) {
  if (targetY <= srcY) return targetY;
  const saturatedMask = smoothstep(0.10, 0.36, hsv.s) * (1 - smoothstep(0.88, 0.99, srcY));
  const plantMask = greenConfidence * (0.70 + 0.30 * saturatedMask);
  const protect = clamp((plantMask * 0.88 + saturatedMask * 0.24) * (0.72 + strength * 0.28) * (1 - skinConfidence * 0.24) * (1 - liftIntent * 0.36), 0, 0.88);
  const maxLift = 0.032 + 0.070 * (1 - smoothstep(0.22, 0.94, srcY)) + liftIntent * (0.032 + greenConfidence * 0.062) * (1 - smoothstep(0.78, 0.98, srcY));
  const guarded = srcY + Math.min(targetY - srcY, maxLift);
  return mix(targetY, guarded, protect);
}

function transformLutColor(r, g, b, refStats, targetStats, toneCurve, settings, params) {
  const srcY = luma(r, g, b);
  const srcHsv = rgbToHsv(r, g, b);
  const strength = settings.strength;
  const liftIntent = referenceLiftIntent(refStats, targetStats);
  const satIntent = referenceSaturationIntent(refStats, targetStats);
  const highlightMask = smoothstep(0.74, 0.98, srcY);
  const shadowMask = 1 - smoothstep(0.05, 0.34, srcY);
  const colorMask = smoothstep(0.025, 0.16, srcHsv.s);
  const skinConfidence = settings.skinProtect ? softSkinConfidence(r, g, b, srcHsv, srcY) : 0;
  const redConfidence = redAccentConfidence(srcHsv, srcY) * (1 - skinConfidence * 0.72);
  const greenHueConfidence = Math.max(
    greenPlantConfidence(srcHsv, srcY),
    hslChannelWeight("green", srcHsv.h, srcHsv.s) * 0.88,
    hslChannelWeight("aqua", srcHsv.h, srcHsv.s) * 0.62
  );
  const greenConfidence = greenHueConfidence * (1 - skinConfidence * 0.86) * (1 - redConfidence * 0.55);
  const toneY = protectMaterialTone(srcY, interpCurve(targetStats.quantiles, toneCurve, srcY), srcHsv, greenConfidence, skinConfidence, strength, liftIntent);

  let [tr, tg, tb] = fitRgbToLuma(r, g, b, toneY);
  const sourceRatio = interpRow(targetStats.balanceRows, srcY);
  const referenceRatio = interpRow(refStats.balanceRows, toneY);
  const materialBalanceGuard = 1 - clamp(greenConfidence * 0.30 + smoothstep(0.16, 0.48, srcHsv.s) * highlightMask * 0.14, 0, 0.42);
  const balanceStrength = params.colorWeight * strength * (0.68 + settings.localStrength * 0.24) * (1 - skinConfidence * 0.20) * (1 - highlightMask * 0.18) * materialBalanceGuard;
  const correction = [
    clamp(referenceRatio[0] / Math.max(0.0001, sourceRatio[0]), 1 / params.maxColorRatio, params.maxColorRatio),
    clamp(referenceRatio[1] / Math.max(0.0001, sourceRatio[1]), 1 / params.maxColorRatio, params.maxColorRatio),
    clamp(referenceRatio[2] / Math.max(0.0001, sourceRatio[2]), 1 / params.maxColorRatio, params.maxColorRatio),
  ];
  tr *= 1 + (correction[0] - 1) * balanceStrength;
  tg *= 1 + (correction[1] - 1) * balanceStrength;
  tb *= 1 + (correction[2] - 1) * balanceStrength;
  [tr, tg, tb] = fitRgbToLuma(tr, tg, tb, toneY);

  let hueDelta = 0;
  let satLog = 0;
  let valueShift = 0;
  let totalWeight = 0;
  for (const channel of HSL_CHANNELS) {
    const weight = hslChannelWeight(channel, srcHsv.h, srcHsv.s);
    if (weight <= 0.0001) continue;
    const refProfile = refStats.hslProfiles?.[channel];
    const targetProfile = targetStats.hslProfiles?.[channel];
    if (!refProfile || !targetProfile) continue;
    const confidence = hslProfileConfidence(refProfile, targetProfile);
    const w = weight * confidence * colorMask;
    if (w <= 0.0001) continue;
    const hueMove = clamp(circularDelta(targetProfile.hue, refProfile.hue), -38 / 360, 38 / 360);
    const isGreenChannel = channel === "green" || channel === "aqua";
    const satRatio = clamp(refProfile.sat / Math.max(0.015, targetProfile.sat), isGreenChannel ? 0.88 : 0.48, isGreenChannel ? 1.62 : 1.95);
    const valDelta = clamp(refProfile.value - targetProfile.value, isGreenChannel ? -0.16 : -0.22, isGreenChannel ? 0.10 : 0.22);
    hueDelta += hueMove * w;
    satLog += Math.log(satRatio) * w;
    valueShift += valDelta * w;
    totalWeight += w;
  }

  if (skinConfidence > 0.001 && refStats.skinSampleCount >= 80 && targetStats.skinSampleCount >= 80) {
    const w = skinConfidence * (settings.skinProtect ? 0.62 : 0.78);
    hueDelta += clamp(circularDelta(targetStats.skinHue, refStats.skinHue), -20 / 360, 20 / 360) * w;
    satLog += Math.log(clamp(refStats.skinSat / Math.max(0.04, targetStats.skinSat), 0.64, 1.42)) * w;
    valueShift += clamp(refStats.skinLuma - targetStats.skinLuma, -0.10, 0.10) * w * 0.54;
    totalWeight += w;
  }

  const chromaStrength = strength * (0.82 + settings.localStrength * 0.30 + satIntent * 0.06) * (1 - highlightMask * 0.16) * (1 - shadowMask * 0.06);
  let outHsv = rgbToHsv(tr, tg, tb);
  if (totalWeight > 0.0001) {
    const avgHueDelta = hueDelta / totalWeight;
    const avgSatLog = satLog / totalWeight;
    const avgValueShift = valueShift / totalWeight;
    outHsv.h += avgHueDelta * params.hueWeight * chromaStrength;
    outHsv.s = clamp01(outHsv.s * Math.exp(avgSatLog * params.satWeight * chromaStrength));
    outHsv.v = clamp01(outHsv.v + avgValueShift * params.toneWeight * chromaStrength * 0.62);
  }

  if (satIntent > 0.001 && colorMask > 0.001 && skinConfidence < 0.82) {
    const minStyledSat = srcHsv.s * (1 + satIntent * 0.08);
    if (outHsv.s < minStyledSat) {
      outHsv.s = mix(outHsv.s, minStyledSat, colorMask * strength * satIntent * 0.24);
    }
  }

  if (skinConfidence > 0.001 && refStats.skinSampleCount >= 80 && targetStats.skinSampleCount >= 80) {
    const skinW = skinConfidence * strength * (settings.skinProtect ? 0.58 : 0.72) * (1 - highlightMask * 0.18);
    const skinSatTarget = clamp(refStats.skinSat, srcHsv.s * 0.62, srcHsv.s * 1.26);
    const skinValueTarget = clamp(refStats.skinValue, srcHsv.v - 0.10, srcHsv.v + 0.10);
    outHsv.h += clamp(circularDelta(outHsv.h, refStats.skinHue), -18 / 360, 18 / 360) * skinW * 0.46;
    outHsv.s = mix(outHsv.s, skinSatTarget, skinW * 0.48);
    outHsv.v = mix(outHsv.v, skinValueTarget, skinW * 0.26);
  }

  if (greenConfidence > 0.001 && refStats.greenSampleCount >= 40) {
    const greenW = greenConfidence * strength * (0.74 + settings.localStrength * 0.22) * (1 - highlightMask * 0.18);
    const greenSatFloor = srcHsv.s * (toneY > srcY ? 0.86 : 0.76);
    const greenSatTarget = clamp(refStats.greenSatP75 * 1.02, greenSatFloor, srcHsv.s * 1.42);
    const greenValueTarget = clamp(refStats.greenValueP70, srcHsv.v - 0.12, srcHsv.v + 0.065);
    outHsv.h += circularDelta(outHsv.h, refStats.greenHue) * greenW * 0.34;
    outHsv.s = mix(outHsv.s, greenSatTarget, greenW * 0.68);
    outHsv.v = mix(outHsv.v, greenValueTarget, greenW * 0.30);
  }

  if (greenConfidence > 0.001) {
    const minGreenSat = srcHsv.s * (toneY > srcY ? 0.84 : 0.76);
    if (outHsv.s < minGreenSat) {
      outHsv.s = mix(outHsv.s, minGreenSat, greenConfidence * strength * 0.82);
    }
  }

  if (redConfidence > 0.001 && refStats.redSampleCount >= 40) {
    const redW = redConfidence * strength * (0.70 + settings.localStrength * 0.18);
    const redSatTarget = clamp(refStats.redSatP70, srcHsv.s * 0.68, srcHsv.s * 1.42);
    const redValueTarget = clamp(refStats.redValueP65, srcHsv.v - 0.10, srcHsv.v + 0.10);
    outHsv.h += circularDelta(outHsv.h, refStats.redHue) * redW * 0.26;
    outHsv.s = mix(outHsv.s, redSatTarget, redW * 0.72);
    outHsv.v = mix(outHsv.v, redValueTarget, redW * 0.48);
  }

  [tr, tg, tb] = hsvToRgb(outHsv.h, outHsv.s, outHsv.v);
  [tr, tg, tb] = refineSkinTone(tr, tg, tb, skinConfidence, refStats, targetStats, strength, highlightMask);
  let finalY = clamp01(toneY + (totalWeight > 0.0001 ? (valueShift / totalWeight) * params.toneWeight * strength * 0.22 : 0));
  finalY = protectMaterialTone(srcY, finalY, srcHsv, greenConfidence, skinConfidence, strength, liftIntent);
  if (greenConfidence > 0.001 && finalY > srcY) {
    finalY = Math.min(finalY, srcY + 0.045 + 0.030 * (1 - srcY) + liftIntent * 0.074);
  }
  [tr, tg, tb] = fitRgbToLuma(tr, tg, tb, finalY);

  if (srcY < 0.015 || srcY > 0.985 || srcHsv.s < 0.012) {
    const neutralBlend = srcY < 0.015 || srcY > 0.985 ? 0.55 : 0.32;
    const neutral = fitRgbToLuma(r, g, b, toneY);
    tr = mix(tr, neutral[0], neutralBlend);
    tg = mix(tg, neutral[1], neutralBlend);
    tb = mix(tb, neutral[2], neutralBlend);
  }

  return [clamp01(tr), clamp01(tg), clamp01(tb)];
}

function createStyleLut(refStats, targetStats, settings, params, toneCurve) {
  const size = LUT_GRID_SIZE;
  const data = new Float32Array(size * size * size * 3);
  for (let bz = 0; bz < size; bz += 1) {
    const b = bz / (size - 1);
    for (let gy = 0; gy < size; gy += 1) {
      const g = gy / (size - 1);
      for (let rx = 0; rx < size; rx += 1) {
        const r = rx / (size - 1);
        const mapped = transformLutColor(r, g, b, refStats, targetStats, toneCurve, settings, params);
        const index = ((bz * size + gy) * size + rx) * 3;
        data[index] = mapped[0];
        data[index + 1] = mapped[1];
        data[index + 2] = mapped[2];
      }
    }
  }
  return { size, data };
}

function sampleStyleLut(lut, r, g, b) {
  const size = lut.size;
  const max = size - 1;
  const fr = clamp01(r) * max;
  const fg = clamp01(g) * max;
  const fb = clamp01(b) * max;
  const r0 = Math.floor(fr);
  const g0 = Math.floor(fg);
  const b0 = Math.floor(fb);
  const r1 = Math.min(max, r0 + 1);
  const g1 = Math.min(max, g0 + 1);
  const b1 = Math.min(max, b0 + 1);
  const tr = fr - r0;
  const tg = fg - g0;
  const tb = fb - b0;

  const read = (ri, gi, bi, ch) => lut.data[((bi * size + gi) * size + ri) * 3 + ch];
  const out = [0, 0, 0];
  for (let ch = 0; ch < 3; ch += 1) {
    const c000 = read(r0, g0, b0, ch);
    const c100 = read(r1, g0, b0, ch);
    const c010 = read(r0, g1, b0, ch);
    const c110 = read(r1, g1, b0, ch);
    const c001 = read(r0, g0, b1, ch);
    const c101 = read(r1, g0, b1, ch);
    const c011 = read(r0, g1, b1, ch);
    const c111 = read(r1, g1, b1, ch);
    const c00 = mix(c000, c100, tr);
    const c10 = mix(c010, c110, tr);
    const c01 = mix(c001, c101, tr);
    const c11 = mix(c011, c111, tr);
    out[ch] = mix(mix(c00, c10, tg), mix(c01, c11, tg), tb);
  }
  return out;
}

function parseCubeLut(text, name = "LUT") {
  const lines = text.split(/\r?\n/);
  let size = 0;
  let title = "";
  let domainMin = [0, 0, 0];
  let domainMax = [1, 1, 1];
  const values = [];

  for (const rawLine of lines) {
    const line = rawLine.replace(/#.*/, "").trim();
    if (!line) continue;
    const parts = line.split(/\s+/);
    const keyword = parts[0].toUpperCase();
    if (keyword === "TITLE") {
      title = line.slice(parts[0].length).trim().replace(/^"|"$/g, "");
      continue;
    }
    if (keyword === "LUT_3D_SIZE") {
      size = Number(parts[1]);
      values.length = 0;
      continue;
    }
    if (keyword === "DOMAIN_MIN" && parts.length >= 4) {
      domainMin = parts.slice(1, 4).map(Number);
      continue;
    }
    if (keyword === "DOMAIN_MAX" && parts.length >= 4) {
      domainMax = parts.slice(1, 4).map(Number);
      continue;
    }
    if (keyword.startsWith("LUT_1D") || keyword === "DOMAIN_MIN" || keyword === "DOMAIN_MAX") continue;
    if (parts.length < 3) continue;
    if (!size) continue;
    const rgb = parts.slice(0, 3).map(Number);
    if (rgb.every(Number.isFinite)) values.push(rgb.map(clamp01));
  }

  if (!Number.isInteger(size) || size < 2 || size > 65) {
    throw new Error("只支持标准 .cube 3D LUT，请检查文件里的 LUT_3D_SIZE。");
  }
  const expected = size * size * size;
  if (values.length < expected) {
    throw new Error(`LUT 数据不完整：需要 ${expected} 行颜色数据，当前只有 ${values.length} 行。`);
  }

  const data = new Float32Array(expected * 3);
  for (let i = 0; i < expected; i += 1) {
    data[i * 3] = values[i][0];
    data[i * 3 + 1] = values[i][1];
    data[i * 3 + 2] = values[i][2];
  }
  return { name: title || name, size, data, domainMin, domainMax };
}

function sampleCubeLut(lut, r, g, b) {
  const size = lut.size;
  const max = size - 1;
  const normalize = (value, ch) => {
    const min = lut.domainMin?.[ch] ?? 0;
    const maxValue = lut.domainMax?.[ch] ?? 1;
    return clamp((value - min) / Math.max(0.000001, maxValue - min), 0, 1);
  };
  const fr = normalize(r, 0) * max;
  const fg = normalize(g, 1) * max;
  const fb = normalize(b, 2) * max;
  const r0 = Math.floor(fr);
  const g0 = Math.floor(fg);
  const b0 = Math.floor(fb);
  const r1 = Math.min(max, r0 + 1);
  const g1 = Math.min(max, g0 + 1);
  const b1 = Math.min(max, b0 + 1);
  const tr = fr - r0;
  const tg = fg - g0;
  const tb = fb - b0;

  const read = (ri, gi, bi, ch) => lut.data[((bi * size + gi) * size + ri) * 3 + ch];
  const out = [0, 0, 0];
  for (let ch = 0; ch < 3; ch += 1) {
    const c000 = read(r0, g0, b0, ch);
    const c100 = read(r1, g0, b0, ch);
    const c010 = read(r0, g1, b0, ch);
    const c110 = read(r1, g1, b0, ch);
    const c001 = read(r0, g0, b1, ch);
    const c101 = read(r1, g0, b1, ch);
    const c011 = read(r0, g1, b1, ch);
    const c111 = read(r1, g1, b1, ch);
    const c00 = mix(c000, c100, tr);
    const c10 = mix(c010, c110, tr);
    const c01 = mix(c001, c101, tr);
    const c11 = mix(c011, c111, tr);
    out[ch] = mix(mix(c00, c10, tg), mix(c01, c11, tg), tb);
  }
  return out;
}

function applyUserLutsToSrgb(r, g, b, settings) {
  const amounts = settings.userLutAmounts || [100, 100];
  const activeLuts = settings.resolvedUserLuts || state.userLuts;
  let sr = clamp01(r);
  let sg = clamp01(g);
  let sb = clamp01(b);
  for (let layer = 0; layer < activeLuts.length; layer += 1) {
    const lut = activeLuts[layer]?.lut;
    const amount = clamp((amounts[layer] ?? 100) / 100, 0, 1);
    if (!lut || amount <= 0) continue;
    const mapped = sampleCubeLut(lut, sr, sg, sb);
    sr = mix(sr, mapped[0], amount);
    sg = mix(sg, mapped[1], amount);
    sb = mix(sb, mapped[2], amount);
  }
  return [clamp01(sr), clamp01(sg), clamp01(sb)];
}

function blankUserLut() {
  return { id: "", name: "", lut: null };
}

function normalizeUserLutIds(ids) {
  const values = Array.isArray(ids) ? ids : [];
  return [0, 1].map((index) => String(values[index] || ""));
}

function resolveUserLutById(id) {
  const entry = state.lutLibrary.find((item) => item.id === id);
  if (!entry) return blankUserLut();
  if (!entry.parsed) entry.parsed = parseCubeLut(entry.text, entry.name);
  return { id: entry.id, name: entry.name, lut: entry.parsed };
}

function resolveUserLutsForIds(ids) {
  return normalizeUserLutIds(ids).map((id) => (id ? resolveUserLutById(id) : blankUserLut()));
}

function setActiveUserLutsFromIds(ids) {
  state.userLuts = resolveUserLutsForIds(ids);
  renderLutLibrary();
}

function settingsWithResolvedUserLuts(settings) {
  const ids = Array.isArray(settings?.userLutIds) ? settings.userLutIds : state.userLuts.map((item) => item.id || "");
  return {
    ...settings,
    userLutIds: normalizeUserLutIds(ids),
    resolvedUserLuts: resolveUserLutsForIds(ids),
  };
}

function openLutDb() {
  if (!window.indexedDB) return Promise.reject(new Error("当前浏览器不支持本地 LUT 库。"));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(LUT_DB_NAME, LUT_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(LUT_STORE_NAME)) {
        const store = db.createObjectStore(LUT_STORE_NAME, { keyPath: "id" });
        store.createIndex("createdAt", "createdAt");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("无法打开本地 LUT 库。"));
  });
}

function runLutStore(mode, callback) {
  return openLutDb().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(LUT_STORE_NAME, mode);
    const store = tx.objectStore(LUT_STORE_NAME);
    const result = callback(store);
    tx.oncomplete = () => {
      db.close();
      resolve(result);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error || new Error("LUT 库操作失败。"));
    };
  }));
}

function getAllStoredLuts() {
  return openLutDb().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(LUT_STORE_NAME, "readonly");
    const request = tx.objectStore(LUT_STORE_NAME).getAll();
    request.onsuccess = () => {
      db.close();
      resolve(request.result || []);
    };
    request.onerror = () => {
      db.close();
      reject(request.error || new Error("无法读取本地 LUT 库。"));
    };
  }));
}

function renderLutLibrary() {
  const sorted = state.lutLibrary.slice().sort((a, b) => b.createdAt - a.createdAt);
  if (dom.lutLibraryCount) dom.lutLibraryCount.textContent = `${sorted.length}/${USER_LUT_LIMIT}`;
  for (let layer = 0; layer < dom.lutSelects.length; layer += 1) {
    const select = dom.lutSelects[layer];
    if (!select) continue;
    const activeId = state.userLuts[layer]?.id || "";
    select.innerHTML = '<option value="">不使用 LUT</option>';
    for (const entry of sorted) {
      const option = document.createElement("option");
      option.value = entry.id;
      option.textContent = entry.name;
      select.appendChild(option);
    }
    select.value = sorted.some((entry) => entry.id === activeId) ? activeId : "";
  }
  updateLutLabels();
}

async function loadLutLibrary() {
  try {
    const entries = await getAllStoredLuts();
    state.lutLibrary = entries.sort((a, b) => b.createdAt - a.createdAt);
    renderLutLibrary();
  } catch (error) {
    console.error(error);
    setStatus(`LUT 库读取失败：${error.message}`, 0);
  }
}

async function selectUserLut(layer, id, options = {}) {
  state.userLuts[layer] = id ? resolveUserLutById(id) : blankUserLut();
  renderLutLibrary();
  saveCurrentParams();
  if (options.refresh !== false) scheduleSmartPreviewUpdate();
}

async function saveLutEntry(file, text, parsed) {
  if (state.lutLibrary.length >= USER_LUT_LIMIT) {
    throw new Error(`LUT 库最多保存 ${USER_LUT_LIMIT} 个，请先删除不需要的 LUT。`);
  }
  const now = Date.now();
  const stored = {
    id: `${now}-${Math.random().toString(36).slice(2, 9)}`,
    name: file.name,
    title: parsed.name || file.name,
    size: parsed.size,
    text,
    createdAt: now,
  };
  await runLutStore("readwrite", (store) => store.put(stored));
  const entry = { ...stored, parsed };
  state.lutLibrary.unshift(entry);
  renderLutLibrary();
  return entry;
}

function removeUserLutIdFromParams(params, id) {
  if (!params) return;
  params.userLutIds = normalizeUserLutIds(params.userLutIds).map((lutId) => (lutId === id ? "" : lutId));
}

function removeUserLutIdEverywhere(id) {
  for (const params of state.targetParams) removeUserLutIdFromParams(params, id);
  if (state.copiedParams) removeUserLutIdFromParams(state.copiedParams, id);
  for (const output of state.outputs) {
    if (!output) continue;
    removeUserLutIdFromParams(output.params, id);
    invalidateHighQualityDisplay(output);
  }
}

async function deleteLutEntry(id) {
  if (!id) return;
  await runLutStore("readwrite", (store) => store.delete(id));
  state.lutLibrary = state.lutLibrary.filter((entry) => entry.id !== id);
  for (let layer = 0; layer < state.userLuts.length; layer += 1) {
    if (state.userLuts[layer].id === id) {
      state.userLuts[layer] = blankUserLut();
    }
  }
  removeUserLutIdEverywhere(id);
  renderLutLibrary();
  saveCurrentParams();
  scheduleSmartPreviewUpdate();
}

function applyHslAdjustments(r, g, b, hslAdjustments) {
  if (!hslAdjustments) return [r, g, b];
  const hsv = rgbToHsv(r, g, b);
  let hueShift = 0;
  let satScale = 1;
  let lumaShift = 0;
  for (const channel of HSL_CHANNELS) {
    const adjust = hslAdjustments[channel];
    if (!adjust) continue;
    const weight = hslChannelWeight(channel, hsv.h, hsv.s);
    if (weight <= 0.0001) continue;
    hueShift += (adjust.h / 100) * (30 / 360) * weight;
    satScale += (adjust.s / 100) * 0.62 * weight;
    lumaShift += (adjust.l / 100) * 0.18 * weight;
  }
  if (Math.abs(hueShift) < 0.0001 && Math.abs(satScale - 1) < 0.0001 && Math.abs(lumaShift) < 0.0001) {
    return [r, g, b];
  }
  const next = hsvToRgb(hsv.h + hueShift, clamp01(hsv.s * satScale), hsv.v);
  const targetY = clamp01(luma(next[0], next[1], next[2]) + lumaShift);
  return fitRgbToLuma(next[0], next[1], next[2], targetY);
}

function applyManualAdjustments(r, g, b, settings) {
  const adjustments = settings.adjustments || {};
  let tr = r;
  let tg = g;
  let tb = b;
  let y = luma(tr, tg, tb);

  const exposure = adjustments.exposure || 0;
  if (Math.abs(exposure) > 0.0001) {
    const factor = Math.pow(2, exposure);
    tr = clamp01(tr * factor);
    tg = clamp01(tg * factor);
    tb = clamp01(tb * factor);
    y = luma(tr, tg, tb);
  }

  const contrast = (adjustments.contrast || 0) / 100;
  if (Math.abs(contrast) > 0.0001) {
    const scale = 1 + contrast * 0.72;
    const nextY = clamp01(0.5 + (y - 0.5) * scale);
    [tr, tg, tb] = fitRgbToLuma(tr, tg, tb, nextY);
    y = nextY;
  }

  let yShift = 0;
  yShift += ((adjustments.highlights || 0) / 100) * 0.16 * smoothstep(0.50, 0.92, y);
  yShift += ((adjustments.shadows || 0) / 100) * 0.16 * (1 - smoothstep(0.12, 0.52, y));
  yShift += ((adjustments.whites || 0) / 100) * 0.12 * smoothstep(0.72, 0.98, y);
  yShift += ((adjustments.blacks || 0) / 100) * 0.12 * (1 - smoothstep(0.04, 0.30, y));
  if (Math.abs(yShift) > 0.0001) {
    y = clamp01(y + yShift);
    [tr, tg, tb] = fitRgbToLuma(tr, tg, tb, y);
  }

  const temp = (adjustments.temperature || 0) / 100;
  const tint = (adjustments.tint || 0) / 100;
  if (Math.abs(temp) > 0.0001 || Math.abs(tint) > 0.0001) {
    const targetY = luma(tr, tg, tb);
    tr = clamp01(tr * (1 + temp * 0.07 + tint * 0.025));
    tg = clamp01(tg * (1 - tint * 0.055));
    tb = clamp01(tb * (1 - temp * 0.08 + tint * 0.025));
    [tr, tg, tb] = fitRgbToLuma(tr, tg, tb, targetY);
  }

  let hsv = rgbToHsv(tr, tg, tb);
  const skin = settings.skinProtect ? softSkinConfidence(tr, tg, tb, hsv, luma(tr, tg, tb)) : 0;
  const vibrance = (adjustments.vibrance || 0) / 100;
  const saturation = (adjustments.saturation || 0) / 100;
  if (Math.abs(vibrance) > 0.0001 || Math.abs(saturation) > 0.0001) {
    const satBoost = saturation * 0.80 + vibrance * 0.72 * (1 - hsv.s) * (1 - skin * 0.55);
    hsv.s = clamp01(hsv.s * (1 + satBoost));
    [tr, tg, tb] = hsvToRgb(hsv.h, hsv.s, hsv.v);
  }

  [tr, tg, tb] = applyHslAdjustments(tr, tg, tb, settings.hsl);
  return [clamp01(tr), clamp01(tg), clamp01(tb)];
}

async function loadImageToImageData(file, maxEdge) {
  if (!canBrowserDecode(file)) {
    const ext = fileExtension(file).toUpperCase() || "RAW";
    throw new Error(`${file.name} 是 ${ext} 文件，网页无法直接读取 RAW。请先转成 JPG/PNG/WebP，或接入本地 RAW 解码服务。`);
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`无法读取图片：${file.name}`));
      image.src = url;
    });
    const scale = maxEdge > 0 ? Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight)) : 1;
    const width = Math.max(1, Math.round(img.naturalWidth * scale));
    const height = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = getSrgb2dContext(canvas, { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, width, height);
    return { canvas, imageData: ctx.getImageData(0, 0, width, height), width, height, name: file.name };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

function setStatus(text, progress = null) {
  dom.statusLine.textContent = text;
  if (progress !== null) dom.progressBar.style.width = `${clamp(progress, 0, 100)}%`;
}

function updateRestoreButton() {
  if (!dom.restoreBtn) return;
  const file = state.targets[state.activeTargetIndex];
  dom.restoreBtn.disabled = Boolean(state.busy || state.liveBusy || !file || !canBrowserDecode(file));
}

function setBusy(busy) {
  state.busy = busy;
  dom.processBtn.disabled = busy;
  dom.pickRefsBtn.disabled = busy;
  dom.pickTargetsBtn.disabled = busy;
  dom.pickFolderBtn.disabled = busy;
  updateRestoreButton();
}

function updateAdjustmentLabels() {
  for (const input of document.querySelectorAll(".adjust-slider")) {
    const param = input.dataset.param;
    const valueEl = document.querySelector(`[data-value-for="${param}"]`);
    input.style.setProperty("--track-gradient", adjustmentGradient(param));
    input.style.setProperty("--range-percent", `${rangePercent(input)}%`);
    input.classList.toggle("has-value", Number(input.value) !== 0);
    if (!valueEl) continue;
    if (param === "exposure") valueEl.textContent = signedValue(Number(input.value) / 100, 2);
    else valueEl.textContent = signedValue(Number(input.value));
  }
}

function updateHslLabels() {
  for (const input of document.querySelectorAll(".hsl-slider")) {
    const key = `${input.dataset.channel}-${input.dataset.axis}`;
    const value = Number(input.value);
    const text = signedValue(value);
    const valueEl = document.querySelector(`[data-hsl-value-for="${key}"]`);
    const bubbleEl = document.querySelector(`[data-hsl-bubble-for="${key}"]`);
    const trackEl = input.closest(".hsl-track");
    const position = `${rangePercent(input)}%`;
    if (trackEl) trackEl.style.setProperty("--value-position", position);
    if (valueEl) valueEl.textContent = text;
    if (bubbleEl) {
      bubbleEl.textContent = text;
      bubbleEl.classList.toggle("is-visible", value !== 0);
    }
  }
}

function updateLutLabels() {
  for (let layer = 0; layer < dom.lutAmountRanges.length; layer += 1) {
    const input = dom.lutAmountRanges[layer];
    const valueEl = dom.lutAmountValues[layer];
    const nameEl = dom.lutNames[layer];
    if (input && valueEl) valueEl.textContent = `${input.value}%`;
    if (nameEl) nameEl.textContent = state.userLuts[layer]?.name || "未启用";
  }
}

function resetControlToZero(input) {
  input.value = "0";
  if (input.classList.contains("hsl-slider")) updateHslLabels();
  else updateAdjustmentLabels();
  saveCurrentParams();
  scheduleFastPreviewUpdate();
}

function readParamsFromControls() {
  const params = defaultParams();
  params.mode = dom.modeSelect.value;
  params.strength = Number(dom.strengthRange.value) / 100;
  params.localStrength = Number(dom.localRange.value) / 100;
  params.skinProtect = dom.skinProtectInput.checked;

  for (const input of document.querySelectorAll(".adjust-slider")) {
    const value = Number(input.value);
    params.adjustments[input.dataset.param] = input.dataset.param === "exposure" ? value / 100 : value;
  }

  for (const input of document.querySelectorAll(".hsl-slider")) {
    const channel = input.dataset.channel;
    const axis = input.dataset.axis;
    params.hsl[channel][axis] = Number(input.value);
  }
  params.userLutIds = state.userLuts.map((item) => item.id || "");
  params.userLutAmounts = dom.lutAmountRanges.map((input) => Number(input?.value ?? 100));
  return params;
}

function applyParamsToControls(params) {
  const next = params || defaultParams();
  dom.modeSelect.value = next.mode;
  dom.strengthRange.value = Math.round(next.strength * 100);
  dom.localRange.value = Math.round(next.localStrength * 100);
  dom.skinProtectInput.checked = Boolean(next.skinProtect);
  dom.strengthValue.textContent = `${dom.strengthRange.value}%`;
  dom.localValue.textContent = `${dom.localRange.value}%`;

  for (const input of document.querySelectorAll(".adjust-slider")) {
    const param = input.dataset.param;
    const value = next.adjustments[param] || 0;
    input.value = param === "exposure" ? Math.round(value * 100) : value;
  }

  for (const input of document.querySelectorAll(".hsl-slider")) {
    const channel = input.dataset.channel;
    const axis = input.dataset.axis;
    input.value = next.hsl?.[channel]?.[axis] || 0;
  }
  for (let layer = 0; layer < dom.lutAmountRanges.length; layer += 1) {
    if (dom.lutAmountRanges[layer]) dom.lutAmountRanges[layer].value = next.userLutAmounts?.[layer] ?? 100;
  }
  setActiveUserLutsFromIds(next.userLutIds || []);
  updateAdjustmentLabels();
  updateHslLabels();
  updateLutLabels();
}

function saveCurrentParams() {
  ensureTargetParams();
  if (state.targets.length && state.activeTargetIndex >= 0) {
    state.targetParams[state.activeTargetIndex] = readParamsFromControls();
  }
}

function summarizeFiles(files) {
  if (!files.length) return "未选择";
  const names = files.slice(0, 7).map((file) => file.name).join("、");
  const unsupported = files.filter((file) => !canBrowserDecode(file)).length;
  const suffix = unsupported ? `，其中 ${unsupported} 个 RAW/不可直接读取` : "";
  return files.length > 7 ? `${names} ... 共 ${files.length} 张${suffix}` : `${names}，共 ${files.length} 张${suffix}`;
}

function summarizeOutputs(outputs) {
  const available = outputs.filter(Boolean);
  if (!available.length) return "未选择";
  const names = available.slice(0, 7).map((output) => output.name).join("、");
  return available.length > 7 ? `${names} ... 共 ${available.length} 张` : `${names}，共 ${available.length} 张`;
}

function updateResultList() {
  if (dom.resultList) dom.resultList.textContent = summarizeOutputs(state.outputs);
}

function setPreview(imgEl, file, frameSelector, urlKind) {
  const frame = imgEl.closest(frameSelector);
  if (!file) {
    if (state.previewUrls[urlKind]) URL.revokeObjectURL(state.previewUrls[urlKind]);
    state.previewUrls[urlKind] = null;
    imgEl.removeAttribute("src");
    frame.classList.remove("has-media");
    const empty = urlKind === "ref" ? dom.refEmpty : dom.targetEmpty;
    empty.textContent = urlKind === "ref" ? "选择参考图后显示" : "选择素材后显示";
    return;
  }
  if (!canBrowserDecode(file)) {
    if (state.previewUrls[urlKind]) URL.revokeObjectURL(state.previewUrls[urlKind]);
    state.previewUrls[urlKind] = null;
    imgEl.removeAttribute("src");
    frame.classList.remove("has-media");
    const empty = urlKind === "ref" ? dom.refEmpty : dom.targetEmpty;
    empty.innerHTML = `<span class="unsupported-note">${fileExtension(file).toUpperCase()} 需要本地 RAW 解码服务，网页不能直接预览。</span>`;
    return;
  }
  const empty = urlKind === "ref" ? dom.refEmpty : dom.targetEmpty;
  empty.textContent = urlKind === "ref" ? "选择参考图后显示" : "选择素材后显示";
  if (state.previewUrls[urlKind]) URL.revokeObjectURL(state.previewUrls[urlKind]);
  state.previewUrls[urlKind] = URL.createObjectURL(file);
  imgEl.src = state.previewUrls[urlKind];
  frame.classList.add("has-media");
}

function revokeThumbUrls(kind) {
  for (const url of state.thumbUrls[kind]) URL.revokeObjectURL(url);
  state.thumbUrls[kind] = [];
}

function updateActiveThumbs(stripEl, activeIndex) {
  for (const button of stripEl.querySelectorAll(".thumb-button")) {
    button.classList.toggle("is-active", Number(button.dataset.index) === activeIndex);
  }
}

function clearCanvas(canvas) {
  const ctx = getSrgb2dContext(canvas);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function outputParamsSignature(output) {
  return JSON.stringify({
    params: output?.params || {},
    maxEdge: output?.previewOnly ? Number(dom.sizeSelect.value) : output?.maxEdge ?? null,
  });
}

function highQualityDisplayNeeded(output) {
  if (!output?.canvas) return false;
  if (output.previewOnly && output.sourceFile) return true;
  if (!output.baseCanvas) return false;
  return output.baseCanvas.width > output.canvas.width || output.baseCanvas.height > output.canvas.height;
}

function hasCurrentHighQualityDisplay(output) {
  return Boolean(output?.highQualityCanvas && output.highQualitySignature === outputParamsSignature(output));
}

function invalidateHighQualityDisplay(output) {
  if (!output) return;
  output.highQualityCanvas = null;
  output.highQualitySourceCanvas = null;
  output.highQualityPromise = null;
  output.highQualitySignature = "";
}

function drawOutputCanvases(output) {
  const useHighQuality = hasCurrentHighQualityDisplay(output);
  const resultSource = useHighQuality ? output.highQualityCanvas : output.canvas;
  const beforeSource = useHighQuality
    ? output.highQualitySourceCanvas || output.sourceCanvas || output.sourcePreviewCanvas || resultSource
    : output.sourcePreviewCanvas || output.sourceCanvas || resultSource;

  const beforeCtx = getSrgb2dContext(dom.beforeCanvas);
  dom.beforeCanvas.width = beforeSource.width;
  dom.beforeCanvas.height = beforeSource.height;
  beforeCtx.drawImage(beforeSource, 0, 0);

  const resultCtx = getSrgb2dContext(dom.resultCanvas);
  dom.resultCanvas.width = resultSource.width;
  dom.resultCanvas.height = resultSource.height;
  resultCtx.drawImage(resultSource, 0, 0);
}

async function ensureHighQualityDisplay(output) {
  if (!highQualityDisplayNeeded(output)) return null;
  const signature = outputParamsSignature(output);
  if (hasCurrentHighQualityDisplay(output)) return output.highQualityCanvas;
  if (output.highQualityPromise && output.highQualitySignature === signature) return output.highQualityPromise;

  output.highQualitySignature = signature;
  output.highQualityPromise = (async () => {
    const displayName = output.name || "当前结果";
    let sourceCanvas = output.sourceCanvas;
    let baseCanvas = output.baseCanvas;
    if (output.previewOnly && output.sourceFile) {
      const loaded = await loadImageToImageData(output.sourceFile, Number(dom.sizeSelect.value));
      sourceCanvas = loaded.canvas;
      baseCanvas = loaded.canvas;
    }
    if (!baseCanvas) return null;
    const baseImageData = canvasToImageData(baseCanvas);
    const canvas = await renderManualAdjustmentsToCanvas(
      baseImageData,
      output.params || defaultParams(),
      null,
      `正在准备高清结果预览：${displayName}`,
      76,
      98
    );
    if (outputParamsSignature(output) !== signature) return null;
    output.highQualityCanvas = canvas;
    output.highQualitySourceCanvas = sourceCanvas || output.sourceCanvas || output.sourcePreviewCanvas || canvas;
    return canvas;
  })().finally(() => {
    if (output.highQualitySignature === signature) output.highQualityPromise = null;
  });
  return output.highQualityPromise;
}

function scheduleHighQualityActiveOutput() {
  const output = state.activeOutput;
  const index = state.activeOutputIndex;
  if (!highQualityDisplayNeeded(output) || hasCurrentHighQualityDisplay(output)) return;
  ensureHighQualityDisplay(output).then((canvas) => {
    if (!canvas || state.activeOutput !== output || state.activeOutputIndex !== index) return;
    drawOutputCanvases(output);
    applyPreviewViewTransform();
    setComparePosition(state.comparePosition);
    setStatus(`高清结果预览已就绪：${output.name}`, 100);
  }).catch((error) => {
    console.error(error);
    if (state.activeOutput === output) setStatus(`高清结果预览失败：${error.message}`, 0);
  });
}

function compareLocalPosition() {
  const rect = dom.compareStage.getBoundingClientRect();
  if (rect.width <= 0) return state.comparePosition;
  const local = 50 + (state.comparePosition - 50) / state.previewView.scale - (state.previewView.x / (rect.width * state.previewView.scale)) * 100;
  return clamp(local, 0, 100);
}

function resetPreviewElementBox(el) {
  if (!el) return;
  el.style.left = "";
  el.style.top = "";
  el.style.right = "";
  el.style.bottom = "";
  el.style.width = "";
  el.style.height = "";
  el.style.transform = "";
}

function positionPreviewElementBox(el, container) {
  if (!el || !container) return;
  const { scale, x, y } = state.previewView;
  if (scale <= 1.0001) {
    resetPreviewElementBox(el);
    return;
  }

  const rect = container.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return;

  const width = rect.width * scale;
  const height = rect.height * scale;
  el.style.left = `${(rect.width - width) / 2 + x}px`;
  el.style.top = `${(rect.height - height) / 2 + y}px`;
  el.style.right = "auto";
  el.style.bottom = "auto";
  el.style.width = `${width}px`;
  el.style.height = `${height}px`;
  el.style.transform = "none";
}

function applyPreviewViewTransform() {
  const { scale, x, y } = state.previewView;
  const targetMedia = dom.targetPreview?.closest(".preview-media");
  positionPreviewElementBox(dom.targetPreview, targetMedia);
  positionPreviewElementBox(dom.beforeCanvas, dom.compareStage);
  positionPreviewElementBox(dom.resultCanvas, dom.compareStage);
  dom.compareStage.style.setProperty("--preview-scale", String(scale));
  dom.compareStage.style.setProperty("--preview-pan-x", `${x}px`);
  dom.compareStage.style.setProperty("--preview-pan-y", `${y}px`);
  dom.compareStage.style.setProperty("--compare-local-position", `${compareLocalPosition()}%`);
}

function resetPreviewView() {
  state.previewView.scale = 1;
  state.previewView.x = 0;
  state.previewView.y = 0;
  applyPreviewViewTransform();
}

function isPreviewViewGesture(event) {
  return event.ctrlKey || event.metaKey;
}

function zoomPreviewView(deltaY, clientX, clientY, targetEl) {
  const rect = targetEl.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return;
  const oldScale = state.previewView.scale;
  const zoomFactor = Math.exp(-deltaY * 0.0015);
  const nextScale = clamp(oldScale * zoomFactor, 1, 8);
  const rx = clientX - rect.left - rect.width / 2;
  const ry = clientY - rect.top - rect.height / 2;
  if (Math.abs(nextScale - 1) < 0.0001) {
    state.previewView.scale = 1;
    state.previewView.x = 0;
    state.previewView.y = 0;
  } else {
    const ratio = nextScale / oldScale;
    state.previewView.scale = nextScale;
    state.previewView.x = rx - (rx - state.previewView.x) * ratio;
    state.previewView.y = ry - (ry - state.previewView.y) * ratio;
  }
  applyPreviewViewTransform();
  if (state.previewView.scale > 1.0001) scheduleHighQualityActiveOutput();
}

function beginPreviewPan(event) {
  if (!isPreviewViewGesture(event) || event.button !== 0 || state.previewView.scale <= 1) return false;
  state.previewView.dragging = true;
  state.previewView.pointerId = event.pointerId;
  state.previewView.startX = event.clientX;
  state.previewView.startY = event.clientY;
  state.previewView.originX = state.previewView.x;
  state.previewView.originY = state.previewView.y;
  try {
    event.currentTarget.setPointerCapture?.(event.pointerId);
  } catch {
    // Synthetic pointer events used by tests may not have an active pointer.
  }
  event.currentTarget.classList.add("is-panning");
  event.preventDefault();
  return true;
}

function movePreviewPan(event) {
  if (!state.previewView.dragging || event.pointerId !== state.previewView.pointerId) return false;
  state.previewView.x = state.previewView.originX + event.clientX - state.previewView.startX;
  state.previewView.y = state.previewView.originY + event.clientY - state.previewView.startY;
  applyPreviewViewTransform();
  event.preventDefault();
  return true;
}

function endPreviewPan(event) {
  if (!state.previewView.dragging || event.pointerId !== state.previewView.pointerId) return;
  state.previewView.dragging = false;
  state.previewView.pointerId = null;
  event.currentTarget.classList.remove("is-panning");
  try {
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    }
  } catch {
    // Ignore pointer capture cleanup failures from synthetic events.
  }
}

function setComparePosition(value) {
  state.comparePosition = clamp(value, 0, 100);
  dom.compareStage.style.setProperty("--compare-position", `${state.comparePosition}%`);
  dom.compareStage.style.setProperty("--compare-local-position", `${compareLocalPosition()}%`);
  dom.compareHandle.setAttribute("aria-valuenow", String(Math.round(state.comparePosition)));
}

function updateCompareFromClientX(clientX) {
  const rect = dom.compareStage.getBoundingClientRect();
  if (rect.width <= 0) return;
  setComparePosition(((clientX - rect.left) / rect.width) * 100);
}

function renderFileThumbs(files, stripEl, kind, activeIndex, onSelect) {
  revokeThumbUrls(kind);
  stripEl.innerHTML = "";
  files.forEach((file, index) => {
    const url = URL.createObjectURL(file);
    state.thumbUrls[kind].push(url);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "thumb-button";
    button.dataset.index = String(index);
    button.title = file.name;
    if (index === activeIndex) button.classList.add("is-active");
    if (canBrowserDecode(file)) {
      const img = document.createElement("img");
      img.src = url;
      img.alt = file.name;
      button.appendChild(img);
    } else {
      const placeholder = document.createElement("span");
      placeholder.className = "thumb-placeholder";
      placeholder.textContent = fileExtension(file) || "RAW";
      button.appendChild(placeholder);
    }
    const badge = document.createElement("span");
    badge.className = "thumb-index";
    badge.textContent = String(index + 1);
    button.appendChild(badge);
    button.addEventListener("click", () => onSelect(index));
    stripEl.appendChild(button);
  });
}

function renderOutputThumbs() {
  dom.resultThumbs.innerHTML = "";
  state.outputs.forEach((output, index) => {
    if (!output) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "thumb-button";
    button.dataset.index = String(index);
    button.title = output.name;
    if (index === state.activeOutputIndex) button.classList.add("is-active");
    const img = document.createElement("img");
    img.src = output.url;
    img.alt = output.name;
    const badge = document.createElement("span");
    badge.className = "thumb-index";
    badge.textContent = String(index + 1);
    button.append(img, badge);
    button.addEventListener("click", () => selectOutput(index));
    dom.resultThumbs.appendChild(button);
  });
}

function selectReference(index) {
  state.activeRefIndex = clamp(index, 0, Math.max(0, state.references.length - 1));
  setPreview(dom.refPreview, state.references[state.activeRefIndex], ".preview-frame", "ref");
  updateActiveThumbs(dom.refThumbs, state.activeRefIndex);
}

function selectTarget(index, syncOutput = true) {
  if (state.targets.length && index !== state.activeTargetIndex) saveCurrentParams();
  ensureTargetParams();
  state.activeTargetIndex = clamp(index, 0, Math.max(0, state.targets.length - 1));
  setPreview(dom.targetPreview, state.targets[state.activeTargetIndex], ".preview-frame", "target");
  updateActiveThumbs(dom.targetThumbs, state.activeTargetIndex);
  applyParamsToControls(state.targetParams[state.activeTargetIndex] || defaultParams());
  if (syncOutput && state.outputs[state.activeTargetIndex]) selectOutput(state.activeTargetIndex, false);
  else if (syncOutput) scheduleBasePreviewUpdate();
  updateRestoreButton();
}

function refreshFileLists() {
  dom.refsList.textContent = summarizeFiles(state.references);
  dom.targetsList.textContent = summarizeFiles(state.targets);
  ensureTargetParams();
  state.activeRefIndex = Math.min(state.activeRefIndex, Math.max(0, state.references.length - 1));
  state.activeTargetIndex = Math.min(state.activeTargetIndex, Math.max(0, state.targets.length - 1));
  renderFileThumbs(state.references, dom.refThumbs, "refs", state.activeRefIndex, selectReference);
  renderFileThumbs(state.targets, dom.targetThumbs, "targets", state.activeTargetIndex, selectTarget);
  selectReference(state.activeRefIndex);
  selectTarget(state.activeTargetIndex);
  updateRestoreButton();
}

function clearOutputs() {
  clearTimeout(state.liveTimer);
  clearTimeout(state.previewTimer);
  state.previewRevision += 1;
  for (const output of state.outputs) {
    if (output?.url) URL.revokeObjectURL(output.url);
  }
  state.outputs = [];
  state.activeOutput = null;
  state.activeOutputIndex = -1;
  dom.resultThumbs.innerHTML = "";
  updateResultList();
  dom.downloadBtn.disabled = true;
  dom.downloadAllBtn.disabled = true;
  dom.resultCanvas.closest(".preview-frame").classList.remove("has-media");
  clearCanvas(dom.beforeCanvas);
  clearCanvas(dom.resultCanvas);
  setComparePosition(50);
  updateRestoreButton();
}

function outputName(fileName, format) {
  const clean = fileName.replace(/\.[^.]+$/, "");
  const ext = format === "image/png" ? "png" : format === "image/webp" ? "webp" : "jpg";
  return `${clean}__tone-match.${ext}`;
}

function canvasToBlob(canvas, format, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("浏览器无法导出该格式。"));
    }, format, quality);
  });
}

function canvasToImageData(canvas) {
  const ctx = getSrgb2dContext(canvas, { willReadFrequently: true });
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

function scaleCanvasToSize(sourceCanvas, width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = getSrgb2dContext(canvas);
  ctx.drawImage(sourceCanvas, 0, 0, width, height);
  return canvas;
}

function scaleCanvasToMaxEdge(sourceCanvas, maxEdge) {
  const sourceEdge = Math.max(sourceCanvas.width, sourceCanvas.height);
  const scale = maxEdge > 0 ? Math.min(1, maxEdge / Math.max(1, sourceEdge)) : 1;
  const width = Math.max(1, Math.round(sourceCanvas.width * scale));
  const height = Math.max(1, Math.round(sourceCanvas.height * scale));
  return scaleCanvasToSize(sourceCanvas, width, height);
}

function coreParamsFromSettings(settings) {
  return {
    mode: settings.mode,
    strength: settings.strength,
    localStrength: settings.localStrength,
    skinProtect: settings.skinProtect,
  };
}

function coreParamsEqual(a, b) {
  if (!a || !b) return false;
  return (
    a.mode === b.mode &&
    Math.abs(a.strength - b.strength) < 0.0001 &&
    Math.abs(a.localStrength - b.localStrength) < 0.0001 &&
    Boolean(a.skinProtect) === Boolean(b.skinProtect)
  );
}

function downloadUrl(url, name) {
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function selectOutput(index, syncTarget = true) {
  const output = state.outputs[index];
  if (!output) return;
  if (syncTarget && state.targets[index]) selectTarget(index, false);
  state.activeOutput = output;
  state.activeOutputIndex = index;

  drawOutputCanvases(output);
  dom.resultCanvas.closest(".preview-frame").classList.add("has-media");
  applyPreviewViewTransform();
  if (state.previewView.scale > 1.0001) scheduleHighQualityActiveOutput();
  setComparePosition(state.comparePosition);
  dom.downloadBtn.disabled = false;
  updateActiveThumbs(dom.resultThumbs, index);
}

function addOutput(output) {
  const index = state.outputs.push(output) - 1;
  renderOutputThumbs();
  selectOutput(index);
  updateResultList();
  dom.downloadAllBtn.disabled = false;
}

function replaceOutput(index, output, select = true) {
  const oldOutput = state.outputs[index];
  if (oldOutput?.url) URL.revokeObjectURL(oldOutput.url);
  state.outputs[index] = output;
  renderOutputThumbs();
  if (select) selectOutput(index, false);
  updateResultList();
  dom.downloadAllBtn.disabled = !state.outputs.some(Boolean);
}

async function renderManualAdjustmentsToCanvas(baseImageData, settings, targetCanvas = null, statusText = null, progressStart = null, progressEnd = null) {
  const renderSettings = settingsWithResolvedUserLuts(settings || defaultParams());
  const canvas = targetCanvas || document.createElement("canvas");
  canvas.width = baseImageData.width;
  canvas.height = baseImageData.height;
  const ctx = getSrgb2dContext(canvas);
  if (!ctx) throw new Error("当前浏览器无法创建图片处理画布。");

  const out = ctx.createImageData(baseImageData.width, baseImageData.height);
  out.data.set(baseImageData.data);
  const pixelCount = baseImageData.width * baseImageData.height;
  for (let p = 0; p < pixelCount; p += 1) {
    const i = p * 4;
    const adjusted = applyManualAdjustments(
      baseImageData.data[i] / 255,
      baseImageData.data[i + 1] / 255,
      baseImageData.data[i + 2] / 255,
      renderSettings
    );
    const withLut = applyUserLutsToSrgb(adjusted[0], adjusted[1], adjusted[2], renderSettings);
    out.data[i] = Math.round(withLut[0] * 255);
    out.data[i + 1] = Math.round(withLut[1] * 255);
    out.data[i + 2] = Math.round(withLut[2] * 255);
    if (p % CHUNK_PIXELS === 0) {
      if (statusText && progressStart !== null && progressEnd !== null) {
        const t = p / pixelCount;
        setStatus(statusText, mix(progressStart, progressEnd, t));
      }
      await nextFrame();
    }
  }
  ctx.putImageData(out, 0, 0);
  return canvas;
}

async function processBaseTarget(file, index, total, imageParams, options = {}) {
  const settings = imageParams || readParamsFromControls();
  const maxEdge = options.maxEdge ?? Number(dom.sizeSelect.value);
  const previewOnly = Boolean(options.previewOnly);
  const progressBase = options.progressBase ?? 18;
  const progressSpan = options.progressSpan ?? 68;
  const label = options.label || "正在生成结果预览";

  setStatus(`${label} ${index + 1}/${total}：${file.name}`, progressBase + (index / Math.max(1, total)) * progressSpan);
  const loaded = await loadImageToImageData(file, maxEdge);
  const previewBaseCanvas = scaleCanvasToMaxEdge(loaded.canvas, MAX_LIVE_PREVIEW_EDGE);
  const previewBaseImageData = canvasToImageData(previewBaseCanvas);
  const previewCanvas = await renderManualAdjustmentsToCanvas(
    previewBaseImageData,
    settings,
    null,
    `${label} ${index + 1}/${total}：${file.name}`,
    progressBase + (index / Math.max(1, total)) * progressSpan,
    progressBase + ((index + 0.88) / Math.max(1, total)) * progressSpan
  );
  const sourcePreviewCanvas = scaleCanvasToSize(loaded.canvas, previewCanvas.width, previewCanvas.height);
  const thumbBlob = await canvasToBlob(previewCanvas, "image/jpeg", 0.86);
  const url = URL.createObjectURL(thumbBlob);
  return {
    canvas: previewCanvas,
    baseCanvas: loaded.canvas,
    previewBaseImageData,
    sourceCanvas: loaded.canvas,
    sourcePreviewCanvas,
    sourceFile: file,
    blob: thumbBlob,
    url,
    name: outputName(file.name, dom.formatSelect.value),
    params: deepClone(settings),
    coreParams: null,
    maxEdge,
    previewOnly,
    toneMatched: false,
  };
}

async function analyzeReferences(files) {
  const allSamples = [];
  for (let i = 0; i < files.length; i += 1) {
    setStatus(`正在分析参考图 ${i + 1}/${files.length}：${files[i].name}`, (i / files.length) * 18);
    const loaded = await loadImageToImageData(files[i], MAX_REFERENCE_EDGE);
    appendSamples(allSamples, samplesFromImageData(loaded.imageData, MAX_ANALYZE_SAMPLES / Math.max(1, files.length)));
    await nextFrame();
  }
  return buildStats(allSamples);
}

async function processTarget(file, refStats, index, total, imageParams) {
  const maxEdge = Number(dom.sizeSelect.value);
  const settings = imageParams || readParamsFromControls();
  const params = modeParams(settings.mode);

  setStatus(`正在读取素材 ${index + 1}/${total}：${file.name}`, 20 + (index / total) * 60);
  const loaded = await loadImageToImageData(file, maxEdge);
  const targetStats = analyzeImageData(loaded.imageData);
  const toneCurve = createToneMapper(refStats, targetStats, settings, params);
  const styleLut = createStyleLut(refStats, targetStats, settings, params, toneCurve);
  const baseCanvas = document.createElement("canvas");
  baseCanvas.width = loaded.width;
  baseCanvas.height = loaded.height;
  const ctx = getSrgb2dContext(baseCanvas);
  if (!ctx) {
    throw new Error("当前浏览器无法创建图片处理画布。");
  }
  const out = ctx.createImageData(loaded.width, loaded.height);
  out.data.set(loaded.imageData.data);

  const pixelCount = loaded.width * loaded.height;
  for (let p = 0; p < pixelCount; p += 1) {
    const i = p * 4;
    const r = srgbByteToLinear(loaded.imageData.data[i]);
    const g = srgbByteToLinear(loaded.imageData.data[i + 1]);
    const b = srgbByteToLinear(loaded.imageData.data[i + 2]);
    const px = sampleStyleLut(styleLut, r, g, b);
    out.data[i] = linearUnitToSrgbByte(px[0]);
    out.data[i + 1] = linearUnitToSrgbByte(px[1]);
    out.data[i + 2] = linearUnitToSrgbByte(px[2]);
    out.data[i + 3] = loaded.imageData.data[i + 3];
    if (p % CHUNK_PIXELS === 0) {
      const localProgress = p / pixelCount;
      setStatus(`正在套用颜色 LUT ${index + 1}/${total}：${file.name}`, 28 + ((index + localProgress) / total) * 50);
      await nextFrame();
    }
  }

  ctx.putImageData(out, 0, 0);
  const previewBaseCanvas = scaleCanvasToMaxEdge(baseCanvas, MAX_LIVE_PREVIEW_EDGE);
  const previewBaseImageData = canvasToImageData(previewBaseCanvas);
  const previewCanvas = await renderManualAdjustmentsToCanvas(
    previewBaseImageData,
    settings,
    null,
    `正在生成快速预览 ${index + 1}/${total}：${file.name}`,
    78 + (index / total) * 10,
    82 + (index / total) * 10
  );
  const sourcePreviewCanvas = scaleCanvasToSize(loaded.canvas, previewCanvas.width, previewCanvas.height);
  const thumbBlob = await canvasToBlob(previewCanvas, "image/jpeg", 0.86);
  const name = outputName(file.name, dom.formatSelect.value);
  const url = URL.createObjectURL(thumbBlob);
  return {
    canvas: previewCanvas,
    baseCanvas,
    previewBaseImageData,
    sourceCanvas: loaded.canvas,
    sourcePreviewCanvas,
    sourceFile: file,
    blob: thumbBlob,
    url,
    name,
    params: deepClone(settings),
    coreParams: coreParamsFromSettings(settings),
    maxEdge,
    previewOnly: false,
    toneMatched: true,
  };
}

async function processAll() {
  if (state.busy || state.liveBusy) return;
  if (!state.targets.length) {
    setStatus("请先选择素材图。", 0);
    return;
  }
  const unsupportedRefs = state.references.filter((file) => !canBrowserDecode(file));
  const unsupportedTargets = state.targets.filter((file) => !canBrowserDecode(file));
  if (unsupportedRefs.length || unsupportedTargets.length) {
    const sample = unsupportedRefs[0] || unsupportedTargets[0];
    setStatus(`处理失败：${sample.name} 是 RAW/浏览器不可解码文件。网页端请先转 JPG/PNG/WebP。`, 0);
    return;
  }

  clearOutputs();
  saveCurrentParams();
  ensureTargetParams();
  setBusy(true);
  try {
    if (state.references.length) {
      state.refStats = await analyzeReferences(state.references);
      for (let i = 0; i < state.targets.length; i += 1) {
        const output = await processTarget(state.targets[i], state.refStats, i, state.targets.length, state.targetParams[i] || readParamsFromControls());
        addOutput(output);
      }
      setStatus(`处理完成：${state.targets.length} 张。`, 100);
    } else {
      state.refStats = null;
      for (let i = 0; i < state.targets.length; i += 1) {
        const output = await processBaseTarget(state.targets[i], i, state.targets.length, state.targetParams[i] || readParamsFromControls(), {
          maxEdge: Number(dom.sizeSelect.value),
          previewOnly: false,
          label: "正在套用 LUT / 参数",
        });
        addOutput(output);
      }
      setStatus(`已生成 LUT / 参数结果：${state.targets.length} 张。`, 100);
    }
  } catch (error) {
    console.error(error);
    setStatus(`处理失败：${error.message}`, 0);
  } finally {
    setBusy(false);
  }
}

async function restoreActiveOutput() {
  if (state.busy || state.liveBusy) return;
  const index = state.activeTargetIndex;
  const file = state.targets[index];
  if (!file) {
    setStatus("请先选择素材图。", 0);
    return;
  }
  if (!canBrowserDecode(file)) {
    setStatus(`还原失败：${file.name} 是 RAW/浏览器不可解码文件。`, 0);
    return;
  }
  saveCurrentParams();
  ensureTargetParams();
  setBusy(true);
  try {
    const output = await processBaseTarget(file, index, state.targets.length || 1, state.targetParams[index] || readParamsFromControls(), {
      maxEdge: Number(dom.sizeSelect.value),
      previewOnly: false,
      label: "正在还原",
    });
    replaceOutput(index, output);
    setStatus(`已还原为仿色前：${file.name}`, 100);
  } catch (error) {
    console.error(error);
    setStatus(`还原失败：${error.message}`, 0);
  } finally {
    setBusy(false);
  }
}

function canLiveUpdate() {
  const output = state.outputs[state.activeTargetIndex];
  return Boolean(
    state.refStats &&
      state.targets[state.activeTargetIndex] &&
      output?.toneMatched &&
      !state.busy
  );
}

function scheduleLivePreviewUpdate() {
  saveCurrentParams();
  clearTimeout(state.previewTimer);
  state.previewRevision += 1;
  if (!canLiveUpdate()) return;
  clearTimeout(state.liveTimer);
  state.liveTimer = setTimeout(() => {
    refreshActiveOutput();
  }, 420);
}

async function refreshActiveOutput() {
  if (!canLiveUpdate()) return;
  if (state.liveBusy) {
    state.liveQueued = true;
    return;
  }
  clearTimeout(state.previewTimer);
  state.previewRevision += 1;
  const index = state.activeTargetIndex;
  const file = state.targets[index];
  const params = state.targetParams[index] || readParamsFromControls();
  state.liveBusy = true;
  dom.processBtn.disabled = true;
  updateRestoreButton();
  try {
    const output = await processTarget(file, state.refStats, index, state.targets.length, params);
    replaceOutput(index, output);
    setStatus(`实时预览已更新：${file.name}`, 100);
  } catch (error) {
    console.error(error);
    setStatus(`实时预览失败：${error.message}`, 0);
  } finally {
    state.liveBusy = false;
    dom.processBtn.disabled = state.busy;
    updateRestoreButton();
    if (state.liveQueued) {
      state.liveQueued = false;
      scheduleLivePreviewUpdate();
    }
  }
}

function canFastPreviewUpdate() {
  const output = state.outputs[state.activeTargetIndex];
  return Boolean(output?.previewBaseImageData && !state.busy && !state.liveBusy);
}

function canBasePreviewUpdate() {
  const file = state.targets[state.activeTargetIndex];
  return Boolean(file && canBrowserDecode(file) && !state.busy && !state.liveBusy);
}

function scheduleBasePreviewUpdate() {
  saveCurrentParams();
  if (!canBasePreviewUpdate()) return;
  clearTimeout(state.previewTimer);
  state.previewRevision += 1;
  state.previewTimer = setTimeout(() => {
    refreshBasePreview();
  }, 80);
}

function scheduleFastPreviewUpdate() {
  saveCurrentParams();
  if (!canFastPreviewUpdate()) {
    scheduleBasePreviewUpdate();
    return;
  }
  clearTimeout(state.previewTimer);
  state.previewTimer = setTimeout(() => {
    refreshManualPreview();
  }, 40);
}

function scheduleSmartPreviewUpdate() {
  saveCurrentParams();
  const output = state.outputs[state.activeTargetIndex];
  if (!output) {
    scheduleBasePreviewUpdate();
    return;
  }
  const params = state.targetParams[state.activeTargetIndex] || readParamsFromControls();
  if (output.toneMatched && (!coreParamsEqual(output.coreParams, coreParamsFromSettings(params)) || output.maxEdge !== Number(dom.sizeSelect.value))) {
    scheduleLivePreviewUpdate();
  } else {
    scheduleFastPreviewUpdate();
  }
}

async function refreshBasePreview() {
  if (!canBasePreviewUpdate()) return;
  if (state.previewBusy) {
    state.previewQueued = true;
    return;
  }
  const revision = state.previewRevision + 1;
  state.previewRevision = revision;
  const index = state.activeTargetIndex;
  const file = state.targets[index];
  const params = state.targetParams[index] || readParamsFromControls();
  state.previewBusy = true;
  try {
    const selectedMaxEdge = Number(dom.sizeSelect.value);
    const previewMaxEdge = selectedMaxEdge || MAX_LIVE_PREVIEW_EDGE;
    const output = await processBaseTarget(file, index, state.targets.length, params, {
      maxEdge: previewMaxEdge,
      previewOnly: selectedMaxEdge === 0,
      label: "正在显示素材结果",
      progressBase: 4,
      progressSpan: 24,
    });
    if (revision !== state.previewRevision || index !== state.activeTargetIndex) {
      if (output.url) URL.revokeObjectURL(output.url);
      return;
    }
    replaceOutput(index, output);
    setStatus(`结果区已显示：${file.name}`, 100);
  } catch (error) {
    console.error(error);
    setStatus(`结果预览失败：${error.message}`, 0);
  } finally {
    state.previewBusy = false;
    if (state.previewQueued) {
      state.previewQueued = false;
      scheduleSmartPreviewUpdate();
    }
  }
}

async function refreshManualPreview() {
  if (!canFastPreviewUpdate()) return;
  if (state.previewBusy) {
    state.previewQueued = true;
    return;
  }

  const revision = state.previewRevision + 1;
  state.previewRevision = revision;
  const index = state.activeTargetIndex;
  const output = state.outputs[index];
  const params = state.targetParams[index] || readParamsFromControls();
  state.previewBusy = true;
  try {
    const canvas = await renderManualAdjustmentsToCanvas(output.previewBaseImageData, params);
    if (revision !== state.previewRevision || index !== state.activeTargetIndex || state.outputs[index] !== output) return;
    output.canvas = canvas;
    output.params = deepClone(params);
    invalidateHighQualityDisplay(output);
    selectOutput(index, false);
    setStatus(`实时预览已更新：${state.targets[index]?.name || output.name}`, 100);
  } catch (error) {
    console.error(error);
    setStatus(`实时预览失败：${error.message}`, 0);
  } finally {
    state.previewBusy = false;
    if (state.previewQueued) {
      state.previewQueued = false;
      scheduleFastPreviewUpdate();
    }
  }
}

async function ensureOutputCoreCurrent(index) {
  let output = state.outputs[index];
  const file = state.targets[index];
  if (!file) return output;
  const params = state.targetParams[index] || output.params || defaultParams();
  if (!output || !output.toneMatched) {
    const freshOutput = await processBaseTarget(file, index, state.targets.length, params, {
      maxEdge: Number(dom.sizeSelect.value),
      previewOnly: false,
      label: "正在生成导出结果",
    });
    replaceOutput(index, freshOutput, index === state.activeTargetIndex);
    return freshOutput;
  }
  if (!state.refStats) return output;
  const nextCoreParams = coreParamsFromSettings(params);
  if (coreParamsEqual(output.coreParams, nextCoreParams) && output.maxEdge === Number(dom.sizeSelect.value)) return output;
  const freshOutput = await processTarget(file, state.refStats, index, state.targets.length, params);
  replaceOutput(index, freshOutput, index === state.activeTargetIndex);
  output = freshOutput;
  return output;
}

async function exportOutput(index) {
  const output = await ensureOutputCoreCurrent(index);
  if (!output) return;
  const format = dom.formatSelect.value;
  const quality = Number(dom.qualityRange.value) / 100;
  const params = state.targetParams[index] || output.params || defaultParams();
  const sourceName = state.targets[index]?.name || output.name;
  setStatus(`正在导出：${sourceName}`, 8);
  const baseImageData = output.baseCanvas ? canvasToImageData(output.baseCanvas) : canvasToImageData(output.canvas);
  const exportCanvas = await renderManualAdjustmentsToCanvas(baseImageData, params, null, `正在套用最终参数：${sourceName}`, 15, 88);
  const blob = await canvasToBlob(exportCanvas, format, quality);
  const url = URL.createObjectURL(blob);
  downloadUrl(url, outputName(sourceName, format));
  setTimeout(() => URL.revokeObjectURL(url), 1200);
  setStatus(`已导出：${sourceName}`, 100);
}

async function exportAllOutputs() {
  if (!state.outputs.some(Boolean)) return;
  dom.downloadBtn.disabled = true;
  dom.downloadAllBtn.disabled = true;
  try {
    let exported = 0;
    for (let i = 0; i < state.outputs.length; i += 1) {
      if (!state.outputs[i]) continue;
      await exportOutput(i);
      exported += 1;
      await nextFrame();
    }
    setStatus(`已导出全部：${exported} 张。`, 100);
  } finally {
    dom.downloadBtn.disabled = !state.activeOutput;
    dom.downloadAllBtn.disabled = !state.outputs.some(Boolean);
  }
}

async function importUserLut(layer) {
  const file = dom.lutInputs[layer]?.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const lut = parseCubeLut(text, file.name);
    const entry = await saveLutEntry(file, text, lut);
    if (dom.lutAmountRanges[layer] && Number(dom.lutAmountRanges[layer].value) === 0) {
      dom.lutAmountRanges[layer].value = "100";
    }
    await selectUserLut(layer, entry.id);
    setStatus(`已保存到 LUT 库并启用：${file.name}`, null);
  } catch (error) {
    console.error(error);
    if (dom.lutInputs[layer]) dom.lutInputs[layer].value = "";
    updateLutLabels();
    setStatus(`LUT 导入失败：${error.message}`, 0);
  }
}

function clearUserLut(layer) {
  state.userLuts[layer] = blankUserLut();
  if (dom.lutInputs[layer]) dom.lutInputs[layer].value = "";
  renderLutLibrary();
  saveCurrentParams();
  scheduleSmartPreviewUpdate();
  setStatus(`已清除 LUT ${layer + 1}。`, null);
}

async function deleteSelectedLut(layer) {
  const id = dom.lutSelects[layer]?.value || state.userLuts[layer]?.id;
  if (!id) {
    setStatus("请先在 LUT 库里选择要删除的 LUT。", null);
    return;
  }
  const entry = state.lutLibrary.find((item) => item.id === id);
  try {
    await deleteLutEntry(id);
    setStatus(`已从 LUT 库删除：${entry?.name || "LUT"}`, null);
  } catch (error) {
    console.error(error);
    setStatus(`删除 LUT 失败：${error.message}`, 0);
  }
}

function bindEvents() {
  dom.pickRefsBtn.addEventListener("click", () => dom.refsInput.click());
  dom.pickTargetsBtn.addEventListener("click", () => dom.targetsInput.click());
  dom.pickFolderBtn.addEventListener("click", () => dom.folderInput.click());
  dom.refsInput.addEventListener("change", () => {
    state.references = Array.from(dom.refsInput.files || []);
    state.activeRefIndex = 0;
    state.refStats = null;
    clearTimeout(state.liveTimer);
    clearOutputs();
    refreshFileLists();
  });
  dom.targetsInput.addEventListener("change", () => {
    state.targets = Array.from(dom.targetsInput.files || []).filter((file) => canBrowserDecode(file) || isRawFile(file));
    state.activeTargetIndex = 0;
    const params = readParamsFromControls();
    params.userLutIds = ["", ""];
    state.targetParams = state.targets.map(() => deepClone(params));
    clearTimeout(state.liveTimer);
    clearOutputs();
    refreshFileLists();
  });
  dom.folderInput.addEventListener("change", () => {
    state.targets = Array.from(dom.folderInput.files || []).filter((file) => canBrowserDecode(file) || isRawFile(file));
    state.activeTargetIndex = 0;
    const params = readParamsFromControls();
    params.userLutIds = ["", ""];
    state.targetParams = state.targets.map(() => deepClone(params));
    clearTimeout(state.liveTimer);
    clearOutputs();
    refreshFileLists();
  });
  dom.clearRefsBtn.addEventListener("click", () => {
    state.references = [];
    state.refStats = null;
    state.activeRefIndex = 0;
    dom.refsInput.value = "";
    clearTimeout(state.liveTimer);
    clearOutputs();
    refreshFileLists();
  });
  dom.clearTargetsBtn.addEventListener("click", () => {
    state.targets = [];
    state.activeTargetIndex = 0;
    state.targetParams = [];
    dom.targetsInput.value = "";
    dom.folderInput.value = "";
    clearTimeout(state.liveTimer);
    clearOutputs();
    refreshFileLists();
  });
  dom.copyParamsBtn.addEventListener("click", () => {
    saveCurrentParams();
    state.copiedParams = deepClone(readParamsFromControls());
    setStatus("已复制当前素材图参数。", null);
  });
  dom.pasteParamsBtn.addEventListener("click", () => {
    if (!state.copiedParams) {
      setStatus("还没有复制参数。", null);
      return;
    }
    applyParamsToControls(deepClone(state.copiedParams));
    saveCurrentParams();
    setStatus("已粘贴到当前素材图。", null);
    scheduleSmartPreviewUpdate();
  });
  dom.syncParamsBtn.addEventListener("click", () => {
    const params = deepClone(readParamsFromControls());
    ensureTargetParams();
    state.targetParams = state.targets.map(() => deepClone(params));
    setStatus(`已同步参数到 ${state.targets.length} 张素材图。`, null);
    scheduleSmartPreviewUpdate();
  });
  dom.strengthRange.addEventListener("input", () => {
    dom.strengthValue.textContent = `${dom.strengthRange.value}%`;
    scheduleLivePreviewUpdate();
  });
  dom.localRange.addEventListener("input", () => {
    dom.localValue.textContent = `${dom.localRange.value}%`;
    scheduleLivePreviewUpdate();
  });
  dom.qualityRange.addEventListener("input", () => {
    dom.qualityValue.textContent = `${dom.qualityRange.value}%`;
    setStatus("导出质量已更新，预览不需要重新渲染。", null);
  });
  for (let layer = 0; layer < dom.lutInputs.length; layer += 1) {
    dom.pickLutBtns[layer]?.addEventListener("click", () => dom.lutInputs[layer]?.click());
    dom.clearLutBtns[layer]?.addEventListener("click", () => clearUserLut(layer));
    dom.deleteLutBtns[layer]?.addEventListener("click", () => {
      deleteSelectedLut(layer);
    });
    dom.lutSelects[layer]?.addEventListener("change", () => {
      selectUserLut(layer, dom.lutSelects[layer].value);
    });
    dom.lutInputs[layer]?.addEventListener("change", () => {
      importUserLut(layer);
    });
    dom.lutAmountRanges[layer]?.addEventListener("input", () => {
      updateLutLabels();
      scheduleSmartPreviewUpdate();
    });
  }
  dom.sizeSelect.addEventListener("change", scheduleSmartPreviewUpdate);
  dom.formatSelect.addEventListener("change", () => {
    setStatus("导出格式已更新，预览不需要重新渲染。", null);
  });
  for (const control of [dom.modeSelect, dom.skinProtectInput]) {
    control.addEventListener("change", scheduleSmartPreviewUpdate);
  }
  for (const input of document.querySelectorAll(".adjust-slider")) {
    input.addEventListener("input", () => {
      updateAdjustmentLabels();
      scheduleFastPreviewUpdate();
    });
    input.addEventListener("dblclick", () => resetControlToZero(input));
  }
  for (const input of document.querySelectorAll(".hsl-slider")) {
    input.addEventListener("input", () => {
      updateHslLabels();
      scheduleFastPreviewUpdate();
    });
    input.addEventListener("dblclick", () => resetControlToZero(input));
  }
  const targetMedia = dom.targetPreview.closest(".preview-media");
  const previewViewAreas = [targetMedia, dom.compareStage].filter(Boolean);
  for (const area of previewViewAreas) {
    area.addEventListener("wheel", (event) => {
      if (!isPreviewViewGesture(event)) return;
      zoomPreviewView(event.deltaY, event.clientX, event.clientY, area);
      event.preventDefault();
    }, { passive: false });
    area.addEventListener("dblclick", (event) => {
      if (!isPreviewViewGesture(event)) return;
      resetPreviewView();
      event.preventDefault();
    });
  }
  window.addEventListener("resize", applyPreviewViewTransform);
  if (targetMedia) {
    targetMedia.addEventListener("pointerdown", beginPreviewPan);
    targetMedia.addEventListener("pointermove", movePreviewPan);
    for (const eventName of ["pointerup", "pointercancel", "pointerleave"]) {
      targetMedia.addEventListener(eventName, endPreviewPan);
    }
  }
  dom.compareStage.addEventListener("pointerdown", (event) => {
    if (!state.activeOutput) return;
    if (beginPreviewPan(event)) return;
    state.compareDragging = true;
    dom.compareStage.setPointerCapture?.(event.pointerId);
    updateCompareFromClientX(event.clientX);
    event.preventDefault();
  });
  dom.compareStage.addEventListener("pointermove", (event) => {
    if (movePreviewPan(event)) return;
    if (!state.compareDragging) return;
    updateCompareFromClientX(event.clientX);
    event.preventDefault();
  });
  for (const eventName of ["pointerup", "pointercancel", "pointerleave"]) {
    dom.compareStage.addEventListener(eventName, (event) => {
      endPreviewPan(event);
      if (!state.compareDragging) return;
      state.compareDragging = false;
      if (dom.compareStage.hasPointerCapture?.(event.pointerId)) {
        dom.compareStage.releasePointerCapture?.(event.pointerId);
      }
    });
  }
  dom.compareHandle.addEventListener("keydown", (event) => {
    if (!state.activeOutput) return;
    if (event.key === "ArrowLeft") setComparePosition(state.comparePosition - 2);
    else if (event.key === "ArrowRight") setComparePosition(state.comparePosition + 2);
    else if (event.key === "Home") setComparePosition(0);
    else if (event.key === "End") setComparePosition(100);
    else return;
    event.preventDefault();
  });
  dom.processBtn.addEventListener("click", processAll);
  dom.restoreBtn?.addEventListener("click", restoreActiveOutput);
  dom.downloadBtn.addEventListener("click", async () => {
    if (state.activeOutputIndex >= 0) await exportOutput(state.activeOutputIndex);
  });
  dom.downloadAllBtn.addEventListener("click", async () => {
    await exportAllOutputs();
  });
  if (dom.themeToggle) {
    dom.themeToggle.addEventListener("click", () => {
      applyTheme(document.body.dataset.theme === "dark" ? "light" : "dark");
    });
  }
}

async function initializeApp() {
  applyTheme(initialTheme());
  renderHslControls();
  updateAdjustmentLabels();
  updateHslLabels();
  updateLutLabels();
  applyPreviewViewTransform();
  bindEvents();
  refreshFileLists();
  await loadLutLibrary();
}

initializeApp().catch((error) => {
  console.error(error);
  setStatus(`初始化失败：${error.message}`, 0);
});
