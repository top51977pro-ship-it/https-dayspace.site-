'use strict';
// DonutClassic Panel - talks to the official exaroton API (https://api.exaroton.com/v1/).
// Reads plugins/DonutClassic/panel/*.json (written by the plugin) and sends console commands for actions.
const API = 'https://api.exaroton.com/v1/';
const PANEL = 'plugins/DonutClassic/panel/';
const $ = (id) => document.getElementById(id);
const state = { key: localStorage.getItem('key') || '', server: JSON.parse(localStorage.getItem('server') || 'null'), data: {} };

// ---------------------------------------------------------------- HTTP (native bridge, falls back to fetch)
let seq = 0; const pending = {};
window.__native = (id, status, body) => { const p = pending[id]; if (p) { delete pending[id]; p({ status, body }); } };
function http(method, path, body) {
  const url = API + path;
  const headers = { Authorization: 'Bearer ' + state.key };
  if (body) headers['Content-Type'] = 'application/json';
  const payload = body ? JSON.stringify(body) : '';
  if (window.Native) {
    return new Promise((res) => { const id = 'r' + (++seq); pending[id] = res; window.Native.request(id, method, url, JSON.stringify(headers), payload); });
  }
  return fetch(url, { method, headers, body: payload || undefined }).then(async (r) => ({ status: r.status, body: await r.text() }))
    .catch((e) => ({ status: 0, body: String(e) }));
}
async function apiJson(method, path, body) {
  const r = await http(method, path, body);
  let j = null; try { j = JSON.parse(r.body); } catch (e) { /* not json */ }
  if (r.status === 0) throw new Error('Network error: ' + r.body);
  if (!j || j.success === false || r.status >= 400) throw new Error((j && j.error) || ('HTTP ' + r.status));
  return j.data;
}
const encPath = (p) => p.split('/').map(encodeURIComponent).join('/');
async function readFile(name) {
  const r = await http('GET', 'servers/' + state.server.id + '/files/data/' + encPath(PANEL + name));
  if (r.status !== 200) throw new Error(name + ': HTTP ' + r.status);
  return JSON.parse(r.body);
}
function command(cmd) { return apiJson('POST', 'servers/' + state.server.id + '/command', { command: cmd }); }

// ---------------------------------------------------------------- helpers
function toast(msg, ms = 2600) { const t = $('toast'); t.textContent = msg; t.classList.remove('hidden'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.add('hidden'), ms); }
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function money(cents) {
  let v = (cents || 0) / 100; const suf = ['', 'K', 'M', 'B', 'T']; let i = 0;
  while (Math.abs(v) >= 1000 && i < suf.length - 1) { v /= 1000; i++; }
  return '$' + (i === 0 ? (Number.isInteger(v) ? v : v.toFixed(2)) : v.toFixed(2).replace(/\.?0+$/, '')) + suf[i];
}
const pretty = (m) => String(m || '').toLowerCase().split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
function ago(ts) { const s = Math.max(0, (Date.now() - ts) / 1000); return s < 60 ? Math.floor(s) + 's ago' : s < 3600 ? Math.floor(s / 60) + 'm ago' : s < 86400 ? Math.floor(s / 3600) + 'h ago' : Math.floor(s / 86400) + 'd ago'; }
function left(ts) { if (!ts) return 'permanent'; const s = (ts - Date.now()) / 1000; if (s <= 0) return 'expired'; return s < 3600 ? Math.ceil(s / 60) + 'm left' : s < 86400 ? Math.floor(s / 3600) + 'h left' : Math.floor(s / 86400) + 'd left'; }
const validName = (n) => /^[A-Za-z0-9_.\-]{1,32}$/.test(n);
const cleanReason = (r) => String(r || '').replace(/[\r\n]/g, ' ').trim().slice(0, 200);
const STATUS = ['Offline', 'Online', 'Starting', 'Stopping', 'Restarting', 'Saving', 'Loading', 'Crashed', 'Pending', 'Transferring', 'Preparing'];

