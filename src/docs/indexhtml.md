**<html lang="en"><head>**

&#x20;   **<meta charset="UTF-8">**

&#x20;   **<meta name="viewport" content="width=device-width, initial-scale=1.0">**

&#x20;   **<title>winmix — Match Intelligence</title>**

&#x20;   **<script src="https://cdn.tailwindcss.com"></script>**

&#x20;   **<script src="https://code.iconify.design/iconify-icon/2.1.0/iconify-icon.min.js"></script>**

&#x20;   **<link rel="preconnect" href="https://fonts.googleapis.com">**

&#x20;   **<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="">**

&#x20;   **<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700\&amp;display=swap" rel="stylesheet">**

&#x20; **</head>**

&#x20; **<body class="antialiased min-h-screen" style="**

&#x20; **--shade-01:#141414; --shade-02:#101010; --shade-03:#191919; --shade-04:#222222; --shade-05:#4c4c4c;**

&#x20; **--shade-06:#727272; --shade-07:#7b7b7b; --shade-08:#e2e2e2; --shade-09:#f1f1f1; --shade-10:#fdfdfd;**

&#x20; **--primary-01:#2a85ff; --primary-02:#00a656; --primary-03:#ff381c; --primary-04:#7f5fff; --primary-05:#ff9d34;**

&#x20; **--b-surface1:#101010; --b-surface2:#191919; --b-pop:#222222; --stroke-border:#272727; --stroke-subtle:#1e1e1e;**

&#x20; **--t-primary:#f1f1f1; --t-secondary:#7b7b7b; --t-tertiary:#727272; --accent:#f52495;**

&#x20; **--shadow-depth:0px 2.15px .5px -2px #00000040, 0px 5px 1.5px -4px #08080833, 0px 6px 4px -4px #08080829, 0px 6px 13px 0px #0808081f, 0px 24px 24px -16px #08080814, 2px 4px 16px 0px #fdfdfd0d inset;**

&#x20; **--shadow-dropdown:0px 16px 48px -4px #000000bf, 0px 0px 10px 0px #00000080;**

&#x20; **background-color:var(--b-surface1); color:var(--t-primary); font-family:'Inter',ui-sans-serif,system-ui,sans-serif; color-scheme:dark;">**

&#x20;   **<div class="flex min-h-screen">**

&#x20;     **<!-- ================= SIDEBAR ================= -->**

&#x20;     **<aside id="sidebar" class="fixed inset-y-0 left-0 z-50 w-\[264px] flex-col justify-between px-4 py-5 -translate-x-full lg:translate-x-0 transition-transform duration-300 flex overflow-y-auto" style="background-color:var(--b-surface2); border-right:1px solid var(--stroke-subtle);">**

&#x20;       **<div>**

&#x20;         **<!-- Logo -->**

&#x20;         **<div class="flex items-center justify-between mb-7 px-2">**

&#x20;           **<div class="flex items-center gap-2.5">**

&#x20;             **<div class="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-semibold tracking-tighter" style="background:linear-gradient(160deg,#2a85ff,#7f5fff); color:#fdfdfd; box-shadow:var(--shadow-depth);">**

&#x20;               **wm**

&#x20;             **</div>**

&#x20;             **<div>**

&#x20;               **<p class="text-sm font-semibold tracking-tighter leading-none">**

&#x20;                 **winmix**

&#x20;               **</p>**

&#x20;               **<p class="text-xs mt-1 leading-none" style="color:var(--t-tertiary);">**

&#x20;                 **match intelligence**

&#x20;               **</p>**

&#x20;             **</div>**

&#x20;           **</div>**

&#x20;           **<button onclick="toggleSidebar()" class="lg:hidden" style="color:var(--t-secondary);">**

&#x20;             **<iconify-icon icon="solar:close-circle-linear" width="20"></iconify-icon>**

&#x20;           **</button>**

&#x20;         **</div>**



&#x20;         **<!-- Search -->**

&#x20;         **<button class="w-full flex items-center gap-2.5 px-3 h-10 rounded-xl mb-6 transition-colors" style="background-color:var(--b-surface1); border:1px solid var(--stroke-border);" onmouseover="this.style.borderColor='#3a3a3a'" onmouseout="this.style.borderColor='var(--stroke-border)'">**

&#x20;           **<iconify-icon icon="solar:magnifer-linear" width="17" style="color:var(--t-tertiary);"></iconify-icon>**

&#x20;           **<span class="text-xs" style="color:var(--t-tertiary);">**

&#x20;             **Search teams, leagues…**

&#x20;           **</span>**

&#x20;           **<span class="ml-auto text-xs px-1.5 py-0.5 rounded-md" style="background-color:var(--b-pop); color:var(--t-tertiary);">**

&#x20;             **⌘K**

&#x20;           **</span>**

&#x20;         **</button>**



&#x20;         **<p class="text-xs font-medium px-3 mb-2 uppercase" style="color:var(--t-tertiary); letter-spacing:.08em;">**

&#x20;           **Overview**

&#x20;         **</p>**

&#x20;         **<nav class="space-y-0.5 mb-6">**

&#x20;           **<a href="#" class="nav-item active flex items-center gap-3 px-3 h-10 rounded-xl text-sm transition-all">**

&#x20;             **<iconify-icon icon="solar:widget-5-linear" width="19"></iconify-icon>**

&#x20;             **Dashboard**

&#x20;           **</a>**

&#x20;           **<a href="#" class="nav-item flex items-center gap-3 px-3 h-10 rounded-xl text-sm transition-all">**

&#x20;             **<iconify-icon icon="solar:graph-new-linear" width="19"></iconify-icon>**

&#x20;             **Predictions**

&#x20;             **<span class="ml-auto text-xs px-1.5 py-0.5 rounded-md" style="background-color:#2a85ff1f; color:#2a85ff;">**

&#x20;               **24**

&#x20;             **</span>**

&#x20;           **</a>**

&#x20;           **<a href="#" class="nav-item flex items-center gap-3 px-3 h-10 rounded-xl text-sm transition-all">**

&#x20;             **<iconify-icon icon="solar:football-linear" width="19"></iconify-icon>**

&#x20;             **Fixtures**

&#x20;           **</a>**

&#x20;           **<a href="#" class="nav-item flex items-center gap-3 px-3 h-10 rounded-xl text-sm transition-all">**

&#x20;             **<iconify-icon icon="solar:cup-star-linear" width="19"></iconify-icon>**

&#x20;             **Leagues**

&#x20;           **</a>**

&#x20;         **</nav>**



&#x20;         **<p class="text-xs font-medium px-3 mb-2 uppercase" style="color:var(--t-tertiary); letter-spacing:.08em;">**

&#x20;           **Analytics**

&#x20;         **</p>**

&#x20;         **<nav class="space-y-0.5">**

&#x20;           **<a href="#match-explorer" class="nav-item flex items-center gap-3 px-3 h-10 rounded-xl text-sm transition-all">**

&#x20;             **<iconify-icon icon="solar:filter-linear" width="19"></iconify-icon>**

&#x20;             **Match Explorer**

&#x20;           **</a>**

&#x20;           **<a href="#" class="nav-item flex items-center gap-3 px-3 h-10 rounded-xl text-sm transition-all">**

&#x20;             **<iconify-icon icon="solar:chart-square-linear" width="19"></iconify-icon>**

&#x20;             **Model Lab**

&#x20;           **</a>**

&#x20;           **<a href="#" class="nav-item flex items-center gap-3 px-3 h-10 rounded-xl text-sm transition-all">**

&#x20;             **<iconify-icon icon="solar:wallet-money-linear" width="19"></iconify-icon>**

&#x20;             **Value Bets**

&#x20;           **</a>**

&#x20;           **<a href="#" class="nav-item flex items-center gap-3 px-3 h-10 rounded-xl text-sm transition-all">**

&#x20;             **<iconify-icon icon="solar:users-group-rounded-linear" width="19"></iconify-icon>**

&#x20;             **Teams**

&#x20;           **</a>**

&#x20;           **<a href="#" class="nav-item flex items-center gap-3 px-3 h-10 rounded-xl text-sm transition-all">**

&#x20;             **<iconify-icon icon="solar:settings-linear" width="19"></iconify-icon>**

&#x20;             **Settings**

&#x20;           **</a>**

&#x20;         **</nav>**

&#x20;       **</div>**



&#x20;       **<!-- Pro card -->**

&#x20;       **<div class="rounded-2xl p-4 relative overflow-hidden mt-6" style="background:linear-gradient(180deg,#f1f1f113,#ebebeb13); border:1px solid var(--stroke-border); box-shadow:var(--shadow-depth);">**

&#x20;         **<div class="absolute -top-10 -right-8 w-28 h-28 rounded-full blur-2xl" style="background:#2a85ff40;"></div>**

&#x20;         **<iconify-icon icon="solar:bolt-circle-linear" width="22" style="color:#2a85ff;"></iconify-icon>**

&#x20;         **<p class="text-sm font-medium mt-2.5">Pro Model Access</p>**

&#x20;         **<p class="text-xs mt-1 leading-relaxed" style="color:var(--t-secondary);">**

&#x20;           **xG engine, live odds feed and unlimited backtests.**

&#x20;         **</p>**

&#x20;         **<button class="w-full h-9 rounded-lg mt-3.5 text-xs font-medium transition-opacity hover:opacity-90" style="background-color:var(--primary-01); color:#fdfdfd;">**

&#x20;           **Upgrade plan**

&#x20;         **</button>**

&#x20;       **</div>**

&#x20;     **</aside>**

&#x20;     **<div id="overlay" onclick="toggleSidebar()" class="fixed inset-0 z-40 bg-black/60 hidden lg:hidden"></div>**



&#x20;     **<!-- ================= MAIN ================= -->**

&#x20;     **<main class="flex-1 lg:ml-\[264px] min-w-0">**

&#x20;       **<!-- Topbar -->**

&#x20;       **<header class="sticky top-0 z-30 flex items-center gap-3 px-4 sm:px-6 h-16" style="background-color:#101010cc; backdrop-filter:blur(16px); border-bottom:1px solid var(--stroke-subtle);">**

&#x20;         **<button onclick="toggleSidebar()" class="lg:hidden" style="color:var(--t-secondary);">**

&#x20;           **<iconify-icon icon="solar:hamburger-menu-linear" width="22"></iconify-icon>**

&#x20;         **</button>**

&#x20;         **<div class="min-w-0">**

&#x20;           **<div class="flex items-center gap-1.5 text-xs" style="color:var(--t-tertiary);">**

&#x20;             **<span>Analytics</span>**

&#x20;             **<iconify-icon icon="solar:alt-arrow-right-linear" width="12"></iconify-icon>**

&#x20;             **<span style="color:var(--t-secondary);">Dashboard</span>**

&#x20;           **</div>**

&#x20;           **<h1 class="text-lg font-semibold tracking-tight leading-tight truncate">**

&#x20;             **Match Intelligence**

&#x20;           **</h1>**

&#x20;         **</div>**



&#x20;         **<div class="ml-auto flex items-center gap-2">**

&#x20;           **<!-- Custom dropdown -->**

&#x20;           **<div class="relative hidden sm:block">**

&#x20;             **<button onclick="toggleMenu('leagueMenu')" class="flex items-center gap-2 h-9 px-3 rounded-xl text-xs transition-colors" style="background-color:var(--b-surface2); border:1px solid var(--stroke-border); color:var(--t-primary);">**

&#x20;               **<span class="w-1.5 h-1.5 rounded-full" style="background-color:var(--primary-01);"></span>**

&#x20;               **<span id="leagueLabel">Premier League</span>**

&#x20;               **<iconify-icon icon="solar:alt-arrow-down-linear" width="14" style="color:var(--t-tertiary);"></iconify-icon>**

&#x20;             **</button>**

&#x20;             **<div id="leagueMenu" class="hidden absolute right-0 mt-2 w-52 rounded-xl p-1.5 z-50" style="background-color:var(--b-pop); border:1px solid var(--stroke-border); box-shadow:var(--shadow-dropdown);">**

&#x20;               **<button onclick="pickLeague(this)" class="menu-item w-full text-left text-xs px-2.5 h-9 rounded-lg flex items-center gap-2">**

&#x20;                 **Premier League**

&#x20;               **</button>**

&#x20;               **<button onclick="pickLeague(this)" class="menu-item w-full text-left text-xs px-2.5 h-9 rounded-lg flex items-center gap-2">**

&#x20;                 **La Liga**

&#x20;               **</button>**

&#x20;               **<button onclick="pickLeague(this)" class="menu-item w-full text-left text-xs px-2.5 h-9 rounded-lg flex items-center gap-2">**

&#x20;                 **Serie A**

&#x20;               **</button>**

&#x20;               **<button onclick="pickLeague(this)" class="menu-item w-full text-left text-xs px-2.5 h-9 rounded-lg flex items-center gap-2">**

&#x20;                 **Bundesliga**

&#x20;               **</button>**

&#x20;             **</div>**

&#x20;           **</div>**



&#x20;           **<button class="w-9 h-9 rounded-xl flex items-center justify-center relative" style="background-color:var(--b-surface2); border:1px solid var(--stroke-border); color:var(--t-secondary);">**

&#x20;             **<iconify-icon icon="solar:bell-linear" width="18"></iconify-icon>**

&#x20;             **<span class="absolute top-2 right-2.5 w-1.5 h-1.5 rounded-full" style="background-color:var(--primary-03);"></span>**

&#x20;           **</button>**

&#x20;           **<div class="flex items-center gap-2.5 pl-1 sm:pl-2">**

&#x20;             **<div class="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-medium" style="background:linear-gradient(150deg,#ff9d34,#f52495); color:#fdfdfd;">**

&#x20;               **DK**

&#x20;             **</div>**

&#x20;             **<div class="hidden md:block leading-tight">**

&#x20;               **<p class="text-xs font-medium">Dániel K.</p>**

&#x20;               **<p class="text-xs" style="color:var(--t-tertiary);">Analyst</p>**

&#x20;             **</div>**

&#x20;           **</div>**

&#x20;         **</div>**

&#x20;       **</header>**



&#x20;       **<div class="p-4 sm:p-6 space-y-5">**

&#x20;         **<!-- KPI ROW -->**

&#x20;         **<section class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">**

&#x20;           **<!-- card 1 -->**

&#x20;           **<div class="rounded-2xl p-5" style="background:linear-gradient(180deg,#f1f1f10a,#ebebeb08); border:1px solid var(--stroke-border); box-shadow:var(--shadow-depth);">**

&#x20;             **<div class="flex items-center justify-between">**

&#x20;               **<span class="text-xs" style="color:var(--t-secondary);">**

&#x20;                 **Prediction accuracy**

&#x20;               **</span>**

&#x20;               **<iconify-icon icon="solar:target-linear" width="17" style="color:var(--t-tertiary);"></iconify-icon>**

&#x20;             **</div>**

&#x20;             **<p class="text-2xl font-semibold tracking-tight mt-3">87.4%</p>**

&#x20;             **<div class="flex items-center justify-between mt-3">**

&#x20;               **<span class="text-xs px-1.5 py-0.5 rounded-md" style="background-color:#00a6561f; color:var(--primary-02);">**

&#x20;                 **+4.2%**

&#x20;               **</span>**

&#x20;               **<svg width="86" height="26" viewBox="0 0 86 26" fill="none">**

&#x20;                 **<polyline points="0,20 12,17 24,19 36,11 48,14 60,7 72,9 86,3" stroke="#00a656" stroke-width="1.5" fill="none" stroke-linecap="round"></polyline>**

