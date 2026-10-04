**<!DOCTYPE html>**

**<html lang="hu" class="antialiased"><head>**

&#x20; **<meta charset="UTF-8">**

&#x20; **<meta name="viewport" content="width=device-width, initial-scale=1.0">**

&#x20; **<title>Match Analytics \&amp; Result Dashboard</title>**

&#x20; **<link rel="preconnect" href="https://fonts.googleapis.com">**

&#x20; **<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="">**

&#x20; **<link href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@600;700\&family=Inter:wght@400;500;600;700\&family=JetBrains+Mono:wght@500;600;700\&display=swap" rel="stylesheet">**

&#x20; **<script src="https://cdn.tailwindcss.com"></script>**

&#x20; **<script>**

&#x20;   **tailwind.config = {**

&#x20;     **theme: {**

&#x20;       **extend: {**

&#x20;         **fontFamily: {**

&#x20;           **sans: \['Inter', 'sans-serif'],**

&#x20;           **display: \['Instrument Sans', 'sans-serif'],**

&#x20;           **mono: \['JetBrains Mono', 'monospace'],**

&#x20;         **},**

&#x20;         **colors: {**

&#x20;           **shell: '#101010',**

&#x20;           **surface: '#212116',**

&#x20;           **surfaceInactive: '#2a2a1e',**

&#x20;           **neon: {**

&#x20;             **DEFAULT: '#e1fd3e',**

&#x20;             **muted: 'rgba(225, 253, 62, 0.40)',**

&#x20;             **soft: 'rgba(225, 253, 62, 0.12)',**

&#x20;           **},**

&#x20;           **gold: {**

&#x20;             **DEFAULT: '#d3a240',**

&#x20;             **soft: 'rgba(211, 162, 64, 0.14)',**

&#x20;           **},**

&#x20;           **olive: {**

&#x20;             **DEFAULT: '#6f962c',**

&#x20;             **soft: 'rgba(111, 150, 44, 0.14)',**

&#x20;           **}**

&#x20;         **},**

&#x20;         **boxShadow: {**

&#x20;           **'shell-elevated': '0 24px 48px -12px rgba(0, 0, 0, 0.85), 0 1px 2px rgba(255, 255, 255, 0.05)',**

&#x20;           **'inner-panel': 'inset 0 1px 0 rgba(255, 255, 255, 0.06), 0 10px 28px rgba(0, 0, 0, 0.45)',**

&#x20;         **}**

&#x20;       **}**

&#x20;     **}**

&#x20;   **}**

&#x20; **</script>**

&#x20; **<style>**

&#x20;   **:root {**

&#x20;     **--lime: #e1fd3e;**

&#x20;     **--gold: #d3a240;**

&#x20;     **--olive: #6f962c;**

&#x20;     **--panel: #212116;**

&#x20;     **--shell: #101010;**

&#x20;   **}**



&#x20;   **@media (prefers-reduced-motion: reduce) {**



&#x20;     **\*,**

&#x20;     **::before,**

&#x20;     **::after {**

&#x20;       **animation-duration: 0.01ms !important;**

&#x20;       **animation-iteration-count: 1 !important;**

&#x20;       **transition-duration: 0.01ms !important;**

&#x20;     **}**

&#x20;   **}**



&#x20;   **.focus-ring {**

&#x20;     **outline: none;**

&#x20;   **}**



&#x20;   **.focus-ring:focus-visible {**

&#x20;     **outline: 2px solid #e1fd3e;**

&#x20;     **outline-offset: 2px;**

&#x20;   **}**

&#x20; **</style>**

**</head>**



**<body class="min-h-screen bg-\[#090909] text-neutral-200 font-sans flex items-center justify-center p-4 sm:p-8 selection:bg-neon selection:text-black">**



&#x20; **<main class="grid grid-cols-1 md:grid-cols-2 w-full max-w-5xl mr-auto ml-auto gap-x-6 gap-y-6 items-start justify-center">**



&#x20;   **<!-- ==========================================**

&#x20;        **1. KÁRTYA: MATCH ANALYTICS (BIZTONSÁGI TREND)**

&#x20;        **========================================== -->**

&#x20;   **<article class="flex flex-col border-white/\[0.07] shadow-shell-elevated overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:border-white/\[0.14] group w-full max-w-\[390px] border rounded-\[36px] mr-auto ml-auto relative">**



&#x20;     **<!-- Top Shell Header -->**

&#x20;     **<header class="relative z-10 flex w-full items-center justify-between px-6 pt-4 pb-2.5">**