// ---------------------------------------------------------------- setup
function showSetup() {
  $('setup').classList.remove('hidden'); $('tabs').classList.add('hidden');
  document.querySelectorAll('main .page').forEach((p) => p.classList.add('hidden'));
  $('key').value = state.key; $('srv').textContent = '';
}
$('loadServers').onclick = async () => {
  state.key = $('key').value.trim();
  if (!state.key) return toast('Paste your exaroton API key first');
  $('serverList').innerHTML = '<div class="empty">Loading…</div>';
  try {
    const servers = await apiJson('GET', 'servers/');
    localStorage.setItem('key', state.key);
    $('serverList').innerHTML = servers.length ? '' : '<div class="empty">No servers on this account.</div>';
    servers.forEach((s) => {
      const b = document.createElement('button'); b.className = 'srvbtn';
      b.innerHTML = '<b>' + esc(s.name) + '</b><div class="muted small">' + esc(s.address) + ' · ' + esc(STATUS[s.status] || s.status) + '</div>';
      b.onclick = () => { state.server = { id: s.id, name: s.name, address: s.address }; localStorage.setItem('server', JSON.stringify(state.server)); start(); };
      $('serverList').appendChild(b);
    });
  } catch (e) { $('serverList').innerHTML = ''; toast('Could not load servers: ' + e.message, 4000); }
};
$('logout').onclick = () => { localStorage.removeItem('server'); state.server = null; showSetup(); };

// ---------------------------------------------------------------- tabs
let tab = 'overview';
document.querySelectorAll('#tabs button').forEach((b) => b.onclick = () => {
  tab = b.dataset.tab;
  document.querySelectorAll('#tabs button').forEach((x) => x.classList.toggle('on', x === b));
  document.querySelectorAll('main .page').forEach((p) => p.classList.toggle('hidden', p.id !== tab));
  render();
});

function start() {
  $('setup').classList.add('hidden'); $('tabs').classList.remove('hidden');
  document.querySelectorAll('main .page').forEach((p) => p.classList.toggle('hidden', p.id !== tab));
  $('srv').textContent = state.server.name + ' · ' + state.server.address;
  load();
}

async function load() {
  $('refresh').disabled = true;
  try {
    const [srv, status, bans, ah, orders, alerts] = await Promise.all([
      apiJson('GET', 'servers/' + state.server.id).catch(() => null),
      readFile('status.json').catch(() => null), readFile('bans.json').catch(() => null), readFile('ah.json').catch(() => null),
      readFile('orders.json').catch(() => null), readFile('alerts.json').catch(() => null)]);
    state.data = { srv, status, bans, ah, orders, alerts };
    if (!status) toast('No panel data yet. Is DonutClassic installed and has the server started once?', 4500);
    render();
  } catch (e) { toast(e.message, 4000); }
  $('refresh').disabled = false;
}
$('refresh').onclick = load;

/** Sends an action, asks the plugin to re-export, then reloads. */
async function act(cmd, label) {
  try {
    await command(cmd);
    toast(label + ' sent');
    await command('dc panel').catch(() => {});
    setTimeout(load, 2500);
  } catch (e) { toast('Failed: ' + e.message, 4000); }
}
function confirmAct(text, cmd, label) { if (confirm(text)) act(cmd, label); }

// ---------------------------------------------------------------- render
function render() {
  if (!state.server) return;
  ({ overview: renderOverview, bans: renderBans, ah: renderAh, orders: renderOrders, alerts: renderAlerts, console: () => {} })[tab]();
}

function card(k, v) { return '<div class="card"><div class="v">' + esc(v) + '</div><div class="k">' + esc(k) + '</div></div>'; }