&#x20;               **</svg>**

&#x20;             **</div>**

&#x20;           **</div>**

&#x20;           **<!-- card 2 -->**

&#x20;           **<div class="rounded-2xl p-5" style="background:linear-gradient(180deg,#f1f1f10a,#ebebeb08); border:1px solid var(--stroke-border); box-shadow:var(--shadow-depth);">**

&#x20;             **<div class="flex items-center justify-between">**

&#x20;               **<span class="text-xs" style="color:var(--t-secondary);">**

&#x20;                 **ROI (30 days)**

&#x20;               **</span>**

&#x20;               **<iconify-icon icon="solar:chart-2-linear" width="17" style="color:var(--t-tertiary);"></iconify-icon>**

&#x20;             **</div>**

&#x20;             **<p class="text-2xl font-semibold tracking-tight mt-3">+18.9%</p>**

&#x20;             **<div class="flex items-center justify-between mt-3">**

&#x20;               **<span class="text-xs px-1.5 py-0.5 rounded-md" style="background-color:#2a85ff1f; color:var(--primary-01);">**

&#x20;                 **1,284 units**

&#x20;               **</span>**

&#x20;               **<svg width="86" height="26" viewBox="0 0 86 26" fill="none">**

&#x20;                 **<polyline points="0,22 12,18 24,20 36,14 48,10 60,12 72,6 86,4" stroke="#2a85ff" stroke-width="1.5" fill="none" stroke-linecap="round"></polyline>**

&#x20;               **</svg>**

&#x20;             **</div>**

&#x20;           **</div>**

&#x20;           **<!-- card 3 -->**

&#x20;           **<div class="rounded-2xl p-5" style="background:linear-gradient(180deg,#f1f1f10a,#ebebeb08); border:1px solid var(--stroke-border); box-shadow:var(--shadow-depth);">**

&#x20;             **<div class="flex items-center justify-between">**

&#x20;               **<span class="text-xs" style="color:var(--t-secondary);">**

&#x20;                 **Matches analysed**

&#x20;               **</span>**

&#x20;               **<iconify-icon icon="solar:football-linear" width="17" style="color:var(--t-tertiary);"></iconify-icon>**

&#x20;             **</div>**

&#x20;             **<p class="text-2xl font-semibold tracking-tight mt-3">12,480</p>**

&#x20;             **<div class="flex items-center justify-between mt-3">**

&#x20;               **<span class="text-xs" style="color:var(--t-tertiary);">**

&#x20;                 **168 today**

&#x20;               **</span>**

&#x20;               **<svg width="86" height="26" viewBox="0 0 86 26" fill="none">**

&#x20;                 **<polyline points="0,14 12,16 24,9 36,13 48,8 60,11 72,5 86,8" stroke="#7f5fff" stroke-width="1.5" fill="none" stroke-linecap="round"></polyline>**

&#x20;               **</svg>**

&#x20;             **</div>**

&#x20;           **</div>**

&#x20;           **<!-- card 4 -->**

&#x20;           **<div class="rounded-2xl p-5" style="background:linear-gradient(180deg,#f1f1f10a,#ebebeb08); border:1px solid var(--stroke-border); box-shadow:var(--shadow-depth);">**

&#x20;             **<div class="flex items-center justify-between">**

&#x20;               **<span class="text-xs" style="color:var(--t-secondary);">**

&#x20;                 **Open value bets**

&#x20;               **</span>**

&#x20;               **<iconify-icon icon="solar:bolt-linear" width="17" style="color:var(--t-tertiary);"></iconify-icon>**

&#x20;             **</div>**

&#x20;             **<p class="text-2xl font-semibold tracking-tight mt-3">31</p>**

&#x20;             **<div class="flex items-center justify-between mt-3">**

&#x20;               **<span class="text-xs px-1.5 py-0.5 rounded-md" style="background-color:#ff9d341f; color:var(--primary-05);">**

&#x20;                 **7 high edge**

&#x20;               **</span>**

&#x20;               **<svg width="86" height="26" viewBox="0 0 86 26" fill="none">**

&#x20;                 **<polyline points="0,10 12,13 24,7 36,15 48,9 60,16 72,10 86,12" stroke="#ff9d34" stroke-width="1.5" fill="none" stroke-linecap="round"></polyline>**

&#x20;               **</svg>**

&#x20;             **</div>**

&#x20;           **</div>**

&#x20;         **</section>**



&#x20;         **<!-- MAIN GRID -->**

&#x20;         **<section class="grid grid-cols-1 xl:grid-cols-3 gap-5">**

&#x20;           **<!-- Predictions panel -->**

&#x20;           **<div class="xl:col-span-2 rounded-2xl overflow-hidden" style="background-color:var(--b-surface2); border:1px solid var(--stroke-border); box-shadow:var(--shadow-depth);">**

&#x20;             **<div class="flex flex-wrap items-center gap-3 p-5" style="border-bottom:1px solid var(--stroke-subtle);">**

&#x20;               **<div>**

&#x20;                 **<h2 class="text-sm font-medium">Today’s predictions</h2>**

&#x20;                 **<p class="text-xs mt-0.5" style="color:var(--t-tertiary);">**

&#x20;                   **Poisson + xG ensemble · updated 2 min ago**

&#x20;                 **</p>**

&#x20;               **</div>**

&#x20;               **<div class="ml-auto flex items-center gap-2">**

&#x20;                 **<!-- segmented -->**

&#x20;                 **<div class="flex p-0.5 rounded-xl" style="background-color:var(--b-surface1); border:1px solid var(--stroke-border);">**

&#x20;                   **<button onclick="setTab(this)" class="seg-tab active text-xs px-3 h-7 rounded-lg transition-all">**

&#x20;                     **All**

&#x20;                   **</button>**

&#x20;                   **<button onclick="setTab(this)" class="seg-tab text-xs px-3 h-7 rounded-lg transition-all">**

&#x20;                     **Live**

&#x20;                   **</button>**

&#x20;                   **<button onclick="setTab(this)" class="seg-tab text-xs px-3 h-7 rounded-lg transition-all">**

&#x20;                     **Value**

&#x20;                   **</button>**

&#x20;                 **</div>**

&#x20;                 **<button class="w-8 h-8 rounded-lg flex items-center justify-center" style="background-color:var(--b-surface1); border:1px solid var(--stroke-border); color:var(--t-secondary);">**

&#x20;                   **<iconify-icon icon="solar:tuning-2-linear" width="16"></iconify-icon>**

&#x20;                 **</button>**

&#x20;               **</div>**

&#x20;             **</div>**



&#x20;             **<!-- table head -->**

&#x20;             **<div class="hidden md:grid grid-cols-12 gap-3 px-5 py-2.5 text-xs" style="color:var(--t-tertiary); border-bottom:1px solid var(--stroke-subtle);">**

&#x20;               **<div class="col-span-4">Fixture</div>**

&#x20;               **<div class="col-span-4">Outcome probability</div>**

&#x20;               **<div class="col-span-2 text-center">Model pick</div>**

&#x20;               **<div class="col-span-2 text-right">Edge</div>**

&#x20;             **</div>**



&#x20;             **<div id="rows">**

&#x20;               **<!-- row template repeated -->**

&#x20;               **<div class="grid grid-cols-1 md:grid-cols-12 gap-3 px-5 py-4 items-center transition-colors" style="border-bottom:1px solid var(--stroke-subtle);" onmouseover="this.style.backgroundColor='#ffffff05'" onmouseout="this.style.backgroundColor='transparent'">**

&#x20;                 **<div class="md:col-span-4 flex items-center gap-3">**

&#x20;                   **<div class="flex -space-x-2">**

&#x20;                     **<div class="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-medium" style="background-color:#22222f; color:#b1e5fc; border:1px solid var(--stroke-border);">**

&#x20;                       **ARS**

&#x20;                     **</div>**

&#x20;                     **<div class="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-medium" style="background-color:#2b1a1a; color:#ffbc99; border:1px solid var(--stroke-border);">**

&#x20;                       **MCI**

&#x20;                     **</div>**

&#x20;                   **</div>**

&#x20;                   **<div class="min-w-0">**

&#x20;                     **<p class="text-xs font-medium truncate">**

&#x20;                       **Arsenal**

&#x20;                       **<span style="color:var(--t-tertiary);">vs</span>**

&#x20;                       **Man City**

&#x20;                     **</p>**

&#x20;                     **<p class="text-xs mt-0.5 flex items-center gap-1.5" style="color:var(--t-tertiary);">**

&#x20;                       **<span class="w-1.5 h-1.5 rounded-full animate-pulse" style="background-color:var(--primary-03);"></span>**

&#x20;                       **LIVE 62’ · 1–1**

&#x20;                     **</p>**

&#x20;                   **</div>**

&#x20;                 **</div>**

&#x20;                 **<div class="md:col-span-4">**

&#x20;                   **<div class="flex h-2 rounded-full overflow-hidden gap-0.5">**

&#x20;                     **<div style="width:46%; background-color:var(--primary-01);"></div>**

&#x20;                     **<div style="width:26%; background-color:var(--shade-05);"></div>**

&#x20;                     **<div style="width:28%; background-color:var(--primary-05);"></div>**

&#x20;                   **</div>**

&#x20;                   **<div class="flex justify-between text-xs mt-1.5" style="color:var(--t-tertiary);">**

&#x20;                     **<span>1 · 46%</span>**

&#x20;                     **<span>X · 26%</span>**

&#x20;                     **<span>2 · 28%</span>**

&#x20;                   **</div>**

&#x20;                 **</div>**

&#x20;                 **<div class="md:col-span-2 md:text-center">**

&#x20;                   **<span class="text-xs px-2 py-1 rounded-lg inline-block" style="background-color:#2a85ff1f; color:var(--primary-01);">**

&#x20;                     **Home · 2.10**

&#x20;                   **</span>**

&#x20;                 **</div>**

&#x20;                 **<div class="md:col-span-2 md:text-right">**

&#x20;                   **<span class="text-xs font-medium" style="color:var(--primary-02);">**

&#x20;                     **+6.4%**

&#x20;                   **</span>**

&#x20;                 **</div>**

&#x20;               **</div>**



&#x20;               **<div class="grid grid-cols-1 md:grid-cols-12 gap-3 px-5 py-4 items-center transition-colors" style="border-bottom:1px solid var(--stroke-subtle);" onmouseover="this.style.backgroundColor='#ffffff05'" onmouseout="this.style.backgroundColor='transparent'">**

&#x20;                 **<div class="md:col-span-4 flex items-center gap-3">**

&#x20;                   **<div class="flex -space-x-2">**

&#x20;                     **<div class="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-medium" style="background-color:#1c2a1c; color:#b5e4ca; border:1px solid var(--stroke-border);">**

&#x20;                       **LIV**

&#x20;                     **</div>**

&#x20;                     **<div class="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-medium" style="background-color:#26222f; color:#cabdff; border:1px solid var(--stroke-border);">**

&#x20;                       **CHE**

&#x20;                     **</div>**

&#x20;                   **</div>**

&#x20;                   **<div class="min-w-0">**

&#x20;                     **<p class="text-xs font-medium truncate">**

&#x20;                       **Liverpool**

&#x20;                       **<span style="color:var(--t-tertiary);">vs</span>**

&#x20;                       **Chelsea**

&#x20;                     **</p>**

&#x20;                     **<p class="text-xs mt-0.5" style="color:var(--t-tertiary);">**

&#x20;                       **Today · 20:45 · Anfield**

&#x20;                     **</p>**

&#x20;                   **</div>**

&#x20;                 **</div>**

&#x20;                 **<div class="md:col-span-4">**

&#x20;                   **<div class="flex h-2 rounded-full overflow-hidden gap-0.5">**

&#x20;                     **<div style="width:58%; background-color:var(--primary-01);"></div>**

&#x20;                     **<div style="width:22%; background-color:var(--shade-05);"></div>**

&#x20;                     **<div style="width:20%; background-color:var(--primary-05);"></div>**

&#x20;                   **</div>**

&#x20;                   **<div class="flex justify-between text-xs mt-1.5" style="color:var(--t-tertiary);">**

&#x20;                     **<span>1 · 58%</span>**

&#x20;                     **<span>X · 22%</span>**

&#x20;                     **<span>2 · 20%</span>**

&#x20;                   **</div>**

&#x20;                 **</div>**

&#x20;                 **<div class="md:col-span-2 md:text-center">**

&#x20;                   **<span class="text-xs px-2 py-1 rounded-lg inline-block" style="background-color:#00a6561f; color:var(--primary-02);">**

&#x20;                     **Over 2.5**

&#x20;                   **</span>**

&#x20;                 **</div>**

&#x20;                 **<div class="md:col-span-2 md:text-right">**

&#x20;                   **<span class="text-xs font-medium" style="color:var(--primary-02);">**

&#x20;                     **+9.1%**

&#x20;                   **</span>**

&#x20;                 **</div>**

&#x20;               **</div>**



&#x20;               **<div class="grid grid-cols-1 md:grid-cols-12 gap-3 px-5 py-4 items-center transition-colors" style="border-bottom:1px solid var(--stroke-subtle);" onmouseover="this.style.backgroundColor='#ffffff05'" onmouseout="this.style.backgroundColor='transparent'">**

&#x20;                 **<div class="md:col-span-4 flex items-center gap-3">**

&#x20;                   **<div class="flex -space-x-2">**

&#x20;                     **<div class="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-medium" style="background-color:#2b2a1a; color:#ffd88d; border:1px solid var(--stroke-border);">**

&#x20;                       **TOT**

&#x20;                     **</div>**

&#x20;                     **<div class="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-medium" style="background-color:#2b1a1a; color:#ffbc99; border:1px solid var(--stroke-border);">**

&#x20;                       **NEW**

&#x20;                     **</div>**

&#x20;                   **</div>**

&#x20;                   **<div class="min-w-0">**

&#x20;                     **<p class="text-xs font-medium truncate">**

&#x20;                       **Tottenham**

&#x20;                       **<span style="color:var(--t-tertiary);">vs</span>**

&#x20;                       **Newcastle**

&#x20;                     **</p>**

&#x20;                     **<p class="text-xs mt-0.5" style="color:var(--t-tertiary);">**

&#x20;                       **Tomorrow · 16:00**

&#x20;                     **</p>**

&#x20;                   **</div>**

&#x20;                 **</div>**

&#x20;                 **<div class="md:col-span-4">**

&#x20;                   **<div class="flex h-2 rounded-full overflow-hidden gap-0.5">**

&#x20;                     **<div style="width:38%; background-color:var(--primary-01);"></div>**

&#x20;                     **<div style="width:29%; background-color:var(--shade-05);"></div>**

&#x20;                     **<div style="width:33%; background-color:var(--primary-05);"></div>**

&#x20;                   **</div>**

&#x20;                   **<div class="flex justify-between text-xs mt-1.5" style="color:var(--t-tertiary);">**

&#x20;                     **<span>1 · 38%</span>**

&#x20;                     **<span>X · 29%</span>**

&#x20;                     **<span>2 · 33%</span>**

&#x20;                   **</div>**

&#x20;                 **</div>**

&#x20;                 **<div class="md:col-span-2 md:text-center">**

&#x20;                   **<span class="text-xs px-2 py-1 rounded-lg inline-block" style="background-color:#7272721f; color:var(--t-secondary);">**

&#x20;                     **Draw · 3.40**

&#x20;                   **</span>**

&#x20;                 **</div>**

