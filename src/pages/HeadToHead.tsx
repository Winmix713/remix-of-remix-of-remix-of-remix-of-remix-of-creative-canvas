import React, { useEffect, useMemo, useState } from "react";
import { Search, Swords } from "lucide-react";
import { useWinmix } from "../contexts/WinmixContext";
import { computeAutoTeamWeights } from "../utils/autoWeights";
import { buildTeamPool } from "../utils/fixtures";
import { computeH2HPairs, summarizeMatchup } from "../utils/h2h";
import {
  collectMeetings,
  computeH2HGoalProfile,
  computeLeagueBaselines,
} from "../utils/patterns";
import {
  assessMarqueeRisk,
  ensureMarqueeRound,
  isMarqueePair,
  loadMarqueeStore,
  marqueeRoundRegistry,
  setMarqueePair,
} from "../utils/marqueePairs";
import { MarqueeRoundsTable } from "../components/winmix/MarqueeRoundsTable";
import { H2HPairTable } from "../components/winmix/H2HPairTable";
import { MatchupHeader } from "../components/winmix/MatchupHeader";
import { HeadToHeadOverview } from "../components/winmix/HeadToHeadOverview";
import { TeamPairSelector, type RunState } from "../components/winmix/TeamPairSelector";
import { PageHeader } from "../components/winmix/PageHeader";
import {
  Panel,
  PanelHeader,
  PanelTitle,
  SectionHeading,
} from "../components/winmix/Panel";

interface AppliedPair {
  home: string;
  away: string;
}

type PairSort = "matches" | "goals";

const INTRO =
  "Minden irányított csapatpár (Hazai → Vendég) összes, eddig betöltött szezonon átívelő találkozója egy helyen, kanonizált csapatnevek szerint csoportosítva. Egy páros futtatása kizárólag a kiválasztott hazai → vendég irányt listázza és összegzi.";

function readUrlParams(teamPoolKeys: Set<string>): AppliedPair | null {
  const params = new URLSearchParams(window.location.search);
  const home = params.get("home");
  const away = params.get("away");
  if (home && away && teamPoolKeys.has(home) && teamPoolKeys.has(away) && home !== away) {
    return { home, away };
  }
  return null;
}

