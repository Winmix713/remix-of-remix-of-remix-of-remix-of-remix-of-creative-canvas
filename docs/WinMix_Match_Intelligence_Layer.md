WinMix Match Intelligence Layer. A most visszakeresett WinMix-anyag alapján **még pontosabban lehet meghatározni, merre érdemes továbbmenni**.

A legfontosabb: az általad bemásolt gondolat **összhangban van a jelenlegi WinMix-architektúrával**, nem pedig egy nulláról induló új rendszer lenne. A meglévő specifikáció már előírja, hogy a teljes kronologikus meccstörténet legyen a csapaterő, attack/defense rating, BTTS, market probability, recency weighting és modelltréning elsődleges forrása. 

Ráadásul a jelenlegi terv kifejezetten azt mondja, hogy **ne készüljön második, konkurens modell**, hanem a meglévő adaptív pipeline-t kell bővíteni, verziózni és perzisztálni. 

### Én ezért ezt az irányt választanám

**Nem „Opta for Virtual Football”.**

Hanem:

> **WinMix Match Intelligence Layer**

A réteg feladata lenne, hogy a meglévő pipeline előtt létrehozzon egy **egységes, időrendileg korrekt, shrinkage-olt, hazai/vendég kontextusú csapatállapotot**.

```text
                 COMPLETE MATCH HISTORY
                          │
                          ▼
              ┌───────────────────────┐
              │ RAW MATCH LAYER       │
              │ FT + HT + H/A         │
              └───────────┬───────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │ WINMIX METRICS LAYER  │
              │                       │
              │ Attack                │
              │ Defense               │
              │ Form                  │
              │ Goals                 │
              │ HT/H2                 │
              │ BTTS                  │
              │ H/A                   │
              │ Volatility            │
              │ H2H                   │
              └───────────┬───────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │ TEAM STATE            │
              │                       │
              │ Attack Rating         │
              │ Defense Rating        │
              │ Home Rating           │
              │ Away Rating           │
              │ Form Rating           │
              │ Goal Environment      │
              │ Stability             │
              └───────────┬───────────┘
                          │
                          ▼
                 EXISTING WINMIX MODEL
                          │
                ┌─────────┴─────────┐
                ▼                   ▼
           Score Matrix          1X2 / BTTS
                │
                ▼
          Core / Joker
```

És **nem piszkálnám első körben a már javított BTTS Core-gate-eket, canonicalizationt vagy Decision Trace-t**, mert a saját fejlesztési specifikációd ezeket explicit módon védendő komponensként kezeli. 

---

# A szerintem legfontosabb újítás

Nem 50 új feature-t kell hozzáadni.

Hanem a meglévő adatokat **egy közös Team State modellbe rendezni**.

Például:

```text
TEAM STATE — Team 07

Attack
    season_attack        1.71
    recent_attack        1.94
    home_attack          2.08
    away_attack          1.52

Defense
    season_defense       1.21
    recent_defense       0.98
    home_defense         0.87
    away_defense         1.36

Form
    last5                 7.8
    last10                7.4
    recency_trend        +0.31

Goals
    scoring_rate          1.82
    conceding_rate        1.07
    goal_volatility       0.63

Match State
    HT→FT conversion      0.78
    comeback               0.24
    lead_loss              0.11

Markets
    BTTS                  54%
    O2.5                  57%
    O3.5                  31%

Rating
    overall               1582
    confidence            0.84
    sample_size             42
```

**De ezeket nem szabad csak pillanatnyi számként tárolni.**

A specifikációd helyesen követeli meg a historical team-rating snapshotokat, hogy egy régebbi predikció később reprodukálható legyen. 

---

# És itt látom a legnagyobb lehetőséget

A WinMixben szerintem érdemes lenne bevezetni egy:

## `Team State Vector`

fogalmat.

Nem feltétlenül ML-vektorként, hanem **kanonikus csapatállapotként**.

Például:

```text
TeamState(t) =
{
  attack,
  defense,
  home_strength,
  away_strength,
  recent_form,
  scoring_rate,
  conceding_rate,
  btts_rate,
  over25_rate,
  goal_volatility,
  second_half_strength,
  comeback_rate,
  lead_retention,
  h2h_adjustment,
  rating_confidence
}
```

A következő mérkőzés előtt:

```text
TeamState(Home, t)
TeamState(Away, t)
```

majd ezekből:

```text
MATCHUP STATE
```

készül.

---

# Például a két csapat külön-külön még nem elég

Legyen:

```text
HOME

Attack: 1.85
Defense: 0.91

AWAY

Attack: 1.63
Defense: 1.12
```

