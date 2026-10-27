// Tiny DOM helpers for the UI. Browser-only (never imported by Node tests).

export function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  if (attrs) applyAttrs(el, attrs);
  append(el, kids);
  return el;
}

export function applyAttrs(el, attrs) {
  for (const k in attrs) {
    const v = attrs[k];
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'vars') { for (const n in v) el.style.setProperty('--' + n, v[n]); }
    else el.setAttribute(k, v === true ? '' : v);
  }
}

export function append(el, kids) {
  for (const c of kids) {
    if (c == null || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else if (c instanceof Node) el.appendChild(c);
    else el.appendChild(document.createTextNode(String(c)));
  }
  return el;
}

// Build an element from an SVG or HTML string.
export function fromHTML(str) {
  const tpl = document.createElement('template');
  tpl.innerHTML = str.trim();
  return tpl.content.firstElementChild;
}

export function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }

export function setText(el, s) { if (el.textContent !== s) el.textContent = s; }

// Restart a CSS animation class.
export function bump(el, cls = 'gp-bump') {
  if (!el) return;
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}

// Trigger a download from a data URL or Blob.
export function download(data, filename) {
  const a = document.createElement('a');
  const url = typeof data === 'string' ? data : URL.createObjectURL(data);
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  if (typeof data !== 'string') setTimeout(() => URL.revokeObjectURL(url), 4000);
}
