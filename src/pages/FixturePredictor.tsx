import { useCallback, useMemo } from 'react';
import { ListChecks, Play, RotateCcw, Search, Sigma, Target, TrendingUp, X } from 'lucide-react';
import { toast } from 'sonner';
import { LEAGUES } from '../data/leagues';
import { useWinmix } from '../contexts/WinmixContext';
import { buildTeamPool, fixturesOf, usedTeamKeys } from '../utils/fixtures';
import {
  combinedProbability,
  draftToSlip,
  duplicateFixtures,
  hasLines,
  rankedPatterns,
  swapSlot,
  type ActiveSlipRole } from
'../utils/slip';
import { useRoundAnalysis } from '../hooks/useRoundAnalysis';
import { defaultSlipMarkets } from '../utils/marketCatalog';
import { QUICK_STRATEGY, defaultCoreStrategy } from '../utils/coreStrategy';
import type {
  CoreStrategySettings,
  League,
  SlipMarketPreferences } from
'../types/winmix';
import { MetricCard, MetricGrid } from '../components/winmix/MetricCard';
import { Collapsible } from '../components/winmix/Collapsible';
import { CoreDecisionTracePanel } from '../components/winmix/CoreDecisionTracePanel';
import { CoreGateStatus } from '../components/winmix/CoreGateStatus';
import { CoreStrategySelector } from '../components/winmix/CoreStrategySelector';
import { FixtureCard } from '../components/winmix/FixtureCard';
import { MarketPoolSelector } from '../components/winmix/MarketPoolSelector';
import { PageHeader } from '../components/winmix/PageHeader';
import { Panel, PanelActions, PanelHeader, PanelTitle } from '../components/winmix/Panel';
import {
  StateEmptyPanel,
  StateError,
  StateNotice,
  StateProgress } from
'../components/winmix/PanelState';
import { RoundBuilder } from '../components/winmix/RoundBuilder';
import { SlipPanel } from '../components/winmix/SlipPanel';
import { PatternConfidenceSummary } from '../components/winmix/PatternConfidenceSummary';
import { EmptyCoreReasons } from '../components/winmix/EmptyCoreReasons';
import { ProductionGatesPanel } from '../components/winmix/ProductionGatesPanel';
import { ZeroCoreNotice } from '../components/winmix/ZeroCoreNotice';
import { MobileSlipBar } from '../components/winmix/MobileSlipBar';

const INTRO =
'Állítsd össze a hét 8 angol és 8 spanyol mérkőzését, majd futtasd az ' +
'elemzést: a rendszer a teljes kumulatív H2H adatbázisból kibányássza a ' +
'mintákat, és hat slotra osztja őket — három core és három joker sor. A core ' +
'oldalt egyetlen kattintással a Core stratégia állítja be; az alapérték a ' +
'profil-biztos BTTS, amely csak a szigorú kapun belüli, stabil kétoldalú ' +
'gólprofilú párosításokat engedi be, és üresen hagyja a kártyát, ha nincs ' +
'ilyen. A kártyánkénti piac-készlet a haladó panelen továbbra is elérhető.';

