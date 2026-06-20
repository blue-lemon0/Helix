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

// ── State ─────────────────────────────────────────

let uid = 0;
function nextId() { return ++uid; }

let fields = [createField('', 'string', '')];

let confirmCallback = null;
let updateTimer = null;

// ── Field helpers ─────────────────────────────────

function createField(name, type, value) {
  return { id: nextId(), name: name || '', type: type || 'string', value: value ?? '', children: [] };
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
      if (!c.name) continue;
      o[c.name] = getFieldValue(c);
    }
    return o;
  }
  if (f.type === 'array') {
    return (f.children || []).map(c => getFieldValue(c));
  }
  if (f.type === 'number') return f.value === '' ? null : Number(f.value);
  if (f.type === 'boolean') return f.value === 'true';
  return f.value;
}

// ── Render ────────────────────────────────────────

function render() {
  renderFields();
  renderJson();
  updateFooter();
}

function renderFields() {
  fieldList.innerHTML = '';

  for (let i = 0; i < fields.length; i++) {
    fieldList.appendChild(renderFieldRow(fields[i], fields, i, 0));
  }
}

function renderFieldRow(f, siblings, index, depth) {
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
  addSiblingBtn.className = 'btn-icon btn-icon-add';
  addSiblingBtn.textContent = '➕';
  addSiblingBtn.title = '添加同级别字段';
  addSiblingBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const newField = createField('', 'string', '');
    siblings.splice(index + 1, 0, newField);
    scheduleRender();
  });
  row.appendChild(addSiblingBtn);

  // Name input
  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.className = 'field-name-input';
  nameInput.placeholder = '字段名';
  nameInput.value = f.name;
  nameInput.addEventListener('input', () => { f.name = nameInput.value; scheduleJsonUpdate(); });
  nameInput.addEventListener('click', e => e.stopPropagation());
  row.appendChild(nameInput);

  // Type select (hover dropdown)
  const typeWrap = document.createElement('span');
  typeWrap.className = 'field-type-wrap';
  const typeCur = document.createElement('span');
  typeCur.className = 'field-type-current';
  typeCur.textContent = f.type;
  typeWrap.appendChild(typeCur);
  const typeMenu = document.createElement('div');
  typeMenu.className = 'field-type-menu';
  const types = ['string', 'number', 'boolean', 'object', 'array'];
  for (const t of types) {
    const item = document.createElement('span');
    item.textContent = t;
    item.dataset.type = t;
    if (t === f.type) item.classList.add('active');
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      if (t === f.type) return;
      const oldType = f.type;
      f.type = t;
      if (f.type !== oldType) {
        if (f.type === 'object' || f.type === 'array') {
          f.value = '';
          if (!f.children) f.children = [];
        } else {
          f.children = [];
          f.value = '';
        }
      }
      scheduleRender();
    });
    typeMenu.appendChild(item);
  }
  typeWrap.appendChild(typeMenu);
  let showTimer = null;
  let hideTimer = null;
  function showMenu() {
    clearTimeout(showTimer);
    clearTimeout(hideTimer);
    showTimer = setTimeout(() => {
      const rect = typeCur.getBoundingClientRect();
      const menuHeight = typeMenu.scrollHeight || 140;
      const spaceBelow = window.innerHeight - rect.bottom - 4;
      typeMenu.style.position = 'fixed';
      typeMenu.style.left = rect.left + 'px';
      typeMenu.style.width = rect.width + 'px';
      if (spaceBelow >= menuHeight) {
        typeMenu.style.top = (rect.bottom + 2) + 'px';
        typeMenu.style.bottom = 'auto';
      } else {
        typeMenu.style.top = 'auto';
        typeMenu.style.bottom = (window.innerHeight - rect.top + 2) + 'px';
      }
      typeWrap.classList.add('open');
    }, 250);
  }
  function hideMenu() {
    clearTimeout(showTimer);
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => typeWrap.classList.remove('open'), 200);
  }
  typeWrap.addEventListener('mouseenter', showMenu);
  typeWrap.addEventListener('mouseleave', hideMenu);
  typeMenu.addEventListener('mouseenter', showMenu);
  typeMenu.addEventListener('mouseleave', hideMenu);
  row.appendChild(typeWrap);

  // Add child button (right after type)
  if (f.type === 'object' || f.type === 'array') {
    const addBtn = document.createElement('button');
    addBtn.className = 'btn-icon btn-icon-add';
    addBtn.textContent = '➕';
    addBtn.title = '添加子字段';
    addBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!f.children) f.children = [];
      const child = createField('', 'string', '');
      f.children.push(child);
      scheduleRender();
    });
    row.appendChild(addBtn);
  }

  // Value input
  if (f.type === 'string') {
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'field-value-input';
    input.placeholder = '值';
    input.value = f.value;
    input.addEventListener('input', () => { f.value = input.value; scheduleJsonUpdate(); });
    row.appendChild(input);
  } else if (f.type === 'number') {
    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'field-value-input';
    input.placeholder = '0';
    input.value = f.value;
    input.addEventListener('input', () => { f.value = input.value; scheduleJsonUpdate(); });
    row.appendChild(input);
  } else if (f.type === 'boolean') {
    const tag = document.createElement('span');
    tag.className = 'field-value-boolean';
    tag.textContent = f.value === 'true' ? 'true' : 'false';
    tag.tabIndex = 0;
    tag.addEventListener('click', () => {
      f.value = f.value === 'true' ? 'false' : 'true';
      tag.textContent = f.value;
      scheduleJsonUpdate();
    });
    row.appendChild(tag);
  } else {
    const placeholder = document.createElement('span');
    placeholder.className = 'field-value-placeholder';
    placeholder.textContent = f.type === 'object' ? '{ }' : '[ ]';
    row.appendChild(placeholder);
  }

  // Delete button
  const delBtn = document.createElement('button');
  delBtn.className = 'btn-icon btn-icon-del';
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
    } else {
      siblings.splice(index, 1);
      scheduleRender();
    }
  });
  row.appendChild(delBtn);
  container.appendChild(row);

  // Render children
  if ((f.type === 'object' || f.type === 'array') && f.children && f.children.length > 0) {
    const indent = document.createElement('div');
    indent.className = 'field-indent';
    for (let i = 0; i < f.children.length; i++) {
      indent.appendChild(renderFieldRow(f.children[i], f.children, i, depth + 1));
    }
    container.appendChild(indent);
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
  copyBtn.disabled = fields.length === 0;
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
importModal.addEventListener('click', (e) => {
  if (e.target === importModal) closeImportModal();
});

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

  if (typeof val === 'object') {
    if (Array.isArray(val)) {
      val.forEach((item, i) => {
        const type = getValueType(item);
        const f = createField(String(i), type);
        if (type === 'object' || type === 'array') {
          f.children = jsonToFields(item);
        } else {
          f.value = String(item ?? '');
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
          f.value = String(item ?? '');
        }
        result.push(f);
      }
    }
    return result;
  }

  const f = createField('', getValueType(val));
  f.value = String(val ?? '');
  result.push(f);
  return result;
}

function getValueType(val) {
  if (val === null || val === undefined) return 'string';
  if (Array.isArray(val)) return 'array';
  if (typeof val === 'object') return 'object';
  if (typeof val === 'boolean') return 'boolean';
  if (typeof val === 'number') return 'number';
  return 'string';
}

// ── Confirm modal ─────────────────────────────────

function showConfirm(msg, callback) {
  confirmText.textContent = msg;
  confirmCallback = callback;
  confirmModal.classList.add('active');
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
confirmModal.addEventListener('click', (e) => {
  if (e.target === confirmModal) closeConfirm();
});

// ── Keyboard shortcut ─────────────────────────────

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (importModal.classList.contains('active')) closeImportModal();
    if (confirmModal.classList.contains('active')) closeConfirm();
  }
});

// ── Init ──────────────────────────────────────────

render();
