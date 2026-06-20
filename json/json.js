// ── Elements ──────────────────────────────────────

const fieldList = document.getElementById('field-list');
const jsonCode = document.getElementById('json-code');
const copyBtn = document.getElementById('copy-btn');
const footerCount = document.getElementById('footer-count');
const clearBtn = document.getElementById('clear-btn');
const importBtn = document.getElementById('import-btn');

const importModal = document.getElementById('import-modal');
const importText = document.getElementById('import-text');
const importError = document.getElementById('import-error');
const modalImport = document.getElementById('modal-import');
const modalCancel = document.getElementById('modal-cancel');
const modalClose = document.getElementById('modal-close');

const confirmModal = document.getElementById('confirm-modal');
const confirmText = document.getElementById('confirm-text');
const confirmOk = document.getElementById('confirm-ok');
const confirmCancel = document.getElementById('confirm-cancel');

const editBtn = document.getElementById('edit-btn');
const editArea = document.getElementById('json-edit-area');

// ── State ─────────────────────────────────────────

let uid = 0;
function nextId() { return ++uid; }

let fields = [createField('', 'string', '')];

let confirmCallback = null;
let updateTimer = null;
let jsonEditMode = false;
let focusFieldId = null;

function focusNext(siblings, nextIndex) {
  if (nextIndex < siblings.length) {
    focusFieldId = siblings[nextIndex].id;
    render();
  } else {
    const newField = createField('', 'string', '');
    siblings.push(newField);
    focusFieldId = newField.id;
    render();
  }
}

// ── Constants ──────────────────────────────────────

const TYPE_CYCLE = ['string', 'object', 'array'];
const TYPE_LABEL = { string: 'V', object: '{}', array: '[]' };

// ── Helpers ────────────────────────────────────────

function needsQuotes(v) {
  if (v === 'true' || v === 'false' || v === 'null') return false;
  if (v === '' || v.trim() === '') return false;
  if (!isNaN(Number(v)) && v.trim() !== '') return false;
  return true;
}

// ── Field helpers ─────────────────────────────────

function createField(name, type, value) {
  return { id: nextId(), name: name || '', type: type || 'string', value: value ?? '', children: [], q: true };
}

function createChildFor(parentType) {
  if (parentType === 'array') {
    const obj = createField('', 'object', '');
    obj.children = [createField('', 'string', '')];
    return obj;
  }
  return createField('', 'string', '');
}

function countFields(list) {
  let n = 0;
  for (const f of list) {
    n++;
    if ((f.type === 'object' || f.type === 'array') && f.children) {
      n += countFields(f.children);
    }
  }
  return n;
}

function syncDupWarnings(siblings, parentEl) {
  if (!parentEl) return;
  const count = {};
  for (const s of siblings) {
    if (s && s.name) count[s.name] = (count[s.name] || 0) + 1;
  }
  const dup = new Set();
  for (const [name, c] of Object.entries(count)) {
    if (c > 1) dup.add(name);
  }
  const inputs = parentEl.querySelectorAll('.field-name-input');
  for (const input of inputs) {
    input.classList.toggle('field-name-dup', dup.has(input.value));
  }
}

function buildJson(list) {
  // Single unnamed root field: unwrap to surface its content
  if (list.length === 1 && !list[0].name) {
    return getFieldValue(list[0]);
  }
  const obj = {};
  for (const f of list) {
    if (!f.name) continue;
    obj[f.name] = getFieldValue(f);
  }
  return obj;
}

function getFieldValue(f) {
  if (f.type === 'object') {
    const o = {};
    for (const c of (f.children || [])) {
      if (!c || !c.name) continue;
      o[c.name] = getFieldValue(c);
    }
    return o;
  }
  if (f.type === 'array') {
    return (f.children || []).filter(c => c).map(c => getFieldValue(c));
  }
  if (f.q === false) {
    const v = f.value;
    if (v === '' || v === 'null') return null;
    if (v === 'true') return true;
    if (v === 'false') return false;
    const num = Number(v);
    if (!isNaN(num) && v.trim() !== '') return num;
  }
  return f.value;
}

// ── Render ────────────────────────────────────────

function render() {
  if (jsonEditMode) cancelEdit();
  renderFields();
  renderJson();
  updateFooter();
  if (focusFieldId) {
    const el = fieldList.querySelector(`.field-row[data-id="${focusFieldId}"] .field-name-input`);
    if (el) el.focus();
    focusFieldId = null;
  }
}

