const textInput = document.getElementById('text-input');
const generateBtn = document.getElementById('generate-btn');
const clearBtn = document.getElementById('clear-btn');
const qrImage = document.getElementById('qr-image');
const downloadBtn = document.getElementById('download-btn');
const downloadAllBtn = document.getElementById('download-all-btn');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const playBtn = document.getElementById('play-btn');
const pageIndicator = document.getElementById('page-indicator');
const densitySlider = document.getElementById('density-slider');
const densityInfo = document.getElementById('density-info');
const speedSelect = document.getElementById('speed-select');
const pageSlider = document.getElementById('page-slider');
const pageSliderLabel = document.getElementById('page-slider-label');
const modePlain = document.getElementById('mode-plain');
const modeChain = document.getElementById('mode-chain');

// ── 配置 ──────────────────────────────────────────

function getMaxBytes() { return parseInt(densitySlider.value, 10); }

// ── 状态 ──────────────────────────────────────────

let currentText = '';
let qrCodes = [];
let currentPage = 0;
let isPlaying = false;
let playTimer = null;
let isChainMode = false;
const SPEED_OPTIONS = [50, 100, 200, 500, 1000, 1500, 2000]; // 毫秒
let speedIndex = 6; // 默认 2000ms

function getSpeedMs() { return SPEED_OPTIONS[speedIndex]; }
function formatSpeed() {
  return (getSpeedMs() / 1000).toFixed(2).replace(/\.?0+$/, '');
}

// ── 工具函数 ──────────────────────────────────────

/** 按 UTF-8 字节长度切分文本 */
function splitByByteLength(text, maxBytes) {
  const encoder = new TextEncoder();
  const segments = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + maxBytes, text.length);
    // 往回调到字节限制内
    while (end > start && encoder.encode(text.slice(start, end)).length > maxBytes) {
      end--;
    }
    if (end === start) end = start + 1; // 极端情况：单个字符超限也强行放进
    segments.push(text.slice(start, end));
    start = end;
  }
  return segments;
}

/** 生成分段 JSON 包 */
function makePacket(data, total, index) {
  return JSON.stringify({ v: 1, t: total, i: index, d: data });
}

/** 更新密度信息 */
function updateDensityInfo(segmentCount) {
  const bytes = getMaxBytes();
  const input = textInput.value.trim();
  let count = segmentCount;
  if (count === undefined && input) {
    const segments = splitByByteLength(input, bytes);
    count = segments.length;
  }
  densityInfo.textContent = count !== undefined
    ? `${bytes} 字节/段 · 共 ${count} 张`
    : `${bytes} 字节/段`;
}
/** 跳转到指定页 */
function goToPage(index) {
  if (index < 0 || index >= qrCodes.length) return;
  currentPage = index;
  qrImage.src = qrCodes[currentPage];
  pageIndicator.textContent = `第 ${currentPage + 1}/${qrCodes.length} 张`;
  pageSlider.value = currentPage;
  pageSliderLabel.textContent = `${currentPage + 1}/${qrCodes.length}`;
  prevBtn.disabled = currentPage === 0;
  nextBtn.disabled = currentPage === qrCodes.length - 1;
  downloadBtn.disabled = false;
  downloadAllBtn.disabled = qrCodes.length <= 1;
  playBtn.disabled = qrCodes.length <= 1;
}

// ── 输入状态管理 ──────────────────────────────────

textInput.addEventListener('input', () => {
  currentText = textInput.value.trim();
  generateBtn.disabled = currentText.length === 0;
  updateDensityInfo();
});

// ── 清空 ──────────────────────────────────────────

clearBtn.addEventListener('click', () => {
  stopPlay();
  textInput.value = '';
  currentText = '';
  generateBtn.disabled = true;
  qrCodes = [];
  currentPage = 0;
  qrImage.removeAttribute('src');
  pageIndicator.textContent = '第 1/1 张';
  pageSlider.max = 0;
  pageSlider.value = 0;
  pageSliderLabel.textContent = '1/1';
  prevBtn.disabled = true;
  nextBtn.disabled = true;
  downloadBtn.disabled = true;
  downloadAllBtn.disabled = true;
  playBtn.disabled = true;
  updateDensityInfo(0);
});

// ── 生成二维码 ────────────────────────────────────

generateBtn.addEventListener('click', generateQRCode);

