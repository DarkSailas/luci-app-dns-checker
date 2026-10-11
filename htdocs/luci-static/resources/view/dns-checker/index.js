'use strict';
'require view';
'require fs';
'require ui';
'require dom';

var ENGINE = '/usr/bin/dns-checker-engine';
// fallback for the page header; the engine reports the installed version in "status"
var VIEW_VERSION = '1.2.7';

// These servers are recommended as the primary one only when no other one answers
var LOW_PRIORITY = { yandex: true, nextdns: true };
// The backup server has to stay reachable, so this one goes first when it answers
var BACKUP_FIRST = 'nextdns';

var OPEN_KEY = 'dnschecker.sections';
var OPEN_DEFAULT = { 'bench': true, 'config': true, 'custom': false };
// 100% on the page is the theme size times ZOOM_BASE
var ZOOM_KEY = 'dnschecker.scale';
var ZOOM_BASE = 1.25;
var ZOOM_MIN = 70, ZOOM_MAX = 150, ZOOM_STEP = 10;

var PROTO = [ [ 'udp', 'UDP (порт 53)' ], [ 'doh', 'DoH (порт 443)' ], [ 'dot', 'DoT (порт 853)' ] ];

var DEFAULT_PROVIDERS = [
	{ id: 'comss', name: 'COMSS One', location: 'RU MSK', udp: '83.220.169.155', doh: 'https://dns.comss.one/dns-query', dot: 'dns.comss.one', boot: '195.208.5.1' },
	{ id: 'comss2', name: 'COMSS Router', location: 'RU MSK', udp: '212.109.195.93', doh: 'https://router.comss.one/dns-query', dot: 'router.comss.one', boot: '195.208.5.1' },
	{ id: 'nextdns', name: 'NextDNS', location: 'Anycast', udp: '45.90.28.80', doh: 'https://dns.nextdns.io/dns-query', dot: 'dns.nextdns.io', boot: '185.222.222.222' },
	{ id: 'adguard', name: 'AdGuard DNS', location: 'SE ARN', udp: '94.140.14.14', doh: 'https://dns.adguard-dns.com/dns-query', dot: 'dns.adguard-dns.com', boot: '45.90.28.80' },
	{ id: 'cloudflare', name: 'Cloudflare', location: 'RU MSK', udp: '1.1.1.1', doh: 'https://cloudflare-dns.com/dns-query', dot: '1.1.1.1', boot: '45.90.28.80' },
	{ id: 'google', name: 'Google Public', location: 'Anycast', udp: '8.8.8.8', doh: 'https://dns.google/dns-query', dot: 'dns.google', boot: '45.90.28.80' },
	{ id: 'quad9', name: 'Quad9', location: 'FI HEL', udp: '9.9.9.9', doh: 'https://dns.quad9.net/dns-query', dot: 'dns.quad9.net', boot: '45.90.28.80' },
	{ id: 'dnssb', name: 'DNS.SB', location: 'Anycast', udp: '185.222.222.222', doh: 'https://doh.dns.sb/dns-query', dot: 'dot.sb', boot: '45.90.28.80' },
	{ id: 'he', name: 'Hurricane Electric', location: 'Anycast', udp: '74.82.42.42', doh: 'https://ordns.he.net/dns-query', dot: 'ordns.he.net', boot: '45.90.28.80' },
	{ id: 'skydns', name: 'SkyDNS', location: 'RU MSK', udp: '193.58.251.251', doh: '', dot: '', boot: '195.208.5.1' },
	{ id: 'xboxdns', name: 'XboxDNS', location: 'RU MSK', udp: '0.0.0.0', doh: 'https://xbox-dns.ru/dns-query', dot: 'xbox-dns.ru', boot: '195.208.5.1' },
	{ id: 'yandex', name: 'Yandex DNS', location: 'RU MSK', udp: '77.88.8.8', doh: 'https://common.dot.dns.yandex.net/dns-query', dot: 'common.dot.dns.yandex.net', boot: '195.208.5.1' }
];

var CHEVRON = '<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">' +
	'<path d="M3.5 6l4.5 4.5L12.5 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