&#x20;       **<div class="inline-flex items-center gap-2">**

&#x20;         **<span class="w-2 h-2 rounded-full bg-neon shadow-\[0\_0\_8px\_#e1fd3e]" aria-hidden="true"></span>**

&#x20;         **<span class="text-\[11px] font-bold tracking-\[0.16em] uppercase font-display text-neon/90">**

&#x20;           **Analytics Module**

&#x20;         **</span>**

&#x20;       **</div>**



&#x20;       **<div class="flex items-center gap-2">**

&#x20;         **<!-- Model Match Dot -->**

&#x20;         **<span class="w-2 h-2 rounded-full bg-amber-400 shadow-\[0\_0\_6px\_rgba(251,191,36,0.6)]" title="Modell-egyezés: neutral" aria-label="Modell-egyezés: neutral"></span>**



&#x20;         **<!-- Refresh / Swap Button -->**

&#x20;         **<button type="button" aria-label="1 · Core — másik jelölt" class="focus-ring inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-\[10px] font-medium text-neutral-400 bg-white/\[0.04] border border-white/\[0.06] hover:text-neon hover:bg-white/\[0.08] hover:border-neon/30 transition-all">**

&#x20;           **<svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">**

&#x20;             **<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path>**

&#x20;             **<path d="M21 3v5h-5"></path>**

&#x20;             **<path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path>**

&#x20;             **<path d="M8 16H3v5"></path>**

&#x20;           **</svg>**

&#x20;           **<span class="">Csere</span>**

&#x20;         **</button>**

&#x20;       **</div>**

&#x20;     **</header>**



&#x20;     **<!-- Inner Match Panel (#212116) -->**

&#x20;     **<div class="flex flex-col w-\[calc(100%-16px)] mx-auto mb-2.5 p-4 sm:p-5 bg-surface border border-gold/15 shadow-inner-panel rounded-\[28px] relative backdrop-blur-md gap-3.5">**



&#x20;       **<!-- Module Header \& Match Pick -->**

&#x20;       **<div class="flex justify-between items-center mb-6">**

&#x20; **<!-- Hazai csapat -->**

&#x20; **<div class="text-center w-5/12 flex flex-col items-center">**

&#x20;   **<img src="https://resources.premierleague.com/premierleague/badges/50/t3.png" alt="Arsenal Logo" width="60" height="60" class="mx-auto mb-2 drop-shadow-md hover:scale-105 transition-transform" loading="lazy">**

&#x20;   **<span class="text-sm font-semibold text-gray-100">Arsenal</span>**

&#x20; **</div>**



&#x20; **<!-- Összes meccs számláló -->**

&#x20; **<div class="text-center w-2/12">**

&#x20;   **<div class="text-2xl font-bold text-\[#CCFF00]">28</div>**

&#x20;   **<div class="text-\[11px] uppercase tracking-wider text-gray-400">Matches</div>**

&#x20; **</div>**



&#x20; **<!-- Vendég csapat -->**

&#x20; **<div class="text-center w-5/12 flex flex-col items-center">**

&#x20;   **<img src="https://resources.premierleague.com/premierleague/badges/50/t8.png" alt="Chelsea Logo" width="60" height="60" class="mx-auto mb-2 drop-shadow-md hover:scale-105 transition-transform" loading="lazy">**

&#x20;   **<span class="text-sm font-semibold text-gray-100">Chelsea</span>**

&#x20; **</div>**

**</div>**



&#x20;       **<!-- 1. H2H Tényadatok (18 meccs) -->**

&#x20;       **<div class="rounded-2xl border border-white/\[0.05] bg-black/40 p-3 shadow-\[inset\_0\_1px\_0\_rgba(255,255,255,.04)]">**

&#x20; **<!-- Hazai győzelem -->**

&#x20; **<div class="text-center tooltip">**

&#x20; **<div class="text-xl font-bold text-white">14</div>**

&#x20; **<div class="text-xs text-gray-400">Home Wins</div>**

&#x20; **<div class="text-sm font-semibold text-\[#CCFF00]">50.0%</div>**

&#x20; 

**</div>**



&#x20; **<!-- Döntetlen -->**

&#x20; **<div class="text-center tooltip border-x border-white/10">**

&#x20;   **<div class="text-xl font-bold text-white">6</div>**

&#x20;   **<div class="text-xs text-gray-400">Draws</div>**

&#x20;   **<div class="text-sm font-semibold text-gray-300">21.4%</div>**