&#x20;                 **<div class="md:col-span-2 md:text-right">**

&#x20;                   **<span class="text-xs font-medium" style="color:var(--t-tertiary);">**

&#x20;                     **+1.2%**

&#x20;                   **</span>**

&#x20;                 **</div>**

&#x20;               **</div>**



&#x20;               **<div class="grid grid-cols-1 md:grid-cols-12 gap-3 px-5 py-4 items-center transition-colors" onmouseover="this.style.backgroundColor='#ffffff05'" onmouseout="this.style.backgroundColor='transparent'">**

&#x20;                 **<div class="md:col-span-4 flex items-center gap-3">**

&#x20;                   **<div class="flex -space-x-2">**

&#x20;                     **<div class="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-medium" style="background-color:#1a2530; color:#b1e5fc; border:1px solid var(--stroke-border);">**

&#x20;                       **BHA**

&#x20;                     **</div>**

&#x20;                     **<div class="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-medium" style="background-color:#221f2e; color:#cabdff; border:1px solid var(--stroke-border);">**

&#x20;                       **AVL**

&#x20;                     **</div>**

&#x20;                   **</div>**

&#x20;                   **<div class="min-w-0">**

&#x20;                     **<p class="text-xs font-medium truncate">**

&#x20;                       **Brighton**

&#x20;                       **<span style="color:var(--t-tertiary);">vs</span>**

&#x20;                       **Aston Villa**

&#x20;                     **</p>**

&#x20;                     **<p class="text-xs mt-0.5" style="color:var(--t-tertiary);">**

&#x20;                       **Sat · 18:30**

&#x20;                     **</p>**

&#x20;                   **</div>**

&#x20;                 **</div>**

&#x20;                 **<div class="md:col-span-4">**

&#x20;                   **<div class="flex h-2 rounded-full overflow-hidden gap-0.5">**

&#x20;                     **<div style="width:31%; background-color:var(--primary-01);"></div>**

&#x20;                     **<div style="width:24%; background-color:var(--shade-05);"></div>**

&#x20;                     **<div style="width:45%; background-color:var(--primary-05);"></div>**

&#x20;                   **</div>**

&#x20;                   **<div class="flex justify-between text-xs mt-1.5" style="color:var(--t-tertiary);">**

&#x20;                     **<span>1 · 31%</span>**

&#x20;                     **<span>X · 24%</span>**

&#x20;                     **<span>2 · 45%</span>**

&#x20;                   **</div>**

&#x20;                 **</div>**

&#x20;                 **<div class="md:col-span-2 md:text-center">**

&#x20;                   **<span class="text-xs px-2 py-1 rounded-lg inline-block" style="background-color:#ff9d341f; color:var(--primary-05);">**

&#x20;                     **Away · 2.35**

&#x20;                   **</span>**

&#x20;                 **</div>**

&#x20;                 **<div class="md:col-span-2 md:text-right">**

&#x20;                   **<span class="text-xs font-medium" style="color:var(--primary-02);">**

&#x20;                     **+7.8%**

&#x20;                   **</span>**

&#x20;                 **</div>**

&#x20;               **</div>**

&#x20;             **</div>**



&#x20;             **<div class="flex items-center justify-between px-5 py-3.5" style="border-top:1px solid var(--stroke-subtle);">**

&#x20;               **<p class="text-xs" style="color:var(--t-tertiary);">**

&#x20;                 **Showing 4 of 24 fixtures**

&#x20;               **</p>**

&#x20;               **<button class="text-xs flex items-center gap-1.5 transition-colors" style="color:var(--primary-01);">**

&#x20;                 **View all**

&#x20;                 **<iconify-icon icon="solar:arrow-right-linear" width="14"></iconify-icon>**

&#x20;               **</button>**

&#x20;             **</div>**

&#x20;           **</div>**



&#x20;           **<!-- Right column -->**

&#x20;           **<div class="space-y-5">**

&#x20;             **<!-- Model accuracy -->**

&#x20;             **<div class="rounded-2xl p-5" style="background-color:var(--b-surface2); border:1px solid var(--stroke-border); box-shadow:var(--shadow-depth);">**

&#x20;               **<div class="flex items-start justify-between">**

&#x20;                 **<div>**

&#x20;                   **<h2 class="text-sm font-medium">Model performance</h2>**

&#x20;                   **<p class="text-xs mt-0.5" style="color:var(--t-tertiary);">**

&#x20;                     **Last 500 predictions**

&#x20;                   **</p>**

&#x20;                 **</div>**

&#x20;                 **<iconify-icon icon="solar:widget-6-linear" width="17" style="color:var(--t-tertiary);"></iconify-icon>**

&#x20;               **</div>**



&#x20;               **<div class="flex items-center gap-5 mt-5">**

&#x20;                 **<div class="relative w-\[112px] h-\[112px] shrink-0">**

&#x20;                   **<svg viewBox="0 0 120 120" class="w-full h-full -rotate-90">**

&#x20;                     **<circle cx="60" cy="60" r="50" stroke="#222222" stroke-width="12" fill="none"></circle>**

&#x20;                     **<circle cx="60" cy="60" r="50" stroke="#2a85ff" stroke-width="12" fill="none" stroke-linecap="round" stroke-dasharray="314" stroke-dashoffset="72"></circle>**

&#x20;                     **<circle cx="60" cy="60" r="50" stroke="#00a656" stroke-width="12" fill="none" stroke-linecap="round" stroke-dasharray="314" stroke-dashoffset="250" transform="rotate(198 60 60)"></circle>**

&#x20;                   **</svg>**

&#x20;                   **<div class="absolute inset-0 flex flex-col items-center justify-center">**

&#x20;                     **<p class="text-lg font-semibold tracking-tight leading-none">**

&#x20;                       **77%**

&#x20;                     **</p>**

&#x20;                     **<p class="text-xs mt-1" style="color:var(--t-tertiary);">**

&#x20;                       **hit rate**

&#x20;                     **</p>**

&#x20;                   **</div>**

&#x20;                 **</div>**

&#x20;                 **<div class="space-y-2.5 min-w-0">**

&#x20;                   **<div class="flex items-center gap-2">**

&#x20;                     **<span class="w-2 h-2 rounded-full" style="background-color:var(--primary-01);"></span>**

&#x20;                     **<span class="text-xs" style="color:var(--t-secondary);">**

&#x20;                       **1X2**

&#x20;                     **</span>**

&#x20;                     **<span class="text-xs ml-auto">72%</span>**

&#x20;                   **</div>**

&#x20;                   **<div class="flex items-center gap-2">**

&#x20;                     **<span class="w-2 h-2 rounded-full" style="background-color:var(--primary-02);"></span>**

&#x20;                     **<span class="text-xs" style="color:var(--t-secondary);">**

&#x20;                       **O/U 2.5**

&#x20;                     **</span>**

&#x20;                     **<span class="text-xs ml-auto">81%</span>**

&#x20;                   **</div>**

&#x20;                   **<div class="flex items-center gap-2">**

&#x20;                     **<span class="w-2 h-2 rounded-full" style="background-color:var(--shade-04);"></span>**

&#x20;                     **<span class="text-xs" style="color:var(--t-secondary);">**

&#x20;                       **BTTS**

&#x20;                     **</span>**

&#x20;                     **<span class="text-xs ml-auto">69%</span>**

&#x20;                   **</div>**

&#x20;                 **</div>**

&#x20;               **</div>**



&#x20;               **<div class="mt-5 pt-4 space-y-3" style="border-top:1px solid var(--stroke-subtle);">**

&#x20;                 **<div class="flex items-center justify-between">**

&#x20;                   **<div>**

&#x20;                     **<p class="text-xs">Live odds sync</p>**

&#x20;                     **<p class="text-xs mt-0.5" style="color:var(--t-tertiary);">**

&#x20;                       **Refresh every 30s**

&#x20;                     **</p>**

&#x20;                   **</div>**

&#x20;                   **<button onclick="toggleSwitch(this)" data-on="true" class="w-10 h-6 rounded-full p-0.5 flex items-center transition-all" style="background-color:var(--primary-01);">**

&#x20;                     **<span class="w-5 h-5 rounded-full bg-white transition-transform" style="transform:translateX(16px); box-shadow:0 1px 3px #00000066;"></span>**

&#x20;                   **</button>**

&#x20;                 **</div>**

&#x20;                 **<div class="flex items-center justify-between">**

&#x20;                   **<div>**

&#x20;                     **<p class="text-xs">Hide low-confidence</p>**

&#x20;                     **<p class="text-xs mt-0.5" style="color:var(--t-tertiary);">**

&#x20;                       **Below 55% probability**

&#x20;                     **</p>**

&#x20;                   **</div>**

&#x20;                   **<button onclick="toggleSwitch(this)" data-on="false" class="w-10 h-6 rounded-full p-0.5 flex items-center transition-all" style="background-color:var(--shade-04);">**

&#x20;                     **<span class="w-5 h-5 rounded-full transition-transform" style="background-color:var(--shade-06); transform:translateX(0px);"></span>**

&#x20;                   **</button>**

&#x20;                 **</div>**

&#x20;               **</div>**

&#x20;             **</div>**



&#x20;             **<!-- Value bet finder -->**

&#x20;             **<div class="rounded-2xl p-5" style="background-color:var(--b-surface2); border:1px solid var(--stroke-border); box-shadow:var(--shadow-depth);">**

&#x20;               **<h2 class="text-sm font-medium">Value bet finder</h2>**

&#x20;               **<p class="text-xs mt-0.5 mb-4" style="color:var(--t-tertiary);">**

&#x20;                 **Filter fixtures by minimum edge**

&#x20;               **</p>**



&#x20;               **<div class="flex items-center justify-between mb-2">**

&#x20;                 **<span class="text-xs" style="color:var(--t-secondary);">**

&#x20;                   **Minimum edge**

&#x20;                 **</span>**

&#x20;                 **<span id="sliderVal" class="text-xs font-medium">5.0%</span>**

&#x20;               **</div>**

&#x20;               **<div id="track" class="relative h-1.5 rounded-full cursor-pointer mb-5" style="background-color:var(--shade-04);">**

&#x20;                 **<div id="fill" class="absolute h-full rounded-full" style="width:33%; background-color:var(--primary-01);"></div>**

&#x20;                 **<div id="thumb" class="absolute w-4 h-4 rounded-full -top-\[5px] -ml-2" style="left:33%; background-color:#fdfdfd; box-shadow:0 2px 6px #00000080;"></div>**

&#x20;               **</div>**



&#x20;               **<div class="space-y-2.5">**

&#x20;                 **<label class="flex items-center gap-2.5 cursor-pointer" onclick="toggleCheck(this)">**

&#x20;                   **<span class="w-4 h-4 rounded-md flex items-center justify-center shrink-0" data-box="" style="border:1px solid var(--stroke-highlight,#7272724d); background-color:var(--primary-01);">**

&#x20;                     **<iconify-icon icon="solar:check-read-linear" width="11" style="color:#fdfdfd;"></iconify-icon>**

&#x20;                   **</span>**

&#x20;                   **<span class="text-xs" style="color:var(--t-secondary);">**

&#x20;                     **Include live matches**

&#x20;                   **</span>**

&#x20;                 **</label>**

&#x20;                 **<label class="flex items-center gap-2.5 cursor-pointer" onclick="toggleCheck(this)">**

&#x20;                   **<span class="w-4 h-4 rounded-md flex items-center justify-center shrink-0" data-box="" style="border:1px solid #3a3a3a; background-color:transparent;">**

&#x20;                     **<iconify-icon icon="solar:check-read-linear" width="11" style="color:#fdfdfd; display:none;"></iconify-icon>**

&#x20;                   **</span>**

&#x20;                   **<span class="text-xs" style="color:var(--t-secondary);">**

&#x20;                     **Only top 5 leagues**

&#x20;                   **</span>**

&#x20;                 **</label>**

&#x20;               **</div>**



&#x20;               **<button class="w-full h-10 rounded-xl mt-5 text-xs font-medium flex items-center justify-center gap-2 transition-opacity hover:opacity-90" style="background-color:var(--primary-01); color:#fdfdfd; box-shadow:var(--shadow-depth);">**

&#x20;                 **<iconify-icon icon="solar:magnifer-linear" width="15"></iconify-icon>**

&#x20;                 **Scan 168 fixtures**

&#x20;               **</button>**

&#x20;             **</div>**

&#x20;           **</div>**

&#x20;         **</section>**



&#x20;         **<!-- BOTTOM GRID -->**

&#x20;         **<section class="grid grid-cols-1 lg:grid-cols-3 gap-5">**

&#x20;           **<!-- xG trend -->**

&#x20;           **<div class="lg:col-span-2 rounded-2xl p-5" style="background-color:var(--b-surface2); border:1px solid var(--stroke-border); box-shadow:var(--shadow-depth);">**

&#x20;             **<div class="flex flex-wrap items-center justify-between gap-3 mb-6">**

&#x20;               **<div>**

&#x20;                 **<h2 class="text-sm font-medium">Expected goals vs. actual</h2>**

&#x20;                 **<p class="text-xs mt-0.5" style="color:var(--t-tertiary);">**

&#x20;                   **Rolling 12 gameweeks**

&#x20;                 **</p>**

&#x20;               **</div>**

&#x20;               **<div class="flex items-center gap-4">**

&#x20;                 **<span class="flex items-center gap-1.5 text-xs" style="color:var(--t-secondary);">**

&#x20;                   **<span class="w-2 h-2 rounded-full" style="background-color:var(--primary-01);"></span>**

&#x20;                   **xG model**

&#x20;                 **</span>**

&#x20;                 **<span class="flex items-center gap-1.5 text-xs" style="color:var(--t-secondary);">**

&#x20;                   **<span class="w-2 h-2 rounded-full" style="background-color:var(--shade-05);"></span>**

&#x20;                   **Actual**

&#x20;                 **</span>**

&#x20;               **</div>**

&#x20;             **</div>**

&#x20;             **<div class="flex items-end gap-2 sm:gap-3 h-40">**

&#x20;               **<div class="flex-1 flex items-end gap-1 h-full">**

&#x20;                 **<div class="flex-1 rounded-t-md" style="height:52%; background-color:var(--primary-01);"></div>**

&#x20;                 **<div class="flex-1 rounded-t-md" style="height:40%; background-color:var(--shade-04);"></div>**

&#x20;               **</div>**

&#x20;               **<div class="flex-1 flex items-end gap-1 h-full">**

&#x20;                 **<div class="flex-1 rounded-t-md" style="height:64%; background-color:var(--primary-01);"></div>**

&#x20;                 **<div class="flex-1 rounded-t-md" style="height:70%; background-color:var(--shade-04);"></div>**

&#x20;               **</div>**

&#x20;               **<div class="flex-1 flex items-end gap-1 h-full">**

&#x20;                 **<div class="flex-1 rounded-t-md" style="height:44%; background-color:var(--primary-01);"></div>**

&#x20;                 **<div class="flex-1 rounded-t-md" style="height:38%; background-color:var(--shade-04);"></div>**

&#x20;               **</div>**

&#x20;               **<div class="flex-1 flex items-end gap-1 h-full">**

&#x20;                 **<div class="flex-1 rounded-t-md" style="height:78%; background-color:var(--primary-01);"></div>**

&#x20;                 **<div class="flex-1 rounded-t-md" style="height:66%; background-color:var(--shade-04);"></div>**

&#x20;               **</div>**

&#x20;               **<div class="flex-1 flex items-end gap-1 h-full">**

