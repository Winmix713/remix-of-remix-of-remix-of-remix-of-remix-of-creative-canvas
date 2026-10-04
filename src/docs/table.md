<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Premier League Standings</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    /* surfaces */
    --bg-page:        #14181b;
    --widget-bg:      #101314;
    --row-bg:         #0c0e0f;
    --row-alt:        rgba(255,255,255,0.025);
    --row-hover:      rgba(255,255,255,0.06);
    --row-active:     rgba(255,255,255,0.08);
    --header-bg:      rgba(255,255,255,0.04);
    --border:         rgba(255,255,255,0.08);
    --border-strong:  rgba(255,255,255,0.14);

    /* text */
    --text-primary:   #ffffff;
    --text-secondary: rgba(255,255,255,0.60);
    --text-muted:     rgba(255,255,255,0.45);
    --text-faint:     rgba(255,255,255,0.35);

    /* accent */
    --accent-gold:    #D4AF37;

    /* zone / semantic colors */
    --zone-cl:        #22c55e;
    --zone-el:        #3b82f6;
    --zone-conf:      #f97316;
    --zone-rel:       #ef4444;
    --gd-positive:    #4ade80;
    --gd-negative:    #f87171;

    /* type */
    --font-display: 'Inter', sans-serif;
    --font-body:    'Inter', sans-serif;
    --font-mono:    'JetBrains Mono', ui-monospace, 'SF Mono', monospace;

    /* motion */
    --ease-standard: cubic-bezier(0.4, 0, 0.2, 1);
  }

  @media (prefers-reduced-motion: reduce) {
    * { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; }
  }

  html, body { background: var(--bg-page); }

  body {
    font-family: var(--font-body);
    display: flex;
    align-items: flex-start;
    justify-content: center;
    min-height: 100vh;
    padding: 40px 16px;
  }

  .card {
    background: var(--widget-bg);
    border: 1px solid var(--border);
    border-radius: 10px;
    overflow: hidden;
    box-shadow: 0 2px 24px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.02) inset;
    width: 100%;
    max-width: 860px;
  }

  /* ───────────────────────── Header block ───────────────────────── */

  .widget-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 22px 24px 18px;
    border-bottom: 1px solid var(--border);
  }

  .header-identity { display: flex; align-items: center; gap: 14px; min-width: 0; }

  .league-crest { width: 38px; height: 38px; flex-shrink: 0; }

  .header-text { display: flex; flex-direction: column; gap: 3px; min-width: 0; }

  .eyebrow {
    font-family: var(--font-display);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--accent-gold);
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .league-title {
    font-family: var(--font-display);
    font-size: 18px;
    font-weight: 700;
    color: var(--text-primary);
    letter-spacing: -0.01em;
    line-height: 1.15;
  }

  .header-meta { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; flex-shrink: 0; }

  .live-pill {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    background: var(--zone-rel);
    color: #fff;
    font-family: var(--font-display);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    padding: 3px 8px 3px 6px;
    border-radius: 999px;
  }

  .live-dot {
    width: 6px; height: 6px;
    border-radius: 50%;
    background: #fff;
    animation: pulse 1.8s infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50%      { opacity: 0.45; transform: scale(0.8); }
  }

  .updated-at {
    font-family: var(--font-body);
    font-size: 11px;
    color: var(--text-faint);
  }

  /* ───────────────────────── Toolbar (mobile "more") ───────────────────────── */

  .toolbar {
    display: none;
    padding: 10px 24px;
    border-bottom: 1px solid var(--border);
  }

  .more-toggle {
    background: rgba(255,255,255,0.06);
    border: 1px solid var(--border-strong);
    color: var(--text-secondary);
    font-family: var(--font-display);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.03em;
    padding: 6px 12px;
    border-radius: 999px;
    cursor: pointer;
    transition: background 150ms var(--ease-standard), color 150ms var(--ease-standard);
  }
  .more-toggle:hover { background: rgba(255,255,255,0.1); color: var(--text-primary); }
  .more-toggle[aria-pressed="true"] { background: var(--accent-gold); color: #1a1508; border-color: var(--accent-gold); }

  /* ───────────────────────── Table shell ───────────────────────── */

  .table-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }
  .table-scroll::-webkit-scrollbar { height: 5px; }
  .table-scroll::-webkit-scrollbar-track { background: transparent; }
  .table-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.14); border-radius: 3px; }

  table.standings {
    width: 100%;
    min-width: 680px;
    border-collapse: collapse;
    table-layout: fixed;
  }

  col.col-rank  { width: 44px; }
  col.col-club  { width: auto; }
  col.col-stat  { width: 48px; }
  col.col-pts   { width: 56px; }

  /* header row */
  thead th {
    background: var(--header-bg);
    border-bottom: 1px solid var(--border);
    font-family: var(--font-display);
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.06em;
    color: var(--text-muted);
    text-align: right;
    padding: 12px 8px;
    white-space: nowrap;
    user-select: none;
  }
  thead th.col-rank  { text-align: center; }
  thead th.col-club  { text-align: left; padding-left: 16px; }
  thead th.col-pts   { padding-right: 16px; color: var(--text-secondary); }

  thead th.sortable { cursor: pointer; }
  thead th.sortable .th-label { border-bottom: 1px solid transparent; padding-bottom: 1px; transition: border-color 150ms var(--ease-standard); }
  thead th.sortable:hover .th-label { border-color: var(--text-muted); }

  thead th:focus-visible,
  .more-toggle:focus-visible,
  .zone-bar:focus-visible {
    outline: 2px solid rgba(255,255,255,0.5);
    outline-offset: -2px;
  }

  .sort-icon {
    display: inline-block;
    margin-left: 3px;
    font-size: 9px;
    color: var(--text-secondary);
    opacity: 0;
    transition: opacity 150ms var(--ease-standard);
  }
  th[aria-sort="descending"] .sort-icon,
  th[aria-sort="ascending"] .sort-icon { opacity: 1; }
  th[aria-sort="ascending"] .sort-icon { transform: rotate(180deg); display: inline-block; }

  /* body rows */
  tbody tr {
    height: 52px;
    background: var(--row-bg);
    transition: background 150ms var(--ease-standard);
  }
  tbody tr:nth-child(even) { background: var(--row-alt); }
  tbody tr:hover { background: var(--row-hover); }
  tbody tr.is-active { background: var(--row-active); }

  tbody tr.zone-divider-bottom td { border-bottom: 1px solid var(--border-strong); }

  tbody td {
    padding: 0 8px;
    font-family: var(--font-mono);
    font-size: 13px;
    font-variant-numeric: tabular-nums;
    color: var(--text-secondary);
    text-align: right;
    white-space: nowrap;
  }

  td.col-rank {
    text-align: center;
    font-family: var(--font-mono);
    font-size: 13px;
    font-weight: 400;
    color: var(--text-faint);
    box-shadow: inset 3px 0 0 0 var(--zone-color, transparent);
    position: relative;
  }

  .rank-move {
    display: inline-flex;
    align-items: center;
    font-size: 9px;
    font-weight: 600;
    margin-left: 3px;
    transition: opacity 600ms ease;
  }
  .rank-move.up   { color: var(--gd-positive); }
  .rank-move.down { color: var(--gd-negative); }
  .rank-move.faded { opacity: 0; }

  td.col-club {
    font-family: var(--font-body);
    text-align: left;
    padding-left: 16px;
    color: var(--text-primary);
  }

  .club-cell { display: flex; align-items: center; gap: 10px; }

  .badge {
    width: 24px; height: 24px;
    border-radius: 6px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: var(--font-display);
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.02em;
  }

  .club-name {
    font-size: 14px;
    font-weight: 500;
    letter-spacing: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  td.col-pts {
    font-weight: 600;
    color: var(--text-primary);
    padding-right: 16px;
  }

  td.col-gd { position: relative; cursor: default; }
  td.col-gd.gd-pos { color: var(--gd-positive); }
  td.col-gd.gd-neg { color: var(--gd-negative); }
  td.col-gd.gd-zero { color: var(--text-secondary); }

  /* tooltips (desktop only) */
  .has-tip { position: relative; }
  @media (hover: hover) {
    .has-tip::after {
      content: attr(data-tip);
      position: absolute;
      bottom: calc(100% + 6px);
      right: 0;
      background: #1c2124;
      color: var(--text-primary);
      font-family: var(--font-body);
      font-size: 11px;
      font-weight: 500;
      white-space: nowrap;
      padding: 6px 9px;
      border-radius: 6px;
      border: 1px solid var(--border-strong);
      box-shadow: 0 4px 16px rgba(0,0,0,0.5);
      opacity: 0;
      pointer-events: none;
      transform: translateY(4px);
      transition: opacity 150ms var(--ease-standard), transform 150ms var(--ease-standard);
      z-index: 5;
    }
    .has-tip:hover::after { opacity: 1; transform: translateY(0); }
  }

  /* collapsible columns (GF / GA / GD) */
  .collapsible { }
  @media (max-width: 640px) {
    .collapsible { display: none; }
    table.standings.show-all .collapsible { display: table-cell; }
    .toolbar { display: flex; align-items: center; justify-content: space-between; }
    table.standings { min-width: 480px; }
    table.standings.show-all { min-width: 680px; }
  }

  /* ───────────────────────── Legend ───────────────────────── */

  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    padding: 14px 24px 20px;
    border-top: 1px solid var(--border);
  }
  .legend-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-family: var(--font-body);
    font-size: 11px;
    color: var(--text-muted);
  }
  .legend-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