var CSS = [
	'.dc-page { font-size:14px; line-height:1.45; }',
	'.dc-page h2 { font-size:18px; margin:0 0 .3em; }',
	'.dc-page .dc-top { display:flex; align-items:center; justify-content:space-between; gap:.6em; flex-wrap:wrap; margin:0 0 .3em; }',
	'.dc-page .dc-top h2 { margin:0; }',
	'.dc-zoom { display:inline-flex; align-items:center; gap:.5em; font-size:12px; }',
	'.dc-zoom-box { display:inline-flex; border:1px solid rgba(128,128,128,.45); border-radius:6px; background:rgba(128,128,128,.10); overflow:hidden; }',
	'.dc-page .dc-zoom-box button { all:unset; box-sizing:border-box; min-width:2.2em; height:26px; padding:0 .6em; font-size:12px; line-height:26px;',
	'  text-align:center; cursor:pointer; color:inherit; }',
	'.dc-page .dc-zoom-box button + button { border-left:1px solid rgba(128,128,128,.45); }',
	'.dc-page .dc-zoom-box button.dc-zoom-cur { min-width:3.8em; font-variant-numeric:tabular-nums; }',
	'.dc-page .dc-zoom-box button:hover:not(:disabled), .dc-page .dc-zoom-box button:focus-visible { color:#8ef5b5; background:rgba(142,245,181,.10); }',
	'.dc-page .dc-zoom-box button:disabled { opacity:.35; cursor:default; }',
	'.dc-sum { margin:0 0 .7em; border:1px solid rgba(128,128,128,.28); border-radius:10px; background:rgba(128,128,128,.05); }',
	'.dc-sum-top { display:flex; flex-wrap:wrap; align-items:center; gap:.6em 1.8em; padding:.7em .9em; }',
	'.dc-state { display:flex; align-items:center; gap:.7em; margin-right:auto; }',
	'.dc-dot { flex:0 0 auto; width:.6em; height:.6em; border-radius:50%; background:#8ef5b5; box-shadow:0 0 0 3px rgba(142,245,181,.18); }',
	'.dc-state-off .dc-dot { background:#f0b45a; box-shadow:0 0 0 3px rgba(240,180,90,.18); }',
	'.dc-state-t { font-size:14px; font-weight:600; white-space:nowrap; }',
	'.dc-state-off .dc-state-t { color:#f0b45a; }',
	'.dc-sum-foot { display:flex; flex-wrap:wrap; align-items:baseline; gap:.3em 2.2em;',
	'  padding:.5em .9em; border-top:1px solid rgba(128,128,128,.2); font-size:12px; }',
	'.dc-sum-foot > div { min-width:0; overflow-wrap:anywhere; }',
	'.dc-k { margin-right:.7em; font-size:11px; letter-spacing:.04em; text-transform:uppercase; opacity:.6; white-space:nowrap; }',
	'.dc-sum-foot .dc-sub, .dc-rec .dc-sub { margin-left:.5em; }',
	'.dc-pill { display:inline-block; padding:.05em .6em; margin:0 .3em .15em 0; border-radius:999px; font-size:11px; line-height:1.5; white-space:nowrap;',
	'  border:1px solid rgba(128,128,128,.4); background:rgba(128,128,128,.10); }',
	'.dc-pill-ok { border-color:rgba(142,245,181,.5); background:rgba(142,245,181,.10); color:#8ef5b5; }',
	'.dc-pill-warn { border-color:rgba(240,180,90,.5); background:rgba(240,180,90,.10); color:#f0b45a; }',
	'.dc-pill-bad { border-color:rgba(240,120,120,.5); background:rgba(240,120,120,.10); color:#f08a8a; }',
	'.dc-pills { display:inline-flex; flex-wrap:wrap; gap:4px; align-items:center; }',
	'.dc-pills .dc-pill { margin:0; }',
	'.dc-lat { min-width:4.6em; margin:0; text-align:center; font-variant-numeric:tabular-nums; }',
	'.dc-count { display:inline-block; min-width:1.6em; padding:0 .5em; margin-left:.4em; border-radius:999px; font-size:12px; font-weight:600; text-align:center;',
	'  background:rgba(142,245,181,.14); color:#8ef5b5; }',
	'.dc-main { font-weight:600; color:inherit; }',
	'.dc-sub { font-size:11px; opacity:.65; }',
	'.dc-num { font-variant-numeric:tabular-nums; }',
	'.dc-none { opacity:.4; }',
	'.dc-page .table .tr:hover .td { background:rgba(142,245,181,.05); }',
	'.dc-page .cbi-map-descr { font-size:12px; opacity:.7; margin:0 0 .8em; }',
	'.dc-page .dc-sec { margin:0 0 .6em; padding:.5em .8em; }',
	'.dc-head { display:flex; align-items:center; gap:.5em; cursor:pointer; user-select:none; }',
	'.dc-page .dc-head h3 { margin:0; padding:0; border:0; flex:1 1 auto; min-width:0; font-size:14px; line-height:1.4; font-weight:600; }',
	'.dc-chev { display:inline-flex; align-items:center; justify-content:center; flex:0 0 auto; width:20px; height:20px;',
	'  border-radius:50%; border:1px solid rgba(128,128,128,.35); opacity:.75;',
	'  transition:transform .18s ease, color .18s ease, border-color .18s ease, opacity .18s ease; }',
	'.dc-head:hover .dc-chev, .dc-head:focus-visible .dc-chev { color:#8ef5b5; border-color:#8ef5b5; opacity:1; }',
	'.dc-sec.dc-closed .dc-chev { transform:rotate(-90deg); }',
	'.dc-sec.dc-closed .dc-body { display:none; }',
	'.dc-body { margin-top:.5em; }',
	'.dc-body > :last-child { margin-bottom:0; }',
	'.dc-note { opacity:.6; font-size:12px; font-weight:normal; }',
	'.dc-page p { margin:0 0 .5em; }',
	'.dc-hint { font-size:12px; opacity:.7; }',
	'.dc-bar { display:flex; flex-wrap:wrap; align-items:center; gap:.4em .6em; margin:0 0 .5em; }',
	'.dc-upd { border:1px solid rgba(128,128,128,.35); border-radius:6px; padding:.6em .8em; margin:0 0 .8em; }',
	'.dc-upd-new { border-color:#8ef5b5; }',
	'.dc-upd > :last-child { margin-bottom:0; }',
	'.dc-rec { display:flex; flex-wrap:wrap; align-items:center; gap:.3em 1.8em; font-size:12px; }',
	'.dc-rec > .btn { margin-left:auto !important; }',
	'.dc-grid { display:grid; grid-template-columns:minmax(9em,13em) minmax(0,1fr) minmax(0,16em) 9em; gap:.45em .6em; align-items:center; margin:0 0 .7em; }',
	'.dc-grid > label { font-size:12px; font-weight:600; }',
	'.dc-grid .btn { width:100%; }',
	'@media (max-width:700px) { .dc-grid { grid-template-columns:1fr; } .dc-grid > label { margin-top:.4em; } }',
	'.dc-form { display:flex; flex-wrap:wrap; align-items:center; gap:.4em .6em; margin:0 0 .6em; }',
	'.dc-form input[type="text"] { flex:1 1 11em; min-width:0; }',
	'.dc-scroll { overflow-x:auto; }',
	'.dc-page .table { margin:0; width:100%; max-width:100%; }',
	'.dc-page .table .th, .dc-page .table .td { padding:.3em .5em; font-size:12px; line-height:1.35; vertical-align:middle; }',
	'.dc-page .table .th { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }',
	'.dc-page .table .td { overflow-wrap:anywhere; }',
	'.dc-page .btn { box-sizing:border-box; display:inline-flex; align-items:center; justify-content:center; height:26px !important; min-height:0 !important;',
	'  margin:0 !important; padding:0 .8em !important; font-size:12px !important; font-weight:500 !important; line-height:1 !important; white-space:nowrap;',
	'  text-transform:none !important; text-shadow:none !important; box-shadow:none !important; background-image:none !important;',
	'  border:1px solid rgba(128,128,128,.45) !important; border-radius:6px !important; background:rgba(128,128,128,.10) !important; color:inherit !important;',
	'  cursor:pointer; transition:color .15s ease, border-color .15s ease, background-color .15s ease; }',
	'.dc-page .btn:hover:not(:disabled), .dc-page .btn:focus-visible { border-color:#8ef5b5 !important; color:#8ef5b5 !important; background:rgba(142,245,181,.10) !important; }',
	'.dc-page .btn.cbi-button-action, .dc-page .btn.cbi-button-apply, .dc-page .btn.cbi-button-add {',
	'  border-color:rgba(142,245,181,.5) !important; background:rgba(142,245,181,.12) !important; color:#8ef5b5 !important; }',
	'.dc-page .btn.cbi-button-action:hover:not(:disabled), .dc-page .btn.cbi-button-apply:hover:not(:disabled), .dc-page .btn.cbi-button-add:hover:not(:disabled) {',
	'  border-color:#8ef5b5 !important; background:rgba(142,245,181,.22) !important; }',
	'.dc-page .btn.cbi-button-remove { border-color:rgba(240,120,120,.5) !important; background:rgba(240,120,120,.10) !important; color:#f08a8a !important; }',
	'.dc-page .btn.cbi-button-remove:hover:not(:disabled) { border-color:#f08a8a !important; background:rgba(240,120,120,.20) !important; color:#f08a8a !important; }',
	'.dc-page .btn:disabled, .dc-page .btn.spinning { opacity:.5; cursor:default; }',
	'.dc-page input[type="text"] { box-sizing:border-box; margin:0 !important; font-size:12px !important; box-shadow:none !important;',
	'  height:26px !important; min-height:0 !important; padding:0 .6em !important; line-height:24px !important;',
	'  border:1px solid rgba(128,128,128,.45) !important; border-radius:6px !important; background:rgba(128,128,128,.10) !important; color:inherit !important;',
	'  outline:none; transition:border-color .15s ease, background-color .15s ease; }',
	'.dc-page input[type="text"]:focus { border-color:#8ef5b5 !important; background:rgba(142,245,181,.06) !important; }',
	'.dc-page input[type="text"]::placeholder { color:inherit; opacity:.45; }',
	// colours of a select stay with the theme: the drop-down list is drawn by the browser
	'.dc-page select { box-sizing:border-box; width:100% !important; min-width:0 !important; height:26px !important; min-height:0 !important; margin:0 !important;',
	'  padding:0 .5em !important; font-size:12px !important; line-height:24px !important; box-shadow:none !important;',
	'  border:1px solid rgba(128,128,128,.45) !important; border-radius:6px !important; outline:none; transition:border-color .15s ease; }',
	'.dc-page select:focus { border-color:#8ef5b5 !important; }'
].join('\n');