export function FixturePredictor() {
  const {
    seasons,
    round,
    teamAliasMap,
    setFixtureTeam,
    clearFixture,
    renameRound,
    resetRound,
    saveSlip,
    settings,
    updateSettings
  } = useWinmix();

  const markets = settings.slipMarkets ?? defaultSlipMarkets();
  const strategy = settings.coreStrategy ?? defaultCoreStrategy();
  /** The spec that actually drove this run's core selection — module constant,
   *  so its `codes` array is referentially stable for the trace memo. */
  const activeSpec = QUICK_STRATEGY[strategy.quickStrategy];

  const {
    analyses,
    draft,
    setDraft,
    ready,
    running,
    stale,
    progress,
    error,
    dismissError,
    run,
    cancel
  } = useRoundAnalysis(markets, strategy);

  const pools = useMemo(
    () =>
    Object.fromEntries(
      LEAGUES.map((league) => [
      league,
      buildTeamPool(seasons, league, teamAliasMap[league] ?? {})]
      )
    ) as Record<League, ReturnType<typeof buildTeamPool>>,
    [seasons, teamAliasMap]
  );

  const allPatterns = useMemo(() => rankedPatterns(analyses), [analyses]);

  const patternCounts = useMemo(
    () =>
    analyses.reduce<Record<string, number>>((acc, a) => {
      acc[a.fixtureId] = a.patterns.length;
      return acc;
    }, {}),
    [analyses]
  );

  /**
   * CORE CALIBRATION BOOTSTRAP — the measurement base, in numbers.
   *
   * Every audited match contributes one out-of-sample market observation, so
   * this is the honest denominator behind an empty or conditional core card:
   * the audit walk, not core selection, is what builds the calibration bands.
   */
  const auditCoverage = useMemo(() => {
    let audited = 0;
    let total = 0;
    seasons.forEach((season) =>
    season.matches.forEach((match) => {
      total++;
      if (match.pipeline) audited++;
    })
    );
    return { audited, total };
  }, [seasons]);

  const combined = useMemo(() => draft ? combinedProbability(draft) : 0, [draft]);
  const duplicates = useMemo(() => draft ? duplicateFixtures(draft) : [], [draft]);
  const filledSlots = useMemo(
    () => draft?.slots.filter((s) => s.pattern).length ?? 0,
    [draft]
  );

  const handleSwap = useCallback(
    (role: ActiveSlipRole) => {
      setDraft((current) => {
        if (!current) return current;
        // H1 — a swapSlot a többi sor mérkőzéseit is kizárja, így a csere
        // nem hozhat be már szereplő mérkőzést. Ha nem marad érvényes
        // alternatíva, `null` jön vissza, és a szelvény változatlan marad.
        const next = swapSlot(current, role, allPatterns, markets, strategy);
        if (!next) {
          toast.error(
            'Nincs másik szabad jelölt ebben a készletben — a többi sor ' +
            'mérkőzései és a kapun kívüli jelöltek ki vannak zárva.'
          );
          return current;
        }
        return next;
      });
    },
    [allPatterns, markets, setDraft, strategy]
  );

  const handleStrategyChange = useCallback(
    (next: CoreStrategySettings) => {
      void updateSettings({ coreStrategy: next });
    },
    [updateSettings]
  );

  // A készlet minden kattintásra azonnal érvényesül: a mentés a beállításokba
  // kerül (újratöltés után is megmarad), a szelvény pedig a memóriában lévő
  // elemzésekből épül újra — nincs szükség a forduló újraelemzésére.
  const handleMarketsChange = useCallback(
    (next: SlipMarketPreferences) => {
      void updateSettings({ slipMarkets: next });
    },
    [updateSettings]
  );

  const handleSave = useCallback(() => {
    if (!draft) return;
    // H2 — duplikált mérkőzés esetén a kombinált valószínűség érvénytelen (0),
    // ezért ilyen szelvény nem kerülhet a ledgerbe.
    if (duplicateFixtures(draft).length > 0) {
      toast.error(
        'Ugyanaz a mérkőzés több soron szerepel — a kombinált valószínűség ' +
        'érvénytelen, a szelvény nem menthető.'
      );
      return;
    }
    const slip = draftToSlip(draft, round.name, strategy);
    if (slip.lines.length === 0) {
      toast.error('A szelvény üres — nincs mit menteni.');
      return;
    }
    saveSlip(slip);
  }, [draft, round.name, saveSlip, strategy]);

  const noData = seasons.length === 0;
  const topPattern = allPatterns[0];
  const totalFixtures = round.fixtures.length;

  return (
    <div className="flex flex-col gap-4 md:gap-5">
      <PageHeader icon={Target} title="Forduló Prediktor — Top 3+3" intro={INTRO} />

      <MetricGrid>
        <MetricCard
          icon={ListChecks}
          label="Összeállított párok"
          value={`${ready.length} / ${totalFixtures}`}
          sub="Kitöltött mérkőzések a fordulóban" />
        
        <MetricCard
          icon={Search}
          label="Talált minták"
          value={allPatterns.length}
          tone={stale ? 'warning' : 'neutral'}
          sub={stale ? 'A forduló módosult az elemzés óta' : 'Az utolsó elemzés alapján'} />
        
        <MetricCard
          icon={TrendingUp}
          label="Legerősebb stabilitás"
          value={topPattern?.stability ?? '—'}
          tone="signal"
          sub={topPattern?.label ?? 'Még nincs elemzés'} />
        
        <MetricCard
          icon={Sigma}
          label="Szelvény komb. valószínűség"
          tone={duplicates.length > 0 ? 'negative' : 'neutral'}
          value={
          duplicates.length > 0 ?
          'érvénytelen' :
          draft && hasLines(draft) ?
          `${(combined * 100).toFixed(1)}%` :
          '—'
          }
          valueClassName={duplicates.length > 0 ? 'text-negative' : undefined}
          sub={
          duplicates.length > 0 ?
          'Ismétlődő mérkőzés — a szorzat nem értelmezhető' :
          draft ?
          `${filledSlots} / ${draft.slots.length} szerepkör feltöltve` :
          'A Top 3+3 sorok szorzata'
          }
          subClassName={duplicates.length > 0 ? 'text-negative' : undefined} />
        
      </MetricGrid>

      {noData ?
      <StateEmptyPanel
        title="Nincs betöltött adat"
        message="A prediktor a betöltött szezonok csapataiból és H2H előzményeiből dolgozik. Töltsd fel a szezon CSV-ket a Taktikai Stúdióban, utána itt összeállítható a forduló."
        action={
          <a
            href="?mp_screen=dashboard"
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-1 px-3 py-1.5 text-ui-xs font-medium text-foreground transition-colors hover:bg-elevated">
            <Target className="h-3.5 w-3.5" aria-hidden={true} />
            Taktikai Stúdió megnyitása
          </a>
        } /> :

      null}

      {/* --- The round ----------------------------------------------------- */}
      <Panel>
        <PanelHeader>
          <PanelTitle>{round.name}</PanelTitle>
          <PanelActions>
            <span className="text-ui-xs tabular-nums text-muted-foreground">
              {ready.length} / {totalFixtures} pár kész
            </span>

            <button
              type="button"
              className="btn btn--ghost btn--sm tap"
              disabled={running}
              onClick={() => void resetRound()}>
              
              <RotateCcw className="h-3.5 w-3.5" aria-hidden={true} />
              Forduló ürítése
            </button>

            {running ?
            <button
              type="button"
              className="btn btn--danger btn--sm tap"
              onClick={cancel}>
              
                <X className="h-3.5 w-3.5" aria-hidden={true} />
                Elemzés megszakítása
              </button> :
            null}

            <button
              type="button"
              className="btn btn--signal btn--sm tap"
              disabled={running || noData || ready.length === 0}
              onClick={() => void run()}>
              
              <Play className="h-3.5 w-3.5" aria-hidden={true} />
              {running ? 'Elemzés fut…' : 'Forduló elemzése'}
            </button>
          </PanelActions>
        </PanelHeader>

        <div className="flex flex-col gap-4 p-4 sm:p-5">
          {progress ?
          <StateProgress
            label="Mintakeresés…"
            detail={`${progress.done} / ${progress.total}`}
            ratio={progress.total > 0 ? progress.done / progress.total : undefined} /> :

          null}

          {error ?
          <StateError
            title="Az elemzés megszakadt egy hiba miatt."
            message={error}
            onDismiss={dismissError} /> :

          null}

          {stale && !running ?
          <StateNotice>
              A forduló módosult az utolsó elemzés óta — futtasd újra, hogy a minták és a szelvény
              szinkronban legyenek.
            </StateNotice> :
          null}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {LEAGUES.map((league) =>
            <RoundBuilder
              key={league}
              league={league}
              fixtures={fixturesOf(round, league)}
              pool={pools[league]}
              used={usedTeamKeys(round, league)}
              patternCounts={patternCounts}
              onSelect={setFixtureTeam}
              onClear={clearFixture} />

            )}
          </div>
        </div>
      </Panel>

      {/* --- Markets, results and the slip --------------------------------
           The slip is pinned on wide screens: previously it sat above a long
           list of fixture cards, so comparing a card against the current
           selection meant scrolling back and forth. */}
      <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_380px] 2xl:grid-cols-[minmax(0,1fr)_460px]">
        <div className="flex min-w-0 flex-col gap-4">
          <CoreStrategySelector
            value={strategy}
            readout={draft?.strategy ?? null}
            running={running}
            onChange={handleStrategyChange} />
          

          <CoreGateStatus
            readout={draft?.strategy ?? null}
            auditedMatches={auditCoverage.audited}
            totalMatches={auditCoverage.total} />
          
          <ProductionGatesPanel />

          <ZeroCoreNotice draft={draft} />


          

          {/* The full derivation behind the three cards: funnel, gate chain,
               per-candidate values, disproved-band proofs, and the conditional
               accounting. Read-only — it adds no gate. */}
          <CoreDecisionTracePanel
            analyses={analyses}
            readout={draft?.strategy ?? null}
            familyCodes={activeSpec.codes}
            profileVeto={activeSpec.profileVeto} />
          

          <PatternConfidenceSummary patterns={allPatterns} />

          <EmptyCoreReasons draft={draft} />


          <Collapsible
            key={strategy.mode}
            title="Haladó / egyedi core beállítás"
            subtitle="Kártyánkénti piac-készlet — csak egyedi módban vezérli a core slotokat"
            defaultOpen={strategy.mode === 'custom'}>
            
            <MarketPoolSelector value={markets} running={running} onChange={handleMarketsChange} />
          </Collapsible>

          {analyses.length > 0 ?
          <section className="flex min-w-0 flex-col gap-3">
              <h2 className="text-ui-base font-medium tracking-tight text-foreground">
                Mérkőzéskártyák és minták ({analyses.length})
              </h2>
              <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
                {analyses.map((analysis) =>
              <FixtureCard key={analysis.fixtureId} analysis={analysis} />
              )}
              </div>
            </section> :
          null}
        </div>

        {draft ?
        <div className="order-first min-w-0 xl:order-none xl:sticky xl:top-0 xl:self-start">
            <SlipPanel
            draft={draft}
            combinedProb={combined}
            duplicates={duplicates}
            roundName={round.name}
            canSave={hasLines(draft) && duplicates.length === 0}
            onRoundNameChange={renameRound}
            onSwap={handleSwap}
            onSave={handleSave} />
          
          </div> :
        null}
      </div>

      {draft ?
      <MobileSlipBar
        combinedProb={combined}
        filled={filledSlots}
        total={draft.slots.length}
        invalid={duplicates.length > 0} /> :
      null}
    </div>);

}