export function HeadToHead() {
  const { leagueSeasons, leagueMatches, teamAliasMap, currentLeague, round } =
    useWinmix();
  const [homeKey, setHomeKey] = useState<string | null>(null);
  const [awayKey, setAwayKey] = useState<string | null>(null);
  const [applied, setApplied] = useState<AppliedPair | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [runState, setRunState] = useState<RunState>("idle");
  const [pairQuery, setPairQuery] = useState("");
  const [pairSort, setPairSort] = useState<PairSort>("matches");

  const [marqueeStore, setMarqueeStore] = useState(() => loadMarqueeStore());
  useEffect(() => {
    setMarqueeStore(
      ensureMarqueeRound({ name: round.name, createdAt: round.createdAt }),
    );
  }, [round.name, round.createdAt]);
  const marqueeRegistry = useMemo(
    () => marqueeRoundRegistry(marqueeStore),
    [marqueeStore],
  );

  const allPairs = useMemo(
    () => computeH2HPairs(leagueSeasons, teamAliasMap[currentLeague] ?? {}),
    [leagueSeasons, teamAliasMap, currentLeague],
  );

  const recommendedWeights = useMemo(
    () => computeAutoTeamWeights(leagueMatches, currentLeague),
    [leagueMatches, currentLeague],
  );

  const teamPool = useMemo(
    () =>
      buildTeamPool(
        leagueSeasons,
        currentLeague,
        teamAliasMap[currentLeague] ?? {},
      ),
    [leagueSeasons, currentLeague, teamAliasMap],
  );

  const teamDisplayMap = useMemo(
    () => new Map(teamPool.map((team) => [team.key, team.display])),
    [teamPool],
  );

  const displayOf = (key: string): string => teamDisplayMap.get(key) ?? key;

  const monogramOf = (key: string | null): string => {
    if (!key) return "—";
    const words = displayOf(key).trim().split(/\s+/);
    return words
      .slice(0, 3)
      .map((word) => word[0])
      .join("")
      .toUpperCase();
  };

  // Restore selection from URL params on first load
  useEffect(() => {
    if (teamPool.length === 0 || applied) return;
    const fromUrl = readUrlParams(new Set(teamPool.map((t) => t.key)));
    if (fromUrl) {
      setHomeKey(fromUrl.home);
      setAwayKey(fromUrl.away);
      setApplied(fromUrl);
      setExpanded(new Set([`${fromUrl.home}___${fromUrl.away}`]));
      setRunState("done");
    }
  }, [teamPool, applied]);

  // Sync URL when applied changes
  useEffect(() => {
    const url = new URL(window.location.href);
    if (applied) {
      url.searchParams.set("home", applied.home);
      url.searchParams.set("away", applied.away);
    } else {
      url.searchParams.delete("home");
      url.searchParams.delete("away");
    }
    window.history.replaceState(null, "", url.toString());
  }, [applied]);

  const pairs = useMemo(() => {
    const scoped = applied
      ? allPairs.filter(
          (p) => p.homeKey === applied.home && p.awayKey === applied.away,
        )
      : allPairs;
    const query = pairQuery.trim().toLocaleLowerCase("hu");
    const filtered = query
      ? scoped.filter((pair) =>
          `${pair.homeDisplay} ${pair.awayDisplay}`
            .toLocaleLowerCase("hu")
            .includes(query),
        )
      : scoped;
    return [...filtered].sort((left, right) =>
      pairSort === "goals"
        ? right.totalGoals - left.totalGoals
        : right.played - left.played,
    );
  }, [allPairs, applied, pairQuery, pairSort]);

  const summary = useMemo(
    () =>
      applied
        ? summarizeMatchup(allPairs, applied.home, applied.away, displayOf)
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allPairs, applied, teamPool],
  );

  const marqueeOn = applied
    ? isMarqueePair(marqueeRegistry, currentLeague, applied.home, applied.away)
    : false;

  const marqueeVerdict = useMemo(() => {
    if (!applied) return null;
    const pairIndex = new Map(allPairs.map((p) => [p.id, p]));
    const { meetings, usedReverse } = collectMeetings(
      pairIndex,
      applied.home,
      applied.away,
    );
    if (meetings.length === 0) {
      return assessMarqueeRisk({
        registered: marqueeOn,
        profile: null,
        risk: null,
      });
    }
    const profile = computeH2HGoalProfile(
      meetings,
      computeLeagueBaselines(allPairs),
      usedReverse,
    );
    return assessMarqueeRisk({ registered: marqueeOn, profile, risk: null });
  }, [allPairs, applied, marqueeOn]);

  const toggleMarquee = (next: boolean) => {
    if (!applied) return;
    setMarqueePair(currentLeague, applied.home, applied.away, next);
    setMarqueeStore(loadMarqueeStore());
  };

  const run = async () => {
    if (!homeKey || !awayKey || runState === "running") return;
    setRunState("running");
    try {
      await new Promise((resolve) => window.setTimeout(resolve, 250));
      setApplied({ home: homeKey, away: awayKey });
      setExpanded(new Set([`${homeKey}___${awayKey}`]));
      setRunState("done");
    } catch {
      setRunState("error");
    }
  };

  const reset = () => {
    setApplied(null);
    setHomeKey(null);
    setAwayKey(null);
    setExpanded(new Set());
    setRunState("idle");
    setPairQuery("");
  };

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const pairsCount = pairs.reduce((acc, pair) => acc + pair.played, 0);

  return (
    <div className="flex flex-col gap-4 md:gap-5">
      <PageHeader icon={Swords} title="H2H — egymás elleni mérkőzések" intro={INTRO} />

      <HeadToHeadOverview allPairs={allPairs} teamPoolSize={teamPool.length} />

      <TeamPairSelector
        homeKey={homeKey}
        awayKey={awayKey}
        teamPool={teamPool}
        runState={runState}
        applied={applied}
        displayOf={displayOf}
        monogramOf={monogramOf}
        pairsCount={pairsCount}
        onHomeChange={(value) => {
          setHomeKey(value);
          setRunState("idle");
        }}
        onAwayChange={(value) => {
          setAwayKey(value);
          setRunState("idle");
        }}
        onRun={run}
        onReset={reset}
      />

      {summary && summary.played > 0 && applied ? (
        <>
          <SectionHeading hint="Kizárólag a kiválasztott hazai → vendég irány">
            Összecsapás mérlege
          </SectionHeading>
          <MatchupHeader
            summary={summary}
            homeRecommendedWeight={
              recommendedWeights[applied.home]?.recommendedWeight ?? null
            }
            awayRecommendedWeight={
              recommendedWeights[applied.away]?.recommendedWeight ?? null
            }
            marqueeOn={marqueeOn}
            onToggleMarquee={toggleMarquee}
            marqueeVerdict={marqueeVerdict}
          />
        </>
      ) : null}

      <SectionHeading hint="Az aktuális és a korábbi körök jelölései">
        Rangadó nyilvántartás
      </SectionHeading>
      <MarqueeRoundsTable
        store={marqueeStore}
        league={currentLeague}
        displayOf={displayOf}
      />

      <SectionHeading hint="Egyirányú bontás">
        Csapatpárok — kumulatív statisztika
      </SectionHeading>
      <Panel>
        <PanelHeader>
          <div className="min-w-0">
            <PanelTitle as="h3">Csapatpárok</PanelTitle>
            <span className="text-ui-xs font-medium text-foreground/70">
              {pairs.length} pár · nyisd le a részletes mérkőzéslistáért
            </span>
          </div>
        </PanelHeader>

        <div className="grid gap-3 border-b border-border px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:px-5">
          <label className="relative min-w-0">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <span className="sr-only">Szűrés csapatnév alapján</span>
            <input
              value={pairQuery}
              onChange={(event) => setPairQuery(event.target.value)}
              placeholder="Szűrés csapatnév alapján…"
              className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm text-foreground outline-none transition focus:border-signal focus:ring-2 focus:ring-signal/20"
            />
          </label>
          <div
            className="grid grid-cols-2 gap-1 rounded-md border border-border bg-muted/30 p-1"
            aria-label="Rendezés"
          >
            <button
              type="button"
              className={`btn btn--sm tap ${pairSort === "matches" ? "btn--signal" : "btn--ghost"}`}
              onClick={() => setPairSort("matches")}
            >
              Meccsszám
            </button>
            <button
              type="button"
              className={`btn btn--sm tap ${pairSort === "goals" ? "btn--signal" : "btn--ghost"}`}
              onClick={() => setPairSort("goals")}
            >
              Gólszám
            </button>
          </div>
        </div>

        <div className="overflow-x-auto [scrollbar-gutter:stable]">
          <H2HPairTable
            pairs={pairs}
            expanded={expanded}
            onToggle={toggle}
            empty={
              allPairs.length === 0
                ? "Nincs betöltött mérkőzés az aktív ligában."
                : "A kiválasztott hazai → vendég irányban nincs betöltött találkozó."
            }
          />
        </div>
      </Panel>
    </div>
  );
}