A modellnek inkább ezt kell látnia:

```text
HOME_ATTACK_VS_AWAY_DEFENSE
=
1.85 vs 1.12

AWAY_ATTACK_VS_HOME_DEFENSE
=
1.63 vs 0.91
```

Vagyis:

> **a mérkőzés matchupját kell modellezni, nem egyszerűen két csapat átlagát.**

Ez szerintem a következő nagy fejlődési pont.

---

# A H2H-t pedig nem külön világnak kezelném

A jelenlegi specifikáció már H2H-pattern generationt és H2H-shrinkage-t használ. 

Én ezt így rendeznék:

```text
GENERAL TEAM STRENGTH
        +
HOME/AWAY CONTEXT
        +
RECENCY
        +
H2H INFORMATION
        ↓
MATCHUP STATE
```

A H2H **ne írja felül** a csapaterőt.

Csak módosító információ legyen.

Például:

```text
Base matchup:
Home 58%
Draw 24%
Away 18%

H2H evidence:
Home +2.1%

Shrunk H2H:
Home +0.8%

Final:
Home 58.8%
```

Ez sokkal biztonságosabb, mint:

```text
H2H says 70%
→ use 70%
```

---

# A másik nagyon fontos dolog: confidence

Ezt erősen javaslom.

Minden új metric mellé:

```text
value
sample_size
confidence
```

például:

```text
Comeback Rate = 42%

sample = 2
confidence = LOW
```

vs.

```text
Comeback Rate = 38%

sample = 31
confidence = HIGH
```

Ez azért különösen fontos, mert a 16 csapatos virtuális ligában bizonyos ritka eseményekhez nagyon lassan gyűlik adat.

---

# És a shadow mode tökéletesen illik ehhez

A jelenlegi terv ezt már elő is írja: minden új adaptív vagy ML-feature először shadow módban fusson. 

Én ezért:

```text
NEW METRIC
     ↓
SHADOW
     ↓
WALK-FORWARD TEST
     ↓
CALIBRATION TEST
     ↓
CORRELATION / REDUNDANCY TEST
     ↓
VALUE TEST
     ↓
ACTIVE
```

pipeline-t használnék.

És egy feature **csak akkor kerülhet be a Core prediction layerbe**, ha bizonyíthatóan javít.

---

# A végső WinMix-modell így lenne igazán erős

```text
                    HISTORICAL MATCHES
                           │
                           ▼
                 ┌───────────────────┐
                 │ CHRONOLOGICAL     │
                 │ DATA ENGINE       │
                 └─────────┬─────────┘
                           │
                           ▼
                 ┌───────────────────┐
                 │ WINMIX METRICS    │
                 │ ENGINE            │
                 └─────────┬─────────┘
                           │
                           ▼
                 ┌───────────────────┐
                 │ TEAM STATE        │
                 │ ENGINE            │
                 └─────────┬─────────┘
                           │
             ┌─────────────┼─────────────┐
             ▼             ▼             ▼
          Home State    Away State      H2H
             │             │             │
             └─────────────┼─────────────┘
                           ▼
                 ┌───────────────────┐
                 │ MATCHUP ENGINE    │
                 └─────────┬─────────┘
                           ▼
                 ┌───────────────────┐
                 │ SCORE MATRIX      │
                 └─────────┬─────────┘
                           ▼
              ┌────────────┴────────────┐
              ▼                         ▼
          MARKET PROBS              CALIBRATION
              │                         │
              └────────────┬────────────┘
                           ▼
                  EXISTING CORE GATE
                           ▼
                     CORE / JOKER
```

És ez azért jó, mert **nem új WinMixet építünk**, hanem a meglévő rendszert tesszük intelligensebbé.

A jelenlegi terv egyébként pontosan ugyanezt az alapelvet hangsúlyozza: a teljes meccstörténet legyen a tanulás forrása, míg a PredictionLedger csak a recommendation layer teljesítményét mérje, mert önmagában selection-biased. 

**Én innen már nem általános ötletelés felé mennék, hanem a következő dokumentumot készíteném el: `WINMIX_MATCH_INTELLIGENCE_SPEC.md`.** Ebben már konkrétan **nem 50 random metrikát**, hanem kb. 25–35 jól megválasztott metrikket definiálnék: képlet, input, időablak, recency, shrinkage, minimum sample, confidence, H/A kezelés, H2H kezelés, leakage-védelem, prediction relevance és shadow/active státusz szerint. Ez lenne az a dokumentum, amit utána közvetlenül oda lehet adni az AI fejlesztőnek implementációra.
