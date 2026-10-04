import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useWinmix } from '../contexts/WinmixContext';
import { completedFixtures } from '../utils/fixtures';
import { analyzeRound, type LeagueContext } from '../utils/roundAnalysis';
import { loadMarqueeRegistry } from '../utils/marqueePairs';
import { buildSlipDraft } from '../utils/slip';
import type { CoreStrategySettings, SlipMarketPreferences } from '../types/winmix';
import { readCheckpoint } from '../utils/checkpointStore';
import { STORAGE_KEY } from '../utils/constants';
import { LEAGUES } from '../data/leagues';
import type {
  FixtureAnalysis,
  FixtureRound,
  League,
  M1Fit } from
'../types/winmix';
import type { SlipDraft } from '../utils/slip';

export type AnalysisStatus = 'idle' | 'running' | 'done' | 'error';

export interface AnalysisProgress {
  done: number;
  total: number;
}

/**
 * A forduló ujjlenyomata: a párosítások sorrendje és csapatai. Ha változik,
 * a korábbi elemzés elavult (`stale`).
 */
export function roundSignature(round: FixtureRound): string {
  return round.fixtures.
  map((f) => `${f.id}:${f.homeKey ?? ''}>${f.awayKey ?? ''}`).
  join('|');
}

/**
 * PONT 5 — az elemzés eredménye lapozáskor ne vesszen el.
 *
 * SESSION scope szándékosan: az elemzés derivált gyorsítótár, nem igazságforrás.
 * Nem élheti túl a fülbezárást, és a visszatöltés csak akkor érvényes, ha a
 * mentett ujjlenyomat bitre egyezik az aktuális fordulóval — különben olyan
 * párosításokra hivatkozó kártyák jelennének meg, amelyek már nem léteznek.
 * Semmi nem dob: blokkolt/teli/hibás session store esetén sima memória-mód.
 */
const ROUND_ANALYSIS_STORE_VERSION = 1;
const ROUND_ANALYSIS_SESSION_KEY = `${STORAGE_KEY}::round-analysis`;

interface RoundAnalysisEnvelope {
  storeVersion: number;
  signature: string;
  analyses: FixtureAnalysis[];
}

