const textInput = document.getElementById('text-input');
const generateBtn = document.getElementById('generate-btn');
const clearBtn = document.getElementById('clear-btn');
const pasteBtn = document.getElementById('paste-btn');
const outputSection = document.getElementById('output-section');
const qrCanvas = document.getElementById('qr-canvas');
const downloadBtn = document.getElementById('download-btn');

let currentText = '';

// ── 输入状态管理 ──────────────────────────────────

textInput.addEventListener('input', () => {
  const val = textInput.value.trim();
  generateBtn.disabled = val.length === 0;
  currentText = val;
});

// ── 清空 ──────────────────────────────────────────

clearBtn.addEventListener('click', () => {
  textInput.value = '';
  currentText = '';
  generateBtn.disabled = true;
  outputSection.hidden = true;
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

function generateQRCode() {
  const text = textInput.value.trim();
  if (!text) return;

  try {
    QRCode.toCanvas(qrCanvas, text, {
      width: 280,
      margin: 2,
      color: {
        dark: '#1a1a1a',
        light: '#ffffff',
      },
    });

    outputSection.hidden = false;
  } catch (err) {
    console.error('二维码生成失败:', err);
    alert('生成失败，请检查输入内容后重试。');
  }
}

// ── 下载二维码 ────────────────────────────────────

downloadBtn.addEventListener('click', () => {
  const link = document.createElement('a');
  link.download = `qrcode_${Date.now()}.png`;
  link.href = qrCanvas.toDataURL('image/png');
  link.click();
});

// ── 快捷键支持 ────────────────────────────────────

textInput.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    if (!generateBtn.disabled) {
      generateQRCode();
    }
  }
});