function parseJson(str) {
	var s = (str || '').replace(/[\x00-\x1F\x7F]/g, function(c) {
		return (c === '\t' || c === '\n' || c === '\r') ? ' ' : '';
	});
	return JSON.parse(s || '{}');
}

// runs the engine and returns its JSON answer; an unreadable answer is an empty object
function engine(args) {
	return fs.exec(ENGINE, args).then(function(res) {
		try {
			return parseJson(res.stdout);
		} catch (e) {
			return {};
		}
	});
}

function notify(text, bad) {
	ui.addNotification(null, E('p', {}, text), bad ? 'error' : 'info');
}

function pill(text, tone, title) {
	return E('span', { 'class': 'dc-pill' + (tone ? ' dc-pill-' + tone : ''), 'title': title || '' }, text);
}

function fmtTime(ts) {
	var d = new Date(ts * 1000);
	var two = function(n) { return (n < 10 ? '0' : '') + n; };
	return two(d.getDate()) + '.' + two(d.getMonth() + 1) + ' ' + two(d.getHours()) + ':' + two(d.getMinutes());
}

function btn(title, cls, fn) {
	return E('button', { 'class': 'btn cbi-button ' + cls, 'click': ui.createHandlerFn(null, fn) }, title);
}

function select(options, value, onchange) {
	var s = E('select', { 'class': 'cbi-input-select', 'change': function(ev) { onchange(ev.target.value); } },
		options.map(function(o) { return E('option', { 'value': o[0] }, o[1]); }));
	s.value = value;
	if (s.selectedIndex < 0) {
		s.selectedIndex = 0;
		onchange(s.value);
	}
	return s;
}