&#x20;   

&#x20; **</div>**



&#x20; **<!-- Vendég győzelem -->**

&#x20; **<div class="text-center tooltip">**

&#x20;   **<div class="text-xl font-bold text-white">8</div>**

&#x20;   **<div class="text-xs text-gray-400">Away Wins</div>**

&#x20;   **<div class="text-sm font-semibold text-gray-300">28.6%</div>**

&#x20;   

&#x20; **</div>**

**</div>**



&#x20;       **<!-- 2. Gólpiaci \& Félidei arányok -->**

&#x20;       **<div class="flex items-center justify-between gap-3 py-1">**

&#x20; **<div class="text-center tooltip bg-\[#141414]/60 p-2.5 rounded-xl border border-white/5">**

&#x20;   **<div class="text-xs text-gray-400">Home Avg</div>**

&#x20;   **<div class="text-base font-bold text-white">1.85</div>**



&#x20; **</div>**

&#x20; **<div class="inline-flex gap-2 bg-\[#CCFF00]/10 border-\[#CCFF00]/30 border rounded-full pt-1.5 pr-4 pb-1.5 pl-4 gap-x-2 gap-y-2 items-center">**

&#x20;   **<div class="text-xs text-gray-400 uppercase tracking-wider">Avg. Goals</div>**

&#x20;   **<div class="text-2xl font-black text-\[#CCFF00]">2.95</div>**



&#x20; **</div>**

&#x20; **<div class="text-center tooltip bg-\[#141414]/60 p-2.5 rounded-xl border border-white/5">**

&#x20;   **<div class="text-xs text-gray-400">Away Avg</div>**

&#x20;   **<div class="text-base font-bold text-white">1.10</div>**



&#x20; **</div>**

**</div>**



&#x20;       **<!-- 3. Leggyakoribb eredmények \& HT/FT Fordulat -->**

&#x20;       **<div class="mb-5 bg-\[#141414]/60 p-3 rounded-xl border border-white/5">**

&#x20; **<div class="flex justify-between items-center mb-2">**

&#x20;   **<span class="text-xs font-semibold text-gray-300 tooltip">**

&#x20;                         **Both Teams Scored (BTTS)**

&#x20;                         

**</span>**

&#x20;   **<span class="text-xs font-bold text-\[#CCFF00]">64.3%</span>**

&#x20; **</div>**

&#x20; **<div class="w-full bg-white/10 rounded-full h-2 overflow-hidden">**

&#x20;   **<div class="bg-\[#CCFF00] h-2 rounded-full transition-all duration-500 ease-out" style="width: 64.3%"></div>**

&#x20; **</div>**

**</div>**



&#x20;       **<!-- 4. Bottom KPI Metrics Bar -->**

&#x20;       **<div class="grid grid-cols-2 gap-3 mb-5">**

&#x20; **<div class="text-center tooltip bg-\[#141414]/60 p-2.5 rounded-xl border border-white/5">**

&#x20;   **<div class="text-xs text-gray-400 mb-0.5">Home Form Index</div>**

&#x20;   **<div class="text-lg font-bold text-\[#CCFF00]">82.4</div>**

&#x20;   

&#x20; **</div>**

&#x20; **<div class="text-center tooltip bg-\[#141414]/60 p-2.5 rounded-xl border border-white/5">**

&#x20;   **<div class="text-xs text-gray-400 mb-0.5">Away Form Index</div>**

&#x20;   **<div class="text-lg font-bold text-\[#CCFF00]">71.0</div>**

&#x20;   

&#x20; **</div>**

**</div>**



&#x20;     **</div>**

&#x20;   **</article>**





&#x20;   **<!-- ==========================================**

&#x20;        **2. KÁRTYA: FINAL RESULT \& MECCSRÉSZLETEK**

&#x20;        **========================================== -->**

&#x20;   



&#x20; **</main><section aria-label="Elemző és meccskártyák" class="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 items-start justify-center" id="cards-container">**



&#x20; **<!-- CARD 1 -->**

&#x20; **<article aria-labelledby="card1-title" class="flex flex-col shadow-card-elevated overflow-hidden transition-all duration-300 hover:border-white/20 w-full max-w-\[430px] border-white/10 border rounded-card mr-auto ml-auto" role="region" aria-describedby="card1-desc">**

&#x20; **<!-- Top Shell Header -->**

&#x20; **</article>**



&#x20; **<!-- CARD 2 -->**

&#x20; 



**</section>**







**</body></html>**