&#x20;                 **<div class="flex-1 rounded-t-md" style="height:58%; background-color:var(--primary-01);"></div>**

&#x20;                 **<div class="flex-1 rounded-t-md" style="height:62%; background-color:var(--shade-04);"></div>**

&#x20;               **</div>**

&#x20;               **<div class="flex-1 flex items-end gap-1 h-full">**

&#x20;                 **<div class="flex-1 rounded-t-md" style="height:88%; background-color:var(--primary-01);"></div>**

&#x20;                 **<div class="flex-1 rounded-t-md" style="height:80%; background-color:var(--shade-04);"></div>**

&#x20;               **</div>**

&#x20;               **<div class="flex-1 flex items-end gap-1 h-full">**

&#x20;                 **<div class="flex-1 rounded-t-md" style="height:70%; background-color:var(--primary-01);"></div>**

&#x20;                 **<div class="flex-1 rounded-t-md" style="height:74%; background-color:var(--shade-04);"></div>**

&#x20;               **</div>**

&#x20;               **<div class="flex-1 flex items-end gap-1 h-full hidden sm:flex">**

&#x20;                 **<div class="flex-1 rounded-t-md" style="height:96%; background-color:var(--primary-01);"></div>**

&#x20;                 **<div class="flex-1 rounded-t-md" style="height:84%; background-color:var(--shade-04);"></div>**

&#x20;               **</div>**

&#x20;               **<div class="flex-1 flex items-end gap-1 h-full hidden sm:flex">**

&#x20;                 **<div class="flex-1 rounded-t-md" style="height:60%; background-color:var(--primary-01);"></div>**

&#x20;                 **<div class="flex-1 rounded-t-md" style="height:56%; background-color:var(--shade-04);"></div>**

&#x20;               **</div>**

&#x20;               **<div class="flex-1 flex items-end gap-1 h-full hidden md:flex">**

&#x20;                 **<div class="flex-1 rounded-t-md" style="height:74%; background-color:var(--primary-01);"></div>**

&#x20;                 **<div class="flex-1 rounded-t-md" style="height:90%; background-color:var(--shade-04);"></div>**

&#x20;               **</div>**

&#x20;               **<div class="flex-1 flex items-end gap-1 h-full hidden md:flex">**

&#x20;                 **<div class="flex-1 rounded-t-md" style="height:50%; background-color:var(--primary-01);"></div>**

&#x20;                 **<div class="flex-1 rounded-t-md" style="height:46%; background-color:var(--shade-04);"></div>**

&#x20;               **</div>**

&#x20;               **<div class="flex-1 flex items-end gap-1 h-full hidden md:flex">**

&#x20;                 **<div class="flex-1 rounded-t-md" style="height:82%; background-color:var(--primary-01);"></div>**

&#x20;                 **<div class="flex-1 rounded-t-md" style="height:78%; background-color:var(--shade-04);"></div>**

&#x20;               **</div>**

&#x20;             **</div>**

&#x20;             **<div class="flex justify-between mt-3 text-xs" style="color:var(--t-tertiary);">**

&#x20;               **<span>GW 14</span>**

&#x20;               **<span class="hidden sm:inline">GW 17</span>**

&#x20;               **<span>GW 20</span>**

&#x20;               **<span class="hidden sm:inline">GW 23</span>**

&#x20;               **<span>GW 25</span>**

&#x20;             **</div>**

&#x20;           **</div>**



&#x20;           **<!-- Form table -->**

&#x20;           **<div class="rounded-2xl p-5" style="background-color:var(--b-surface2); border:1px solid var(--stroke-border); box-shadow:var(--shadow-depth);">**

&#x20;             **<div class="flex items-center justify-between mb-4">**

&#x20;               **<h2 class="text-sm font-medium">Form index</h2>**

&#x20;               **<button class="text-xs" style="color:var(--t-tertiary);">**

&#x20;                 **Season**

&#x20;               **</button>**

&#x20;             **</div>**

&#x20;             **<div class="space-y-3">**

&#x20;               **<div class="flex items-center gap-3">**

&#x20;                 **<span class="text-xs w-4" style="color:var(--t-tertiary);">**

&#x20;                   **1**

&#x20;                 **</span>**

&#x20;                 **<div class="w-7 h-7 rounded-lg flex items-center justify-center text-xs" style="background-color:#1a2530; color:#b1e5fc;">**

&#x20;                   **MCI**

&#x20;                 **</div>**

&#x20;                 **<div class="min-w-0 flex-1">**

&#x20;                   **<p class="text-xs truncate">Manchester City</p>**

&#x20;                 **</div>**

&#x20;                 **<div class="flex gap-1">**

&#x20;                   **<span class="w-4 h-4 rounded text-xs flex items-center justify-center" style="background-color:#00a65626; color:var(--primary-02); font-size:.6rem;">**

&#x20;                     **W**

&#x20;                   **</span>**

&#x20;                   **<span class="w-4 h-4 rounded text-xs flex items-center justify-center" style="background-color:#00a65626; color:var(--primary-02); font-size:.6rem;">**

&#x20;                     **W**

&#x20;                   **</span>**

&#x20;                   **<span class="w-4 h-4 rounded text-xs flex items-center justify-center" style="background-color:#7272721f; color:var(--t-secondary); font-size:.6rem;">**

&#x20;                     **D**

&#x20;                   **</span>**

&#x20;                   **<span class="w-4 h-4 rounded text-xs flex items-center justify-center" style="background-color:#00a65626; color:var(--primary-02); font-size:.6rem;">**

&#x20;                     **W**

&#x20;                   **</span>**

&#x20;                 **</div>**

&#x20;                 **<span class="text-xs font-medium w-8 text-right">94.2</span>**

&#x20;               **</div>**

&#x20;               **<div class="flex items-center gap-3">**

&#x20;                 **<span class="text-xs w-4" style="color:var(--t-tertiary);">**

&#x20;                   **2**

&#x20;                 **</span>**

&#x20;                 **<div class="w-7 h-7 rounded-lg flex items-center justify-center text-xs" style="background-color:#2b1a1a; color:#ffbc99;">**

&#x20;                   **ARS**

&#x20;                 **</div>**

&#x20;                 **<div class="min-w-0 flex-1">**

&#x20;                   **<p class="text-xs truncate">Arsenal</p>**

&#x20;                 **</div>**

&#x20;                 **<div class="flex gap-1">**

&#x20;                   **<span class="w-4 h-4 rounded flex items-center justify-center" style="background-color:#00a65626; color:var(--primary-02); font-size:.6rem;">**

&#x20;                     **W**

&#x20;                   **</span>**

&#x20;                   **<span class="w-4 h-4 rounded flex items-center justify-center" style="background-color:#ff381c26; color:var(--primary-03); font-size:.6rem;">**

&#x20;                     **L**

&#x20;                   **</span>**

&#x20;                   **<span class="w-4 h-4 rounded flex items-center justify-center" style="background-color:#00a65626; color:var(--primary-02); font-size:.6rem;">**

&#x20;                     **W**

&#x20;                   **</span>**

&#x20;                   **<span class="w-4 h-4 rounded flex items-center justify-center" style="background-color:#00a65626; color:var(--primary-02); font-size:.6rem;">**

&#x20;                     **W**

&#x20;                   **</span>**

&#x20;                 **</div>**

&#x20;                 **<span class="text-xs font-medium w-8 text-right">91.7</span>**

&#x20;               **</div>**

&#x20;               **<div class="flex items-center gap-3">**

&#x20;                 **<span class="text-xs w-4" style="color:var(--t-tertiary);">**

&#x20;                   **3**

&#x20;                 **</span>**

&#x20;                 **<div class="w-7 h-7 rounded-lg flex items-center justify-center text-xs" style="background-color:#1c2a1c; color:#b5e4ca;">**

&#x20;                   **LIV**

&#x20;                 **</div>**

&#x20;                 **<div class="min-w-0 flex-1">**

&#x20;                   **<p class="text-xs truncate">Liverpool</p>**

&#x20;                 **</div>**

&#x20;                 **<div class="flex gap-1">**

&#x20;                   **<span class="w-4 h-4 rounded flex items-center justify-center" style="background-color:#7272721f; color:var(--t-secondary); font-size:.6rem;">**

&#x20;                     **D**

&#x20;                   **</span>**

&#x20;                   **<span class="w-4 h-4 rounded flex items-center justify-center" style="background-color:#00a65626; color:var(--primary-02); font-size:.6rem;">**

&#x20;                     **W**

&#x20;                   **</span>**

&#x20;                   **<span class="w-4 h-4 rounded flex items-center justify-center" style="background-color:#00a65626; color:var(--primary-02); font-size:.6rem;">**

&#x20;                     **W**

&#x20;                   **</span>**

&#x20;                   **<span class="w-4 h-4 rounded flex items-center justify-center" style="background-color:#7272721f; color:var(--t-secondary); font-size:.6rem;">**

&#x20;                     **D**

&#x20;                   **</span>**

&#x20;                 **</div>**

&#x20;                 **<span class="text-xs font-medium w-8 text-right">88.5</span>**

&#x20;               **</div>**

&#x20;               **<div class="flex items-center gap-3">**

&#x20;                 **<span class="text-xs w-4" style="color:var(--t-tertiary);">**

&#x20;                   **4**

&#x20;                 **</span>**

&#x20;                 **<div class="w-7 h-7 rounded-lg flex items-center justify-center text-xs" style="background-color:#26222f; color:#cabdff;">**

&#x20;                   **AVL**

&#x20;                 **</div>**

&#x20;                 **<div class="min-w-0 flex-1">**

&#x20;                   **<p class="text-xs truncate">Aston Villa</p>**

&#x20;                 **</div>**

&#x20;                 **<div class="flex gap-1">**

&#x20;                   **<span class="w-4 h-4 rounded flex items-center justify-center" style="background-color:#00a65626; color:var(--primary-02); font-size:.6rem;">**

&#x20;                     **W**

&#x20;                   **</span>**

&#x20;                   **<span class="w-4 h-4 rounded flex items-center justify-center" style="background-color:#00a65626; color:var(--primary-02); font-size:.6rem;">**

&#x20;                     **W**

&#x20;                   **</span>**

&#x20;                   **<span class="w-4 h-4 rounded flex items-center justify-center" style="background-color:#ff381c26; color:var(--primary-03); font-size:.6rem;">**

&#x20;                     **L**

&#x20;                   **</span>**

&#x20;                   **<span class="w-4 h-4 rounded flex items-center justify-center" style="background-color:#7272721f; color:var(--t-secondary); font-size:.6rem;">**

&#x20;                     **D**

&#x20;                   **</span>**

&#x20;                 **</div>**

&#x20;                 **<span class="text-xs font-medium w-8 text-right">83.1</span>**

&#x20;               **</div>**

&#x20;               **<div class="flex items-center gap-3">**

&#x20;                 **<span class="text-xs w-4" style="color:var(--t-tertiary);">**

&#x20;                   **5**

&#x20;                 **</span>**

&#x20;                 **<div class="w-7 h-7 rounded-lg flex items-center justify-center text-xs" style="background-color:#2b2a1a; color:#ffd88d;">**

&#x20;                   **TOT**

&#x20;                 **</div>**

&#x20;                 **<div class="min-w-0 flex-1">**

&#x20;                   **<p class="text-xs truncate">Tottenham</p>**

&#x20;                 **</div>**

&#x20;                 **<div class="flex gap-1">**

&#x20;                   **<span class="w-4 h-4 rounded flex items-center justify-center" style="background-color:#ff381c26; color:var(--primary-03); font-size:.6rem;">**

&#x20;                     **L**

&#x20;                   **</span>**

&#x20;                   **<span class="w-4 h-4 rounded flex items-center justify-center" style="background-color:#00a65626; color:var(--primary-02); font-size:.6rem;">**

&#x20;                     **W**

&#x20;                   **</span>**

&#x20;                   **<span class="w-4 h-4 rounded flex items-center justify-center" style="background-color:#00a65626; color:var(--primary-02); font-size:.6rem;">**

&#x20;                     **W**

&#x20;                   **</span>**

&#x20;                   **<span class="w-4 h-4 rounded flex items-center justify-center" style="background-color:#ff381c26; color:var(--primary-03); font-size:.6rem;">**

&#x20;                     **L**

&#x20;                   **</span>**

&#x20;                 **</div>**

&#x20;                 **<span class="text-xs font-medium w-8 text-right">79.4</span>**

&#x20;               **</div>**

&#x20;             **</div>**

&#x20;             **<button class="w-full h-9 rounded-xl mt-5 text-xs transition-colors" style="background-color:var(--b-surface1); border:1px solid var(--stroke-border); color:var(--t-secondary);">**

&#x20;               **Full standings**

&#x20;             **</button>**

&#x20;           **</div>**

&#x20;         **</section>**

&#x20;         **<section class="grid grid-cols-1 xl:grid-cols-3 gap-5">**

&#x20;           **<!-- Head to head analyser -->**

&#x20;           **<div class="xl:col-span-2 rounded-2xl p-5" style="background-color:var(--b-surface2); border:1px solid var(--stroke-border); box-shadow:var(--shadow-depth);">**

&#x20;             **<div class="flex flex-wrap items-center justify-between gap-3 mb-5">**

&#x20;               **<div>**

&#x20;                 **<h2 class="text-sm font-medium">Head-to-head analyser</h2>**

&#x20;                 **<p class="text-xs mt-0.5" style="color:var(--t-tertiary);">**

&#x20;                   **Last 10 meetings · weighted by venue**

&#x20;                 **</p>**

&#x20;               **</div>**

&#x20;               **<button class="h-9 px-3 rounded-xl text-xs flex items-center gap-2 transition-colors" style="background-color:var(--b-surface1); border:1px solid var(--stroke-border); color:var(--t-secondary);">**

&#x20;                 **<iconify-icon icon="solar:refresh-linear" width="14"></iconify-icon>**

&#x20;                 **Swap teams**

&#x20;               **</button>**

&#x20;             **</div>**



&#x20;             **<div class="flex items-center gap-3 mb-6">**

&#x20;               **<div class="flex-1 flex items-center gap-2.5 h-11 px-3 rounded-xl" style="background-color:var(--b-surface1); border:1px solid var(--stroke-border);">**

&#x20;                 **<span class="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-medium" style="background-color:#2b1a1a; color:#ffbc99;">**

&#x20;                   **ARS**

&#x20;                 **</span>**

&#x20;                 **<span class="text-xs truncate">Arsenal</span>**

&#x20;                 **<iconify-icon icon="solar:alt-arrow-down-linear" width="14" class="ml-auto" style="color:var(--t-tertiary);"></iconify-icon>**

&#x20;               **</div>**

&#x20;               **<span class="text-xs" style="color:var(--t-tertiary);">vs</span>**

&#x20;               **<div class="flex-1 flex items-center gap-2.5 h-11 px-3 rounded-xl" style="background-color:var(--b-surface1); border:1px solid var(--stroke-border);">**

&#x20;                 **<span class="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-medium" style="background-color:#1a2530; color:#b1e5fc;">**

&#x20;                   **MCI**

&#x20;                 **</span>**

&#x20;                 **<span class="text-xs truncate">Manchester City</span>**

&#x20;                 **<iconify-icon icon="solar:alt-arrow-down-linear" width="14" class="ml-auto" style="color:var(--t-tertiary);"></iconify-icon>**

&#x20;               **</div>**

&#x20;             **</div>**



&#x20;             **<div class="space-y-3.5">**

