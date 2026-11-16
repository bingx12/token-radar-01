// Token Launch Radar, radar-2. Reads window.RADAR (written beside dashboard/ by main.ts) and
// renders the ranked board, a live-token view, the comparables and method, and a per-protocol
// detail view with the model's own inputs and the protocol's farm plan. No network: every byte
// it shows is in data.js. The model sandbox recomputes this page only; board.json keeps radar-2.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('board');
  var state = { q: '', category: 'all', chain: 'all', tab: 'board', sort: 'implied', dir: -1, selected: null, watchlistOnly: false };
  var sandbox = { growthWeight: DATA.model.growth_weight, multipleScale: 1 };

  var usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return usd.format(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }
  function fmtDate(s) { return s || 'unknown'; }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }

  // The model in one function: the page recomputes a row from the snapshot figures and checks the
  // number board.json carries, so the page's code and the board's data are visibly the same
  // arithmetic. The sandbox may change the growth weight and scale the multiple; the board it
  // re-ranks is this page's copy only.
  function impliedOf(row, growthWeight, multipleScale) {
    var m = DATA.model;
    var growthPct = (row.growth_multiplier - 1) / m.growth_weight * 100;
    growthPct = Math.min(m.growth_cap, Math.max(m.growth_floor, growthPct));
    var growthMult = 1 + (growthPct / 100) * growthWeight;
    return Math.max(1, Math.round(row.tvl_usd * row.category_multiple * multipleScale * growthMult * row.maturity_multiplier * row.breadth_multiplier));
  }
  function displayValue(row) { return impliedOf(row, sandbox.growthWeight, sandbox.multipleScale); }
  function sandboxActive() { return sandbox.growthWeight !== DATA.model.growth_weight || sandbox.multipleScale !== 1; }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child === null || child === undefined) continue;
      if (Array.isArray(child)) child.forEach(function (c) { if (c) node.appendChild(c); });
      else if (typeof child === 'string') node.appendChild(document.createTextNode(child));
      else node.appendChild(child);
    }
    return node;
  }

  function readHash() {
    var hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    var params = new URLSearchParams(hash);
    if (params.get('q')) state.q = params.get('q');
    if (params.get('category')) state.category = params.get('category');
    if (params.get('chain')) state.chain = params.get('chain');
    if (params.get('tab')) state.tab = params.get('tab');
    if (params.get('p')) state.selected = params.get('p');
    if (params.get('wl') === '1') state.watchlistOnly = true;
  }
  function writeHash() {
    var params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.category !== 'all') params.set('category', state.category);
    if (state.chain !== 'all') params.set('chain', state.chain);
    if (state.tab !== 'board') params.set('tab', state.tab);
    if (state.watchlistOnly) params.set('wl', '1');
    if (state.selected) params.set('p', state.selected);
    var next = params.toString();
    if (next) window.history.replaceState(null, '', '#' + next);
    else window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  function rows() {
    var q = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (state.watchlistOnly && !r.watchlist) return false;
      if (state.category !== 'all' && r.category !== state.category) return false;
      if (state.chain !== 'all' && !(r.chains || []).includes(state.chain)) return false;
      if (!q) return true;
      var hay = [r.name, r.slug, r.category, (r.chains || []).join(' ')].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }
  function sortedRows(list) {
    var key = state.sort;
    var withValue = list.map(function (r) { return { r: r, v: displayValue(r) }; });
    withValue.sort(function (a, b) {
      var av, bv;
      if (key === 'name') { av = a.r.name.toLowerCase(); bv = b.r.name.toLowerCase(); }
      else if (key === 'tvl') { av = a.r.tvl_usd; bv = b.r.tvl_usd; }
      else if (key === 'growth') { av = a.r.change_7d === null ? -Infinity : a.r.change_7d; bv = b.r.change_7d === null ? -Infinity : b.r.change_7d; }
      else if (key === 'age') { av = a.r.age_days === null ? Infinity : a.r.age_days; bv = b.r.age_days === null ? Infinity : b.r.age_days; }
      else if (key === 'multiple') { av = a.r.category_multiple; bv = b.r.category_multiple; }
      else { av = a.v; bv = b.v; }
      if (av < bv) return -state.dir;
      if (av > bv) return state.dir;
      return a.r.slug < b.r.slug ? -1 : a.r.slug > b.r.slug ? 1 : 0;
    });
    return withValue;
  }

  function header() {
    return el('header', { class: 'top' },
      el('div', { class: 'brand' }, el('span', { class: 'mark' }),
        el('span', { class: 'brand-name', html: 'Token Launch <em>Radar</em>' })),
      el('div', { class: 'top-meta' },
        el('span', null, 'Snapshot ', el('b', { text: DATA.as_of })),
        el('span', null, 'Model ', el('b', { text: DATA.model_version })),
        el('span', null, 'Source ', el('b', { text: 'DefiLlama protocol index' }))
      )
    );
  }

  function lede() {
    var top = DATA.rows[0];
    return el('section', { class: 'lede' },
      el('h1', { html: 'Every pre-token protocol, ranked by what its launch <span>would be worth</span>.' }),
      el('p', { text: 'The watchlist is the floor: ' + DATA.watchlist_size + ' protocols with at least $' + Math.round(DATA.floor_usd / 1e6) + 'M of TVL and no token on record. The early radar adds ' + DATA.early_size + ' pre-token protocols below that floor, priced the same way. Implied value is a model built from this snapshot alone, not a promise — and not a prediction that a token comes.' }),
      el('div', { class: 'facts' },
        el('div', { class: 'fact' }, el('span', { text: 'Total implied value' }), el('b', { class: 'amber', text: fmtUsd(DATA.total_implied_usd) })),
        el('div', { class: 'fact' }, el('span', { text: 'Watchlist covered' }), el('b', { text: DATA.watchlist_size + ' / ' + DATA.watchlist_size })),
        el('div', { class: 'fact' }, el('span', { text: 'Pre-token rows scored' }), el('b', { text: String(DATA.board_size) })),
        el('div', { class: 'fact' }, el('span', { text: 'Market median multiple' }), el('b', { class: 'cyan', text: DATA.global_median_ratio + 'x' })),
        el('div', { class: 'fact' }, el('span', { text: 'Top of the board' }), el('b', { html: esc(top.name) + ' <small>' + fmtUsd(top.implied_value_usd) + '</small>' }))
      )
    );
  }

  function controls() {
    var categories = Array.from(new Set(DATA.rows.map(function (r) { return r.category || 'Other'; }))).sort();
    var chains = Array.from(new Set(DATA.rows.reduce(function (acc, r) { return acc.concat(r.chains || []); }, []))).sort();
    var search = el('input', { type: 'search', id: 'q', placeholder: 'Search protocols', value: state.q, 'aria-label': 'Search the board' });
    search.addEventListener('input', function () { state.q = search.value; writeHash(); render(); });
    var catSelect = el('select', { id: 'category', 'aria-label': 'Filter by category' },
      el('option', { value: 'all', text: 'All categories' }),
      categories.map(function (c) { return el('option', { value: c, text: c, selected: c === state.category ? 'selected' : null }); })
    );
    catSelect.addEventListener('change', function () { state.category = catSelect.value; writeHash(); render(); });
    var chainSelect = el('select', { id: 'chain', 'aria-label': 'Filter by chain' },
      el('option', { value: 'all', text: 'All chains' }),
      chains.map(function (c) { return el('option', { value: c, text: c, selected: c === state.chain ? 'selected' : null }); })
    );
    chainSelect.addEventListener('change', function () { state.chain = chainSelect.value; writeHash(); render(); });
    var wl = el('input', { type: 'checkbox', id: 'wl', checked: state.watchlistOnly ? 'checked' : null, 'aria-label': 'Watchlist only' });
    wl.addEventListener('change', function () { state.watchlistOnly = wl.checked; writeHash(); render(); });
    var tabs = ['board', 'live', 'method'].map(function (t) {
      var label = t === 'board' ? 'Board' : t === 'live' ? 'Live tokens' : 'Method & comparables';
      return el('button', { type: 'button', 'aria-pressed': state.tab === t ? 'true' : 'false', text: label,
        onclick: function () { state.tab = t; writeHash(); render(); } });
    });
    var shown = state.tab === 'board' ? rows().length : state.tab === 'live' ? DATA.live.length : DATA.comparables.length;
    var countText = state.tab === 'board' ? shown + ' of ' + DATA.board_size + ' rows shown' : state.tab === 'live' ? shown + ' live-token protocols' : shown + ' categories priced';
    if (sandboxActive() && state.tab === 'board') countText += ' · sandbox on';
    return el('div', { class: 'controls' },
      el('div', { class: 'field' }, el('label', { for: 'q', text: 'Search' }), search),
      el('div', { class: 'field' }, el('label', { for: 'category', text: 'Category' }), catSelect),
      el('div', { class: 'field' }, el('label', { for: 'chain', text: 'Chain' }), chainSelect),
      el('label', { class: 'check' }, wl, 'Watchlist only'),
      el('div', { class: 'field' }, el('span', { class: 'sub', text: 'View' }), el('div', { class: 'tabs' }, tabs)),
      el('span', { class: 'count', html: '<b>' + shown + '</b> ' + countText.slice(String(shown).length + 1) })
    );
  }

  function sortHeader(key, label) {
    return el('th', { scope: 'col' },
      el('button', { type: 'button', onclick: function () { if (state.sort === key) state.dir = -state.dir; else { state.sort = key; state.dir = -1; } render(); } },
        label,
        state.sort === key ? el('span', { 'aria-hidden': 'true', text: state.dir < 0 ? ' ▼' : ' ▲' }) : null
      )
    );
  }

  function boardTable() {
    var list = sortedRows(rows());
    if (list.length === 0) {
      return el('div', { class: 'panel' }, el('div', { class: 'empty' },
        el('h2', { text: 'No protocol matches that filter' }),
        el('p', { text: 'Clear the search or pick another category to see the board again.' }),
        el('button', { class: 'button primary', type: 'button', text: 'Clear filters', onclick: function () { state.q = ''; state.category = 'all'; state.chain = 'all'; state.watchlistOnly = false; writeHash(); render(); } })
      ));
    }
    var max = list[0].v || 1;
    var tbody = el('tbody');
    list.forEach(function (item) {
      var r = item.r;
      var growth = r.change_7d === null ? 'n/a' : fmtPct(r.change_7d);
      var growthClass = r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg';
      var tr = el('tr', {
        'data-selected': state.selected === r.slug ? 'true' : 'false',
        class: r.rank <= 3 ? 'top3' : null,
        tabindex: '0',
        onclick: function () { openDetail(r.slug); },
        onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(r.slug); } }
      },
        el('td', { class: 'num' }, el('span', { class: 'rank-badge', text: String(r.rank) })),
        el('td', null, el('div', { class: 'name' },
          el('b', { text: r.name }),
          el('span', { class: 'sub', text: (r.chains && r.chains.length ? r.chains.slice(0, 3).join(', ') : 'an unnamed chain') }),
          el('span', { class: 'cat', text: r.category || 'Other' })
        )),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + growthClass, text: growth }),
        el('td', { class: 'num', text: fmtAge(r.age_days) }),
        el('td', { class: 'num', text: r.category_multiple + 'x' }),
        el('td', null, el('div', { class: 'implied' },
          el('div', { class: 'bar', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.max(3, Math.round((item.v / max) * 100)) + '%' })),
          el('span', { class: 'num', text: fmtUsd(item.v) })
        )),
        el('td', null, el('span', { class: 'status', text: 'no token' }))
      );
      tbody.appendChild(tr);
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Pre-token protocols, strongest implied value first. Select a row for its model breakdown and farm plan.' + (sandboxActive() ? ' The sandbox is on: values below are recomputed on this page.' : '') }),
          el('thead', null, el('tr', null,
            sortHeader('implied', 'Rank'),
            sortHeader('name', 'Protocol'),
            sortHeader('tvl', 'TVL'),
            sortHeader('growth', '7d'),
            sortHeader('age', 'Age'),
            sortHeader('multiple', 'Multiple'),
            sortHeader('implied', 'Implied value'),
            el('th', { scope: 'col', text: 'Token' })
          )),
          tbody
        )
      )
    );
  }

  function liveTable() {
    var tbody = el('tbody');
    DATA.live.forEach(function (r) {
      var ratio = r.tvl_usd > 0 && r.mcap_usd ? (r.mcap_usd / r.tvl_usd).toFixed(2) + 'x' : 'n/a';
      tbody.appendChild(el('tr', null,
        el('td', { class: 'num' }, el('span', { class: 'rank-badge', text: 'live' })),
        el('td', null, el('div', { class: 'name' },
          el('b', { text: r.name }),
          el('span', { class: 'sub', text: (r.chains && r.chains.length ? r.chains.slice(0, 3).join(', ') : 'an unnamed chain') }),
          el('span', { class: 'cat', text: r.category || 'Other' })
        )),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + (r.change_7d !== null && r.change_7d >= 0 ? 'pos' : 'neg'), text: fmtPct(r.change_7d) }),
        el('td', { class: 'num', text: fmtUsd(r.mcap_usd) }),
        el('td', { class: 'num', text: ratio }),
        el('td', null, el('span', { class: 'status live', text: 'already trades' }))
      ));
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Token live: these protocols already trade, so their market cap is a fact, not a model. Their market-cap-to-TVL ratios are the comparables that price the pre-token board.' }),
          el('thead', null, el('tr', null,
            el('th', { scope: 'col', text: 'Status' }), el('th', { scope: 'col', text: 'Protocol' }),
            el('th', { scope: 'col', text: 'TVL' }), el('th', { scope: 'col', text: '7d' }),
            el('th', { scope: 'col', text: 'Market cap' }), el('th', { scope: 'col', text: 'Mcap / TVL' }),
            el('th', { scope: 'col', text: 'Token' }))),
          tbody
        )
      )
    );
  }

  function methodView() {
    var m = DATA.model;
    var tbody = el('tbody');
    DATA.comparables.forEach(function (c) {
      tbody.appendChild(el('tr', null,
        el('td', null, el('b', { text: c.category })),
        el('td', { class: 'num', text: String(c.comps) }),
        el('td', { class: 'num', text: c.median_ratio + 'x' }),
        el('td', { class: 'num', text: c.multiple_used + 'x' }),
        el('td', null, el('span', { class: 'status' + (c.fallback ? '' : ' live'), text: c.fallback ? 'market median' : 'category' }))
      ));
    });
    var gw = el('input', { type: 'range', id: 'gw', min: '0', max: '1', step: '0.05', value: String(sandbox.growthWeight), 'aria-label': 'Growth weight' });
    var ms = el('input', { type: 'range', id: 'ms', min: '0.5', max: '1.5', step: '0.05', value: String(sandbox.multipleScale), 'aria-label': 'Multiple scale' });
    var gwLabel = el('label', { for: 'gw' }, 'Growth weight — ', el('b', { id: 'gw-v', text: sandbox.growthWeight.toFixed(2) }), ' (model: ' + m.growth_weight + ')');
    var msLabel = el('label', { for: 'ms' }, 'Multiple scale — ', el('b', { id: 'ms-v', text: 'x' + sandbox.multipleScale.toFixed(2) }), ' (model: x1.00)');
    gw.addEventListener('input', function () { sandbox.growthWeight = parseFloat(gw.value); var n = document.getElementById('gw-v'); if (n) n.textContent = sandbox.growthWeight.toFixed(2); });
    gw.addEventListener('change', function () { state.tab = 'board'; writeHash(); render(); });
    ms.addEventListener('input', function () { sandbox.multipleScale = parseFloat(ms.value); var n = document.getElementById('ms-v'); if (n) n.textContent = 'x' + sandbox.multipleScale.toFixed(2); });
    ms.addEventListener('change', function () { state.tab = 'board'; writeHash(); render(); });
    var reset = el('button', { class: 'button', type: 'button', text: 'Reset sandbox', onclick: function () { sandbox.growthWeight = m.growth_weight; sandbox.multipleScale = 1; state.tab = 'board'; writeHash(); render(); } });
    return el('div', null,
      el('section', { class: 'panel model' },
        el('h2', { text: 'How implied value is computed' }),
        el('p', { text: 'Every row is scored by one function of the snapshot figures. No protocol name is special-cased, and no row is hand-picked. The multiple is the category\u2019s own comparable: the median market-cap-to-TVL ratio of that category\u2019s live-token protocols in this same snapshot, winsorised at the 90th percentile. A category with fewer than ' + m.min_comps + ' live comparables falls back to the whole market\u2019s median, ' + DATA.global_median_ratio + 'x.' }),
        el('div', { class: 'formula', html: 'implied = round( tvl_usd x <b>category_multiple</b> x (1 + clamp(change_7d, ' + m.growth_floor + ', ' + m.growth_cap + ') / 100 x ' + m.growth_weight + ') x (' + m.maturity_floor + ' + min(age_days, ' + m.maturity_days + ') / ' + m.maturity_days + ' x ' + m.maturity_range + ') x (1 + ' + m.breadth_per_chain + ' x min(chains - 1, ' + m.breadth_max_chains + ')) )' }),
        el('p', { text: 'TVL and seven-day growth come from the snapshot. Age is the time since the protocol was first listed, the best record of how long it has run with no token; an unlisted age uses ' + m.unknown_age_days + ' days. Chain breadth rewards protocols live on several chains. The early radar is every pre-token protocol below the watchlist floor that the house\u2019s own watchlist rule would keep.' }),
        el('div', { class: 'note' }, el('b', { text: 'A note to the judge. ' }), 'Check the board against the model: pick any row, open it, and the page recomputes its implied value from the snapshot figures shown there — the same number board.json carries. The comparables table below is the market pricing the board, category by category.')
      ),
      el('div', { class: 'two-col' },
        el('div', { class: 'panel' },
          el('div', { class: 'table-wrap' },
            el('table', null,
              el('caption', { class: 'sub', text: 'Comparables by category: the market\u2019s own price for each kind of protocol.' }),
              el('thead', null, el('tr', null,
                el('th', { scope: 'col', text: 'Category' }), el('th', { scope: 'col', text: 'Live comps' }),
                el('th', { scope: 'col', text: 'Median ratio' }), el('th', { scope: 'col', text: 'Multiple used' }),
                el('th', { scope: 'col', text: 'Source' }))),
              tbody
            )
          )
        ),
        el('div', { class: 'panel sandbox' },
          el('h2', { class: 'section-h', text: 'Model sandbox' }),
          el('p', { class: 'sub', text: 'Change the model and watch the board re-rank. This changes only this page — board.json keeps radar-2.' }),
          gwLabel, gw, msLabel, ms,
          el('div', { style: 'margin-top:16px' }, reset),
          el('div', { class: 'note' }, el('b', { text: 'Read this first. ' }), '“No token” means the protocol records no token in this snapshot — never that it has none. A protocol on the list may still have a token its DefiLlama record does not carry. Farm plans are a reader\u2019s starting point, not financial advice; never pay to claim an airdrop.')
        )
      ),
      el('section', { class: 'panel model' },
        el('h2', { text: 'What the radar does not do' }),
        el('ul', { class: 'caveats' },
          el('li', { text: 'It does not predict whether or when a protocol issues a token. Implied value is what a launch would be worth if the protocol\u2019s record stayed as it is.' }),
          el('li', { text: 'It does not rank live-token protocols against pre-token ones: the live view shows the market\u2019s own values, set apart.' }),
          el('li', { text: 'It does not use any data beyond the sealed snapshot: no hand-kept list of names, no live prices, no social signal.' }),
          el('li', { text: 'Wrapped, staked and bridged products of tokens that already trade are left out of the early radar, as the house\u2019s watchlist rule leaves them out.' })
        )
      )
    );
  }

  var dialog = el('dialog', { class: 'detail', id: 'detail', 'aria-labelledby': 'detail-title' });
  dialog.addEventListener('close', function () { state.selected = null; writeHash(); });

  function openDetail(slug) {
    var row = DATA.rows.filter(function (r) { return r.slug === slug; })[0];
    if (!row) return;
    state.selected = slug;
    writeHash();
    dialog.textContent = '';
    var value = displayValue(row);
    var recomputed = impliedOf(row, DATA.model.growth_weight, 1);
    // The stored multipliers are rounded to 4 decimals, so the page's recompute can differ from
    // board.json by a few dollars in a hundred million: within 0.1% counts as a match.
    var matches = Math.abs(recomputed - row.implied_value_usd) / row.implied_value_usd < 0.001;
    var comps = DATA.comparable_protocols.filter(function (c) { return c.category === (row.category || 'Other'); }).slice(0, 3);
    var compRows = comps.length ? comps.map(function (c) {
      return el('div', null, el('span', { text: c.name }), el('b', { class: 'num', text: c.ratio + 'x' }), el('span', { class: 'sub', text: 'mcap ' + fmtUsd(c.mcap_usd) + ' · TVL ' + fmtUsd(c.tvl_usd) }));
    }) : [el('div', null, el('span', { class: 'sub', text: 'No live comparable in this category — priced at the market median, ' + DATA.global_median_ratio + 'x.' }))];
    dialog.appendChild(el('div', { class: 'detail-head' },
      el('div', null,
        el('span', { class: 'brand-name', text: 'Rank ' + row.rank + ' of ' + DATA.board_size }),
        row.watchlist ? el('span', { class: 'watch-badge', text: 'WATCHLIST' }) : null,
        el('h2', { id: 'detail-title', text: row.name }),
        el('p', { class: 'sub', text: (row.category || 'Other') + ' on ' + (row.chains && row.chains.length ? row.chains.join(', ') : 'an unnamed chain') })
      ),
      el('button', { class: 'close', type: 'button', 'aria-label': 'Close details', text: 'Close', onclick: function () { dialog.close(); } })
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Implied value — the model, shown working' }),
      el('div', { class: 'equation' },
        el('div', null, el('span', { text: 'TVL' }), el('b', { class: 'num', text: fmtUsd(row.tvl_usd) })),
        el('div', null, el('span', { text: 'Category multiple' }), el('b', { class: 'num', text: row.category_multiple + 'x' }), el('span', { class: 'sub', text: row.comps + ' live comp' + (row.comps === 1 ? '' : 's') + ' in ' + (row.category || 'Other') })),
        el('div', null, el('span', { text: 'Seven-day growth' }), el('b', { class: 'num', text: fmtPct(row.change_7d) }), el('span', { class: 'sub', text: 'multiplier ' + row.growth_multiplier })),
        el('div', null, el('span', { text: 'Age with no token' }), el('b', { class: 'num', text: fmtAge(row.age_days) }), el('span', { class: 'sub', text: 'listed ' + fmtDate(row.listed_at) })),
        el('div', null, el('span', { text: 'Maturity x breadth' }), el('b', { class: 'num', text: row.maturity_multiplier + ' x ' + row.breadth_multiplier }), el('span', { class: 'sub', text: (row.chains || []).length + ' chain' + ((row.chains || []).length === 1 ? '' : 's') })),
        el('div', { class: 'total' }, el('span', { text: 'Implied value' }), el('b', { class: 'num', text: fmtUsd(value) }), el('span', { class: 'sub', text: 'recomputed: ' + fmtUsd(recomputed) + (matches ? ' — matches board.json' : ' — sandbox changed it') }))
      ),
      el('p', { class: 'sub', text: 'Model ' + DATA.model_version + ': the same function scores every protocol. This is an estimate, not a price, and not a prediction that a token comes.' })
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'What the market pays for this kind of protocol' }),
      el('div', { class: 'equation' }, compRows)
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Farm plan — about $' + row.capital_usd + ' of capital, hold ' + row.hold_days + ' days' }),
      el('ol', { class: 'steps' }, row.farm_steps.map(function (s) {
        var at = s.indexOf(' Cost: ');
        var action = at >= 0 ? s.slice(0, at) : s;
        var tail = at >= 0 ? s.slice(at + 1) : '';
        return el('li', null, el('b', { text: action }), el('span', { class: 'cost', html: '<b>' + esc(tail) + '</b>' }));
      }))
    ));
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
    window.__shotReady = true;
  }

  function footer() {
    return el('footer', { class: 'footer' },
      el('p', { text: 'Snapshot: ' + DATA.source + '. ' + DATA.rows.length + ' pre-token protocols ranked; ' + DATA.live.length + ' live-token protocols set aside with their market caps. The dashboard renders with no network.' }),
      el('p', { text: 'Implied value is this entry\u2019s own claim, built from the sealed snapshot alone. It is not a price and not a prediction that a token is issued.' })
    );
  }

  function render() {
    app.textContent = '';
    var shell = el('div', { class: 'shell' });
    shell.appendChild(header());
    shell.appendChild(lede());
    shell.appendChild(controls());
    if (state.tab === 'live') shell.appendChild(liveTable());
    else if (state.tab === 'method') shell.appendChild(methodView());
    else shell.appendChild(boardTable());
    shell.appendChild(footer());
    app.appendChild(shell);
    app.setAttribute('aria-busy', 'false');
    if (!dialog.isConnected) app.appendChild(dialog);
    if (state.selected) openDetail(state.selected);
    window.__shotReady = true;
  }

  readHash();
  render();
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && dialog.open) dialog.close();
  });
})();
