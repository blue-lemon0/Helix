document.getElementById('qr-generator-btn').addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('qrcode/qrcode.html') });
});

document.getElementById('json-builder-btn').addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('json/json.html') });
});