&#x20;               **<div>**

&#x20;                 **<div class="flex items-center justify-between text-xs mb-1.5">**

&#x20;                   **<span style="color:var(--t-primary);">1.84</span>**

&#x20;                   **<span style="color:var(--t-tertiary);">Avg. xG</span>**

&#x20;                   **<span style="color:var(--t-primary);">2.06</span>**

&#x20;                 **</div>**

&#x20;                 **<div class="flex h-1.5 rounded-full overflow-hidden gap-0.5">**

&#x20;                   **<div style="width:47%; background-color:var(--primary-01);"></div>**

&#x20;                   **<div style="width:53%; background-color:var(--shade-04);"></div>**

&#x20;                 **</div>**

&#x20;               **</div>**

&#x20;               **<div>**

&#x20;                 **<div class="flex items-center justify-between text-xs mb-1.5">**

&#x20;                   **<span style="color:var(--t-primary);">54%</span>**

&#x20;                   **<span style="color:var(--t-tertiary);">Possession</span>**

&#x20;                   **<span style="color:var(--t-primary);">46%</span>**

&#x20;                 **</div>**

&#x20;                 **<div class="flex h-1.5 rounded-full overflow-hidden gap-0.5">**

&#x20;                   **<div style="width:54%; background-color:var(--primary-01);"></div>**

&#x20;                   **<div style="width:46%; background-color:var(--shade-04);"></div>**

&#x20;                 **</div>**

&#x20;               **</div>**

&#x20;               **<div>**

&#x20;                 **<div class="flex items-center justify-between text-xs mb-1.5">**

&#x20;                   **<span style="color:var(--t-primary);">14.2</span>**

&#x20;                   **<span style="color:var(--t-tertiary);">Shots / match</span>**

&#x20;                   **<span style="color:var(--t-primary);">16.8</span>**

&#x20;                 **</div>**

&#x20;                 **<div class="flex h-1.5 rounded-full overflow-hidden gap-0.5">**

&#x20;                   **<div style="width:46%; background-color:var(--primary-01);"></div>**

&#x20;                   **<div style="width:54%; background-color:var(--shade-04);"></div>**

&#x20;                 **</div>**

&#x20;               **</div>**

&#x20;               **<div>**

&#x20;                 **<div class="flex items-center justify-between text-xs mb-1.5">**

&#x20;                   **<span style="color:var(--t-primary);">1.1</span>**

&#x20;                   **<span style="color:var(--t-tertiary);">Goals conceded</span>**

&#x20;                   **<span style="color:var(--t-primary);">0.9</span>**

&#x20;                 **</div>**

&#x20;                 **<div class="flex h-1.5 rounded-full overflow-hidden gap-0.5">**

&#x20;                   **<div style="width:55%; background-color:var(--primary-01);"></div>**

&#x20;                   **<div style="width:45%; background-color:var(--shade-04);"></div>**

&#x20;                 **</div>**

&#x20;               **</div>**

&#x20;             **</div>**



&#x20;             **<div class="grid grid-cols-3 gap-3 mt-5 pt-4" style="border-top:1px solid var(--stroke-subtle);">**

&#x20;               **<div class="rounded-xl p-3 text-center" style="background-color:var(--b-surface1); border:1px solid var(--stroke-border);">**

&#x20;                 **<p class="text-lg font-semibold tracking-tight">4</p>**

&#x20;                 **<p class="text-xs mt-0.5" style="color:var(--t-tertiary);">**

&#x20;                   **Arsenal wins**

&#x20;                 **</p>**

&#x20;               **</div>**

&#x20;               **<div class="rounded-xl p-3 text-center" style="background-color:var(--b-surface1); border:1px solid var(--stroke-border);">**

&#x20;                 **<p class="text-lg font-semibold tracking-tight">2</p>**

&#x20;                 **<p class="text-xs mt-0.5" style="color:var(--t-tertiary);">**

&#x20;                   **Draws**

&#x20;                 **</p>**

&#x20;               **</div>**

&#x20;               **<div class="rounded-xl p-3 text-center" style="background-color:var(--b-surface1); border:1px solid var(--stroke-border);">**

&#x20;                 **<p class="text-lg font-semibold tracking-tight">4</p>**

&#x20;                 **<p class="text-xs mt-0.5" style="color:var(--t-tertiary);">**

&#x20;                   **City wins**

&#x20;                 **</p>**

&#x20;               **</div>**

&#x20;             **</div>**

&#x20;           **</div>**



&#x20;           **<!-- Top value picks -->**

&#x20;           **<div class="rounded-2xl p-5" style="background-color:var(--b-surface2); border:1px solid var(--stroke-border); box-shadow:var(--shadow-depth);">**

&#x20;             **<div class="flex items-center justify-between mb-4">**

&#x20;               **<div>**

&#x20;                 **<h2 class="text-sm font-medium">Top value picks</h2>**

&#x20;                 **<p class="text-xs mt-0.5" style="color:var(--t-tertiary);">**

&#x20;                   **Highest model edge today**

&#x20;                 **</p>**

&#x20;               **</div>**

&#x20;               **<iconify-icon icon="solar:bolt-linear" width="17" style="color:var(--t-tertiary);"></iconify-icon>**

&#x20;             **</div>**

&#x20;             **<div class="space-y-2.5">**

&#x20;               **<div class="flex items-center gap-3 p-3 rounded-xl" style="background-color:var(--b-surface1); border:1px solid var(--stroke-border);">**

&#x20;                 **<span class="w-7 h-7 rounded-lg flex items-center justify-center text-xs" style="background-color:#1c2a1c; color:#b5e4ca;">**

&#x20;                   **LIV**

&#x20;                 **</span>**

&#x20;                 **<div class="min-w-0 flex-1">**

&#x20;                   **<p class="text-xs truncate">Liverpool — Over 2.5</p>**

&#x20;                   **<p class="text-xs mt-0.5" style="color:var(--t-tertiary);">**

&#x20;                     **Odds 1.72 · fair 1.55**

&#x20;                   **</p>**

&#x20;                 **</div>**

&#x20;                 **<span class="text-xs font-medium" style="color:var(--primary-02);">**

&#x20;                   **+9.1%**

&#x20;                 **</span>**

&#x20;               **</div>**

&#x20;               **<div class="flex items-center gap-3 p-3 rounded-xl" style="background-color:var(--b-surface1); border:1px solid var(--stroke-border);">**

&#x20;                 **<span class="w-7 h-7 rounded-lg flex items-center justify-center text-xs" style="background-color:#221f2e; color:#cabdff;">**

&#x20;                   **AVL**

&#x20;                 **</span>**

&#x20;                 **<div class="min-w-0 flex-1">**

&#x20;                   **<p class="text-xs truncate">Aston Villa — Away win</p>**

&#x20;                   **<p class="text-xs mt-0.5" style="color:var(--t-tertiary);">**

&#x20;                     **Odds 2.35 · fair 2.14**

&#x20;                   **</p>**

&#x20;                 **</div>**

&#x20;                 **<span class="text-xs font-medium" style="color:var(--primary-02);">**

&#x20;                   **+7.8%**

&#x20;                 **</span>**

&#x20;               **</div>**

&#x20;               **<div class="flex items-center gap-3 p-3 rounded-xl" style="background-color:var(--b-surface1); border:1px solid var(--stroke-border);">**

&#x20;                 **<span class="w-7 h-7 rounded-lg flex items-center justify-center text-xs" style="background-color:#22222f; color:#b1e5fc;">**

&#x20;                   **ARS**

&#x20;                 **</span>**

&#x20;                 **<div class="min-w-0 flex-1">**

&#x20;                   **<p class="text-xs truncate">Arsenal — Home win</p>**

&#x20;                   **<p class="text-xs mt-0.5" style="color:var(--t-tertiary);">**

&#x20;                     **Odds 2.10 · fair 1.94**

&#x20;                   **</p>**

&#x20;                 **</div>**

&#x20;                 **<span class="text-xs font-medium" style="color:var(--primary-02);">**

&#x20;                   **+6.4%**

&#x20;                 **</span>**

&#x20;               **</div>**

&#x20;               **<div class="flex items-center gap-3 p-3 rounded-xl" style="background-color:var(--b-surface1); border:1px solid var(--stroke-border);">**

&#x20;                 **<span class="w-7 h-7 rounded-lg flex items-center justify-center text-xs" style="background-color:#2b2a1a; color:#ffd88d;">**

&#x20;                   **TOT**

&#x20;                 **</span>**

&#x20;                 **<div class="min-w-0 flex-1">**

&#x20;                   **<p class="text-xs truncate">Tottenham — BTTS</p>**

&#x20;                   **<p class="text-xs mt-0.5" style="color:var(--t-tertiary);">**

&#x20;                     **Odds 1.65 · fair 1.58**

&#x20;                   **</p>**

&#x20;                 **</div>**

&#x20;                 **<span class="text-xs font-medium" style="color:var(--primary-05);">**

&#x20;                   **+4.3%**

&#x20;                 **</span>**

&#x20;               **</div>**

&#x20;             **</div>**

&#x20;             **<button class="w-full h-9 rounded-xl mt-5 text-xs transition-colors" style="background-color:var(--b-surface1); border:1px solid var(--stroke-border); color:var(--t-secondary);">**

&#x20;               **Open value bets**

&#x20;             **</button>**

&#x20;           **</div>**

&#x20;         **</section>**



&#x20;         **<!-- Upcoming fixtures -->**

&#x20;         **<section class="rounded-2xl overflow-hidden" style="background-color:var(--b-surface2); border:1px solid var(--stroke-border); box-shadow:var(--shadow-depth);">**

&#x20;           **<div class="flex flex-wrap items-center gap-3 p-5" style="border-bottom:1px solid var(--stroke-subtle);">**

&#x20;             **<div>**

&#x20;               **<h2 class="text-sm font-medium">Upcoming fixtures</h2>**

&#x20;               **<p class="text-xs mt-0.5" style="color:var(--t-tertiary);">**

&#x20;                 **Next 7 days · Premier League**

&#x20;               **</p>**

&#x20;             **</div>**

&#x20;             **<button class="ml-auto text-xs flex items-center gap-1.5" style="color:var(--primary-01);">**

&#x20;               **Full calendar**

&#x20;               **<iconify-icon icon="solar:arrow-right-linear" width="14"></iconify-icon>**

&#x20;             **</button>**

&#x20;           **</div>**

&#x20;           **<div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">**

&#x20;             **<div class="p-5" style="border-bottom:1px solid var(--stroke-subtle); border-right:1px solid var(--stroke-subtle);">**

&#x20;               **<p class="text-xs" style="color:var(--t-tertiary);">**

&#x20;                 **Sat · 15:00**

&#x20;               **</p>**

&#x20;               **<p class="text-xs font-medium mt-2">**

&#x20;                 **Everton**

&#x20;                 **<span style="color:var(--t-tertiary);">vs</span>**

&#x20;                 **Fulham**

&#x20;               **</p>**

&#x20;               **<div class="flex items-center gap-2 mt-3">**

&#x20;                 **<span class="text-xs px-1.5 py-0.5 rounded-md" style="background-color:#2a85ff1f; color:var(--primary-01);">**

&#x20;                   **1 · 2.45**

&#x20;                 **</span>**

&#x20;                 **<span class="text-xs px-1.5 py-0.5 rounded-md" style="background-color:#7272721f; color:var(--t-secondary);">**

&#x20;                   **X · 3.30**

&#x20;                 **</span>**

&#x20;                 **<span class="text-xs px-1.5 py-0.5 rounded-md" style="background-color:#7272721f; color:var(--t-secondary);">**

&#x20;                   **2 · 2.90**

&#x20;                 **</span>**

&#x20;               **</div>**

&#x20;             **</div>**

&#x20;             **<div class="p-5" style="border-bottom:1px solid var(--stroke-subtle); border-right:1px solid var(--stroke-subtle);">**

&#x20;               **<p class="text-xs" style="color:var(--t-tertiary);">**

&#x20;                 **Sat · 17:30**

&#x20;               **</p>**

&#x20;               **<p class="text-xs font-medium mt-2">**

&#x20;                 **West Ham**

&#x20;                 **<span style="color:var(--t-tertiary);">vs</span>**

&#x20;                 **Brentford**

&#x20;               **</p>**

&#x20;               **<div class="flex items-center gap-2 mt-3">**

&#x20;                 **<span class="text-xs px-1.5 py-0.5 rounded-md" style="background-color:#7272721f; color:var(--t-secondary);">**

&#x20;                   **1 · 2.20**

&#x20;                 **</span>**

&#x20;                 **<span class="text-xs px-1.5 py-0.5 rounded-md" style="background-color:#7272721f; color:var(--t-secondary);">**

&#x20;                   **X · 3.45**

&#x20;                 **</span>**

&#x20;                 **<span class="text-xs px-1.5 py-0.5 rounded-md" style="background-color:#ff9d341f; color:var(--primary-05);">**

&#x20;                   **2 · 3.10**

&#x20;                 **</span>**

&#x20;               **</div>**

&#x20;             **</div>**

&#x20;             **<div class="p-5" style="border-bottom:1px solid var(--stroke-subtle); border-right:1px solid var(--stroke-subtle);">**

&#x20;               **<p class="text-xs" style="color:var(--t-tertiary);">**

&#x20;                 **Sun · 14:00**

&#x20;               **</p>**

&#x20;               **<p class="text-xs font-medium mt-2">**

&#x20;                 **Wolves**

&#x20;                 **<span style="color:var(--t-tertiary);">vs</span>**

&#x20;                 **Crystal Palace**

&#x20;               **</p>**

&#x20;               **<div class="flex items-center gap-2 mt-3">**

&#x20;                 **<span class="text-xs px-1.5 py-0.5 rounded-md" style="background-color:#7272721f; color:var(--t-secondary);">**

&#x20;                   **1 · 2.60**

&#x20;                 **</span>**

&#x20;                 **<span class="text-xs px-1.5 py-0.5 rounded-md" style="background-color:#00a6561f; color:var(--primary-02);">**

&#x20;                   **X · 3.20**

&#x20;                 **</span>**

&#x20;                 **<span class="text-xs px-1.5 py-0.5 rounded-md" style="background-color:#7272721f; color:var(--t-secondary);">**

&#x20;                   **2 · 2.75**

&#x20;                 **</span>**

&#x20;               **</div>**

&#x20;             **</div>**

&#x20;             **<div class="p-5" style="border-bottom:1px solid var(--stroke-subtle);">**

&#x20;               **<p class="text-xs" style="color:var(--t-tertiary);">**

&#x20;                 **Sun · 16:30**

&#x20;               **</p>**

&#x20;               **<p class="text-xs font-medium mt-2">**

&#x20;                 **Man United**

&#x20;                 **<span style="color:var(--t-tertiary);">vs</span>**

&#x20;                 **Nottingham**

&#x20;               **</p>**

&#x20;               **<div class="flex items-center gap-2 mt-3">**

&#x20;                 **<span class="text-xs px-1.5 py-0.5 rounded-md" style="background-color:#2a85ff1f; color:var(--primary-01);">**

&#x20;                   **1 · 1.80**

&#x20;                 **</span>**

&#x20;                 **<span class="text-xs px-1.5 py-0.5 rounded-md" style="background-color:#7272721f; color:var(--t-secondary);">**

&#x20;                   **X · 3.70**

&#x20;                 **</span>**

&#x20;                 **<span class="text-xs px-1.5 py-0.5 rounded-md" style="background-color:#7272721f; color:var(--t-secondary);">**