function renderFields() {
  fieldList.innerHTML = '';

  if (fields.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'field-empty';
    const btn = document.createElement('button');
    btn.className = 'btn btn-secondary';
    btn.textContent = '+ 添加字段';
    btn.addEventListener('click', () => {
      fields.push(createField('', 'string', ''));
      render();
    });
    empty.appendChild(btn);
    fieldList.appendChild(empty);
    return;
  }

  for (let i = 0; i < fields.length; i++) {
    fieldList.appendChild(renderFieldRow(fields[i], fields, i, 0));
  }
  syncDupWarnings(fields, fieldList);
}

function renderFieldRow(f, siblings, index, depth, containerType) {
  const container = document.createElement('div');

  const row = document.createElement('div');
  row.className = 'field-row';
  row.dataset.id = f.id;

  // Gutter / indentation
  if (depth > 0) {
    const gutter = document.createElement('div');
    gutter.className = 'field-gutter';
    row.appendChild(gutter);
  }

  // Add sibling button (left)
  const addSiblingBtn = document.createElement('button');
  addSiblingBtn.className = 'btn-mini btn-icon btn-icon-add';
  addSiblingBtn.textContent = '+';
  addSiblingBtn.title = '添加同级别字段';
  addSiblingBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const newField = createField('', 'string', '');
    siblings.splice(index + 1, 0, newField);
    scheduleRender();
  });
  row.appendChild(addSiblingBtn);

  // Name input (hidden for array children — show index instead)
  if (containerType !== 'array') {
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'field-name-input';
    nameInput.placeholder = '字段名';
    nameInput.value = f.name;
    nameInput.addEventListener('input', () => {
      f.name = nameInput.value;
      scheduleJsonUpdate();
      const parentEl = (nameInput.closest('#field-list') || nameInput.closest('.field-indent'));
      if (parentEl) syncDupWarnings(siblings, parentEl);
    });
    nameInput.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      if (f.type === 'string') {
        const vi = row.querySelector('.field-value-input');
        if (vi) { vi.focus(); return; }
      }
      focusNext(siblings, index + 1);
    });
    nameInput.addEventListener('click', e => e.stopPropagation());
    row.appendChild(nameInput);
  }

  // Type toggle button: "" → {} → [] → 1
  const typeBtn = document.createElement('button');
  typeBtn.className = 'btn-mini field-type-btn';
  typeBtn.textContent = TYPE_LABEL[f.type] || '""';
  typeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const idx = TYPE_CYCLE.indexOf(f.type);
    const next = TYPE_CYCLE[(idx + 1) % TYPE_CYCLE.length];
    if (next === f.type) return;
    const wasContainer = f.type === 'object' || f.type === 'array';
    const isContainer = next === 'object' || next === 'array';
    f.type = next;
    if (isContainer) {
      f.value = '';
      f.children = [];
      f.children.push(createChildFor(next));
    } else {
      // switching to string mode — default to quoted
      f.q = true;
      if (wasContainer) { f.children = []; f.value = ''; }
    }
    scheduleRender();
  });
  row.appendChild(typeBtn);

  // Add child button (right after type)
  if (f.type === 'object' || f.type === 'array') {
    const addBtn = document.createElement('button');
    addBtn.className = 'btn-mini btn-icon btn-icon-add-child';
    addBtn.textContent = '↳';
    addBtn.title = '添加子字段';
    addBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!f.children) f.children = [];
      f.children = f.children.filter(c => c);
      f.children.push(createChildFor(f.type));
      scheduleRender();
    });
    row.appendChild(addBtn);
  }

  // Value input
  if (f.type === 'string') {
    const valWrap = document.createElement('span');
    valWrap.className = 'literal-wrap';

    const textInput = document.createElement('input');
    textInput.type = 'text';
    textInput.className = 'field-value-input';
    textInput.placeholder = '值';
    textInput.value = f.value;
    textInput.addEventListener('input', () => { f.value = textInput.value; syncQuote(textInput, quoteBtn, f); scheduleJsonUpdate(); });
    textInput.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      focusNext(siblings, index + 1);
    });

    const quoteBtn = document.createElement('button');
    quoteBtn.className = 'btn-mini literal-mode-btn';
    quoteBtn.textContent = '"';

    function syncQuote(input, btn, field) {
      btn.classList.toggle('on', field.q !== false);
      input.classList.toggle('warn', field.q === false && needsQuotes(field.value));
    }

    quoteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      f.q = f.q === false ? true : false;
      syncQuote(textInput, quoteBtn, f);
      scheduleJsonUpdate();
    });

    valWrap.appendChild(quoteBtn);
    valWrap.appendChild(textInput);
    syncQuote(textInput, quoteBtn, f);
    row.appendChild(valWrap);
  } else {
    const placeholder = document.createElement('span');
    placeholder.className = 'field-value-placeholder';
    placeholder.textContent = f.type === 'object' ? '{ }' : '[ ]';
    row.appendChild(placeholder);
  }

  // Delete button
  const delBtn = document.createElement('button');
  delBtn.className = 'btn-mini btn-icon btn-icon-del';
  delBtn.textContent = '✕';
  delBtn.title = '删除';
  delBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const childCount = countFields(f.children || []);
    if (childCount > 0) {
      showConfirm(`该字段包含 ${childCount} 个子字段，确定删除吗？`, () => {
        siblings.splice(index, 1);
        scheduleRender();
      });
      return;
    }
    siblings.splice(index, 1);
    scheduleRender();
  });
  row.appendChild(delBtn);
  container.appendChild(row);

  // Render children
  if ((f.type === 'object' || f.type === 'array') && f.children && f.children.length > 0) {
    const indent = document.createElement('div');
    indent.className = 'field-indent';
    for (let i = 0; i < f.children.length; i++) {
      if (!f.children[i]) continue;
      indent.appendChild(renderFieldRow(f.children[i], f.children, i, depth + 1, f.type));
    }
    if (indent.children.length > 0) container.appendChild(indent);
    syncDupWarnings(f.children, indent);
  }

  return container;
}