function table(head, rows, empty, widths) {
	var t = E('table', { 'class': 'table', 'style': 'table-layout:fixed; width:100%' }, [
		E('tr', { 'class': 'tr table-titles' }, head.map(function(h, i) {
			return E('th', { 'class': 'th', 'style': 'width:' + widths[i], 'title': h }, h);
		}))
	]);
	if (!rows.length)
		t.appendChild(E('tr', { 'class': 'tr placeholder' }, E('td', { 'class': 'td', 'colspan': head.length }, E('em', empty))));
	rows.forEach(function(r) {
		t.appendChild(E('tr', { 'class': 'tr' }, r.map(function(c) {
			return E('td', { 'class': 'td' }, c);
		})));
	});
	return E('div', { 'class': 'dc-scroll' }, t);
}

// latency of one protocol: green under 25 ms, amber under 80 ms, red above
function latency(metric, hijacked) {
	if (!metric || typeof metric.latency !== 'number')
		return E('span', { 'class': 'dc-none' }, '—');
	if (metric.latency < 0)
		return pill('сбой', 'bad', 'Сервер не ответил');
	var p = hijacked
		? pill('подмена, ' + metric.latency + ' мс', 'bad', 'Ответ подменён: запросы по UDP перехватывают по дороге или сервер сам отвечает, что youtube.com не существует')
		: pill(metric.latency + ' мс', metric.latency < 25 ? 'ok' : metric.latency < 80 ? 'warn' : 'bad', metric.address || '');
	p.classList.add('dc-lat');
	return p;
}