&#x20;                   **2 · 4.20**

&#x20;                 **</span>**

&#x20;               **</div>**

&#x20;             **</div>**

&#x20;           **</div>**

&#x20;         **</section>**



&#x20;         **<!-- ============ WINMIX STUDIO · MATCH EXPLORER ============ -->**

&#x20;         **<section id="match-explorer" class="space-y-5 pt-2">**

&#x20;           **<!-- Hero / heading -->**

&#x20;           **<div class="rounded-2xl p-6 sm:p-8 relative overflow-hidden" style="background:linear-gradient(140deg,#f1f1f110,#ebebeb06); border:1px solid var(--stroke-border); box-shadow:var(--shadow-depth);">**

&#x20;             **<div class="absolute -top-16 -right-10 w-56 h-56 rounded-full blur-3xl" style="background:#2a85ff33;"></div>**

&#x20;             **<div class="absolute -bottom-24 left-16 w-48 h-48 rounded-full blur-3xl" style="background:#7f5fff26;"></div>**

&#x20;             **<div class="relative">**

&#x20;               **<span class="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg" style="background-color:#2a85ff1f; color:var(--primary-01);">**

&#x20;                 **<iconify-icon icon="solar:cpu-bolt-linear" width="13"></iconify-icon>**

&#x20;                 **winmix studio**

&#x20;               **</span>**

&#x20;               **<h2 class="text-2xl sm:text-3xl font-semibold tracking-tight mt-4">**

&#x20;                 **Match explorer \&amp; statistics engine**

&#x20;               **</h2>**

&#x20;               **<p class="text-sm mt-2 max-w-xl leading-relaxed" style="color:var(--t-secondary);">**

&#x20;                 **Filter thousands of historical fixtures by team, both-teams-scored**

&#x20;                 **and comeback patterns — then export the exact sample your model**

&#x20;                 **needs.**

&#x20;               **</p>**

&#x20;               **<div class="flex flex-wrap items-center gap-2.5 mt-5">**

&#x20;                 **<button class="h-10 px-4 rounded-xl text-xs font-medium flex items-center gap-2 transition-opacity hover:opacity-90" style="background-color:var(--primary-01); color:#fdfdfd; box-shadow:var(--shadow-depth);">**

&#x20;                   **<iconify-icon icon="solar:play-circle-linear" width="15"></iconify-icon>**

&#x20;                   **Run analysis**

&#x20;                 **</button>**

&#x20;                 **<button class="h-10 px-4 rounded-xl text-xs flex items-center gap-2 transition-colors" style="background-color:var(--b-surface2); border:1px solid var(--stroke-border); color:var(--t-secondary);">**

&#x20;                   **<iconify-icon icon="solar:download-minimalistic-linear" width="15"></iconify-icon>**

&#x20;                   **Export CSV**

&#x20;                 **</button>**

&#x20;               **</div>**

&#x20;             **</div>**

&#x20;           **</div>**



&#x20;           **<!-- Filter bar -->**

&#x20;           **<div class="rounded-2xl p-5" style="background-color:var(--b-surface2); border:1px solid var(--stroke-border); box-shadow:var(--shadow-depth);">**

&#x20;             **<div class="flex flex-wrap items-center gap-3 mb-5">**

&#x20;               **<div class="flex items-center gap-2.5">**

&#x20;                 **<span class="w-8 h-8 rounded-xl flex items-center justify-center" style="background-color:var(--b-surface1); border:1px solid var(--stroke-border); color:var(--primary-01);">**

&#x20;                   **<iconify-icon icon="solar:filter-linear" width="16"></iconify-icon>**

&#x20;                 **</span>**

&#x20;                 **<div>**

&#x20;                   **<h3 class="text-sm font-medium">Filters</h3>**

&#x20;                   **<p class="text-xs mt-0.5" style="color:var(--t-tertiary);">**

&#x20;                     **Narrow down the match database**

&#x20;                   **</p>**

&#x20;                 **</div>**

&#x20;               **</div>**

&#x20;               **<button onclick="resetFilters()" class="ml-auto h-9 px-3 rounded-xl text-xs flex items-center gap-2 transition-colors" style="background-color:var(--b-surface1); border:1px solid var(--stroke-border); color:var(--t-secondary);">**

&#x20;                 **<iconify-icon icon="solar:restart-linear" width="14"></iconify-icon>**

&#x20;                 **Reset**

&#x20;               **</button>**

&#x20;             **</div>**



&#x20;             **<div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">**

&#x20;               **<!-- Home team -->**

&#x20;               **<div>**

&#x20;                 **<label class="text-xs block mb-1.5" style="color:var(--t-tertiary);">**

&#x20;                   **Home team**

&#x20;                 **</label>**

&#x20;                 **<div class="relative">**

&#x20;                   **<button onclick="toggleMenu('ddHome')" class="w-full flex items-center gap-2 h-11 px-3 rounded-xl text-xs transition-colors" style="background-color:var(--b-surface1); border:1px solid var(--stroke-border); color:var(--t-primary);">**

&#x20;                     **<iconify-icon icon="solar:home-2-linear" width="15" style="color:var(--t-tertiary);"></iconify-icon>**

&#x20;                     **<span id="ddHomeLabel" class="truncate">All teams</span>**

&#x20;                     **<iconify-icon icon="solar:alt-arrow-down-linear" width="14" class="ml-auto" style="color:var(--t-tertiary);"></iconify-icon>**

&#x20;                   **</button>**

&#x20;                   **<div id="ddHome" class="dd-menu hidden absolute left-0 right-0 mt-2 rounded-xl p-1.5 z-40 max-h-56 overflow-y-auto" style="background-color:var(--b-pop); border:1px solid var(--stroke-border); box-shadow:var(--shadow-dropdown);">**

&#x20;                     **<button onclick="pickOption(this,'ddHome','ddHomeLabel')" class="menu-item w-full text-left text-xs px-2.5 h-9 rounded-lg">**

&#x20;                       **All teams**

&#x20;                     **</button>**

&#x20;                     **<button onclick="pickOption(this,'ddHome','ddHomeLabel')" class="menu-item w-full text-left text-xs px-2.5 h-9 rounded-lg">**

&#x20;                       **Arsenal**

&#x20;                     **</button>**

&#x20;                     **<button onclick="pickOption(this,'ddHome','ddHomeLabel')" class="menu-item w-full text-left text-xs px-2.5 h-9 rounded-lg">**

&#x20;                       **Liverpool**

&#x20;                     **</button>**

&#x20;                     **<button onclick="pickOption(this,'ddHome','ddHomeLabel')" class="menu-item w-full text-left text-xs px-2.5 h-9 rounded-lg">**

&#x20;                       **Manchester City**

&#x20;                     **</button>**

&#x20;                     **<button onclick="pickOption(this,'ddHome','ddHomeLabel')" class="menu-item w-full text-left text-xs px-2.5 h-9 rounded-lg">**

&#x20;                       **Tottenham**

&#x20;                     **</button>**

&#x20;                     **<button onclick="pickOption(this,'ddHome','ddHomeLabel')" class="menu-item w-full text-left text-xs px-2.5 h-9 rounded-lg">**

&#x20;                       **Chelsea**

&#x20;                     **</button>**

&#x20;                   **</div>**

&#x20;                 **</div>**

&#x20;               **</div>**



&#x20;               **<!-- Away team -->**

&#x20;               **<div>**

&#x20;                 **<label class="text-xs block mb-1.5" style="color:var(--t-tertiary);">**

&#x20;                   **Away team**

&#x20;                 **</label>**

&#x20;                 **<div class="relative">**

&#x20;                   **<button onclick="toggleMenu('ddAway')" class="w-full flex items-center gap-2 h-11 px-3 rounded-xl text-xs transition-colors" style="background-color:var(--b-surface1); border:1px solid var(--stroke-border); color:var(--t-primary);">**

&#x20;                     **<iconify-icon icon="solar:map-point-linear" width="15" style="color:var(--t-tertiary);"></iconify-icon>**

&#x20;                     **<span id="ddAwayLabel" class="truncate">All teams</span>**

&#x20;                     **<iconify-icon icon="solar:alt-arrow-down-linear" width="14" class="ml-auto" style="color:var(--t-tertiary);"></iconify-icon>**

&#x20;                   **</button>**

&#x20;                   **<div id="ddAway" class="dd-menu hidden absolute left-0 right-0 mt-2 rounded-xl p-1.5 z-40 max-h-56 overflow-y-auto" style="background-color:var(--b-pop); border:1px solid var(--stroke-border); box-shadow:var(--shadow-dropdown);">**

&#x20;                     **<button onclick="pickOption(this,'ddAway','ddAwayLabel')" class="menu-item w-full text-left text-xs px-2.5 h-9 rounded-lg">**

&#x20;                       **All teams**

&#x20;                     **</button>**

&#x20;                     **<button onclick="pickOption(this,'ddAway','ddAwayLabel')" class="menu-item w-full text-left text-xs px-2.5 h-9 rounded-lg">**

&#x20;                       **Aston Villa**

&#x20;                     **</button>**

&#x20;                     **<button onclick="pickOption(this,'ddAway','ddAwayLabel')" class="menu-item w-full text-left text-xs px-2.5 h-9 rounded-lg">**

&#x20;                       **Brighton**

&#x20;                     **</button>**

&#x20;                     **<button onclick="pickOption(this,'ddAway','ddAwayLabel')" class="menu-item w-full text-left text-xs px-2.5 h-9 rounded-lg">**

&#x20;                       **Newcastle**

&#x20;                     **</button>**

&#x20;                     **<button onclick="pickOption(this,'ddAway','ddAwayLabel')" class="menu-item w-full text-left text-xs px-2.5 h-9 rounded-lg">**

&#x20;                       **West Ham**

&#x20;                     **</button>**

&#x20;                     **<button onclick="pickOption(this,'ddAway','ddAwayLabel')" class="menu-item w-full text-left text-xs px-2.5 h-9 rounded-lg">**

&#x20;                       **Everton**

&#x20;                     **</button>**

&#x20;                   **</div>**

&#x20;                 **</div>**

&#x20;               **</div>**



&#x20;               **<!-- BTTS -->**

&#x20;               **<div>**

&#x20;                 **<label class="text-xs block mb-1.5" style="color:var(--t-tertiary);">**

&#x20;                   **Both teams scored**

&#x20;                 **</label>**

&#x20;                 **<div class="relative">**

&#x20;                   **<button onclick="toggleMenu('ddBtts')" class="w-full flex items-center gap-2 h-11 px-3 rounded-xl text-xs transition-colors" style="background-color:var(--b-surface1); border:1px solid var(--stroke-border); color:var(--t-primary);">**

&#x20;                     **<iconify-icon icon="solar:football-linear" width="15" style="color:var(--t-tertiary);"></iconify-icon>**

&#x20;                     **<span id="ddBttsLabel" class="truncate">Any</span>**

&#x20;                     **<iconify-icon icon="solar:alt-arrow-down-linear" width="14" class="ml-auto" style="color:var(--t-tertiary);"></iconify-icon>**

&#x20;                   **</button>**

&#x20;                   **<div id="ddBtts" class="dd-menu hidden absolute left-0 right-0 mt-2 rounded-xl p-1.5 z-40" style="background-color:var(--b-pop); border:1px solid var(--stroke-border); box-shadow:var(--shadow-dropdown);">**

&#x20;                     **<button onclick="pickOption(this,'ddBtts','ddBttsLabel')" class="menu-item w-full text-left text-xs px-2.5 h-9 rounded-lg">**

&#x20;                       **Any**

&#x20;                     **</button>**

&#x20;                     **<button onclick="pickOption(this,'ddBtts','ddBttsLabel')" class="menu-item w-full text-left text-xs px-2.5 h-9 rounded-lg">**

&#x20;                       **Yes**

&#x20;                     **</button>**

&#x20;                     **<button onclick="pickOption(this,'ddBtts','ddBttsLabel')" class="menu-item w-full text-left text-xs px-2.5 h-9 rounded-lg">**

&#x20;                       **No**

&#x20;                     **</button>**

&#x20;                   **</div>**

&#x20;                 **</div>**

&#x20;               **</div>**



&#x20;               **<!-- Comeback -->**

&#x20;               **<div>**

&#x20;                 **<label class="text-xs block mb-1.5" style="color:var(--t-tertiary);">**

&#x20;                   **Comeback**

&#x20;                 **</label>**

&#x20;                 **<div class="relative">**

&#x20;                   **<button onclick="toggleMenu('ddComeback')" class="w-full flex items-center gap-2 h-11 px-3 rounded-xl text-xs transition-colors" style="background-color:var(--b-surface1); border:1px solid var(--stroke-border); color:var(--t-primary);">**

&#x20;                     **<iconify-icon icon="solar:round-arrow-right-up-linear" width="15" style="color:var(--t-tertiary);"></iconify-icon>**

&#x20;                                           **<span id="ddComebackLabel" class="truncate">Any</span>**

&#x20;                     **<iconify-icon icon="solar:alt-arrow-down-linear" width="14" class="ml-auto" style="color:var(--t-tertiary);"></iconify-icon>**

&#x20;                   **</button>**

&#x20;                   **<div id="ddComeback" class="dd-menu hidden absolute left-0 right-0 mt-2 rounded-xl p-1.5 z-40" style="background-color:var(--b-pop); border:1px solid var(--stroke-border); box-shadow:var(--shadow-dropdown);">**

&#x20;                     **<button onclick="pickOption(this,'ddComeback','ddComebackLabel')" class="menu-item w-full text-left text-xs px-2.5 h-9 rounded-lg">**

&#x20;                       **Any**

&#x20;                     **</button>**

&#x20;                     **<button onclick="pickOption(this,'ddComeback','ddComebackLabel')" class="menfull text-left text-xs px-2.5 h-9 rounded-lg">**

&#x20;                       **Away comeback**

&#x20;                     **</button>**

&#x20;                     **<button onclick="pickOption(this,'ddComeback','ddComebackLabel')" class="menu-item w-full text-left text-xs px-2.5 h-9 rounded-lg">**

&#x20;                       **No comeback**

&#x20;                     **</button>**

&#x20;                   **</div>**

&#x20;                 **</div>**

&#x20;               **</div>**

&#x20;             **</div>**



&#x20;             **<!-- Active chips + actions -->**

&#x20;             **<div class="flex flex-wrap items-center gap-2 mt-5 pt-4" style="border-top:1px solid var(--stroke-subtle);">**

&#x20;               **<span class="text-xs" style="color:var(--t-tertiary);">**

&#x20;                 **Active:**

&#x20;               **</span>**

&#x20;               **<span class="text-xs px-2 py-1 rounded-lg flex items-center gap-1.5" style="background-color:#2a85ff1f; color:var(--primary-01);">**

&#x20;                 **Season 2024/25**

&#x20;                 **<iconify-icon icon="solar:close-circle-linear" width="12"></iconify-icon>**

&#x20;               **</span>**

&#x20;               **<span class="text-xs px-2 py-1 rounded-lg flex items-center gap-1.5" style="background-color:#7f5fff1f; color:var(--primary-04);">**

&#x20;                 **Premier League**

&#x20;                 **<iconify-icon icon="solar:close-circle-linear" width="12"></iconify-icon>**

&#x20;               **</span>**

&#x20;               **<span class="text-xs px-2 py-1 rounded-lg flex items-center gap-1.5" style="background-color:#00a6561f; color:var(--primary-02);">**

&#x20;                 **Min. 1.5 xG**

