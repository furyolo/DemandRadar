// ==UserScript==
// @name         DemandRadar Fiverr Gig Assistant
// @namespace    https://demandradar.local/
// @version      0.1.0
// @description  Pull deduped DemandRadar Fiverr Gig drafts from the local bridge and fill visible Fiverr form fields.
// @match        https://www.fiverr.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM.xmlHttpRequest
// @grant        GM_setClipboard
// @connect      127.0.0.1
// @connect      localhost
// ==/UserScript==

(function () {
  'use strict';

  const BRIDGE_URL = 'http://127.0.0.1:3233';
  const TOKEN = 'demandradar-local';
  let currentDraft = null;

  const panel = document.createElement('div');
  panel.style.cssText = [
    'position:fixed',
    'right:16px',
    'bottom:16px',
    'z-index:2147483647',
    'width:320px',
    'background:#111827',
    'color:#f9fafb',
    'font:13px/1.4 system-ui,-apple-system,Segoe UI,sans-serif',
    'border:1px solid #374151',
    'border-radius:8px',
    'box-shadow:0 12px 30px rgba(0,0,0,.28)',
    'padding:12px'
  ].join(';');
  panel.innerHTML = [
    '<div style="font-weight:700;margin-bottom:8px">DemandRadar Fiverr</div>',
    '<div data-dr-status style="margin-bottom:10px;color:#d1d5db">No draft loaded.</div>',
    '<div data-dr-title style="margin-bottom:10px;max-height:72px;overflow:auto"></div>',
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px"></div>'
  ].join('');
  document.body.appendChild(panel);

  const actions = panel.querySelector('div:last-child');
  addButton(actions, 'Load next', loadNextDraft);
  addButton(actions, 'Fill fields', fillVisibleFields);
  addButton(actions, 'Copy title', () => copyField('title_suffix_after_i_will'));
  addButton(actions, 'Copy desc', () => copyField('description'));
  addButton(actions, 'Mark saved', () => updateStatus('draft_saved'));
  addButton(actions, 'Published', () => updateStatus('published'));
  addButton(actions, 'Skip', () => updateStatus('skipped'));
  addButton(actions, 'Failed', () => updateStatus('failed'));

  async function loadNextDraft() {
    setStatus('Loading next draft...');
    const result = await bridgeRequest('GET', '/api/drafts/next');
    currentDraft = result.draft;
    if (!currentDraft) {
      setStatus('No pending draft in local queue.');
      setTitle('');
      return;
    }
    setStatus(`Loaded ${currentDraft.id}`);
    setTitle(currentDraft.supply ? `${currentDraft.supply.title}\n${currentDraft.supply.source_url}` : currentDraft.id);
    await updateStatus('filling', false);
  }

  async function fillVisibleFields() {
    if (!currentDraft) {
      setStatus('Load a draft first.');
      return;
    }
    const map = currentDraft.form_fill_map || {};
    let filled = 0;
    filled += fillByHints(['title', 'gig title', 'i will'], map.title_suffix_after_i_will);
    filled += fillByHints(['description', 'describe', 'gig description'], map.description);
    filled += fillByHints(['tag', 'search tag', 'positive keywords'], Array.isArray(map.search_tags) ? map.search_tags.join(', ') : '');

    const packages = map.packages || {};
    filled += fillByHints(['basic', 'package name'], packages.basic && packages.basic.name);
    filled += fillByHints(['standard'], packages.standard && packages.standard.name);
    filled += fillByHints(['premium'], packages.premium && packages.premium.name);

    setStatus(`Filled ${filled} visible field(s). Publish is still manual.`);
  }

  function fillByHints(hints, value) {
    if (!value) return 0;
    const controls = Array.from(document.querySelectorAll('input:not([type=hidden]), textarea, [contenteditable="true"]'));
    for (const control of controls) {
      if (isFilled(control)) continue;
      const text = controlText(control).toLowerCase();
      if (!hints.some((hint) => text.includes(hint))) continue;
      setControlValue(control, String(value));
      return 1;
    }
    return 0;
  }

  function controlText(control) {
    const id = control.getAttribute('id');
    const label = id ? document.querySelector(`label[for="${cssEscape(id)}"]`) : null;
    const parent = control.closest('label,div,section,fieldset');
    return [
      control.getAttribute('name'),
      control.getAttribute('aria-label'),
      control.getAttribute('placeholder'),
      label && label.textContent,
      parent && parent.textContent
    ].filter(Boolean).join(' ');
  }

  function isFilled(control) {
    if (control.isContentEditable) return control.textContent.trim().length > 0;
    return typeof control.value === 'string' && control.value.trim().length > 0;
  }

  function setControlValue(control, value) {
    control.focus();
    if (control.isContentEditable) {
      control.textContent = value;
    } else {
      control.value = value;
    }
    control.dispatchEvent(new Event('input', { bubbles: true }));
    control.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function copyField(key) {
    if (!currentDraft) {
      setStatus('Load a draft first.');
      return;
    }
    const value = currentDraft.form_fill_map && currentDraft.form_fill_map[key];
    if (!value) {
      setStatus(`Missing ${key}.`);
      return;
    }
    GM_setClipboard(String(value));
    setStatus(`Copied ${key}.`);
  }

  async function updateStatus(status, showMessage = true) {
    if (!currentDraft) return;
    const eventType = status === 'published'
      ? 'published'
      : status === 'draft_saved'
        ? 'draft_saved'
        : status === 'skipped'
          ? 'skipped'
          : status === 'failed'
            ? 'failed'
            : 'fill_started';
    await bridgeRequest('POST', `/api/drafts/${encodeURIComponent(currentDraft.id)}/status`, { status, eventType });
    if (showMessage) setStatus(`Marked ${status}.`);
  }

  function bridgeRequest(method, path, body) {
    return new Promise((resolve, reject) => {
      const request = (typeof GM !== 'undefined' && GM.xmlHttpRequest) || GM_xmlhttpRequest;
      request({
        method,
        url: `${BRIDGE_URL}${path}`,
        headers: {
          'Content-Type': 'application/json',
          'x-demandradar-token': TOKEN
        },
        data: body ? JSON.stringify(body) : undefined,
        onload: (response) => {
          try {
            const json = JSON.parse(response.responseText || '{}');
            if (response.status >= 400 || json.ok === false) throw new Error(json.error || response.statusText);
            resolve(json);
          } catch (error) {
            reject(error);
            setStatus(error.message || String(error));
          }
        },
        onerror: () => {
          const message = 'Cannot reach local bridge. Start npm run goofish:fiverr-bridge first.';
          setStatus(message);
          reject(new Error(message));
        }
      });
    });
  }

  function addButton(parent, label, handler) {
    const button = document.createElement('button');
    button.textContent = label;
    button.type = 'button';
    button.style.cssText = 'border:1px solid #4b5563;border-radius:6px;background:#1f2937;color:#fff;padding:7px;cursor:pointer';
    button.addEventListener('click', () => handler().catch((error) => setStatus(error.message || String(error))));
    parent.appendChild(button);
  }

  function setStatus(message) {
    panel.querySelector('[data-dr-status]').textContent = message;
  }

  function setTitle(message) {
    panel.querySelector('[data-dr-title]').textContent = message;
  }

  function cssEscape(value) {
    if (window.CSS && CSS.escape) return CSS.escape(value);
    return value.replace(/"/g, '\\"');
  }
})();