function renderOverview() {
  const { srv, status, bans, ah, orders } = state.data;
  const online = (status && status.online) || [];
  const activeBans = ((bans && bans.punishments) || []).filter((p) => p.active && p.type.includes('BAN')).length;
  $('statCards').innerHTML = card('Server', srv ? (STATUS[srv.status] || srv.status) : '—') + card('Players', online.length + (status ? ' / ' + status.maxPlayers : ''))
    + card('TPS', status ? status.tps : '—') + card('Active bans', activeBans)
    + card('AH listings', ah ? ah.listings.length : '—') + card('Open orders', orders ? orders.orders.length : '—');
  $('players').innerHTML = online.length ? '' : '<div class="empty">' + (status ? 'Nobody online' : 'No data') + '</div>';
  online.forEach((p) => {
    const vl = Object.entries(p.violations || {}).filter(([, v]) => v >= 1).map(([k, v]) => k + ' ' + v.toFixed(1)).join(', ');
    const d = document.createElement('div'); d.className = 'item';
    d.innerHTML = '<div class="top"><span class="name">' + esc(p.name) + (p.bedrock ? '<span class="tag blue">Bedrock</span>' : '<span class="tag">Java</span>') + '</span><span class="price">' + money(p.money) + '</span></div>'
      + '<div class="meta">' + esc(p.shards) + ' shards · ' + esc(p.world) + (p.team ? ' · team ' + esc(p.team) : '') + (vl ? ' · <span style="color:#fca5a5">VL: ' + esc(vl) + '</span>' : '') + '</div>'
      + '<div class="acts"><button data-a="kick">Kick</button><button data-a="mute">Mute 1h</button><button class="bad" data-a="ban">Ban 7d</button></div>';
    d.querySelector('[data-a=kick]').onclick = () => confirmAct('Kick ' + p.name + '?', 'dckick ' + p.name + ' Kicked by staff', 'Kick');
    d.querySelector('[data-a=mute]').onclick = () => confirmAct('Mute ' + p.name + ' for 1 hour?', 'dcmute ' + p.name + ' 1h Muted by staff', 'Mute');
    d.querySelector('[data-a=ban]').onclick = () => { const r = prompt('Ban ' + p.name + ' for 7 days. Reason:', 'Breaking the rules'); if (r !== null) act('dcban ' + p.name + ' 7d ' + cleanReason(r), 'Ban'); };
    $('players').appendChild(d);
  });
}

$('banGo').onclick = () => {
  const name = $('banName').value.trim(), type = $('banType').value, dur = $('banDur').value, reason = cleanReason($('banReason').value) || 'Breaking the rules';
  if (!validName(name)) return toast('Enter a valid player name');
  const cmd = type === 'dckick' || type === 'dcwarn' ? type + ' ' + name + ' ' + reason : type + ' ' + name + ' ' + dur + ' ' + reason;
  confirmAct('Run: ' + cmd + ' ?', cmd, 'Punishment');
};
$('banSearch').oninput = renderBans; $('banFilter').onchange = renderBans;
function renderBans() {
  const all = (state.data.bans && state.data.bans.punishments) || [];
  const q = $('banSearch').value.trim().toLowerCase(), activeOnly = $('banFilter').value === 'active';
  const list = all.filter((p) => (!activeOnly || (p.active && p.type !== 'KICK' && p.type !== 'WARN')) && (!q || String(p.name).toLowerCase().includes(q)));
  $('banList').innerHTML = list.length ? '' : '<div class="empty">Nothing here</div>';
  list.forEach((p) => {
    const d = document.createElement('div'); d.className = 'item';
    d.innerHTML = '<div class="top"><span class="name">' + esc(p.name) + '<span class="tag ' + (p.active ? 'red' : '') + '">' + esc(p.type) + (p.active ? '' : ' · ended') + '</span></span><span class="muted small">' + ago(p.created) + '</span></div>'
      + '<div class="meta">' + esc(p.reason) + ' · by ' + esc(p.actor) + ' · ' + (p.active ? left(p.expires) : (p.removedBy ? 'removed by ' + esc(p.removedBy) : 'expired')) + '</div>'
      + (p.active && (p.type.includes('BAN') || p.type === 'MUTE') ? '<div class="acts"><button class="good">' + (p.type === 'MUTE' ? 'Unmute' : 'Unban') + '</button></div>' : '');
    const b = d.querySelector('.good');
    if (b) b.onclick = () => confirmAct((p.type === 'MUTE' ? 'Unmute ' : 'Unban ') + p.name + '?', (p.type === 'MUTE' ? 'dcunmute ' : 'dcunban ') + p.name, p.type === 'MUTE' ? 'Unmute' : 'Unban');
    $('banList').appendChild(d);
  });
}