&#x20;                 **<iconify-icon icon="solar:close-circle-linear" width="12"></iconify-icon>**

&#x20;               **</span>**

&#x20;               **<button class="ml-auto h-9 px-4 rounded-xl text-xs font-medium flex items-center gap-2 transition-opacity hover:opacity-90" style="background-color:var(--primary-01); color:#fdfdfd;">**

&#x20;                 **<iconify-icon icon="solar:magnifer-linear" width="14"></iconify-icon>**

&#x20;                 **Apply filters**

&#x20;               **</button>**

&#x20;             **</div>**

&#x20;           **</div>**



&#x20;           **<!-- Aggregated statistics strip -->**

&#x20;           **<div class="grid grid-cols-2 lg:grid-cols-4 gap-4">**

&#x20;             **<div class="rounded-2xl p-5" style="background:linear-gradient(180deg,#f1f1f10a,#ebebeb08); border:1px solid var(--stroke-border); box-shadow:var(--shadow-depth);">**

&#x20;               **<div class="flex items-center gap-2">**

&#x20;                 **<span class="w-7 h-7 rounded-lg flex items-center justify-center" style="background-color:#2a85ff1f; color:var(--primary-01);">**

&#x20;                   **<iconify-icon icon="solar:database-linear" width="14"></iconify-icon>**

&#x20;                 **</span>**

&#x20;                 **<span class="text-xs" style="color:var(--t-secondary);">**

&#x20;                   **Matches found**

&#x20;                 **</span>**

&#x20;               **</div>**

&#x20;               **<p class="text-2xl font-semibold tracking-tight mt-3">1,284</p>**

&#x20;               **<p class="text-xs mt-1.5" style="color:var(ebebeb08); border:1px solid var(--stroke-border); box-shadow:var(--shadow-depth);">**

&#x20;               **</p><div class="flex items-center gap-2">**

&#x20;                 **<span class="w-7 h-7 rounded-lg flex items-center justify-center" style="background-color:#00a6561f; color:var(--primary-02);">**

&#x20;                   **<iconify-icon icon="solar:football-linear" width="14"></iconify-icon>**

&#x20;                 **</span>**

&#x20;                 **<span class="text-xs" style="color:var(--t-secondary);">**

&#x20;                   **Avg. goals**

&#x20;                 **</span>**

&#x20;               **</div>**

&#x20;               **<p class="text-2xl font-semibold tracking-tight mt-3">2.94</p>**

&#x20;               **<p class="text-xs mt-1.5" style="color:var(--t-tertiary);">**

&#x20;                 **1.68 home · 1.26 away**

&#x20;               **</p>**

&#x20;             **</div>**

&#x20;             **<div class="rounded-2xl p-5" style="background:linear-gradient(180deg,#f1f1f10a,#ebebeb08); border:1px solid var(--stroke-border); box-shadow:var(--shadow-depth);">**

&#x20;               **<div class="flex items-center gap-2">**

&#x20;                 **<span class="w-7 h-7 rounded-lg flex items-center justify-center" style="background-color:#7f5fff1f; color:var(--primary-04);">**

&#x20;                   **<iconify-icon icon="solar:transfer-horizontal-linear" width="14"></iconify-icon>**

&#x20;                 **</span>**

&#x20;                 **<span class="text-xs" style="color:var(--t-secondary);">**

&#x20;                   **BTTS rate**

&#x20;                 **</span>**

&#x20;               **</div>**

&#x20;               **<p class="text-2xl font-semibold tracking-tight mt-3">58.3%</p>**

&#x20;               **<div class="h-1.5 rounded-full mt-3 overflow-hidden" style="background-color:var(--shade-04);">**

&#x20;                 **<div class="h-full rounded-full" style="width:58.3%; background-color:var(--primary-04);"></div>**

&#x20;               **</div>**

&#x20;             **</div>**

&#x20;             **<div class="rounded-2xl p-5" style="background:linear-gradient(180deg,#f1f1f10a,#ebebeb08); border:1px solid var(--stroke-border); box-shadow:var(--shadow-depth);">**

&#x20;               **<div class="flex items-center gap-2">**

&#x20;                 **<span class="w-7 h-7 rounded-lg flex items-center justify-center" style="background-color:#ff9d341f; color:var(--primary-05);">**

&#x20;                   **<iconify-icon icon="solar:refresh-square-linear" width="14"></iconify-icon>**

&#x20;                 **</span>**

&#x20;                 **<span class="text-xs" style="color:var(--t-secondary);">**

&#x20;                   **Comebacks**

&#x20;                 **</span>**

&#x20;               **</div>**

&#x20;               **<p class="text-2xl font-semibold tracking-tight mt-3">11.7%</p>**

&#x20;               **<p class="text-xs mt-1.5" style="color:var(--t-tertiary);">**

&#x20;                 **150 matches turned around**

&#x20;               **</p>**

&#x20;             **</div>**

&#x20;           **</div>**



&#x20;           **<!-- Results table -->**

&#x20;           **<div class="rounded-2xl overflow-hidden" style="background-color:var(--b-surface2); border:1px solid var(--stroke-border); box-shadow:var(--shadow-depth);">**

&#x20;             **<div class="flex flex-wrap items-center gap-3 p-5" style="border-bottom:1px solid var(--stroke-subtle);">**

&#x20;               **<div>**

&#x20;                 **<h3 class="text-sm font-medium">Match results</h3>**

&#x20;                 **<p class="text-xs mt-0.5" style="color:var(--t-tertiary);">**

&#x20;                   **Sorted by date · newest first**

&#x20;                 **</p>**

&#x20;               **</div>**

&#x20;               **<div class="ml-auto flex items-center gap-2">**

&#x20;                 **<div class="flex p-0.5 rounded-xl" style="background-color:var(--b-surface1); border:1px solid var(--stroke-border);">**

&#x20;                   **<button onclick="setTab(this)" class="seg-tab active**

&#x20;                   **\&gt;**

&#x20;                     **Cards**

&#x20;                   **\&lt;/button\&gt;**

&#x20;                 **\&lt;/div\&gt;**

&#x20;                 **\&lt;button**

&#x20;                   **class=" w-8="" h-8="" rounded-lg="" flex="" items-center="" justify-center"="" style="background-color:var(--b-surface1); border:1px solid var(--stroke-border); color:var(--t-secondary);">**

&#x20;                   **<iconify-icon icon="solar:sort-vertical-linear" width="16"></iconify-icon>**

&#x20;                 **</button>**

&#x20;               **</div>**

&#x20;             **</div>**



&#x20;             **<!-- head -->**

&#x20;             **<div class="hidden lg:grid grid-cols-12 gap-3 px-5 py-2.5 text-xs" style="color:var(--t-tertiary); border-bottom:1px solid var(--stroke-subtle);">**

&#x20;               **<div class="col-span-2">Date</div>**

&#x20;               **<div class="col-span-3">Home</div>**

&#x20;               **<div class="col-span-2 text-center">Score (HT / FT)</div>**

&#x20;               **<div class="col-span-3">Away</div>**

&#x20;               **<div class="col-span-2 text-right">Flags</div>**

&#x20;             **</div>**



&#x20;             **<div>**

&#x20;               **<!-- row 1 -->**

&#x20;               **<div class="grid grid-cols-1 lg:grid-cols-12 gap-3 px-5 py-4 items-center transition-colors" style="border-bottom:1px solid var(--stroke-subtle);" onmouseover="this.style.backgroundColor='#ffffff05'" onmouseout="this.style.backgroundColor='transparent'">**

&#x20;                 **<div class="lg:col-span-2">**

&#x20;                   **<p class="text-xs">12 Apr 2025</p>**

&#x20;                   **<p class="text-xs mt-0.5" style="color:var(--t-tertiary);">**

&#x20;                     **GW 32 · 17:30**

&#x20;                   **</p>**

&#x20;                 **</div>**

&#x20;                 **<div class="lg:col-span-3 flex items-center gap-2.5">**

&#x20;                   **<span class="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-medium shrink-0" style="background-color:#2b1a1a; color:#ffbc99;">**

&#x20;                     **ARS**

&#x20;                   **</span>**

&#x20;                   **<span class="text-xs truncate">Arsenal</span>**

&#x20;                 **</div>**

&#x20;                 **<div class="lg:col-span-2 lg:text-center">**

&#x20;                   **<span class="text-sm font-medium tracking-tight">3 – 2</span>**

&#x20;                   **<p class="text-xs mt-0.5" style="color:var(--t-tertiary);">**

&#x20;                     **HT 0 – 2**

&#x20;                   **</p>**

&#x20;                 **</div>**

&#x20;                 **<div class="lg:col-span-3 flex items-center gap-2.5">**

&#x20;                   **<span class="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-medium shrink-0" style="background-color:#1a2530; color:#b1e5fc;">**

&#x20;                     **MCI**

&#x20;                   **</span>**

&#x20;                   **<span class="text-xs truncate">Manchester City</span>**

&#x20;                 **</div>**

&#x20;                 **<div class="lg:col-span-2 flex flex-wrap lg:justify-end gap-1.5">**

&#x20;                   **<span class="text-xs px-1.5 py-0.5 rounded-md" style="background-color:#00a6561f; color:var(--primary-02);">**

&#x20;                     **BTTS**

&#x20;                   **</span>**

&#x20;                   **<span class="text-xs px-1.5 py-0.5 rounded-md" style="background-color:#ff9d341f; color:var(--primary-05);">**

&#x20;                     **Comeback**

&#x20;                   **</span>**

&#x20;                 **</div>**

&#x20;               **</div>**



&#x20;               **<!-- row 2 -->**

&#x20;               **<div class="grid grid-cols-1 lg:grid-cols-12 gap-3 px-5 py-4 items-center transition-colors" style="border-bottom:1px solid var(--stroke-subtle);" onmouseover="this.style.backgroundColor='#ffffff05'" onmouseout="this.style.backgroundColor='transpar**

&#x20;                   **\&lt;/p\&gt;**

&#x20;                 **\&lt;/div\&gt;**

&#x20;                 **\&lt;div class=" lg:col-span-3="" flex="" items-center="" gap-2.5"="">**

&#x20;                   **<span class="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-medium shrink-0" style="background-color:#1c2a1c; color:#b5e4ca;">**

&#x20;                     **LIV**

&#x20;                   **</span>**

&#x20;                   **<span class="text-xs truncate">Liverpool</span>**

&#x20;                 **</div>**

&#x20;                 **<div class="lg:col-span-2 lg:text-center">**

&#x20;                   **<span class="text-sm font-medium tracking-tight">2 – 2</span>**

&#x20;                   **<p class="text-xs mt-0.5" style="color:var(--t-tertiary);">**

&#x20;                     **HT 1 – 1**

&#x20;                   **</p>**

&#x20;                 **</div>**

&#x20;                 **<div class="lg:col-span-3 flex items-center gap-2.5">**

&#x20;                   **<span class="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-medium shrink-0" style="background-color:#26222f; color:#cabdff;">**

&#x20;                     **CHE**

&#x20;                   **</span>**

&#x20;                   **<span class="text-xs truncate">Chelsea</span>**

&#x20;                 **</div>**

&#x20;                 **<div class="lg:col-span-2 flex flex-wrap lg:justify-end gap-1.5">**

&#x20;                   **<span class="text-xs px-1.5 py-0.5 rounded-md" style="background-color:#00a6561f; color:var(--primary-02);">**

&#x20;                     **BTTS**

&#x20;                   **</span>**

&#x20;                   **<span class="text-xs px-1.5 py-0.5 rounded-md" style="background-color:#2a85ff1f; color:var(--primary-01);">**

&#x20;                     **Over 2.5**

&#x20;                   **</span>**

&#x20;                 **</div>**

&#x20;               **</div>**



&#x20;               **<!-- row 3 -->**

&#x20;               **<div class="grid grid-cols-1 lg:grid-cols-12 gap-3 px-5 py-4 items-center transition-colors" style="border-bottom:1px solid var(--stroke-subtle);" onmouseover="this.style.backgroundColor='#ffffff05'" onmouseout="this.style.backgroundColor='transparent'">**

&#x20;                 **<div class="lg:col-span-2">**

&#x20;                   **<p class="text-xs">05 Apr 2025</p>**

&#x20;                   **<p class="text-xs mt-0.5" style="color:var(--t-tertiary);">**

&#x20;                     **GW 31 · 15:00**

&#x20;                   **</p>**

&#x20;                 **</div>**

&#x20;                 **<div class="lg:col-span-3 flex items-center gap-2.5">**

&#x20;                   **<span class="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-medium shrink-0" style="background-color:#2b2a1a; color:#ffd88d;">**

&#x20;                     **TOT**

&#x20;                   **</span>**

&#x20;                   **<span class="text-xs truncate">Tottenham</span>**

&#x20;                 **</div>**

&#x20;                 **<div class="lg:col-span-2 lg:text-center">**

&#x20;                   **<span class="text-sm font-medium tracking-tight">1 – 0</span>**

&#x20;                   **<p class="text-xs mt-0.5" style="color:var(--t-tertiary);">**

&#x20;                     **HT 0 – 0**

&#x20;                   **</p>**

&#x20;                 **</div>**

&#x20;                 **<div class="lg:col-span-3 flex items-center gap-2.5">**

&#x20;                   **<span class="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-medium shrink-0" style="background-color:#2b1a1a; color:#ffbc99;">**

&#x20;                     **NEW**

&#x20;                   **</span>**

&#x20;                   **<span class="text-xs truncate">Newcastle</span>**

&#x20;                 **</div>**

&#x20;                 **<div class="lg:col-span-2 flex flex-wrap lg:justify-end gap-1.5">**

&#x20;                   **<span class="text-xs px-1.5 py-0.5 rounded-md" style="background-color:#7272721f; color:var(--t-secondary);">**

&#x20;                     **Clean sheet**

&#x20;                   **</span>**

&#x20;                 **</div>**

&#x20;               **</div>**



&#x20;               **<!-- row 4 -->**

&#x20;               **<div class="grid grid-cols-1 lg:grid-cols-12 gap-3 px-5 py-4 items-center transition-colors" style="border-bottom:1px solid var(--stroke-subtle);" onmouseover="this.style.backgroundColor='#ffffff05'" onmouseout="this.style.backgroundColor='transparent'">**

&#x20;                 **<div class="lg:col-span-2">**

&#x20;                   **<p class="text-xs">01 Apr 2025</p>**

&#x20;                   **<p class="text-xs mt-0.5" style="color:var(--t-tertiary);">**

&#x20;                     **GW 30 · 19:45**

&#x20;                   **</p>**

&#x20;                 **</div>**

&#x20;                 **<div class="lg:col-span-3 flex items-center gap-2.5">**

&#x20;                   **<span class="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-medium shrink-0" style="background-color:#1a2530; color:#b1e5fc;">**

&#x20;                     **BHA**

&#x20;                   **</span>**

&#x20;                   **<span class="text-xs truncate">Brighton</span>**

&#x20;                 **</div>**

&#x20;                 **<div class="lg:col-span-2 lg:text-center">**

&#x20;                   **<span class="text-sm font-medium tracking-tight">2 – 3</span>**

&#x20;                   **<p class="text-xs mt-0.5" style="color:var(--t-tertiary);">**

&#x20;                     **HT 2 – 0**

&#x20;                   **</p>**

&#x20;                 **</div>**

&#x20;                 **<div class="lg:col-span-3 flex items-center gap-2.5">**

&#x20;                   **<span class="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-medium shrink-0" style="background-color:#221f2e; color:#cabdff;">**

