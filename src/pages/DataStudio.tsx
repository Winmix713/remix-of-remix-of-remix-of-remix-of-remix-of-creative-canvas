import React, { useMemo } from 'react';
import { Activity, Database, Layers, ShieldCheck, Target, Trophy } from 'lucide-react';
import { useWinmix } from '../contexts/WinmixContext';
import { useLeagueForecastStats } from '../hooks/useLeagueForecastStats';
import { LEAGUE_FLAG, LEAGUE_LABEL } from '../data/leagues';
import { ChangelogPanel } from '../components/winmix/ChangelogPanel';
import { DiagnosticsPanel } from '../components/winmix/DiagnosticsPanel';
import { MatchLogPanel } from '../components/winmix/MatchLogPanel';
import { MetricCard, MetricGrid } from '../components/winmix/MetricCard';
import { ReliabilityBandTable } from '../components/winmix/ReliabilityBandTable';
import { SectionHeading } from '../components/winmix/Panel';
import { SeasonPills } from '../components/winmix/SeasonPills';
import { StandingsPanel } from '../components/winmix/StandingsPanel';
import { UploadHero } from '../components/winmix/UploadHero';

/**
 * Adatbázis & lefedettség. A pipeline VEZÉRLÉSE (beállítások, súlyok,
 * újraszámítás, karbantartás) a Pipeline Üzemeltetés képernyőn él, a
 * kalibrációs telemetria pedig a Pipeline Auditban — ez a lap szándékosan nem
 * duplikálja egyiket sem.
 *
 * A nyolc panel három feliratozott szakaszra bomlik (Adatok · Liga állapot ·
 * Modell egészség), mert egy scrollban nem volt semmilyen tájékozódási pont.
 */
export function DataStudio() {
  const { seasons, currentLeague } = useWinmix();
  const stats = useLeagueForecastStats();

  const coverage = useMemo(() => {
    const enCount = seasons.filter((s) => s.league === 'angol').length;
    const esCount = seasons.filter((s) => s.league === 'spanyol').length;
    return {
      enCount,
      esCount,
      totalMatches: seasons.reduce((acc, s) => acc + s.matches.length, 0),
      leagueTotalMatches: seasons.
      filter((s) => s.league === currentLeague).
      reduce((acc, s) => acc + s.matches.length, 0)
    };
  }, [seasons, currentLeague]);

  const { skillCI } = stats;

  return (
    <div className="flex flex-col gap-4 md:gap-5 lg:px-0">
      {/* --- Data ---------------------------------------------------------- */}
      <SectionHeading icon={Database} hint="CSV / JSON betöltés és szezonok">
        Adatok
      </SectionHeading>
      <UploadHero />
      <SeasonPills />

      {/* --- League state -------------------------------------------------- */}
      <SectionHeading icon={Trophy} hint={LEAGUE_LABEL[currentLeague]}>
        Liga állapot
      </SectionHeading>

      <MetricGrid cols={4}>
        <MetricCard
          icon={Layers}
          label="Összes bajnokság (mindkét liga)"
          value={`${seasons.length} db`}
          sub={`${coverage.totalMatches} mérkőzés összesen`}
          interval={`${LEAGUE_LABEL[currentLeague]}: ${coverage.leagueTotalMatches}`} />
        
        <MetricCard
          icon={Trophy}
          label={`${LEAGUE_FLAG.angol} Angol / ${LEAGUE_FLAG.spanyol} Spanyol`}
          value={`${coverage.enCount} / ${coverage.esCount}`}
          tone="signal"
          sub="~240 meccs / szezon" />
        
        <MetricCard
          icon={Target}
          label={`Javasolt (actionable) pontosság — ${LEAGUE_LABEL[currentLeague]}`}
          value={stats.hasPipeline ? `${stats.accActionable.toFixed(1)}%` : '— %'}
          tone={stats.hasPipeline ? 'signal' : 'neutral'}
          sub={
          stats.hasPipeline ?
          `Lefedettség ${stats.coveragePct.toFixed(1)}%` :
          'Lefedettség — %'
          }
          interval={
          stats.hasPipeline ? `${stats.actionableCount}/${stats.evaluated} mérkőzés` : undefined
          } />
        
        <MetricCard
          icon={ShieldCheck}
          label={`Igazolt előny a B1 bázishoz képest — ${LEAGUE_LABEL[currentLeague]}`}
          value={
          skillCI ?
          skillCI.crossesZero ?
          'Nincs kimutatható előny' :
          `${skillCI.mean >= 0 ? '+' : ''}${skillCI.mean.toFixed(2)}%` :
          '—'
          }
          valueClassName={
          skillCI ?
          skillCI.crossesZero ?
          'text-negative text-ui-lg leading-snug' :
          'text-positive' :
          undefined
          }
          tone={skillCI ? skillCI.crossesZero ? 'negative' : 'positive' : 'neutral'}
          interval={
          skillCI ?
          `95% CI: ${skillCI.lo >= 0 ? '+' : ''}${skillCI.lo.toFixed(2)}% … ${
          skillCI.hi >= 0 ? '+' : ''}${
          skillCI.hi.toFixed(2)}%` :
          '95% CI: nincs adat'
          }
          sub={
          stats.hasPipeline ?
          `Argmax ${stats.accAll.toFixed(1)}% · Brier ${stats.brier.toFixed(3)} · LogLoss ${stats.logLossEns.toFixed(3)}` :
          'Argmax — · Brier — · LogLoss —'
          } />
        
      </MetricGrid>

      <StandingsPanel />
      <MatchLogPanel />

      {/* --- Model health -------------------------------------------------- */}
      <SectionHeading icon={Activity} hint="Megbízhatóság, diagnosztika, előzmény">
        Modell egészség
      </SectionHeading>
      <ReliabilityBandTable bands={stats.bands} />
      <DiagnosticsPanel />
      <ChangelogPanel />
    </div>);

}