$('ahSearch').oninput = renderAh; $('ahSort').onchange = renderAh;
function renderAh() {
  const all = (state.data.ah && state.data.ah.listings) || [];
  const q = $('ahSearch').value.trim().toLowerCase(), sort = $('ahSort').value;
  const list = all.filter((x) => !q || (x.item + ' ' + x.material + ' ' + x.seller).toLowerCase().includes(q));
  const by = { each: (a, b) => a.each - b.each, price: (a, b) => a.price - b.price, '-price': (a, b) => b.price - a.price, new: (a, b) => a.expires - b.expires }[sort];
  list.sort(by);
  if (list.length) {
    const eaches = list.map((x) => x.each).sort((a, b) => a - b);
    $('ahSummary').textContent = list.length + ' listings · cheapest ' + money(eaches[0]) + '/item · median ' + money(eaches[Math.floor(eaches.length / 2)]) + '/item';
  } else $('ahSummary').textContent = '';
  $('ahList').innerHTML = list.length ? '' : '<div class="empty">No listings</div>';
  list.slice(0, 300).forEach((x) => {
    const d = document.createElement('div'); d.className = 'item';
    d.innerHTML = '<div class="top"><span class="name">' + esc(x.amount) + '× ' + esc(x.item || pretty(x.material)) + '</span><span class="price">' + money(x.price) + '</span></div>'
      + '<div class="meta">' + money(x.each) + ' each · seller ' + esc(x.seller) + ' · ' + left(x.expires) + '</div>';
    $('ahList').appendChild(d);
  });
}

$('ordSearch').oninput = renderOrders;
function renderOrders() {
  const all = (state.data.orders && state.data.orders.orders) || [];
  const q = $('ordSearch').value.trim().toLowerCase();
  const list = all.filter((o) => !q || (o.material + ' ' + o.owner).toLowerCase().includes(q)).sort((a, b) => b.priceEach - a.priceEach);
  $('ordList').innerHTML = list.length ? '' : '<div class="empty">No open orders</div>';
  list.forEach((o) => {
    const pct = o.amount ? Math.round(o.filled * 100 / o.amount) : 0;
    const d = document.createElement('div'); d.className = 'item';
    d.innerHTML = '<div class="top"><span class="name">' + esc(pretty(o.material)) + '</span><span class="price">' + money(o.priceEach) + ' each</span></div>'
      + '<div class="meta">' + esc(o.filled) + ' / ' + esc(o.amount) + ' filled (' + pct + '%) · by ' + esc(o.owner) + ' · escrow ' + money(o.escrow) + '</div>';
    $('ordList').appendChild(d);
  });
}

function renderAlerts() {
  const list = (state.data.alerts && state.data.alerts.alerts) || [];
  $('alertList').innerHTML = list.length ? '' : '<div class="empty">No alerts 🎉</div>';
  list.forEach((a) => {
    const d = document.createElement('div'); d.className = 'item';
    d.innerHTML = '<div class="top"><span class="name">' + esc(a.name) + '<span class="tag red">' + esc(a.check) + '</span></span><span class="muted small">' + ago(a.ts) + '</span></div>'
      + '<div class="meta">VL ' + Number(a.vl).toFixed(1) + ' · ' + esc(a.detail) + '</div>'
      + '<div class="acts"><button data-a="h">History</button><button class="bad" data-a="b">Ban 30d</button></div>';
    d.querySelector('[data-a=h]').onclick = () => { $('banSearch').value = a.name; $('banFilter').value = 'all'; document.querySelector('[data-tab=bans]').click(); };
    d.querySelector('[data-a=b]').onclick = () => confirmAct('Ban ' + a.name + ' for 30 days (' + a.check + ')?', 'dcban ' + a.name + ' 30d Cheating (' + a.check + ')', 'Ban');
    $('alertList').appendChild(d);
  });
}

$('cmdGo').onclick = () => {
  const c = $('cmd').value.trim().replace(/^\//, '');
  if (!c) return;
  if (/[\r\n]/.test(c)) return toast('One line only');
  act(c, 'Command');
  $('cmd').value = '';
};

// ---------------------------------------------------------------- boot
if (state.key && state.server) start(); else showSetup();
