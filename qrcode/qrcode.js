const textInput = document.getElementById('text-input');
const generateBtn = document.getElementById('generate-btn');
const clearBtn = document.getElementById('clear-btn');
const pasteBtn = document.getElementById('paste-btn');
const qrImage = document.getElementById('qr-image');
const downloadBtn = document.getElementById('download-btn');
const downloadAllBtn = document.getElementById('download-all-btn');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const pageIndicator = document.getElementById('page-indicator');

// ── 配置 ──────────────────────────────────────────

const MAX_BYTES = 2000; // 单张 QR 码有效载荷上限（字节）

// ── 状态 ──────────────────────────────────────────

let currentText = '';
let qrCodes = [];
let currentPage = 0;

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

/** 跳转到指定页 */
function goToPage(index) {
  if (index < 0 || index >= qrCodes.length) return;
  currentPage = index;
  qrImage.src = qrCodes[currentPage];
  pageIndicator.textContent = `第 ${currentPage + 1}/${qrCodes.length} 张`;
  prevBtn.disabled = currentPage === 0;
  nextBtn.disabled = currentPage === qrCodes.length - 1;
  downloadBtn.disabled = false;
  downloadAllBtn.disabled = qrCodes.length <= 1;
}

// ── 输入状态管理 ──────────────────────────────────

textInput.addEventListener('input', () => {
  currentText = textInput.value.trim();
  generateBtn.disabled = currentText.length === 0;
});

// ── 清空 ──────────────────────────────────────────

clearBtn.addEventListener('click', () => {
  textInput.value = '';
  currentText = '';
  generateBtn.disabled = true;
  qrCodes = [];
  currentPage = 0;
  qrImage.removeAttribute('src');
  pageIndicator.textContent = '第 1/1 张';
  prevBtn.disabled = true;
  nextBtn.disabled = true;
  downloadBtn.disabled = true;
  downloadAllBtn.disabled = true;
});

// ── 粘贴 ──────────────────────────────────────────

pasteBtn.addEventListener('click', async () => {
  try {
    const text = await navigator.clipboard.readText();
    textInput.value = text;
    currentText = text.trim();
    generateBtn.disabled = currentText.length === 0;
    textInput.dispatchEvent(new Event('input'));
  } catch {
    textInput.focus();
  }
});

// ── 生成二维码 ────────────────────────────────────

generateBtn.addEventListener('click', generateQRCode);

async function generateQRCode() {
  const text = textInput.value.trim();
  if (!text) return;

  try {
    const segments = splitByByteLength(text, MAX_BYTES);
    const total = segments.length;

    // 批量生成
    const results = [];
    for (let i = 0; i < total; i++) {
      const packet = makePacket(segments[i], total, i);
      const dataUrl = await QRCode.toDataURL(packet, {
        width: 280,
        margin: 2,
        color: { dark: '#1a1a1a', light: '#ffffff' },
      });
      results.push(dataUrl);
    }

    qrCodes = results;
    goToPage(0);
  } catch (err) {
    console.error('二维码生成失败:', err);
    alert('生成失败，请检查输入内容后重试。');
  }
}

// ── 翻页 ──────────────────────────────────────────

prevBtn.addEventListener('click', () => goToPage(currentPage - 1));
nextBtn.addEventListener('click', () => goToPage(currentPage + 1));

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