// ── JSON rendering with syntax highlight ─────────

function renderJson() {
  const obj = buildJson(fields);
  let text;
  try {
    text = JSON.stringify(obj, null, 2) || '{ }';
  } catch {
    text = '{ }';
  }
  jsonCode.innerHTML = highlightJson(text);
  if (!jsonEditMode) copyBtn.disabled = fields.length === 0;
}

function highlightJson(str) {
  return str
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"([^"]+)":/g, '<span class="json-key">"$1"</span>:')
    .replace(/:\s*"([^"]+)"/g, ': <span class="json-string">"$1"</span>')
    .replace(/:\s*(-?\d+\.?\d*)/g, ': <span class="json-number">$1</span>')
    .replace(/:\s*(true|false)/g, ': <span class="json-boolean">$1</span>')
    .replace(/:\s*(null)/g, ': <span class="json-null">$1</span>')
    .replace(/([{}[\]])/g, '<span class="json-bracket">$1</span>');
}

// ── Footer ────────────────────────────────────────

function updateFooter() {
  footerCount.textContent = `共 ${countFields(fields)} 个字段`;
}

// ── Debounced update ──────────────────────────────

function scheduleRender() {
  clearTimeout(updateTimer);
  updateTimer = setTimeout(render, 50);
}

function scheduleJsonUpdate() {
  renderJson();
  updateFooter();
}

// ── Copy ──────────────────────────────────────────

copyBtn.addEventListener('click', async () => {
  const obj = buildJson(fields);
  const text = JSON.stringify(obj, null, 2);
  try {
    await navigator.clipboard.writeText(text);
    copyBtn.textContent = '✅ 已复制';
    setTimeout(() => { copyBtn.textContent = '📋 复制 JSON'; }, 1500);
  } catch {
    alert('复制失败');
  }
});

// ── Inline JSON editor ──────────────────────────

const jsonPreview = document.getElementById('json-preview');
let editCancelBtn = null;

editBtn.addEventListener('click', () => {
  if (!jsonEditMode) {
    startEdit();
  } else {
    applyEdit();
  }
});

function startEdit() {
  jsonEditMode = true;
  editArea.value = getJsonText();
  jsonPreview.classList.add('edit-mode');
  editBtn.textContent = '✅ 同步到字段';
  editBtn.className = 'btn btn-primary';
  copyBtn.disabled = true;
  if (!editCancelBtn) {
    editCancelBtn = document.createElement('button');
    editCancelBtn.className = 'btn btn-secondary';
    editCancelBtn.textContent = '取消';
    editCancelBtn.addEventListener('click', cancelEdit);
    copyBtn.parentNode.insertBefore(editCancelBtn, copyBtn);
  }
  editArea.focus();
}