return view.extend({
	open: null,

	isOpen: function(key) {
		if (!this.open) {
			this.open = Object.assign({}, OPEN_DEFAULT);
			try {
				var s = JSON.parse(window.localStorage.getItem(OPEN_KEY));
				if (s && typeof s == 'object')
					Object.assign(this.open, s);
			} catch (e) {}
		}
		return !!this.open[key];
	},

	setOpen: function(key, on) {
		this.isOpen(key);
		this.open[key] = on;
		try {
			window.localStorage.setItem(OPEN_KEY, JSON.stringify(this.open));
		} catch (e) {}
	},

	getZoom: function() {
		var z = 100;
		try {
			z = parseInt(window.localStorage.getItem(ZOOM_KEY), 10);
		} catch (e) {}
		if (!(z >= ZOOM_MIN && z <= ZOOM_MAX))
			z = 100;
		return z;
	},

	// page scale, kept in the browser; limited to ZOOM_MIN..ZOOM_MAX percent
	zoomBar: function(page) {
		var self = this;
		// plain handler: ui.createHandlerFn re-enables the button and would undo the limits
		var zbtn = function(title, fn) {
			return E('button', { 'type': 'button', 'click': fn }, title);
		};
		var cur = zbtn('', function() { set(100); });
		var less = zbtn('−', function() { set(self.getZoom() - ZOOM_STEP); });
		var more = zbtn('+', function() { set(self.getZoom() + ZOOM_STEP); });
		var show = function(z) {
			page.style.zoom = String(Math.round(z * ZOOM_BASE) / 100);
			cur.textContent = z + '%';
			less.disabled = z <= ZOOM_MIN;
			more.disabled = z >= ZOOM_MAX;
		};
		var set = function(z) {
			z = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));
			try {
				window.localStorage.setItem(ZOOM_KEY, String(z));
			} catch (e) {}
			show(z);
		};
		cur.title = 'Вернуть 100%';
		less.title = 'Мельче';
		more.title = 'Крупнее';
		cur.className = 'dc-zoom-cur';
		show(this.getZoom());
		return E('div', { 'class': 'dc-zoom' }, [
			E('span', {}, 'Масштаб'),
			E('div', { 'class': 'dc-zoom-box' }, [ less, cur, more ])
		]);
	},

	// collapsible section; the state survives re-rendering and page reloads
	section: function(key, title, content, note, count) {
		var self = this;
		var chev = E('span', { 'class': 'dc-chev' });
		chev.innerHTML = CHEVRON;
		var sec = E('div', { 'class': 'cbi-section dc-sec' + (self.isOpen(key) ? '' : ' dc-closed') });
		var toggle = function() {
			var on = !self.isOpen(key);
			self.setOpen(key, on);
			sec.classList.toggle('dc-closed', !on);
			head.setAttribute('aria-expanded', on ? 'true' : 'false');
		};
		var head = E('div', {
			'class': 'dc-head', 'role': 'button', 'tabindex': '0',
			'aria-expanded': self.isOpen(key) ? 'true' : 'false',
			'title': 'Свернуть или развернуть',
			'click': toggle,
			'keydown': function(ev) {
				if (ev.key == 'Enter' || ev.key == ' ') {
					ev.preventDefault();
					toggle();
				}
			}
		}, [ chev, E('h3', {}, [
			title,
			count != null ? E('span', { 'class': 'dc-count' }, String(count)) : '',
			note ? ' ' : '',
			note ? E('span', { 'class': 'dc-note' }, note) : ''
		]) ]);
		sec.appendChild(head);
		sec.appendChild(E('div', { 'class': 'dc-body' }, content));
		return sec;
	},

	load: function() {
		return Promise.all([
			fs.exec(ENGINE, [ 'status' ]),
			fs.exec(ENGINE, [ 'backup' ])
		]).then(function(results) {
			try {
				return parseJson(results[0].stdout);
			} catch (e) {
				return {};
			}
		});
	},

	render: function(initialStatus) {
		var self = this;

		var state = {
			version: initialStatus.version || VIEW_VERSION,
			podkopRunning: false,
			activePrimaryServer: '',
			activePrimaryProto: 'udp',
			activeBackupServer: '',
			activeBackupProto: 'udp',
			failover: {},
			activeWanDns: '',
			customProviders: [],
			providersList: [],
			selected: {
				primaryId: 'comss',
				primaryProto: (initialStatus.podkop && initialStatus.podkop.dns_type) || 'udp',
				backupId: 'none',
				backupProto: (initialStatus.podkop && initialStatus.podkop.backup_dns_type) || 'udp',
				wan1Id: 'auto',
				wan2Id: 'none'
			},
			benchmark: null,
			recommendations: null,
			leakResult: null,
			updateInfo: null
		};

		function matches(p, addr) {
			return p.udp === addr || p.doh === addr || p.dot === addr;
		}

		function rebuildProvidersList() {
			var list = DEFAULT_PROVIDERS.slice();
			state.customProviders.forEach(function(cp) {
				list.push({
					id: cp.id,
					name: cp.name,
					location: 'свой',
					udp: cp.udp || '0.0.0.0',
					doh: cp.doh || '',
					dot: cp.dot || '',
					boot: cp.boot || '195.208.5.1',
					is_custom: true
				});
			});
			state.providersList = list;

			// the form starts from what is configured now
			list.forEach(function(p) {
				if (state.activePrimaryServer && matches(p, state.activePrimaryServer))
					state.selected.primaryId = p.id;
				if (state.activeBackupServer && matches(p, state.activeBackupServer))
					state.selected.backupId = p.id;
			});
			var wan = state.activeWanDns ? state.activeWanDns.trim().split(/\s+/) : [];
			list.forEach(function(p) {
				if (wan.length > 0 && p.udp === wan[0])
					state.selected.wan1Id = p.id;
				if (wan.length > 1 && p.udp === wan[1])
					state.selected.wan2Id = p.id;
			});
		}

		function takeStatus(st) {
			state.podkopRunning = !!st.podkop_running;
			state.activePrimaryServer = (st.podkop && st.podkop.dns_server) || '';
			state.activePrimaryProto = (st.podkop && st.podkop.dns_type) || 'udp';
			state.activeBackupServer = (st.podkop && st.podkop.backup_dns_server) || '';
			state.activeBackupProto = (st.podkop && st.podkop.backup_dns_type) || 'udp';
			state.failover = st.failover || {};
			state.activeWanDns = st.router_wan_dns || '';
			state.customProviders = st.custom_providers || [];
			rebuildProvidersList();
		}

		function providersMap() {
			var map = {};
			state.providersList.forEach(function(p) { map[p.id] = p; });
			return map;
		}

		function wanIp(id) {
			if (!id || id === 'auto' || id === 'none')
				return '';
			var p = providersMap()[id];
			return (p && p.udp) || '';
		}

		function providerName(addr) {
			for (var i = 0; i < state.providersList.length; i++)
				if (matches(state.providersList[i], addr))
					return state.providersList[i].name;
			return null;
		}

		// "COMSS One  83.220.169.155  [UDP]" for the summary
		function dnsValue(addr, proto) {
			if (!addr || addr === 'none')
				return E('span', { 'class': 'dc-none' }, 'не настроен');
			var name = providerName(addr);
			return [
				E('strong', {}, name || addr),
				name ? E('span', { 'class': 'dc-sub dc-num' }, addr) : '',
				proto ? E('span', { 'class': 'dc-sub' }, pill(proto.toUpperCase())) : ''
			];
		}

		function useRecommendations() {
			var r = state.recommendations;
			state.selected.primaryId = r.primary.id;
			state.selected.primaryProto = r.primary.proto;
			state.selected.backupId = r.backup.id;
			state.selected.backupProto = r.backup.proto;
			state.selected.wan1Id = r.primary.id;
			state.selected.wan2Id = r.backup.id;
		}

		function primaryArgs() {
			var map = providersMap();
			var p = map[state.selected.primaryId] || map['comss'];
			return [ state.selected.primaryProto, p[state.selected.primaryProto] || p.udp, p.boot || '195.208.5.1' ];
		}

		function backupArgs() {
			var p = providersMap()[state.selected.backupId];
			var addr = (state.selected.backupId !== 'none' && p) ? (p[state.selected.backupProto] || p.udp) : 'none';
			return [ state.selected.backupProto, addr ];
		}

		// applies settings through the engine, then shows what is configured now
		function apply(args, done) {
			return engine(args).then(function(out) {
				notify(out.status === 'error' ? (out.message || 'Не удалось применить настройки') : done, out.status === 'error');
				return actions.refreshStatus();
			}).catch(function(e) {
				notify('Ошибка: ' + e.message, true);
			});
		}

		var actions = {
			refreshStatus: function() {
				return engine([ 'status' ]).then(function(st) {
					takeStatus(st);
					render();
				});
			},

			runLeakTest: function() {
				return fs.exec(ENGINE, [ 'leak_test' ]).then(function(res) {
					try {
						state.leakResult = parseJson(res.stdout);
					} catch (e) {
						state.leakResult = { error: true };
					}
					render();
				}).catch(function() {
					state.leakResult = { error: true };
					render();
				});
			},

			runBenchmark: function() {
				// the benchmark outlasts the 20 s limit of a LuCI call, so it runs in the
				// background on the router and the page asks for the result
				var deadline = Date.now() + 120000;
				var waitResult = function() {
					return new Promise(function(resolve) {
						window.setTimeout(resolve, 2000);
					}).then(function() {
						return fs.exec(ENGINE, [ 'test_result' ]).then(function(res) {
							return parseJson(res.stdout);
						}).catch(function() {
							// a single lost answer on a busy router is not a failure
							return { status: 'running' };
						});
					}).then(function(data) {
						if (data.status === 'running') {
							if (Date.now() > deadline)
								throw new Error('роутер не ответил за две минуты');
							return waitResult();
						}
						if (data.status || !data.providers)
							throw new Error('замер прервался, запустите ещё раз');
						return data;
					});
				};

				return fs.exec(ENGINE, [ 'test_start' ]).then(waitResult).then(function(data) {
					state.benchmark = data;

					var pairs = [];
					(data.providers || []).forEach(function(p) {
						[ 'udp', 'doh', 'dot' ].forEach(function(proto) {
							if (p[proto] && p[proto].latency >= 0 && !(proto === 'udp' && p.hijacked))
								pairs.push({ id: p.id, name: p.name, proto: proto, latency: p[proto].latency });
						});
					});

					if (pairs.length >= 2) {
						pairs.sort(function(a, b) {
							return (LOW_PRIORITY[a.id] ? 1 : 0) - (LOW_PRIORITY[b.id] ? 1 : 0) || a.latency - b.latency;
						});
						var best = pairs[0], second = null;
						for (var i = 1; i < pairs.length && !second; i++)
							if (pairs[i].id !== best.id)
								second = pairs[i];
						if (best.id !== BACKUP_FIRST) {
							// UDP by address works without the bootstrap server
							var reserve = pairs.filter(function(p) { return p.id === BACKUP_FIRST; });
							reserve.sort(function(a, b) {
								return (a.proto === 'udp' ? 0 : 1) - (b.proto === 'udp' ? 0 : 1) || a.latency - b.latency;
							});
							if (reserve.length)
								second = reserve[0];
						}
						state.recommendations = { primary: best, backup: second || pairs[1] };
						useRecommendations();
					}
					render();
				}).catch(function(e) {
					notify('Замер не удался: ' + e.message, true);
				});
			},

			applyPrimary: function() {
				return apply([ 'apply_primary' ].concat(primaryArgs()), 'Основной DNS Podkop сохранён');
			},

			applyBackup: function() {
				return apply([ 'apply_backup' ].concat(backupArgs()), 'Резервный DNS Podkop сохранён');
			},

			applyWan: function() {
				return apply([ 'apply_wan', wanIp(state.selected.wan1Id), wanIp(state.selected.wan2Id) ], 'DNS роутера (WAN) сохранён');
			},

			applyAll: function() {
				return apply([ 'apply' ].concat(primaryArgs(), backupArgs(), [ wanIp(state.selected.wan1Id), wanIp(state.selected.wan2Id) ]),
					'Все настройки DNS применены');
			},

			restoreBackup: function() {
				if (!confirm('Вернуть настройки DNS к тем, что были до первого применения?'))
					return;
				return apply([ 'restore' ], 'Настройки восстановлены из резервной копии');
			},

			checkUpdate: function() {
				return engine([ 'check_update' ]).then(function(info) {
					state.updateInfo = info;
					render();
				}).catch(function(e) {
					notify('Ошибка: ' + e.message, true);
				});
			},

			runUpdate: function() {
				return engine([ 'update' ]).then(function(out) {
					if (out.status === 'error')
						return notify(out.message || 'Не удалось скачать обновление', true);
					// the browser keeps the old copy of this file: fetch it past the cache before reloading
					var url = L.env.base_url + '/view/dns-checker/main.js' + (L.env.resource_version ? '?v=' + L.env.resource_version : '');
					return window.fetch(url, { cache: 'reload' }).catch(function() {}).then(function() {
						window.location.reload();
					});
				}).catch(function(e) {
					notify('Ошибка обновления: ' + e.message, true);
				});
			},

			addCustom: function(name, doh, dot, udp) {
				if (!name)
					return notify('Укажите название профиля', true);
				if (!doh && !dot && !udp)
					return notify('Укажите хотя бы один адрес: DoH, DoT или UDP', true);
				return engine([ 'add_custom', 'c_' + Date.now(), name, udp, doh, dot ]).then(function() {
					return actions.refreshStatus();
				}).catch(function(e) {
					notify('Ошибка: ' + e.message, true);
				});
			},

			deleteCustom: function(id, name) {
				if (!confirm('Удалить профиль ' + name + '?'))
					return;
				return engine([ 'del_custom', id ]).then(function() {
					return actions.refreshStatus();
				}).catch(function(e) {
					notify('Ошибка: ' + e.message, true);
				});
			}
		};

		// version and update controls, always visible at the top of the page
		function updateBar() {
			var up = state.updateInfo;
			var text = !up ? 'обновления ещё не проверялись'
				: up.has_update ? 'на GitHub вышла ' + up.remote_version
				: up.remote_version ? 'установлена последняя'
				: 'не удалось узнать версию на GitHub';

			return E('div', { 'class': 'dc-upd' + (up && up.has_update ? ' dc-upd-new' : '') }, [
				E('div', { 'class': 'dc-bar' }, [
					E('span', {}, [ 'Версия ', E('strong', {}, (up && up.local_version) || state.version), ' — ', text ]),
					btn('Проверить обновление', 'cbi-button-neutral', actions.checkUpdate),
					(up && up.has_update) ? btn('Обновить до ' + up.remote_version, 'cbi-button-apply', actions.runUpdate) : ''
				])
			]);
		}

		// what the backup server is doing right now
		function failoverPill() {
			var fo = state.failover;
			if (!fo.enabled)
				return '';
			if (!fo.running)
				return pill('слежение не запущено', 'bad', 'Служба, которая следит за основным DNS, не работает. Нажмите «Применить» у резервного DNS');
			if (fo.active && fo.tier === 'reserve')
				return pill('тоже молчит, с ' + fmtTime(fo.since) + ' работает запасной ' + fo.active_server, 'bad',
					'Основной и резервный DNS не отвечают. Podkop работает через запасной сервер внутри России и вернётся на резервный или основной, как только те ответят');
			if (fo.active && fo.hold)
				return pill('работает вместо основного с ' + fmtTime(fo.since) + ', до ночи', 'warn',
					'Основной DNS отказал второй раз за сутки. Чтобы не рвать соединения лишний раз, Podkop вернётся на него после ' + fo.hold_hour + ':00, если он будет отвечать');
			if (fo.active)
				return pill('работает вместо основного с ' + fmtTime(fo.since), 'warn',
					'Основной DNS перестал отвечать. Когда он снова будет отвечать 5 минут подряд, Podkop вернётся на него');
			return pill('на подхвате', 'ok', 'Основной DNS отвечает. Если он замолчит, Podkop перейдёт на резервный примерно за минуту' +
				(fo.reserve ? '. Если замолчит и резервный, включится запасной: ' + fo.reserve.split(' ').join(', ') : ''));
		}

		function summary() {
			var leak = state.leakResult;
			var wan = state.activeWanDns ? state.activeWanDns.trim().split(/\s+/) : [];

			return E('div', { 'class': 'dc-sum' }, [
				E('div', { 'class': 'dc-sum-top' }, [
					E('div', { 'class': 'dc-state' + (state.podkopRunning ? '' : ' dc-state-off') }, [
						E('span', { 'class': 'dc-dot' }),
						E('span', { 'class': 'dc-state-t' }, 'Podkop ' + (state.podkopRunning ? 'работает' : 'не запущен'))
					]),
					btn('Проверить утечки DNS', 'cbi-button-neutral', actions.runLeakTest)
				]),
				E('div', { 'class': 'dc-sum-foot' }, [
					E('div', {}, [ E('span', { 'class': 'dc-k' }, 'Основной DNS' ) ].concat(dnsValue(state.activePrimaryServer, state.activePrimaryProto))),
					E('div', {}, [ E('span', { 'class': 'dc-k' }, 'Резервный DNS' ) ].concat(dnsValue(state.activeBackupServer, state.activeBackupProto), failoverPill())),
					E('div', {}, [
						E('span', { 'class': 'dc-k' }, 'DNS роутера (WAN)'),
						wan.length ? E('strong', { 'class': 'dc-num' }, wan.join(', ')) : E('span', { 'class': 'dc-none' }, 'от провайдера (DHCP)')
					])
				]),
				(state.failover.enabled && state.failover.event) ? E('div', { 'class': 'dc-sum-foot' }, [
					E('div', {}, [
						E('span', { 'class': 'dc-k' }, 'Последнее переключение'),
						E('span', { 'class': 'dc-num' }, fmtTime(state.failover.event_time)),
						E('span', { 'class': 'dc-sub' }, state.failover.event)
					])
				]) : '',
				leak ? E('div', { 'class': 'dc-sum-foot' }, [
					E('div', {}, leak.error ? [
						E('span', { 'class': 'dc-k' }, 'Утечки DNS'),
						pill('проверка не удалась', 'bad')
					] : [
						E('span', { 'class': 'dc-k' }, 'Утечки DNS'),
						pill('не обнаружены', 'ok'),
						'запросы наружу отправляет ',
						E('strong', { 'class': 'dc-num' }, leak.resolver_ip || '?'),
						leak.provider ? E('span', { 'class': 'dc-sub' }, leak.provider) : ''
					])
				]) : ''
			]);
		}

		function benchSection() {
			var measured = {};
			if (state.benchmark && state.benchmark.providers)
				state.benchmark.providers.forEach(function(item) { measured[item.id] = item; });

			var rows = state.providersList.map(function(p) {
				var m = measured[p.id] || {};
				return [
					[
						E('div', { 'class': 'dc-pills' }, [
							E('span', { 'class': 'dc-main' }, p.name),
							pill((!p.is_custom && m.location) || p.location || 'Anycast', '', 'Откуда отвечает сервер'),
							m.hijacked ? pill('подмена', 'bad', 'По UDP этот сервер отдаёт подменённые ответы. По DoH и DoT он может отвечать честно') : ''
						]),
						E('div', { 'class': 'dc-sub dc-num' }, (p.udp && p.udp !== '0.0.0.0') ? p.udp : (p.doh || p.dot))
					],
					// a protocol the server does not have shows a dash, not a failure
					latency((p.udp && p.udp !== '0.0.0.0') ? m.udp : null, !!m.hijacked),
					latency(p.doh ? m.doh : null, false),
					latency(p.dot ? m.dot : null, false)
				];
			});

			var r = state.recommendations;
			var rec = function(label, x) {
				return E('div', {}, [
					E('span', { 'class': 'dc-k' }, label),
					E('strong', {}, x.name),
					E('span', { 'class': 'dc-sub' }, x.proto.toUpperCase() + ', ' + x.latency + ' мс')
				]);
			};

			return self.section('bench', 'Замер задержек', [
				E('div', { 'class': 'dc-bar' }, [
					E('span', { 'class': 'dc-hint', 'style': 'flex:1 1 20em' },
						'Каждому серверу отправляется 10 запросов по UDP, DoH и DoT, в таблице — средняя задержка. Заодно проверяется, не перехватывает ли провайдер запросы по UDP. Замер идёт до минуты. Основным Yandex DNS и NextDNS рекомендуются, только если остальные серверы не отвечают. Резервным рекомендуется Yandex DNS: от резерва нужна прежде всего доступность.'),
					btn(state.benchmark ? 'Повторить замер' : 'Запустить замер', 'cbi-button-action', actions.runBenchmark)
				]),
				r ? E('div', { 'class': 'dc-upd dc-upd-new' }, [
					E('div', { 'class': 'dc-rec' }, [
						rec('Быстрее всех', r.primary),
						rec('Запасной', r.backup),
						btn('Подставить в настройку', 'cbi-button-neutral', function() {
							useRecommendations();
							render();
						})
					]),
					E('p', { 'class': 'dc-hint', 'style': 'margin-top:.4em' },
						'Эти серверы уже выбраны в разделе «Настройка». Чтобы они заработали, нажмите там «Применить всё».')
				]) : '',
				table([ 'Сервер', 'UDP (порт 53)', 'DoH (порт 443)', 'DoT (порт 853)' ], rows, 'Серверов нет',
					[ '46%', '18%', '18%', '18%' ])
			], state.benchmark ? null : 'ещё не запускался', state.providersList.length);
		}

		function configSection() {
			var sel = state.selected;
			var names = state.providersList.map(function(p) { return [ p.id, p.name ]; });
			var plain = state.providersList.filter(function(p) {
				return p.udp && p.udp !== '0.0.0.0';
			}).map(function(p) { return [ p.id, p.name + ' (' + p.udp + ')' ]; });

			return self.section('config', 'Настройка', [
				E('p', { 'class': 'dc-hint' },
					'Каждую строку можно применить отдельно или все три сразу. Перед первым изменением прежние настройки сохраняются, к ним можно вернуться.'),
				E('p', { 'class': 'dc-hint' },
					'Резервный DNS включается сам: раз в 30 секунд проверяется основной, и если он не отвечает, Podkop переводится на резервный. Через 5 минут устойчивых ответов основной возвращается. Каждое переключение перезапускает sing-box, связь пропадает на пару секунд. Поэтому после второго отказа за сутки резервный остаётся до 4 часов утра.'),
				E('div', { 'class': 'dc-grid' }, [
					E('label', {}, 'Основной DNS Podkop'),
					select(names, sel.primaryId, function(v) { sel.primaryId = v; }),
					select(PROTO, sel.primaryProto, function(v) { sel.primaryProto = v; }),
					btn('Применить', 'cbi-button-neutral', actions.applyPrimary),

					E('label', {}, 'Резервный DNS Podkop'),
					select([ [ 'none', 'Без резервного' ] ].concat(names), sel.backupId, function(v) { sel.backupId = v; }),
					select(PROTO, sel.backupProto, function(v) { sel.backupProto = v; }),
					btn('Применить', 'cbi-button-neutral', actions.applyBackup),

					E('label', {}, 'DNS роутера (WAN)'),
					select([ [ 'auto', 'От провайдера (DHCP)' ] ].concat(plain), sel.wan1Id, function(v) { sel.wan1Id = v; }),
					select([ [ 'none', 'Без второго' ] ].concat(plain), sel.wan2Id, function(v) { sel.wan2Id = v; }),
					btn('Применить', 'cbi-button-neutral', actions.applyWan)
				]),
				E('div', { 'class': 'dc-bar' }, [
					btn('Применить всё', 'cbi-button-apply', actions.applyAll),
					btn('Вернуть прежние настройки', 'cbi-button-neutral', actions.restoreBackup)
				])
			]);
		}

		function customSection() {
			var input = function(placeholder) {
				return E('input', { 'class': 'cbi-input-text', 'type': 'text', 'placeholder': placeholder });
			};
			var name = input('Название');
			var doh = input('DoH: https://dns.nextdns.io/xxxxxx');
			var dot = input('DoT: xxxxxx.dns.nextdns.io');
			var udp = input('UDP: 45.90.28.80');
			var addr = function(v) {
				return v ? E('span', { 'class': 'dc-num' }, v) : E('span', { 'class': 'dc-none' }, '—');
			};

			var rows = state.customProviders.map(function(cp) {
				return [
					E('span', { 'class': 'dc-main' }, cp.name),
					addr(cp.doh),
					addr(cp.dot),
					addr(cp.udp),
					btn('Удалить', 'cbi-button-remove', function() { return actions.deleteCustom(cp.id, cp.name); })
				];
			});

			return self.section('custom', 'Свои серверы', [
				E('p', { 'class': 'dc-hint' },
					'Личный профиль NextDNS, AdGuard Home, Control D или любой другой сервер. Достаточно одного адреса из трёх. Сервер появится в замере и в списках настройки.'),
				E('div', { 'class': 'dc-form' }, [
					name, doh, dot, udp,
					btn('Добавить', 'cbi-button-add', function() {
						return actions.addCustom(name.value.trim(), doh.value.trim(), dot.value.trim(), udp.value.trim());
					})
				]),
				table([ 'Название', 'DoH', 'DoT', 'UDP', '' ], rows, 'Своих серверов пока нет',
					[ '20%', '30%', '24%', '14%', '12%' ])
			], null, state.customProviders.length);
		}

		var root = E('div', {});

		function render() {
			dom.content(root, [ updateBar(), summary(), benchSection(), configSection(), customSection() ]);
		}

		takeStatus(initialStatus);

		var page = E('div', { 'class': 'dc-page' });
		dom.content(page, [
			E('style', {}, CSS),
			E('div', { 'class': 'dc-top' }, [
				E('h2', {}, 'DNS Checker'),
				this.zoomBar(page)
			]),
			E('div', { 'class': 'cbi-map-descr' },
				'Сравнивает скорость DNS-серверов, проверяет перехват и утечки запросов и переключает DNS в Podkop и на роутере.'),
			root
		]);
		render();

		return page;
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