&#x20;                     **AVL**

&#x20;                   **</span>**

&#x20;                   **<span class="text-xs truncate">Aston Villa</span>**

&#x20;                 **</div>**

&#x20;                 **<div class="lg:col-span-2 flex flex-wrap lg:justify-end gap-1.5">**

&#x20;                   **<span class="text-xs px-1.5 py-0.5 rounded-md" style="background-color:#00a6561f; color:var(--primary-02);">**

&#x20;                     **BTTS**

&#x20;                   **</span>**

&#x20;                   **<span class="text-xs px-1.5 py-0.5 rounded-md" style="background-color:#ff381c1f; color:var(--primary-03);">**

&#x20;                     **Away comeback**

&#x20;                   **</span>**

&#x20;                 **</div>**

&#x20;               **</div>**



&#x20;               **<!-- row 5 -->**

&#x20;               **<div class="grid grid-cols-1 lg:grid-cols-12 gap-3 px-5 py-4 items-center transition-colors" style="border-bottom:1px solid var(--stroke-subtle);" onmouseover="this.style.backgroundColor='#ffffff05'" onmouseout="this.style.backgroundColor='transparent'">**

&#x20;                 **<div class="lg:col-span-2">**

&#x20;                   **<p class="text-xs">29 Mar 2025</p>**

&#x20;                   **<p class="text-xs mt-0.5" style="color:var(--t-tertiary);">**

&#x20;                     **GW 30 · 16:30**

&#x20;                   **</p>**

&#x20;                 **</div>**

&#x20;                 **<div class="lg:col-span-3 flex items-center gap-2.5">**

&#x20;                   **<span class="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-medium shrink-0" style="background-color:#26222f; color:#cabdff;">**

&#x20;                     **MUN**

&#x20;                   **</span>**

&#x20;                   **<span class="text-xs truncate">Manchester United</span>**

&#x20;                 **</div>**

&#x20;                 **<div class="lg:col-span-2 lg:text-center">**

&#x20;                   **<span class="text-sm font-medium tracking-tight\&lt;span**

&#x20;                     **class=" w-7="" h-7="" rounded-lg="" flex="" items-center="" justify-center="" text-xs="" font-medium="" shrink-0"="" style="background-color:#2b2a1a; color:#ffd88d;">**

&#x20;                     **WOL**

&#x20;                   **</span>**

&#x20;                   **<span class="text-xs truncate">Wolves</span>**

&#x20;                 **</div>**

&#x20;                 **<div class="lg:col-span-2 flex flex-wrap lg:justify-end gap-1.5">**

&#x20;                   **<span class="text-xs px-1.5 py-0.5 rounded-md" style="background-color:#7272721f; color:var(--t-secondary);">**

&#x20;                     **Under 2.5**

&#x20;                   **</span>**

&#x20;                 **</div>**

&#x20;               **</div>**



&#x20;               **<!-- row 6 -->**

&#x20;               **<div class="grid grid-cols-1 lg:grid-cols-12 gap-3 px-5 py-4 items-center transition-colors" onmouseover="this.style.backgroundColor='#ffffff05'" onmouseout="this.style.backgroundColor='transparent'">**

&#x20;                 **<div class="lg:col-span-2">**

&#x20;                   **<p class="text-xs">22 Mar 2025</p>**

&#x20;                   **<p class="text-xs mt-0.5" style="color:var(--t-tertiary);">**

&#x20;                     **GW 29 · 14:00**

&#x20;                   **</p>**

&#x20;                 **</div>**

&#x20;                 **<div class="lg:col-span-3 flex items-center gap-2.5">**

&#x20;                   **<span class="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-medium shrink-0" style="background-color:#2b1a1a; color:#ffbc99;">**

&#x20;                     **WHU**

&#x20;                   **</span>**

&#x20;                   **<span class="text-xs truncate">West Ham</span>**

&#x20;                 **</div>**

&#x20;                 **<div class="lg:col-span-2 lg:text-center">**

&#x20;                   **<span class="text-sm font-medium tracking-tight">4 – 1</span>**

&#x20;                   **<p class="text-xs mt-0.5" style="color:var(--t-tertiary);">**

&#x20;                     **HT 2 – 1**

&#x20;                   **</p>**

&#x20;                 **</div>**

&#x20;                 **<div class="lg:col-span-3 flex items-center gap-2.5">**

&#x20;                   **<span class="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-medium shrink-0" style="background-color:#1c2a1c; color:#b5e4ca;">**

&#x20;                     **EVE**

&#x20;                   **</span>**

&#x20;                   **<span class="text-xs truncate">Everton</span>**

&#x20;                 **</div>**

&#x20;                 **<div class="lg:col-span-2 flex flex-wrap lg:justify-end gap-1.5">**

&#x20;                   **<span class="text-xs px-1.5 py-0.5 rounded-md" style="background-color:#00a6561f; color:var(--primary-02);">**

&#x20;                     **BTTS**

&#x20;                   **</span>**

&#x20;                   **<span class="text-xs px-1.5 py-0.5 rounded-md" style="background-color:#2a85ff1f; color:var(--primary-01);">**

&#x20;                     **Over 2.5**

&#x20;                   **</span>**

&#x20;                 **</div>**

&#x20;               **</div>**

&#x20;             **</div>**



&#x20;             **<!-- pagination -->**

&#x20;             **<div class="flex flex-wrap items-center gap-3 px-5 py-3.5" style="border-top:1px solid var(--stroke-subtle);">**

&#x20;               **<p class="text-xs" style="color:var(--t-tertiary);">**

&#x20;                 **Showing 1–6 of 1,284 matches**

&#x20;               **</p>**

&#x20;               **<div class="ml-auto flex items-center gap-1.5">**

&#x20;                 **<button class="w-8 h-8 rounded-lg flex items-center justify-center" style="background-color:var(--b-surface1); border:1px solid var(--stroke-border); color:var(--t-tertiary);">**

&#x20;                   **<iconify-icon icon="solar:alt-arrow-left-linear" width="15"></iconify-icon>**

&#x20;                 **</button>**

&#x20;                 **<button onclick="setPage(this)" class="page-btn active w-8 h-8 rounded-lg text-xs transition-all">**

&#x20;                   **1**

&#x20;                 **</button>**

&#x20;                 **<button onclick="setPage(this)" class="page-btn w-8 h-8 rounded-lg text-xs transition-all">**

&#x20;                   **2**

&#x20;                 **</button>**

&#x20;                 **<button onclick="setPage(this)" class="page-btn w-8 h-8 rounded-lg text-xs transition-all">**

&#x20;                   **3**

&#x20;                 **</button>**

&#x20;                 **<span class="text-xs px-1" style="color:var(--t-tertiary);">**

&#x20;                   **…**

&#x20;                 **</span>**

&#x20;                 **<button onclick="setPage(this)" class="page-btn w-8 h-8 rounded-lg text-xs transition-all">**

&#x20;                   **214**

&#x20;                 **</button>**

&#x20;                 **<button class="w-8 h-8 rounded-lg flex items-center justify-center" style="background-color:var(--b-surface1); border:1px solid var(--stroke-border); color:var(--t-secondary);">**

&#x20;                   **<iconify-icon icon="solar:alt-arrow-right-linear" width="15"></iconify-icon>**

&#x20;                 **</button>**

&#x20;               **</div>**

&#x20;             **</div>**

&#x20;           **</div>**

&#x20;         **</section>**



&#x20;         **<footer class="flex flex-wrap items-center gap-3 pt-2 pb-4 text-xs" style="color:var(--t-tertiary);">**

&#x20;           **<span>© 2025 winmix studio</span>**

&#x20;           **<span class="hidden sm:inline">·</span>**

&#x20;           **<span>Data updated 2 min ago</span>**

&#x20;           **<div class="ml-auto flex items-center gap-4">**

&#x20;             **<a href="#" class="transition-colors hover:text-white">Docs</a>**

&#x20;             **<a href="#" class="transition-colors hover:text-white">API</a>**

&#x20;             **<a href="#" class="transition-colors hover:text-white">Support</a>**

&#x20;           **</div>**

&#x20;         **</footer>**

&#x20;       **</div>**

&#x20;     **</main>**

&#x20;   **</div>**



&#x20;   **<style>**

&#x20;     **.nav-item {**

&#x20;       **color: var(--t-secondary);**

&#x20;     **}**

&#x20;     **.nav-item:hover {**

&#x20;       **color: var(--t-primary);**

&#x20;       **background-color: #ffffff08;**

&#x20;     **}**

&#x20;     **.nav-item.active {**

&#x20;       **color: var(--t-primary);**

&#x20;       **background-color: var(--b-pop);**

&#x20;       **box-shadow: var(--shadow-depth);**

&#x20;     **}**

&#x20;     **.menu-item {**

&#x20;       **color: var(--t-secondary);**

&#x20;     **}**

&#x20;     **.menu-item:hover {**

&#x20;       **color: var(--t-primary);**

&#x20;       **background-color: #ffffff0a;**

&#x20;     **}**

&#x20;     **.t-secondary);**

&#x20;       **background-color: var(--b-surface1);**

&#x20;       **border: 1px solid var(--stroke-border);**

&#x20;     **}**

&#x20;     **.page-btn:hover {**

&#x20;       **color: var(--t-primary);**

&#x20;     **}**

&#x20;     **.page-btn.active {**

&#x20;       **color: #fdfdfd;**

&#x20;       **background-color: var(--primary-01);**

&#x20;       **border-color: var(--primary-01);**

&#x20;     **}**

&#x20;     **::-webkit-scrollbar {**

&#x20;       **width: 6px;**

&#x20;       **height: 6px;**

&#x20;     **}**

&#x20;     **::-webkit-scrollbar-track {**

&#x20;       **background: transpar**

&#x20;     **}**

&#x20;     **html {**

&#x20;       **scroll-behavior: smooth;**

&#x20;     **}**

&#x20;   **</style>**



&#x20;   **<script>**

&#x20;     **function toggleSidebar() {**

&#x20;       **const s = document.getElementById("sidebar");**

&#x20;       **const o = document.getElementById("overlay");**

&#x20;       **s.classList.toggle("-translate-x-full");**

&#x20;       **o.classList.toggle("hidden");**

&#x20;     **}**



&#x20;     **function toggleMenu(id) {**

&#x20;       **const el = document.getElementById(id);**

&#x20;       **document.querySelectorAll(".dd-menu, #leagueMenu").forEach((m) => {**

&#x20;         **if (m.id !== id) m.classList.add("hidden");**

&#x20;       **});**

&#x20;       **el.classList.toggle("hidden");**

&#x20;     **}**



&#x20;     **document.addEventListener("click", (e) => {**

&#x20;       **if (!e.target.closest(".relative")) {**

&#x20;         **document**

&#x20;           **.querySelectorAgetElementById("leagueMenu").classList.add("hidden");**

&#x20;     **}**



&#x20;     **function pickOption(btn, menuId, labelId) {**

&#x20;       **document.getElementById(labelId).textContent = btn.textContent.trim();**

&#x20;       **document.getElementById(menuId).classList.add("hidden");**

&#x20;     **}**



&#x20;     **function resetFilters() {**

&#x20;       **document.getElementById("ddHomeLabel").textContent = "All teams";**

&#x20;       **document.getElementById("ddAwayLabel").textContent = "All teams";**

&#x20;       **document.getElementById("ddBttsLabel").textContent = "Any";**

&#x20;       **document.getElementById("ddComebackLabel").textContent = "Any";**

&#x20;     **}**



&#x20;     **function setTab(btn) {**

&#x20;       **btn.parentElement**

&#x20;         **.querySelectorAll(".seg-tab")**

&#x20;         **.forEach((t) => t.classList.remove("active"));**

&#x20;       **btn.classList.add("active");**

&#x20;     **}**



&#x20;     **function setPage(btn) {**

&#x20;       **btn.parentElement**

&#x20;         **.querySelectorAll(".page-btn")**

&#x20;         **.forEach((t) => t.classList.remove("active"));**

&#x20;       **btn.classList.add("active");**

&#x20;     **}**



&#x20;     **function toggleSwitch(btn) {**

&#x20;       **const on = btn.dataset.on === "true";**

&#x20;       **const knob = btn.querySelector("span");**

&#x20;       **if (on) {**

&#x20;         **btn.dataset.on = "false";**

&#x20;         **btn.style.backgroundColor = "var(--shade-04)";**

&#x20;         **knob.style.transform = "translateX(0px)";**

&#x20;         **knob.style.backgroundColor = "var(--shade-06)";**

&#x20;         **knob.classList.remove("bg-white");**

&#x20;       **} else {**

&#x20;         **btn.dataset.on = "true";**

&#x20;         **btn.style.backgroundColor = "var(--primary-01)";**

&#x20;         **knob.style.transform = "translateX(16px)";**

&#x20;         **knob.style.backgroundColor = "#fdfdfd";**

&#x20;         **knob.style.boxShadow = "0 1px 3px #00000066";**

&#x20;       **}**

&#x20;     **}**



&#x20;     **function toggleCheck(label) {**

&#x20;       **const box = label.querySelector("\[data-box]");**

&#x20;       **const icon = box.querySelector("iconify-icon");**

&#x20;       **const checked = box.style.backgroundColor !== "transparent";**

&#x20;       **if (checked) {**

&#x20;         **box.style.backgroundColor = "transparent";**

&#x20;         **box.style.borderColor = "#3a3a3a";**

&#x20;         **icon.style.display = "none";**

&#x20;       **} else {**

&#x20;         **box.style.backgroundColor = "var(--primary-01)";**

&#x20;         **box.style.borderColor = "var(--primary-01)";**

&#x20;         **icon.style.display = "block";**

&#x20;       **}**

&#x20;     **}**



&#x20;     **// Value bet slider**

&#x20;     **(function () {**

&#x20;       **const track = document.getElementById("track");**

&#x20;       **const fill = document.getElementById("fill");**

&#x20;       **const thumb = document.getElementById("thumb");**

&#x20;       **const out = document.getElementById("sliderVal");**

&#x20;       **let dragging = false;**



&#x20;       **function setFromX(clientX) {**

&#x20;         **const r = track.getBoundingClientRect();**

&#x20;         **let p = (clientX - r.left) / r.width;**

&#x20;         **p = Math.max(0, Math.min(1, p));**

&#x20;         **fill.style.width = p \* 100 + "%";**

&#x20;         **thumb.style.left = p \* 100 + "%";**

&#x20;         **out.textContent = (p \* 15).toFixed(1) + "%";**

&#x20;       **}**



&#x20;       **track.addEventListener("mousedown", (e) => {**

&#x20;         **dragging = true;**

&#x20;         **setFromX(e.clientX);**

&#x20;       **});**

&#x20;       **window.addEventListener("mousemove", (e) => {**

&#x20;         **if (dragging) setFromX(e.clientX);**

&#x20;       **});**

&#x20;       **window.addEventListener("mouseup", () => (dragging = false));**

&#x20;       **track.addEventListener(**

&#x20;         **"touchstart",**

&#x20;         **(e) => setFromX(e.touches\[0].clientX),**

&#x20;         **{ passive: true }**

&#x20;       **);**

&#x20;       **track.addEventListener(**

&#x20;         **"touchmove",**

&#x20;         **(e) => setFromX(e.touches\[0].clientX),**

&#x20;         **{ passive: true }**

&#x20;       **);**

&#x20;     **})();**

&#x20;   **</script>**

&#x20; 

**</body></html>**

