/* ===== Reference data: ranks, approval levels, goal templates ===== */
const YEAR = 2026;
const CATS = ["Safety", "Operations", "Compliance", "Teamwork", "Development", "Conduct"];
const SCALE = [
  { v: 1, label: "Unsatisfactory", short: "Unsatisfactory" },
  { v: 2, label: "Needs improvement", short: "Needs impr." },
  { v: 3, label: "Meets expectations", short: "Meets" },
  { v: 4, label: "Exceeds expectations", short: "Exceeds" },
  { v: 5, label: "Outstanding", short: "Outstanding" }
];
// appraiser = level 2, reviewer = level 3 (countersign), office approval = level 4 (Crewing Manager)
const RANKS = {
  MST: { name: "Master", dept: "Deck", level: "Officer", appr: "MSUPT", rev: null, next: null },
  CO: { name: "Chief Officer", dept: "Deck", level: "Officer", appr: "MST", rev: "MSUPT", next: "MST" },
  "2O": { name: "Second Officer", dept: "Deck", level: "Officer", appr: "CO", rev: "MST", next: "CO" },
  "3O": { name: "Third Officer", dept: "Deck", level: "Officer", appr: "CO", rev: "MST", next: "2O" },
  CE: { name: "Chief Engineer", dept: "Engine", level: "Officer", appr: "MST", rev: "TSUPT", next: null },
  "2E": { name: "Second Engineer", dept: "Engine", level: "Officer", appr: "CE", rev: "MST", next: "CE" },
  "3E": { name: "Third Engineer", dept: "Engine", level: "Officer", appr: "CE", rev: "MST", next: "2E" },
  "4E": { name: "Fourth Engineer", dept: "Engine", level: "Officer", appr: "CE", rev: "MST", next: "3E" },
  ETO: { name: "Electro-Technical Officer", dept: "Engine", level: "Officer", appr: "CE", rev: "MST", next: null },
  DCD: { name: "Deck Cadet", dept: "Deck", level: "Non-Officer", appr: "CO", rev: "MST", next: "3O" },
  BSN: { name: "Bosun", dept: "Deck", level: "Non-Officer", appr: "CO", rev: "MST", next: null },
  AB: { name: "Able Seaman", dept: "Deck", level: "Non-Officer", appr: "CO", rev: "MST", next: "BSN" },
  OS: { name: "Ordinary Seaman", dept: "Deck", level: "Non-Officer", appr: "CO", rev: "MST", next: "AB" },
  FTR: { name: "Fitter", dept: "Engine", level: "Non-Officer", appr: "CE", rev: "MST", next: null },
  OLR: { name: "Oiler", dept: "Engine", level: "Non-Officer", appr: "CE", rev: "MST", next: "FTR" },
  CCK: { name: "Chief Cook", dept: "Catering", level: "Non-Officer", appr: "MST", rev: null, next: null },
  MSM: { name: "Messman", dept: "Catering", level: "Non-Officer", appr: "CCK", rev: "MST", next: "CCK" }
};
const RANK_ORDER = ["MST", "CO", "2O", "3O", "CE", "2E", "3E", "4E", "ETO", "DCD", "BSN", "AB", "OS", "FTR", "OLR", "CCK", "MSM"];
const OFFICE = {
  MSUPT: { name: "Capt. Neil Fernandes", title: "Marine Superintendent" },
  TSUPT: { name: "Priya Nair", title: "Technical Superintendent" },
  CREWING: { name: "Farah Khan", title: "Crewing Manager" }
};
const VESSELS = [
  { id: "V1", name: "MV Coral Meridian", type: "Bulk carrier" },
  { id: "V2", name: "MT Aegean Dawn", type: "Product tanker" },
  { id: "V3", name: "MV Saffron Bay", type: "Container ship" },
  { id: "V4", name: "MT Nordic Tern", type: "Chemical tanker" },
  { id: "V5", name: "MV Konkan Pearl", type: "Bulk carrier" },
  { id: "V6", name: "MV Lagos Spirit", type: "Container ship" }
];
const TEMPLATES = {
  Officer: [
    { title: "Lead safe operations in my department", category: "Safety", target: "Zero lost-time injuries; 100% drills and toolbox talks; permits to work closed correctly", weight: 25 },
    { title: "Clean inspections", category: "Compliance", target: "No PSC, vetting or audit findings in my area of responsibility", weight: 20 },
    { title: "Planned work on time", category: "Operations", target: "100% of PMS jobs (engine) or voyage and cargo plans (deck) done on time", weight: 20 },
    { title: "Lead and develop the team", category: "Teamwork", target: "Familiarisation and on-board training complete for every junior I supervise", weight: 15 },
    { title: "My own development", category: "Development", target: "All assigned CBTs complete; one competence course before next contract", weight: 20 }
  ],
  "Non-Officer": [
    { title: "Work safely", category: "Safety", target: "Zero injuries; PPE and permit to work always followed; 100% drill attendance", weight: 30 },
    { title: "Assigned work done well", category: "Operations", target: "PMS jobs and daily work orders done on time and to standard", weight: 30 },
    { title: "Reliable and disciplined", category: "Conduct", target: "No warnings; work and rest hours recorded accurately", weight: 20 },
    { title: "Keep learning", category: "Development", target: "Assigned CBTs and training record book tasks complete", weight: 20 }
  ]
};
const GOAL_LIBRARY = [
  { title: "Mooring operations without incident", category: "Safety", target: "Zero mooring incidents; snap-back zones briefed before every operation", for: "Deck" },
  { title: "Enclosed space entry done right", category: "Safety", target: "100% entries with permit, gas test and rescue team ready", for: "All" },
  { title: "Cargo operations without claims", category: "Operations", target: "No cargo damage or shortage claims; stability checked every stage", for: "Deck" },
  { title: "Bunkering without spills", category: "Operations", target: "Zero spills; checklist and soundings complete for every bunkering", for: "Engine" },
  { title: "Fuel efficiency", category: "Operations", target: "Main engine fuel consumption within 2% of the performance curve", for: "Engine" },
  { title: "Navigation records in order", category: "Compliance", target: "ECDIS, passage plans and log books 100% compliant at every audit", for: "Deck" },
  { title: "Environmental records in order", category: "Compliance", target: "Oil Record Book and Garbage Record Book with no findings", for: "All" },
  { title: "Mentor a cadet", category: "Teamwork", target: "Cadet's training record book tasks for this period signed off", for: "Officer" },
  { title: "Speak up for safety", category: "Teamwork", target: "At least one near-miss or improvement report each month", for: "All" },
  { title: "Galley hygiene", category: "Compliance", target: "No findings in Master's weekly galley and provisions inspection", for: "Catering" },
  { title: "Food within budget", category: "Operations", target: "Victualling within the daily allowance; crew satisfaction 4 of 5 or better", for: "Catering" },
  { title: "Prepare for promotion", category: "Development", target: "Complete the next-rank familiarisation and a competency check with the HOD", for: "All" },
  { title: "Rest-hour compliance", category: "Conduct", target: "No MLC rest-hour non-conformities", for: "All" }
];
const TRAINING = ["Bridge Resource Management", "Engine Room Resource Management", "ECDIS type-specific", "Leadership & Managerial Skills", "Advanced fire fighting refresher", "Behavioural safety workshop", "Maritime English", "Food safety & hygiene", "Cargo handling & stability", "High-voltage safety", "Enclosed space entry & rescue", "Mooring safety"];
const STAGES = [
  { id: "goals", name: "Goal setting", short: "Goals" },
  { id: "goals_review", name: "Goal agreement", short: "Agree goals" },
  { id: "self", name: "Self-evaluation", short: "Self" },
  { id: "appraiser", name: "Appraiser evaluation", short: "Appraiser" },
  { id: "ack", name: "Seafarer acknowledgement", short: "Acknowledge" },
  { id: "reviewer", name: "Countersign", short: "Countersign" },
  { id: "office", name: "Office approval", short: "Office" },
  { id: "done", name: "Completed", short: "Done" }
];
const resolveRole = (role, vessel) => role ? (OFFICE[role] ? role : `${vessel}-${role}`) : null;
const STAGE_IDX = Object.fromEntries(STAGES.map((s, i) => [s.id, i]));