async function generateQRCode() {
  stopPlay();
  const text = textInput.value.trim();
  if (!text) return;

  try {
    const segments = splitByByteLength(text, getMaxBytes());
    const total = segments.length;
    const results = [];

    for (let i = 0; i < total; i++) {
      const content = isChainMode
        ? makePacket(segments[i], total, i)  // 智能拼接：JSON 包，App 自动拼接
        : segments[i];                       // 纯文本
      const dataUrl = await QRCode.toDataURL(content, {
        width: 320, margin: 2,
        color: { dark: '#1a1a1a', light: '#ffffff' },
      });
      results.push(dataUrl);
    }

    qrCodes = results;
    pageSlider.max = results.length - 1;
    goToPage(0);
    updateDensityInfo(total);
  } catch (err) {
    console.error('二维码生成失败:', err);
    alert('生成失败，请检查输入内容后重试。');
  }
}

// ── 翻页 ──────────────────────────────────────────

prevBtn.addEventListener('click', () => { stopPlay(); goToPage(currentPage - 1); });
nextBtn.addEventListener('click', () => { stopPlay(); goToPage(currentPage + 1); });

// ── 密度滑块 ──────────────────────────────────────

densitySlider.addEventListener('input', () => {
  localStorage.setItem('densityMaxBytes', densitySlider.value); // 记住滑块位置，下次打开恢复
  if (qrCodes.length > 0 && textInput.value.trim()) {
    // 已有二维码，调整密度后自动重新生成
    generateQRCode();
  } else {
    updateDensityInfo();
  }
});

// ── 自动播放 ──────────────────────────────────────

function stopPlay() {
  if (playTimer) {
    clearInterval(playTimer);
    playTimer = null;
  }
  isPlaying = false;
  playBtn.textContent = '▶';
  playBtn.classList.remove('is-playing');
}

function startPlay() {
  isPlaying = true;
  playBtn.textContent = '⏸';
  playBtn.classList.add('is-playing');
  playTimer = setInterval(() => {
    const next = currentPage + 1;
    if (next >= qrCodes.length) {
      goToPage(0);
    } else {
      goToPage(next);
    }
  }, getSpeedMs());
}

function togglePlay() {
  if (isPlaying) {
    stopPlay();
    return;
  }
  startPlay();
}

playBtn.addEventListener('click', togglePlay);

// ── 播放速度 ──────────────────────────────────────

speedSelect.addEventListener('change', () => {
  speedIndex = parseInt(speedSelect.value, 10);
  localStorage.setItem('speedIndex', speedIndex);
  if (isPlaying) {
    stopPlay();
    startPlay();
  }
});

// ── 页数滑块 ──────────────────────────────────────

pageSlider.addEventListener('input', () => {
  stopPlay();
  goToPage(parseInt(pageSlider.value, 10));
});

// ── 模式切换 ──────────────────────────────────────

function setMode(chain) {
  isChainMode = chain;
  localStorage.setItem('chainMode', chain);
  modePlain.classList.toggle('mode-btn-active', !chain);
  modeChain.classList.toggle('mode-btn-active', chain);
  // 有二维码则按新模式重生成
  if (qrCodes.length > 0 && textInput.value.trim()) {
    generateQRCode();
  }
}

modePlain.addEventListener('click', () => setMode(false));
modeChain.addEventListener('click', () => setMode(true));

// ── 下载当前二维码 ────────────────────────────────

downloadBtn.addEventListener('click', () => {
  if (!qrCodes[currentPage]) return;
  const link = document.createElement('a');
  link.download = `qrcode_${currentPage + 1}.png`;
  link.href = qrCodes[currentPage];
  link.click();
});

// ── 下载全部二维码 ────────────────────────────────

downloadAllBtn.addEventListener('click', () => {
  qrCodes.forEach((dataUrl, i) => {
    const link = document.createElement('a');
    link.download = `qrcode_${i + 1}.png`;
    link.href = dataUrl;
    link.click();
  });
});

// ── 快捷键支持 ────────────────────────────────────

textInput.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    if (!generateBtn.disabled) generateQRCode();
  }
});

// ── 初始化 ──────────────────────────────────────────

(function init() {
  // 填充速度选项
  SPEED_OPTIONS.forEach((ms, i) => {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = (ms / 1000).toFixed(2).replace(/\.?0+$/, '') + ' s/张';
    speedSelect.appendChild(opt);
  });
  // 从上一次会话恢复密度滑块位置
  const saved = localStorage.getItem('densityMaxBytes');
  if (saved) {
    densitySlider.value = saved;
    updateDensityInfo();
  }
  // 恢复播放速度
  const savedSpeed = localStorage.getItem('speedIndex');
  if (savedSpeed !== null) {
    speedIndex = parseInt(savedSpeed, 10);
    if (speedIndex < 0 || speedIndex >= SPEED_OPTIONS.length) speedIndex = 6;
  }
  speedSelect.value = speedIndex;
  // 恢复模式
  const savedMode = localStorage.getItem('chainMode');
  if (savedMode === 'true') setMode(true);
})();
