// Shared helpers for every page — same shape as the works app's t2w.js.
const P = (() => {
  const PAGES = [
    ['/', 'Dashboard'],
    ['/schedule.html', 'Order schedule'],
    ['/pos.html', 'Purchase orders'],
    ['/bom.html', 'BOM templates'],
    ['/settings.html', 'Settings'],
  ];

  const STATUS = {
    OVERDUE: 'Overdue to order',
    ORDER_NOW: 'Order now',
    PART_ORDERED: 'Part ordered',
    PLANNED: 'Planned',
    ORDERED: 'Ordered',
    RECEIVED: 'Received',
    INSTALLED: 'Installed',
    NO_BOM: 'No BOM',
    NO_DATE: 'No programme date',
    ON_HOLD: 'On hold',
    DRAFT: 'Draft',
    ISSUED: 'Issued',
    PART_RECEIVED: 'Part received',
    CANCELLED: 'Cancelled',
    APPROVED: 'Approved',
  };

  let me = null;

  async function call(action, params = {}) {
    const res = await fetch('/api/rpc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, params }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) {
      window.location.href = '/login.html?next=' + encodeURIComponent(location.pathname + location.search);
      throw new Error('Signed out');
    }
    if (!res.ok) throw new Error(data.error || res.statusText);
    return data;
  }

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = (v, dp = 0) => (v === null || v === undefined || v === '' ? '' : Number(v).toLocaleString(undefined, { maximumFractionDigits: dp, minimumFractionDigits: 0 }));
  const money = (v) => (v === null || v === undefined || v === '' ? '' : '$' + Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 }));
  const today = () => new Date().toISOString().slice(0, 10);

  function date(v) {
    if (!v) return '';
    const s = String(v).slice(0, 10);
    const [y, m, d] = s.split('-').map(Number);
    if (!y) return esc(v);
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: '2-digit', timeZone: 'UTC' });
  }
  function dateTime(v) {
    if (!v) return '';
    return new Date(v).toLocaleString('en-AU', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' });
  }
  function daysFrom(v) {
    if (!v) return null;
    return Math.round((Date.parse(String(v).slice(0, 10)) - Date.parse(today())) / 86400000);
  }
  function relDays(v) {
    const d = daysFrom(v);
    if (d === null) return '';
    if (d === 0) return 'today';
    return d < 0 ? `${-d}d ago` : `in ${d}d`;
  }
  const status = (s) => `<span class="pill s-${esc(s)}">${esc(STATUS[s] || s)}</span>`;
  const q = (name) => new URLSearchParams(location.search).get(name);
  const $ = (sel, root = document) => root.querySelector(sel);

  function flash(el, text, kind = 'ok') {
    el.innerHTML = `<div class="msg ${kind}">${esc(text)}</div>`;
    if (kind === 'ok') setTimeout(() => { if (el.textContent.includes(text)) el.innerHTML = ''; }, 4000);
  }

  async function mount() {
    const res = await fetch('/api/me');
    if (res.status === 401) {
      window.location.href = '/login.html?next=' + encodeURIComponent(location.pathname + location.search);
      throw new Error('Signed out');
    }
    me = await res.json();
    if (!res.ok) {
      document.body.innerHTML = `<main><div class="msg err">${esc(me.error || 'Access denied')}</div><p><a href="/login.html">Sign in as someone else</a></p></main>`;
      throw new Error(me.error);
    }
    const here = location.pathname === '/index.html' ? '/' : location.pathname;
    const bar = document.createElement('div');
    bar.className = 'topbar';
    bar.innerHTML = `
      <h1>T2W Pipeline — Procurement<small>order planner</small></h1>
      <nav>${PAGES.map(([href, label]) => `<a href="${href}" class="${here === href ? 'active' : ''}">${label}</a>`).join('')}</nav>
      <div class="who">${esc(me.user.fullName)} · ${esc(me.user.role.replace('_', ' '))}
        <button class="logout" id="logoutBtn">Sign out</button></div>`;
    document.body.prepend(bar);
    $('#logoutBtn').addEventListener('click', async () => {
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.href = '/login.html';
    });
    document.querySelectorAll('[data-perm]').forEach((el) => {
      if (!me.permissions[el.dataset.perm]) el.style.display = 'none';
    });
    return me;
  }

  const can = (perm) => Boolean(me && me.permissions[perm]);

  function options(list, selected, { blank } = {}) {
    const opts = list.map((o) => (Array.isArray(o) ? o : [o, o]));
    return (blank !== undefined ? `<option value="">${esc(blank)}</option>` : '') +
      opts.map(([v, l]) => `<option value="${esc(v)}" ${String(v) === String(selected ?? '') ? 'selected' : ''}>${esc(l)}</option>`).join('');
  }

  function csv(filename, header, rows) {
    const cell = (v) => {
      const s = String(v ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const text = [header, ...rows].map((r) => r.map(cell).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv' }));
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  return { call, esc, num, money, date, dateTime, relDays, daysFrom, status, STATUS, q, $, flash, mount, can, options, today, csv };
})();
