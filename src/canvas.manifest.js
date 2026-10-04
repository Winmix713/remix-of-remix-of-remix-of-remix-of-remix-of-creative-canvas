export const manifest = {
  screens: {
    scr_glkrkb: { name: "Taktikai Stúdió & Adatbázis", route: "/", state: { "view": "dashboard" }, position: { "x": 160, "y": 220 } },
    scr_39qf36: { name: "Üzemeltetés — Csapat súlyozás", route: "/", state: { "view": "operations", "opsTab": "weights" }, position: { "x": 160, "y": 2200 } },
    scr_rz8xkn: { name: "Üzemeltetés — Pipeline beállítások", route: "/", state: { "view": "operations", "opsTab": "settings" }, position: { "x": 1560, "y": 2200 } },
    scr_wti6gr: { name: "Üzemeltetés — Felhő tier", route: "/", state: { "view": "operations", "opsTab": "cloud" }, position: { "x": 2960, "y": 2200 } },
    scr_b0jcwg: { name: "Pipeline v2 Audit & Telemetria", route: "/", state: { "view": "pipeline" }, position: { "x": 4360, "y": 2200 } },
    scr_kkj24b: { name: "H2H — Egymás elleni mérkőzések", route: "/", state: { "view": "h2h" }, position: { "x": 160, "y": 4180 } },
    scr_l82uao: { name: "Forduló Prediktor — Top 3+3", route: "/", state: { "view": "predictor" }, position: { "x": 1560, "y": 4180 } },
    scr_c9iygx: { name: "Tipp Napló & Visszacsatolás", route: "/", state: { "view": "ledger" }, position: { "x": 160, "y": 6160 } }
  },
  sections: {
    sec_ve5tyq: { name: "Main Dashboard", x: 0, y: 0, width: 1520, height: 1180 },
    sec_8shnvh: { name: "Operations & Management", x: 0, y: 1980, width: 5720, height: 1180 },
    sec_r8lbpn: { name: "Analysis & Prediction", x: 0, y: 3960, width: 2920, height: 1180 },
    sec_9kdiek: { name: "Feedback & Logging", x: 0, y: 5940, width: 1520, height: 1180 }
  },
  layers: [
  { kind: "section", id: "sec_ve5tyq", children: [
    { kind: "screen", id: "scr_glkrkb" }]
  },
  { kind: "section", id: "sec_8shnvh", children: [
    { kind: "screen", id: "scr_39qf36" },
    { kind: "screen", id: "scr_rz8xkn" },
    { kind: "screen", id: "scr_wti6gr" },
    { kind: "screen", id: "scr_b0jcwg" }]
  },
  { kind: "section", id: "sec_r8lbpn", children: [
    { kind: "screen", id: "scr_kkj24b" },
    { kind: "screen", id: "scr_l82uao" }]
  },
  { kind: "section", id: "sec_9kdiek", children: [
    { kind: "screen", id: "scr_c9iygx" }]
  }]

};