</style>
</head>
<body>

<div class="card">

  <!-- Header -->
  <div class="widget-header">
    <div class="header-identity">
      <svg class="league-crest" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Premier League crest">
        <defs>
          <linearGradient id="crestGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#3d0142"/>
            <stop offset="100%" stop-color="#1c001f"/>
          </linearGradient>
        </defs>
        <path d="M20 2 L36 8 L36 22 C36 30 28 37 20 39 C12 37 4 30 4 22 L4 8 Z" fill="url(#crestGrad)" stroke="#5c0068" stroke-width="0.6"/>
        <path d="M20 10 C22.5 10 24 12 24 14.5 C24 17 22.5 19 20 22 C17.5 19 16 17 16 14.5 C16 12 17.5 10 20 10 Z" fill="#00ff85"/>
        <circle cx="20" cy="14.3" r="1.6" fill="#1c001f"/>
      </svg>
      <div class="header-text">
        <span class="eyebrow">2024/25 Season · Matchday 30</span>
        <h1 class="league-title">Premier League</h1>
      </div>
    </div>
    <div class="header-meta">
      <span class="live-pill"><span class="live-dot" aria-hidden="true"></span>Live</span>
      <span class="updated-at">Updated 2 min ago</span>
    </div>
  </div>

  <!-- Mobile toolbar -->
  <div class="toolbar">
    <span class="updated-at" style="font-size:11px;">Goal stats hidden</span>
    <button class="more-toggle" id="moreToggle" type="button" aria-pressed="false">More stats</button>
  </div>

  <!-- Table -->
  <div class="table-scroll">
    <table class="standings" id="standingsTable">
      <colgroup>
        <col class="col-rank">
        <col class="col-club">
        <col class="col-stat">
        <col class="col-stat">
        <col class="col-stat">
        <col class="col-stat">
        <col class="col-stat collapsible">
        <col class="col-stat collapsible">
        <col class="col-stat collapsible">
        <col class="col-pts">
      </colgroup>
      <thead>
        <tr>
          <th class="col-rank" scope="col">#</th>
          <th class="col-club" scope="col">Club</th>
          <th class="sortable" scope="col" data-key="p" tabindex="0">P<span class="sort-icon">▾</span></th>
          <th class="sortable" scope="col" data-key="w" tabindex="0">W<span class="sort-icon">▾</span></th>
          <th class="sortable" scope="col" data-key="d" tabindex="0">D<span class="sort-icon">▾</span></th>
          <th class="sortable" scope="col" data-key="l" tabindex="0">L<span class="sort-icon">▾</span></th>
          <th class="sortable collapsible" scope="col" data-key="gf" tabindex="0">GF<span class="sort-icon">▾</span></th>
          <th class="sortable collapsible" scope="col" data-key="ga" tabindex="0">GA<span class="sort-icon">▾</span></th>
          <th class="sortable collapsible" scope="col" data-key="gd" tabindex="0">GD<span class="sort-icon">▾</span></th>
          <th class="col-pts sortable" scope="col" data-key="pts" tabindex="0" aria-sort="descending">Pts<span class="sort-icon">▾</span></th>
        </tr>
      </thead>
      <tbody id="standingsBody"></tbody>
    </table>
  </div>

  <!-- Legend -->
  <div class="legend">
    <span class="legend-item"><span class="legend-dot" style="background:var(--zone-cl);"></span>Champions League</span>
    <span class="legend-item"><span class="legend-dot" style="background:var(--zone-el);"></span>Europa League</span>
    <span class="legend-item"><span class="legend-dot" style="background:var(--zone-conf);"></span>Conference League</span>
    <span class="legend-item"><span class="legend-dot" style="background:var(--zone-rel);"></span>Relegation</span>
  </div>