function readStoredAnalysis(): { signature: string;analyses: FixtureAnalysis[]; } | null {
  try {
    const raw = window.sessionStorage.getItem(ROUND_ANALYSIS_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RoundAnalysisEnvelope;
    if (
    !parsed ||
    parsed.storeVersion !== ROUND_ANALYSIS_STORE_VERSION ||
    typeof parsed.signature !== 'string' ||
    !Array.isArray(parsed.analyses) ||
    parsed.analyses.length === 0)
    {
      return null;
    }
    return { signature: parsed.signature, analyses: parsed.analyses };
  } catch {
    return null;
  }
}

function writeStoredAnalysis(
signature: string | null,
analyses: FixtureAnalysis[])
{
  try {
    if (!signature || analyses.length === 0) {
      window.sessionStorage.removeItem(ROUND_ANALYSIS_SESSION_KEY);
      return;
    }
    const envelope: RoundAnalysisEnvelope = {
      storeVersion: ROUND_ANALYSIS_STORE_VERSION,
      signature,
      analyses
    };
    window.sessionStorage.setItem(
      ROUND_ANALYSIS_SESSION_KEY,
      JSON.stringify(envelope)
    );
  } catch {
    // Session store elérhetetlen vagy tele — a perzisztálás legjobb-igyekezet.
  }
}


export function useRoundAnalysis(
markets?: SlipMarketPreferences | null,
strategy?: CoreStrategySettings | null)
{
  const {
    seasons,
    round,
    teamAliasMap,
    teamWeights,
    calibration,
    patternWeights
  } = useWinmix();

  // Induló visszatöltés a session storeból (lásd a modul fejét). Lazy
  // inicializálás: az első render már a mentett eredménnyel jön fel, így nincs
  // üres-flash és nincs fölösleges újraelemzés lapozás után.
  const restoredRef = useRef<{signature: string;analyses: FixtureAnalysis[];} | null | undefined>(
    undefined
  );
  if (restoredRef.current === undefined) restoredRef.current = readStoredAnalysis();
  const restored = restoredRef.current;

  const [analyses, setAnalyses] = useState<FixtureAnalysis[]>(
    () => restored?.analyses ?? []
  );
  const [draft, setDraft] = useState<SlipDraft | null>(null);
  const [analyzedSignature, setAnalyzedSignature] = useState<string | null>(
    () => restored?.signature ?? null
  );
  const [status, setStatus] = useState<AnalysisStatus>(
    () => restored ? 'done' : 'idle'
  );
  const [progress, setProgress] = useState<AnalysisProgress | null>(null);
  const [error, setError] = useState<string | null>(null);


  const abortRef = useRef<AbortController | null>(null);
  const contextCache = useRef(new Map<League, LeagueContext>());
  // Debounce-védelem: a `running` állapot React-en keresztül terjed, ami nem
  // elég gyors a rapid dupla-kattintások ellen. A `debounceRef` közvetlenül
  // a ref-ben blokkolja a második kattintást, amíg az első el nem indul.
  const debounceRef = useRef(false);

  const ready = useMemo(() => completedFixtures(round), [round]);
  const signature = useMemo(() => roundSignature(round), [round]);
  const running = status === 'running';
  const stale = analyzedSignature !== null && analyzedSignature !== signature;

  // A piac-készlet változása nem igényel újraelemzést: ugyanabból a
  // mintahalmazból épül újra a szelvény, azonnal.
  const marketsKey = markets ?
  `${markets.coreCards.map((card) => card.join(',')).join('|')}#${markets.joker.join(',')}` :
  '';
  const marketsRef = useRef(markets);
  marketsRef.current = markets;

  // A core stratégia váltása szintén nem igényel újraelemzést — ugyanabból a
  // mintahalmazból épül újra a szelvény, azonnal.
  const strategyKey = strategy ?
  `${strategy.mode}:${strategy.quickStrategy}:${strategy.vetoMode}` :
  '';
  const strategyRef = useRef(strategy);
  strategyRef.current = strategy;

  useEffect(() => {
    if (analyses.length === 0) return;
    setDraft(buildSlipDraft(analyses, marketsRef.current, strategyRef.current));
  }, [analyses, marketsKey, strategyKey]);

  // A forduló kiürítése után nem maradhat a képernyőn az előző futás
  // eredménye: a mérkőzéskártyák és a szelvény olyan párosításokra
  // hivatkoznának, amelyek már nem léteznek. Csak akkor törlünk, ha nincs
  // egyetlen kitöltött pár sem és épp nem fut elemzés.
  useEffect(() => {
    if (ready.length > 0 || running) return;
    if (analyses.length === 0 && draft === null && analyzedSignature === null) return;
    setAnalyses([]);
    setDraft(null);
    setAnalyzedSignature(null);
    setProgress(null);
  }, [analyses.length, analyzedSignature, draft, ready.length, running]);

  // A visszatöltött eredmény érvényessége: ha a forduló időközben (másik
  // munkamenet-lapon vagy szerkesztéssel) megváltozott, a mentett elemzés nem
  // létező párosításokra hivatkozna — eldobjuk. Csak mountnál fut.
  useEffect(() => {
    if (!restored) return;
    if (restored.signature === signature) return;
    setAnalyses([]);
    setDraft(null);
    setAnalyzedSignature(null);
    setStatus('idle');
    writeStoredAnalysis(null, []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Perzisztálás: minden érvényes eredmény azonnal a session storeba kerül,
  // a törlés (kiürített forduló, elavult visszatöltés) pedig ki is takarítja.
  useEffect(() => {
    writeStoredAnalysis(analyzedSignature, analyses);
  }, [analyses, analyzedSignature]);



  /**
   * C1 — a FORRÁS bekötése. A pipeline a bejárás végén ligánként kipublikálja
   * az illesztett modellt a `calibration[league].modelFit`-be (`m1Fit`,
   * `ensembleWM1`, `dixonColesRho`), és ugyanezt a checkpointra is elmenti.
   * Innentől a tipp pontosan azzal a modellel készül, amelynek a pontosságát
   * a Pipeline képernyő méri — a cold-start ág csak akkor marad életben, ha
   * az audit maga sem jutott el az illesztési küszöbig.
   *
   * A checkpoint másodlagos forrás: a `modelFit` új mezői opcionálisak, mert a
   * korábbi séma szerint mentett pillanatképek nem tartalmazzák őket. Ilyenkor
   * a session-scope checkpointból ugyanaz az illesztés még kinyerhető, teljes
   * újrafuttatás nélkül.
   */
  const fittedModels = useMemo(() => {
    const m1Fits: Partial<Record<League, M1Fit | null>> = {};
    const ensembleWM1: Partial<Record<League, number>> = {};
    const dixonColesRho: Partial<Record<League, number | null>> = {};

    LEAGUES.forEach((league) => {
      const fit = calibration[league]?.modelFit ?? null;
      const cp = fit?.m1Fit === undefined ? readCheckpoint(league) : null;

      m1Fits[league] = fit?.m1Fit ?? cp?.m1Fit ?? null;
      dixonColesRho[league] = fit?.dixonColesRho ?? cp?.dixonColesRho ?? null;

      const w = fit?.ensembleWM1 ?? cp?.ensembleWM1;
      if (typeof w === 'number' && Number.isFinite(w)) ensembleWM1[league] = w;
    });

    return { m1Fits, ensembleWM1, dixonColesRho };
  }, [calibration]);

  // A H2H kontextus a nyers adatokból származik: ha az adat vagy az alias
  // térkép módosul, a cache érvénytelen.
  //
  // H3 — SZÁNDÉKOSAN nem szerepel itt a `teamWeights`, a `calibration` és a
  // `patternWeights`. A cache csak adat-eredetű állapotot tárol (párok,
  // baseline-ok, history, megbízhatósági sávok); a súlyokat és a kalibrációs
  // hőmérsékletet az `analyzeFixture` minden futásnál közvetlenül kapja meg,
  // így azok módosulása nem tehet elavulttá egyetlen cache-elt kontextust sem.
  // Ha a `buildLeagueContext` egyszer mégis súlyt vagy kalibrációt épít be a
  // kontextusba, ezt a listát KÖTELEZŐ bővíteni — lásd a szerződést az
  // `AnalyzeRoundParams.contextCache` mezőn.
  useEffect(() => {
    contextCache.current = new Map();
  }, [seasons, teamAliasMap]);

  // Lecsatolásnál nem hagyunk futó munkát maga után.
  useEffect(() => () => abortRef.current?.abort(), []);

  const cancel = useCallback(() => abortRef.current?.abort(), []);

  const run = useCallback(async () => {
    if (abortRef.current) return;
    // Debounce: a `running` állapot setStatus-szal történik, ami a React
    // render ciklushoz kötött. Két gyors kattintás között a `running` még
    // lehet false, amikor az első abortRef.current = null már lefutott a
    // finally-ben, de a setStatus('running') még nem renderelődött. A
    // `debounceRef` azonnal blokkol — nincs render-ciklus függőség.
    if (debounceRef.current) return;
    if (ready.length === 0) {
      toast.error('Legalább egy párosítást állíts össze az elemzés előtt.');
      return;
    }

    debounceRef.current = true;
    const controller = new AbortController();
    abortRef.current = controller;

    // A futás indulásakor érvényes ujjlenyomatot rögzítjük, hogy a közben
    // szerkesztett forduló ne jelölje tévesen frissnek az eredményt.
    const runSignature = signature;

    setError(null);
    setStatus('running');
    setProgress({ done: 0, total: ready.length });

    try {
      const result = await analyzeRound({
        fixtures: ready,
        seasons,
        teamAliasMap,
        teamWeights,
        calibration,
        patternWeights,
        // C1 — az audit által illesztett modell, ligánként. Ezzel a tipp és a
        // mért pontosság ugyanazt a modellt írja le; a kettő már csak a
        // history szeletben tér el.
        m1Fits: fittedModels.m1Fits,
        ensembleWM1: fittedModels.ensembleWM1,
        dixonColesRho: fittedModels.dixonColesRho,
        // RANGADÓ — az operátor által megjelölt irányított párosítások. Csak
        // rangsor-korrekció forrása, kapué soha.
        marqueePairKeys: allMarqueeKeys(loadMarqueeRegistry()),
        contextCache: contextCache.current,
        signal: controller.signal,
        onProgress: (done, total) => setProgress({ done, total })
      });

      setAnalyses(result);
      // A szelvényt az `analyses` változására figyelő effekt építi fel, hogy a
      // piac-készlet módosítása se igényeljen új elemzést.
      setAnalyzedSignature(runSignature);
      setStatus('done');
      toast.success(`${result.length} párosítás elemezve, minták kinyerve.`);
    } catch (e) {
      if (controller.signal.aborted) {
        setStatus(analyzedSignature ? 'done' : 'idle');
        toast.message(
          'Az elemzés megszakítva — a korábbi eredmények változatlanok.'
        );
        return;
      }
      setError(e instanceof Error ? e.message : String(e));
      setStatus('error');
      toast.error('Az elemzés hibára futott — a részletek a panelen olvashatók.');
    } finally {
      abortRef.current = null;
      debounceRef.current = false;
      setProgress(null);
    }
  }, [
  analyzedSignature,
  fittedModels,
  calibration,
  patternWeights,
  ready,
  seasons,
  signature,
  teamAliasMap,
  teamWeights]
  );

  return {
    analyses,
    draft,
    setDraft,
    ready,
    running,
    stale,
    status,
    progress,
    error,
    dismissError: useCallback(() => setError(null), []),
    run,
    cancel
  };
}

/** Minden liga megjelölt irányított kulcsa egy halmazban (a kulcsok egyediek). */
function allMarqueeKeys(registry: ReturnType<typeof loadMarqueeRegistry>): ReadonlySet<string> {
  return new Set(Object.values(registry).flatMap((keys) => keys ?? []));
}