/* ===== Deterministic sample generator (shared with the seeding script) ===== */
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function gauss(r) { let u = 0, v = 0; while (!u) u = r(); while (!v) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const round2 = x => Math.round(x * 100) / 100;

const FIRST = ["Rahul", "Arjun", "Vikram", "Joseph", "Mark", "Rogelio", "Jerome", "Andriy", "Oleksandr", "Ivan", "Marko", "Ante", "Budi", "Agus", "Kyaw", "Aung", "Sandeep", "Imran", "Thomas", "Mihai", "Dmytro", "Reynaldo", "Noel", "Pradeep", "Suresh", "Anil", "Ricardo", "Tomislav", "Hendra", "Zaw", "Rohan", "Faizal", "Christian", "Paolo", "Sergiy", "Kevin", "Nikhil", "Edwin", "Ramon", "Luka"];
const LAST = ["Mehta", "Nair", "Fernandes", "D'Souza", "Santos", "Reyes", "Dela Cruz", "Kovalenko", "Shevchenko", "Horvat", "Novak", "Kusuma", "Wijaya", "Htun", "Min", "Singh", "Khan", "Pereira", "Popescu", "Bondar", "Garcia", "Bautista", "Iyer", "Pillai", "Rao", "Mendoza", "Babic", "Saputra", "Oo", "Kulkarni", "Shaikh", "Lim", "Villanueva", "Melnyk", "Joshi", "Menon", "Castillo", "Perić"];

function sampleFleet() {
  const r = rng(20260101);
  const roster = [];
  const used = new Set();
  const name = () => { for (;;) { const n = FIRST[Math.floor(r() * FIRST.length)] + " " + LAST[Math.floor(r() * LAST.length)]; if (!used.has(n)) { used.add(n); return n; } } };
  const positions = ["MST", "CO", "2O", "3O", "CE", "2E", "3E", "4E", "ETO", "DCD", "BSN", "AB", "AB", "OS", "FTR", "OLR", "CCK", "MSM"];
  for (const v of VESSELS) {
    let ab = 0;
    for (const rk of positions) {
      const id = rk === "AB" ? `${v.id}-AB${++ab}` : `${v.id}-${rk}`;
      const ability = clamp(3.35 + gauss(r) * 0.55, 1.6, 4.85);
      roster.push({ id, name: (rk === "MST" ? "Capt. " : "") + name(), rank: rk, vessel: v.id, ability: round2(ability), joined: 2008 + Math.floor(r() * 17) });
    }
  }
  // Fixed demo characters for the walkthrough on MV Coral Meridian
  const fix = { "V1-MST": "Capt. Arvind Rao", "V1-CO": "Rahul Mehta", "V1-2O": "Joseph Santos", "V1-3O": "Andriy Kovalenko", "V1-CE": "Marko Horvat", "V1-AB1": "Budi Kusuma", "V1-BSN": "Rogelio Reyes", "V1-CCK": "Noel Bautista" };
  for (const p of roster) if (fix[p.id]) p.name = fix[p.id];
  const findP = id => roster.find(p => p.id === id);
  findP("V1-2O").ability = 3.85; findP("V1-AB1").ability = 3.2; findP("V1-3O").ability = 3.0;

  const hist = {}; // last year's completed results
  const apps = [];
  const rate = (base, cat) => clamp(Math.round(base + gauss(r) * 0.6 + (cat === "Safety" ? 0.15 : 0)), 1, 5);
  for (const p of roster) {
    const rk = RANKS[p.rank];
    const tpl = TEMPLATES[rk.level];
    // 2025 history (completed)
    const ab25 = p.ability - 0.1 + gauss(r) * 0.2;
    const cats = {};
    let tot = 0;
    for (const g of tpl) { const v = rate(ab25, g.category); cats[g.category] = v; tot += v * g.weight; }
    hist[p.id] = { overall: round2(tot / 100), cats, decision: tot / 100 < 2.5 ? "Approved with reservations" : "Approved" };
    apps.push(sampleApp(p, r, rate));
  }
  return { roster, hist, apps };
}

function stagePick(p, r) {
  const forced = { "V1-2O": "self", "V1-AB1": "goals", "V1-3O": "appraiser", "V1-BSN": "reviewer", "V1-CO": "appraiser", "V1-CE": "reviewer", "V1-MST": "self", "V1-CCK": "office", "V1-OS": "goals_review", "V1-2E": "ack" };
  if (forced[p.id]) return forced[p.id];
  const x = r();
  if (x < 0.06) return "goals";
  if (x < 0.12) return "goals_review";
  if (x < 0.26) return "self";
  if (x < 0.40) return "appraiser";
  if (x < 0.50) return "ack";
  if (x < 0.60) return "reviewer";
  if (x < 0.70) return "office";
  return "done";
}

function sampleApp(p, r, rate) {
  const rk = RANKS[p.rank];
  const stage = stagePick(p, r);
  const si = STAGE_IDX[stage];
  const goals = TEMPLATES[rk.level].map((g, i) => ({ id: "g" + (i + 1), ...g, self: null, selfNote: "", mgr: null, mgrNote: "" }));
  if (rk.dept === "Catering" && rk.level === "Non-Officer") { goals[1] = { ...goals[1], title: "Galley and mess run well", target: "Meals on time; no findings in galley inspections; victualling within allowance" }; }
  const d = (m, day) => `${YEAR}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const a = { id: `A${YEAR}-${p.id}`, personId: p.id, year: YEAR, rank: p.rank, vessel: p.vessel, level: rk.level, stage, goals, selfSummary: { achievements: "", challenges: "", support: "" }, appraiser: null, ack: null, reviewer: null, office: null, history: [], updated: "" };
  const H = (on, by, action, note) => a.history.push({ on, by, action, note: note || "" });
  H(d(1, 2), "SYSTEM", "Appraisal opened for " + YEAR);
  if (si >= 1) H(d(1, 9 + Math.floor(r() * 10)), p.id, "Submitted goals for agreement");
  if (si >= 2) H(d(1, 20 + Math.floor(r() * 10)), resolveRole(rk.appr, p.vessel), "Agreed goals");
  if (si >= 3) {
    for (const g of a.goals) { const m = rate(p.ability, g.category); g.self = clamp(Math.round(m + 0.25 + gauss(r) * 0.5), 1, 5); g.selfNote = g.self >= 5 || g.self <= 2 ? selfNoteFor(g.self, r) : (r() < 0.5 ? selfNoteFor(g.self, r) : ""); g._m = m; }
    a.selfSummary = { achievements: pick(r, ACHIEVE), challenges: pick(r, CHALL), support: pick(r, SUPPORT) };
    H(d(6 + Math.floor(r() * 3), 1 + Math.floor(r() * 25)), p.id, "Submitted self-evaluation");
  }
  if (si >= 4) {
    for (const g of a.goals) { g.mgr = g._m; g.mgrNote = g.mgr >= 5 || g.mgr <= 2 ? noteFor(g, g.mgr, r) : (r() < 0.6 ? noteFor(g, g.mgr, r) : ""); }
    const ov = overall(a.goals, "mgr");
    const saf = a.goals.find(g => g.category === "Safety").mgr;
    const low = a.goals.some(g => g.mgr <= 2);
    a.appraiser = {
      strengths: pick(r, STRENGTHS), improvements: pick(r, IMPROVE),
      rehire: ov < 2.5 || saf <= 2 ? "With reservations" : "Recommended",
      promotion: rk.next && ov >= 3.8 && saf >= 4 ? "Ready now" : (rk.next ? (ov >= 3.2 ? "Ready next year" : "Not yet ready") : "Not applicable"),
      training: low ? [TRAINING[Math.floor(r() * TRAINING.length)]] : [], comment: ""
    };
    H(d(9, 1 + Math.floor(r() * 20)), resolveRole(rk.appr, p.vessel), "Submitted appraiser evaluation", "Overall " + ov.toFixed(2));
  }
  if (si >= 5) { a.ack = { agree: r() > 0.12, comment: "" }; if (!a.ack.agree) a.ack.comment = "I believe the Safety rating does not reflect the drills I led after the PSC visit."; H(d(9, 22 + Math.floor(r() * 6)), p.id, a.ack.agree ? "Acknowledged and agreed" : "Acknowledged and disagreed", a.ack.comment); }
  if (si >= 6 && rk.rev) { a.reviewer = { comment: r() < 0.4 ? "Fair and well evidenced." : "" }; H(d(9, 28), resolveRole(rk.rev, p.vessel), "Countersigned", a.reviewer.comment); }
  if (si >= 7) { const ov = overall(a.goals, "mgr"); a.office = { decision: ov < 2.5 ? "Approved with reservations" : "Approved", promotionApproved: a.appraiser.promotion === "Ready now", training: a.appraiser.training, remarks: "" }; H(d(9, 30), "CREWING", "Approved and closed", a.office.decision); }
  for (const g of a.goals) delete g._m;
  a.updated = a.history[a.history.length - 1].on;
  return a;
}
const ACHIEVE = ["Led the drill programme after the PSC visit and closed every action within a week.", "Completed all planned maintenance in my area and helped the dry-dock team with the hull survey.", "Took over the cargo plan for three loading ports without any claim.", "Kept my area clean and organised; no findings in the internal audit.", "Finished all CBTs and started my next-rank familiarisation."];
const CHALL = ["Short port stays made it hard to finish maintenance on time.", "The new ECDIS software took time to learn.", "Two crew changes in one month meant extra training of new joiners.", "Spare parts arrived late for the purifier overhaul.", "Bad weather in the Bay of Bengal delayed deck painting."];
const SUPPORT = ["Leadership course before my next contract.", "More time with the Chief Officer on cargo calculations.", "Type-specific ECDIS course.", "Hands-on training on the new purifier.", "Guidance on preparing for my next-rank exam."];
const STRENGTHS = ["Calm under pressure and dependable on watch.", "Strong safety awareness; stops the job when something is wrong.", "Good team player who helps new joiners settle in.", "Thorough with paperwork and records.", "Technically sound and quick to learn."];
const IMPROVE = ["Plan the day's work earlier and report delays sooner.", "Take more ownership of training juniors.", "Improve accuracy of rest-hour records.", "Speak up more in toolbox talks.", "Keep PMS entries up to date the same day."];
function selfNoteFor(v, r) {
  return pick(r, v >= 5 ? ["I went well beyond the target and helped others meet it too.", "No findings at all this year and I led the improvement myself."] : v <= 2 ? ["I fell short here; two items were late at the audit.", "I struggled with this after the crew change and need support."] : ["I met the target throughout the year.", "On target; I closed the few late items quickly."]);
}
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
function noteFor(g, v, r) {
  const hi = ["Went beyond the target: " + g.target.split(";")[0].toLowerCase() + ", and coached others to do the same.", "Clearly exceeded the target with no findings all year."];
  const mid = ["Target met consistently.", "Met the target; a couple of late items were closed quickly.", "Steady performance against the target."];
  const lo = ["Target missed: two items overdue at the internal audit.", "Below target; needed reminders more than once.", "Missed the target after a near miss that was not reported on time."];
  return pick(r, v >= 5 ? hi : v <= 2 ? lo : mid);
}

/* ===== Scoring ===== */
function overall(goals, key) {
  let s = 0, w = 0;
  for (const g of goals) if (g[key]) { s += g[key] * g.weight; w += g.weight; }
  return w ? round2(s / w) : null;
}
function band(x) {
  if (x == null) return null;
  return x >= 4.5 ? SCALE[4] : x >= 3.5 ? SCALE[3] : x >= 2.5 ? SCALE[2] : x >= 1.5 ? SCALE[1] : SCALE[0];
}
function catScores(goals, key) {
  const out = {};
  for (const c of CATS) { const gs = goals.filter(g => g.category === c && g[key]); if (gs.length) out[c] = round2(gs.reduce((s, g) => s + g[key] * g.weight, 0) / gs.reduce((s, g) => s + g.weight, 0)); }
  return out;
}

/* ===== Sample industry benchmark (illustrative, not real company data) ===== */
const SAMPLE_COMPANIES = [
  { name: "Manager A · Singapore", bias: 0.18, sd: 0.48 },
  { name: "Manager B · Hamburg", bias: 0.05, sd: 0.42 },
  { name: "Manager C · Mumbai", bias: -0.04, sd: 0.55 },
  { name: "Manager D · Manila", bias: -0.12, sd: 0.5 },
  { name: "Manager E · Athens", bias: 0.1, sd: 0.6 }
];
function sampleBenchmark() {
  const r = rng(777);
  const rows = []; // [company, rank, year, overall, safety, operations, compliance, teamwork, development, conduct]
  for (const yr of [2025, 2026]) for (const c of SAMPLE_COMPANIES) for (const rk of RANK_ORDER) {
    const n = 14 + Math.floor(r() * 22);
    const lvlAdj = RANKS[rk].level === "Officer" ? 0.05 : -0.05;
    for (let i = 0; i < n; i++) {
      const base = clamp(3.3 + c.bias + lvlAdj + gauss(r) * c.sd, 1.2, 4.9);
      const cat = k => { if (RANKS[rk].level === "Officer" ? k === "Conduct" : (k === "Compliance" || k === "Teamwork")) return null; return clamp(Math.round(base + gauss(r) * 0.55), 1, 5); };
      rows.push([c.name, rk, yr, round2(clamp(base + gauss(r) * 0.12, 1, 5)), ...CATS.map(cat)]);
    }
  }
  return rows;
}

if (typeof module !== "undefined") module.exports = { sampleFleet, sampleBenchmark, overall, RANKS, TEMPLATES };