</div>

<script>
(function () {
  // ── Club data (English names throughout — Option A) ──────────────
  const clubs = [
    { name: 'Manchester City',       abbr: 'MCI', color: '#1C2C5B', p: 30, w: 21, d: 5,  l: 4,  gf: 57, ga: 24, pts: 68, prevRank: 1  },
    { name: 'Liverpool',              abbr: 'LIV', color: '#C8102E', p: 30, w: 18, d: 7,  l: 5,  gf: 53, ga: 22, pts: 61, prevRank: 3  },
    { name: 'Manchester United',      abbr: 'MUN', color: '#DA291C', p: 30, w: 17, d: 7,  l: 6,  gf: 47, ga: 28, pts: 58, prevRank: 2  },
    { name: 'Everton',                abbr: 'EVE', color: '#003399', p: 30, w: 17, d: 6,  l: 7,  gf: 44, ga: 26, pts: 57, prevRank: 6  },
    { name: 'Tottenham Hotspur',      abbr: 'TOT', color: '#132257', p: 30, w: 17, d: 5,  l: 8,  gf: 47, ga: 31, pts: 56, prevRank: 4  },
    { name: 'Arsenal',                abbr: 'ARS', color: '#EF0107', p: 30, w: 14, d: 9,  l: 7,  gf: 40, ga: 31, pts: 51, prevRank: 5  },
    { name: 'Brentford',              abbr: 'BRE', color: '#E30613', p: 30, w: 13, d: 8,  l: 9,  gf: 38, ga: 28, pts: 47, prevRank: 7  },
    { name: 'Fulham',                 abbr: 'FUL', color: '#000000', p: 30, w: 12, d: 4,  l: 14, gf: 36, ga: 38, pts: 40, prevRank: 8  },
    { name: 'Crystal Palace',         abbr: 'CRY', color: '#1B458F', p: 30, w: 9,  d: 11, l: 10, gf: 22, ga: 28, pts: 38, prevRank: 9  },
    { name: 'Chelsea',                abbr: 'CHE', color: '#034694', p: 30, w: 9,  d: 8,  l: 13, gf: 31, ga: 38, pts: 35, prevRank: 10 },
    { name: 'Newcastle United',       abbr: 'NEW', color: '#1B1B1B', p: 30, w: 7,  d: 8,  l: 15, gf: 34, ga: 51, pts: 29, prevRank: 12 },
    { name: 'Nottingham Forest',      abbr: 'NFO', color: '#DD0000', p: 30, w: 6,  d: 11, l: 13, gf: 27, ga: 47, pts: 29, prevRank: 11 },
    { name: 'Wolverhampton Wanderers',abbr: 'WOL', color: '#FDB913', p: 30, w: 7,  d: 5,  l: 18, gf: 33, ga: 47, pts: 26, prevRank: 13 },
    { name: 'Aston Villa',            abbr: 'AVL', color: '#670E36', p: 30, w: 7,  d: 5,  l: 18, gf: 24, ga: 49, pts: 26, prevRank: 14 },
    { name: 'Brighton & Hove Albion', abbr: 'BHA', color: '#0057B8', p: 30, w: 6,  d: 7,  l: 17, gf: 24, ga: 47, pts: 25, prevRank: 15 },
    { name: 'West Ham United',        abbr: 'WHU', color: '#7A263A', p: 30, w: 3,  d: 8,  l: 19, gf: 27, ga: 49, pts: 17, prevRank: 16 },
  ];

  const N = clubs.length;

  // sort by points descending to establish the true, fixed league rank
  clubs.sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf);
  clubs.forEach((c, i) => {
    c.gd = c.gf - c.ga;
    c.rank = i + 1;
    c.zone = zoneFor(c.rank);
  });

  function zoneFor(rank) {
    if (rank <= 4) return { color: 'var(--zone-cl)', label: 'UEFA Champions League place' };
    if (rank === 5) return { color: 'var(--zone-el)', label: 'UEFA Europa League place' };
    if (rank === 6) return { color: 'var(--zone-conf)', label: 'UEFA Conference League place' };
    if (rank > N - 3) return { color: 'var(--zone-rel)', label: 'Relegation zone' };
    return { color: 'transparent', label: '' };
  }

  function luminance(hex) {
    const c = hex.replace('#', '');
    const r = parseInt(c.substring(0, 2), 16) / 255;
    const g = parseInt(c.substring(2, 4), 16) / 255;
    const b = parseInt(c.substring(4, 6), 16) / 255;
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  const tbody = document.getElementById('standingsBody');
  const table = document.getElementById('standingsTable');
  const dividerRanks = new Set([4, 5, N - 3]); // CL→EL, EL→Conf, →Relegation

  let sortKey = 'pts';
  let sortDir = 'desc';
  let firstRender = true;

  function buildRow(c) {
    const tr = document.createElement('tr');
    tr.dataset.rank = c.rank;
    if (dividerRanks.has(c.rank)) tr.classList.add('zone-divider-bottom');

    const textColor = luminance(c.color) > 0.5 ? '#14181b' : '#ffffff';
    const gdClass = c.gd > 0 ? 'gd-pos' : c.gd < 0 ? 'gd-neg' : 'gd-zero';
    const gdSign = c.gd > 0 ? '+' : '';

    let moveHtml = '';
    if (firstRender && c.prevRank !== c.rank) {
      const up = c.prevRank > c.rank;
      const diff = Math.abs(c.prevRank - c.rank);
      moveHtml = `<span class="rank-move ${up ? 'up' : 'down'}" data-fade="1">${up ? '▲' : '▼'}${diff}</span>`;
    }

    tr.innerHTML = `
      <td class="col-rank has-tip" style="--zone-color:${c.zone.color}" ${c.zone.label ? `data-tip="${c.zone.label}"` : ''}>${c.rank}${moveHtml}</td>
      <td class="col-club">
        <span class="club-cell">
          <span class="badge" style="background:${c.color};color:${textColor};" role="img" aria-label="${c.name} crest">${c.abbr.slice(0,2)}</span>
          <span class="club-name">${c.name}</span>
        </span>
      </td>
      <td>${c.p}</td>
      <td>${c.w}</td>
      <td>${c.d}</td>
      <td>${c.l}</td>
      <td class="collapsible">${c.gf}</td>
      <td class="collapsible">${c.ga}</td>
      <td class="col-gd collapsible ${gdClass} has-tip" data-tip="Goals For: ${c.gf} | Goals Against: ${c.ga}">${gdSign}${c.gd}</td>
      <td class="col-pts">${c.pts}</td>
    `;
    return tr;
  }

  function render(list) {
    const prevRects = new Map();
    if (!firstRender) {
      Array.from(tbody.children).forEach(tr => {
        prevRects.set(tr.dataset.rank, tr.getBoundingClientRect().top);
      });
    }

    tbody.innerHTML = '';
    list.forEach(c => tbody.appendChild(buildRow(c)));

    if (!firstRender) {
      Array.from(tbody.children).forEach(tr => {
        const prevTop = prevRects.get(tr.dataset.rank);
        if (prevTop == null) return;
        const newTop = tr.getBoundingClientRect().top;
        const delta = prevTop - newTop;
        if (delta) {
          tr.style.transition = 'none';
          tr.style.transform = `translateY(${delta}px)`;
          requestAnimationFrame(() => {
            tr.style.transition = 'transform 300ms var(--ease-standard)';
            tr.style.transform = '';
          });
        }
      });
    }

    if (firstRender) {
      setTimeout(() => {
        document.querySelectorAll('[data-fade]').forEach(el => el.classList.add('faded'));
      }, 5000);
      firstRender = false;
    }
  }

  function sortAndRender() {
    const sorted = [...clubs].sort((a, b) => {
      const diff = a[sortKey] - b[sortKey];
      return sortDir === 'desc' ? -diff : diff;
    });
    render(sorted);
  }

  document.querySelectorAll('th.sortable').forEach(th => {
    const activate = () => {
      const key = th.dataset.key;
      if (sortKey === key) {
        sortDir = sortDir === 'desc' ? 'asc' : 'desc';
      } else {
        sortKey = key;
        sortDir = 'desc';
      }
      document.querySelectorAll('th.sortable').forEach(h => h.removeAttribute('aria-sort'));
      th.setAttribute('aria-sort', sortDir === 'desc' ? 'descending' : 'ascending');
      sortAndRender();
    };
    th.addEventListener('click', activate);
    th.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); }
    });
  });

  const moreToggle = document.getElementById('moreToggle');
  moreToggle.addEventListener('click', () => {
    const expanded = table.classList.toggle('show-all');
    moreToggle.setAttribute('aria-pressed', String(expanded));
    moreToggle.textContent = expanded ? 'Fewer stats' : 'More stats';
  });

  sortAndRender();
})();
</script>
</body>
</html>