function cancelEdit() {
  jsonEditMode = false;
  jsonPreview.classList.remove('edit-mode');
  editBtn.textContent = '✏️ 编辑 JSON';
  editBtn.className = 'btn btn-secondary';
  copyBtn.disabled = fields.length === 0;
  if (editCancelBtn) {
    editCancelBtn.remove();
    editCancelBtn = null;
  }
}

function applyEdit() {
  const raw = editArea.value.trim();
  if (!raw) { cancelEdit(); return; }
  try {
    const parsed = JSON.parse(raw);
    fields = jsonToFields(parsed);
    cancelEdit();
    render();
  } catch (err) {
    alert(`JSON 解析失败：${err.message}`);
  }
}

function getJsonText() {
  const obj = buildJson(fields);
  try { return JSON.stringify(obj, null, 2); } catch { return '{ }'; }
}

// ── Clear ─────────────────────────────────────────

clearBtn.addEventListener('click', () => {
  if (fields.length === 0) return;
  showConfirm('确定要清空所有字段吗？', () => {
    fields = [];
    render();
  });
});

// ── Import ────────────────────────────────────────

importBtn.addEventListener('click', () => {
  importText.value = '';
  importError.textContent = '';
  modalImport.disabled = true;
  importModal.classList.add('active');
  setTimeout(() => importText.focus(), 100);
});

function closeImportModal() {
  importModal.classList.remove('active');
}

modalClose.addEventListener('click', closeImportModal);
modalCancel.addEventListener('click', closeImportModal);
closeOnBackdrop(importModal, closeImportModal);

importText.addEventListener('input', () => {
  modalImport.disabled = importText.value.trim().length === 0;
});

importText.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    if (!modalImport.disabled) doImport();
  }
});

modalImport.addEventListener('click', doImport);

function doImport() {
  const raw = importText.value.trim();
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    fields = jsonToFields(parsed);
    closeImportModal();
    render();
  } catch (err) {
    importError.textContent = `解析失败：${err.message}`;
  }
}

function jsonToFields(val) {
  const result = [];
  if (val === null || val === undefined) return result;

  if (typeof val !== 'object') {
    const f = createField('', getValueType(val));
    assignPrimitiveValue(f, val);
    result.push(f);
    return result;
  }

  if (Array.isArray(val)) {
    val.forEach((item, i) => {
      const type = getValueType(item);
      const f = createField(String(i), type);
      if (type === 'object' || type === 'array') {
        f.children = jsonToFields(item);
      } else {
        assignPrimitiveValue(f, item);
      }
      result.push(f);
    });
  } else {
    for (const key of Object.keys(val)) {
      const item = val[key];
      const type = getValueType(item);
      const f = createField(key, type);
      if (type === 'object' || type === 'array') {
        f.children = jsonToFields(item);
      } else {
        assignPrimitiveValue(f, item);
      }
      result.push(f);
    }
  }
  return result;
}

function assignPrimitiveValue(f, val) {
  if (val === null) {
    f.value = 'null';
    f.q = false;
  } else if (typeof val === 'boolean' || typeof val === 'number') {
    f.value = String(val);
    f.q = false;
  } else {
    f.value = String(val);
    f.q = true;
  }
}

function getValueType(val) {
  if (val === null || val === undefined) return 'string';
  if (Array.isArray(val)) return 'array';
  if (typeof val === 'object') return 'object';
  return 'string';
}

// ── Confirm modal ─────────────────────────────────

function showConfirm(msg, callback) {
  confirmText.textContent = msg;
  confirmCallback = callback;
  confirmModal.classList.add('active');
}

function closeOnBackdrop(overlay, closeFn) {
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeFn();
  });
}

function closeConfirm() {
  confirmModal.classList.remove('active');
  confirmCallback = null;
}

confirmOk.addEventListener('click', () => {
  if (confirmCallback) confirmCallback();
  closeConfirm();
});

confirmCancel.addEventListener('click', closeConfirm);
closeOnBackdrop(confirmModal, closeConfirm);

// ── Keyboard shortcut ─────────────────────────────

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (importModal.classList.contains('active')) closeImportModal();
  if (confirmModal.classList.contains('active')) closeConfirm();
});

// ── Init ──────────────────────────────────────────

render();
