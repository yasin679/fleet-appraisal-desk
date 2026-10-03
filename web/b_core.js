/* ===== State, helpers ===== */
const API = window.FAD_API || null; // "/api" when served by the .NET application; null in the shareable link
const S = { user: null, view: { name: "boot", args: [], data: null }, edit: null, open: {}, fleetF: { vessel: "", level: "", stage: "", q: "" }, busy: "", notice: "", errors: null, upload: null, afterLogin: null, loginErr: "", demo: null };
let renderPending = false;
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const clone = o => JSON.parse(JSON.stringify(o));
const today = () => new Date().toISOString().slice(0, 10);
const fmt = x => x == null ? "–" : Number(x).toFixed(2);
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fdate = d => d ? `${+d.slice(8, 10)} ${MONTHS[+d.slice(5, 7) - 1]} ${d.slice(0, 4)}` : "";
const ss = { get(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { v == null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, v); } catch (e) {} } };
const vesselName = id => (VESSELS.find(v => v.id === id) || {}).name || id || "";
const rankName = r => (RANKS[r] || {}).name || r;
function roleOfRank(rank) { return rank === "MST" ? "master" : ["CO", "CE", "CCK"].includes(rank) ? "hod" : "seafarer"; }

/* ===== Mapping between the API (C#) shape and the page's shape ===== */
const ST_FROM = { Goals: "goals", GoalsReview: "goals_review", Self: "self", Appraiser: "appraiser", Ack: "ack", Reviewer: "reviewer", Office: "office", Done: "done" };
const ST_TO = Object.fromEntries(Object.entries(ST_FROM).map(([k, v]) => [v, k]));
const REH = { Recommended: "Recommended", WithReservations: "With reservations", NotRecommended: "Not recommended" };
const PRO = { ReadyNow: "Ready now", ReadyNextYear: "Ready next year", NotYetReady: "Not yet ready", NotApplicable: "Not applicable" };
const DEC = { Approved: "Approved", ApprovedWithReservations: "Approved with reservations", NotForRehire: "Not for re-hire" };
const inv = m => Object.fromEntries(Object.entries(m).map(([k, v]) => [v, k]));
const REH_TO = inv(REH), PRO_TO = inv(PRO), DEC_TO = inv(DEC);
const LEVEL_FROM = l => l === "NonOfficer" ? "Non-Officer" : l;

function fromApiSummary(x) {
  return { id: x.id, personId: x.seafarerId, name: x.name, rank: x.rankCode, rankName: x.rankName, level: LEVEL_FROM(x.level), vessel: x.vesselId, vesselName: x.vesselName,
    stage: ST_FROM[x.stage], waitingOn: x.waitingOn, waitingOnName: x.waitingOnName, selfOverall: x.selfOverall, apprOverall: x.appraiserOverall, updated: x.updated };
}
function fromApiDetail(d) {
  const as = d.assessment, of = d.office;
  return {
    id: d.id, personId: d.seafarerId, year: d.year, rank: d.rankCode, vessel: d.vesselId, level: LEVEL_FROM(d.level), stage: ST_FROM[d.stage],
    names: d.names || {}, appraiserId: d.appraiserId, reviewerId: d.reviewerId, hasReviewer: d.hasReviewer, nextRank: d.nextRank, waitingOn: d.waitingOn,
    seesSelf: d.seesSelf, seesAppr: d.seesAppraiser,
    goals: d.goals.map(g => ({ id: g.id, title: g.title, category: g.category, target: g.target, weight: g.weight, self: g.selfRating ?? null, selfNote: g.selfNote || "", mgr: g.appraiserRating ?? null, mgrNote: g.appraiserNote || "" })),
    selfSummary: d.selfSummary ? { achievements: d.selfSummary.achievements || "", challenges: d.selfSummary.challenges || "", support: d.selfSummary.support || "" } : { achievements: "", challenges: "", support: "" },
    appraiser: as ? { strengths: as.strengths || "", improvements: as.improvements || "", rehire: REH[as.rehire] || "", promotion: PRO[as.promotion] || "", training: as.training || [], comment: as.comment || "" } : null,
    ack: d.ack ? { agree: d.ack.agrees, comment: d.ack.comment || "" } : null,
    reviewer: d.countersign ? { comment: d.countersign.comment || "" } : null,
    office: of ? { decision: DEC[of.decision] || "", promotionApproved: !!of.promotionApproved, training: of.training || [], remarks: of.remarks || "" } : null,
    history: (d.history || []).map(h => ({ on: h.on, by: h.by, action: h.action, note: h.note || "" })), updated: d.updated
  };
}
const toApiGoals = a => ({ goals: a.goals.map(g => ({ id: /^g[\w-]+$/.test(g.id) && !g._new ? g.id : null, title: g.title, category: g.category, target: g.target, weight: +g.weight || 0 })) });
const toApiRatings = (a, key, note) => a.goals.map(g => ({ goalId: g.id, rating: g[key] || null, note: g[note] || "" }));

/* ===== Backend 1: the .NET API ===== */
class ApiError extends Error { constructor(status, message, errors) { super(message); this.status = status; this.errors = errors || null; } }
async function http(method, path, body, raw) {
  let res;
  try {
    res = await fetch(API + path, { method, credentials: "same-origin", headers: body !== undefined ? { "Content-Type": raw ? "text/csv" : "application/json" } : {}, body: body === undefined ? undefined : raw ? body : JSON.stringify(body) });
  } catch (e) { throw new ApiError(0, "Can't reach the server. Check your connection and try again."); }
  const txt = await res.text();
  let j = null; try { j = txt ? JSON.parse(txt) : null; } catch (e) {}
  if (!res.ok) {
    if (res.status === 401 && path !== "/auth/login" && path !== "/auth/me") onSignedOut();
    throw new ApiError(res.status, (j && j.message) || `The server answered ${res.status}.`, j && j.errors);
  }
  return j;
}
const ApiBackend = {
  kind: "api",
  async me() { try { const m = await http("GET", "/auth/me"); return m; } catch (e) { if (e.status === 401) return null; throw e; } },
  async login(id, pw) { const r = await http("POST", "/auth/login", { userId: id, password: pw }); return Object.assign({}, r.user, { mustChange: !!r.mustChangePassword }); },
  async logout() { try { await http("POST", "/auth/logout", {}); } catch (e) {} },
  async demoAccounts() { try { return await http("GET", "/auth/demo-accounts"); } catch (e) { return []; } },
  async changePassword(cur, nw) { return http("POST", "/auth/change-password", { current: cur, new: nw }); },
  async worklist() { return (await http("GET", "/worklist")).map(w => ({ action: w.action, a: fromApiSummary(w.appraisal) })); },
  async list(scope) { return (await http("GET", "/appraisals" + (scope ? "?scope=" + scope : ""))).map(fromApiSummary); },
  async get(id) { return fromApiDetail(await http("GET", "/appraisals/" + encodeURIComponent(id))); },
  async act(id, kind, a, extra) {
    const p = "/appraisals/" + encodeURIComponent(id);
    const go = async (m, path, body) => fromApiDetail(await http(m, p + path, body));
    switch (kind) {
      case "save": if (extra === "goals") return go("PUT", "/goals", toApiGoals(a)); if (extra === "self") return go("PUT", "/self", { ratings: toApiRatings(a, "self", "selfNote"), summary: a.selfSummary }); return go("PUT", "/evaluation", { ratings: toApiRatings(a, "mgr", "mgrNote"), assessment: assessmentToApi(a.appraiser) });
      case "submitGoals": await go("PUT", "/goals", toApiGoals(a)); return go("POST", "/goals/submit", {});
      case "agreeGoals": await go("PUT", "/goals", toApiGoals(a)); return go("POST", "/goals/agree", {});
      case "retGoals": return go("POST", "/goals/return", { remark: extra });
      case "submitSelf": await go("PUT", "/self", { ratings: toApiRatings(a, "self", "selfNote"), summary: a.selfSummary }); return go("POST", "/self/submit", {});
      case "submitMgr": await go("PUT", "/evaluation", { ratings: toApiRatings(a, "mgr", "mgrNote"), assessment: assessmentToApi(a.appraiser) }); return go("POST", "/evaluation/submit", {});
      case "retSelf": return go("POST", "/evaluation/return", { remark: extra });
      case "submitAck": return go("POST", "/acknowledge", { agrees: !!a.ack.agree, comment: a.ack.comment || "" });
      case "countersign": return go("POST", "/countersign", { comment: (a.reviewer && a.reviewer.comment) || "" });
      case "retAppr": return go("POST", "/return-to-appraiser", { remark: extra });
      case "approve": return go("POST", "/approve", { decision: DEC_TO[a.office.decision] || null, promotionApproved: !!a.office.promotionApproved, training: a.office.training, remarks: a.office.remarks || "" });
    }
    throw new Error("Unknown action " + kind);
  },
  async people() { return (await http("GET", "/people")).map(p => ({ id: p.id, name: p.name, rank: p.rankCode, rankName: p.rankName, vessel: p.vesselId, vesselName: p.vesselName })); },
  async compare(pid, yr) { return http("GET", `/compare/${encodeURIComponent(pid)}?year=${yr}`); },
  async fleetVsIndustry(yr) { return http("GET", `/compare/fleet-vs-industry?year=${yr}`); },
  async dashboard() { return http("GET", "/dashboard"); },
  async bench() { return http("GET", "/benchmark"); },
  async parseBench(text, name) { return { name, text, preview: parseBench(text, name) }; },
  async saveBench(up, source) { return http("POST", "/benchmark?source=" + encodeURIComponent(source), up.text, true); },
  async resetBench() { return http("DELETE", "/benchmark"); },
  async resetDemo() { return http("POST", "/admin/reset-demo", {}); }
};
function assessmentToApi(p) { return p ? { strengths: p.strengths, improvements: p.improvements, rehire: REH_TO[p.rehire] || null, promotion: PRO_TO[p.promotion] || null, training: p.training || [], comment: p.comment || "" } : null; }

/* ===== Backend 2: in the browser (shareable link), using the page's shared storage ===== */
const L = { mode: "connecting", roster: null, hist: null, apps: {}, bench: null, benchMeta: null, loaded: {} };
let DB = null, SAMPLE_BENCH = null;
const writeQ = {};
function benchRows() { if (L.bench) return L.bench; if (!SAMPLE_BENCH) SAMPLE_BENCH = sampleBenchmark(); return SAMPLE_BENCH; }
function personL(id) { if (OFFICE[id]) return { id, name: OFFICE[id].name, title: OFFICE[id].title, office: true }; const p = (L.roster || []).find(x => x.id === id); return p ? { ...p, title: RANKS[p.rank].name } : null; }
const nameL = id => (personL(id) || {}).name || (id === "SYSTEM" ? "System" : id || "");
const appraiserOf = a => resolveRole(RANKS[a.rank].appr, a.vessel);
const reviewerOf = a => resolveRole(RANKS[a.rank].rev, a.vessel);
function actorFor(a) { switch (a.stage) { case "goals": case "self": case "ack": return a.personId; case "goals_review": case "appraiser": return appraiserOf(a); case "reviewer": return reviewerOf(a); case "office": return "CREWING"; default: return null; } }
function roleOf(uid) { if (OFFICE[uid]) return uid === "CREWING" ? "crewing" : "supt"; const p = personL(uid); return p ? roleOfRank(p.rank) : "seafarer"; }
function canViewL(uid, a) { return !!OFFICE[uid] || a.personId === uid || appraiserOf(a) === uid || reviewerOf(a) === uid || uid === a.vessel + "-MST"; }
function inScopeL(uid, a) { if (OFFICE[uid]) return true; if (a.personId === uid) return false; if (roleOf(uid) === "master") return a.vessel === personL(uid).vessel; return appraiserOf(a) === uid || reviewerOf(a) === uid; }
const seesSelfL = (uid, a) => uid === a.personId || STAGE_IDX[a.stage] >= STAGE_IDX.appraiser;
const seesApprL = (uid, a) => STAGE_IDX[a.stage] >= STAGE_IDX.ack || (a.stage === "appraiser" && uid === appraiserOf(a));
function summaryL(a, uid) {
  const w = actorFor(a);
  return { id: a.id, personId: a.personId, name: nameL(a.personId), rank: a.rank, rankName: rankName(a.rank), level: a.level, vessel: a.vessel, vesselName: vesselName(a.vessel), stage: a.stage, waitingOn: w, waitingOnName: w ? nameL(w) : "",
    selfOverall: STAGE_IDX[a.stage] >= STAGE_IDX.appraiser && seesSelfL(uid, a) ? overall(a.goals, "self") : null, apprOverall: seesApprL(uid, a) ? overall(a.goals, "mgr") : null, updated: a.updated };
}
function detailL(a, uid) {
  const d = clone(a); const ids = [a.personId, appraiserOf(a), reviewerOf(a), actorFor(a), "CREWING", ...a.history.map(h => h.by)].filter(Boolean);
  d.names = Object.fromEntries(ids.map(i => [i, nameL(i)])); d.appraiserId = appraiserOf(a); d.reviewerId = reviewerOf(a); d.hasReviewer = !!RANKS[a.rank].rev; d.nextRank = RANKS[a.rank].next; d.waitingOn = actorFor(a);
  d.seesSelf = seesSelfL(uid, a); d.seesAppr = seesApprL(uid, a);
  if (!d.seesSelf) d.goals.forEach(g => { g.self = null; g.selfNote = ""; });
  if (!d.seesAppr) d.goals.forEach(g => { g.mgr = null; g.mgrNote = ""; });
  return d;
}
function scoreOfL(pid, yr) {
  if (yr === 2025) { const h = (L.hist || {})[pid]; return h ? { overall: h.overall, cats: h.cats, self: null } : null; }
  const a = L.apps[`A${yr}-${pid}`]; if (!a || STAGE_IDX[a.stage] < STAGE_IDX.ack) return null;
  return { overall: overall(a.goals, "mgr"), cats: catScores(a.goals, "mgr"), self: overall(a.goals, "self") };
}
const sortN = xs => xs.slice().sort((a, b) => a - b);
function quant(sorted, p) { if (!sorted.length) return null; const i = (sorted.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i); return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo); }
function others(vals, x) { const i = vals.indexOf(x); return i < 0 ? vals : vals.slice(0, i).concat(vals.slice(i + 1)); }
const higherThan = (vals, x) => vals.length ? Math.round(vals.filter(v => v < x).length / vals.length * 100) : null;
const pctRank = (vals, x) => vals.length ? Math.round((vals.filter(v => v < x).length + vals.filter(v => v === x).length / 2) / vals.length * 100) : null;
function dist(label, kind, vals, me, includesMe) { const s = sortN(vals); return { label, kind, n: s.length, p10: quant(s, .1), p25: quant(s, .25), p50: quant(s, .5), p75: quant(s, .75), p90: quant(s, .9), higherThanPct: me == null ? null : higherThan(includesMe ? others(vals, me) : vals, me) }; }
function compareL(pid, yr, uid) {
  const p = personL(pid), rk = p.rank, me = scoreOfL(pid, yr);
  const fleet = L.roster.filter(x => x.rank === rk).map(x => ({ p: x, s: scoreOfL(x.id, yr) })).filter(x => x.s);
  const rows = benchRows().filter(r => r[1] === rk && r[2] === yr);
  const comps = [...new Set(rows.map(r => r[0]))];
  const fv = fleet.map(x => x.s.overall), pool = rows.map(r => r[3]).concat(fv);
  const m = me ? me.overall : null, fO = m == null ? fv : others(fv, m), iO = m == null ? pool : others(pool, m);
  const avg = xs => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
  const cats = CATS.filter(c => (me && me.cats[c] != null) || fleet.some(x => x.s.cats[c] != null)).map(c => ({ category: c, person: me && me.cats[c] != null ? me.cats[c] : null,
    fleetAverage: avg(fleet.map(x => x.s.cats[c]).filter(v => v != null)), industryAverage: avg(rows.map(r => r[4 + CATS.indexOf(c)]).filter(v => v != null)) }));
  const anon = roleOf(uid) === "seafarer";
  const ranking = fleet.slice().sort((a, b) => b.s.overall - a.s.overall || a.p.id.localeCompare(b.p.id)).map((x, i) => { const hide = anon && x.p.id !== pid; return { position: i + 1, id: hide ? null : x.p.id, name: hide ? null : x.p.name, vesselName: hide ? null : vesselName(x.p.vessel), overall: x.s.overall, isPerson: x.p.id === pid }; });
  return {
    result: { seafarerId: pid, rankCode: rk, year: yr, overall: m, band: m == null ? null : band(m).label, selfOverall: me ? me.self : null,
      fleetRank: m == null ? null : fv.filter(v => v > m).length + 1, fleetRated: fv.length, fleetOthers: fO.length, higherThanPctOfFleet: m == null || !fO.length ? null : higherThan(fO, m),
      tiesInFleet: m == null ? 0 : fO.filter(v => v === m).length, smallGroup: fO.length < 4, industryPercentile: m == null || !iO.length ? null : pctRank(iO, m), industryOthers: iO.length, industryRated: pool.length,
      companies: comps.length + 1, distributions: [dist("Our fleet", "fleet", fv, m, true), ...comps.map(c => dist(c, "company", rows.filter(r => r[0] === c).map(r => r[3]), m, false)), dist("All companies", "all", pool, m, true)],
      categories: cats, source: L.benchMeta ? { source: L.benchMeta.source, uploaded: L.benchMeta.uploaded, isSample: false, rows: L.benchMeta.rowCount } : { source: "Sample benchmark: 5 fictional ship managers (illustrative, not real company data)", isSample: true, rows: benchRows().length } },
    name: p.name, rankName: RANKS[rk].name, ranking, hasPreviousYear: !!scoreOfL(pid, yr - 1)
  };
}
const LocalBackend = {
  kind: "local",
  ready: null,
  async me() { await this.ready; const id = ss.get("fad-user"); return id && (OFFICE[id] || personL(id)) ? meL(id) : null; },
  async login(id, pw) {
    await this.ready; id = (id || "").trim().toUpperCase();
    if (!(OFFICE[id] || personL(id))) throw new ApiError(401, "We don't recognise that Crew ID. Try V1-2O, or pick a demo account.");
    if (pw !== "demo") throw new ApiError(401, "Wrong password. The demo password is demo.");
    ss.set("fad-user", id); return meL(id);
  },
  async logout() { ss.set("fad-user", null); },
  async demoAccounts() { await this.ready; return DEMO_IDS.map(id => { const own = L.apps[`A${YEAR}-${id}`]; return { id, name: nameL(id), title: (personL(id) || {}).title, role: roleOf(id), ownStage: own ? ST_TO[own.stage] : null, ownIsMine: own ? actorFor(own) === id : false, waiting: Object.values(L.apps).filter(a => a.personId !== id && actorFor(a) === id).length }; }); },
  async changePassword() { throw new ApiError(400, "Passwords can only be changed in the server version of the app."); },
  async worklist() { const u = S.user.id; return Object.values(L.apps).filter(a => actorFor(a) === u).sort((a, b) => STAGE_IDX[b.stage] - STAGE_IDX[a.stage]).map(a => ({ action: actionLabel(a.stage), a: summaryL(a, u) })); },
  async list(scope) { const u = S.user.id; return Object.values(L.apps).filter(a => scope === "mine" ? a.personId === u : inScopeL(u, a)).sort((a, b) => a.vessel.localeCompare(b.vessel) || RANK_ORDER.indexOf(a.rank) - RANK_ORDER.indexOf(b.rank) || a.personId.localeCompare(b.personId)).map(a => summaryL(a, u)); },
  async get(id) { const a = L.apps[id]; if (!a) throw new ApiError(404, "That appraisal doesn't exist."); if (!canViewL(S.user.id, a)) throw new ApiError(403, "You can't view this appraisal."); return detailL(a, S.user.id); },
  async act(id, kind, a, extra) {
    const live = L.apps[id]; const u = S.user.id;
    const errs = checksForKind(kind, a);
    if (errs.length) throw new ApiError(422, "Some items still need attention.", errs);
    const next = clone(live);
    const H = (action, note) => next.history.push({ on: today(), by: u, action, note: note || "" });
    if (kind === "save") { if (extra === "goals") next.goals = clone(a.goals); else if (extra === "self") { next.goals = mergeRatings(next.goals, a.goals, "self", "selfNote"); next.selfSummary = clone(a.selfSummary); } else { next.goals = mergeRatings(next.goals, a.goals, "mgr", "mgrNote"); next.appraiser = clone(a.appraiser); } }
    else if (kind.startsWith("ret")) {
      if (!(extra || "").trim()) throw new ApiError(422, "Some items still need attention.", ["BR-14: Say what needs to change before sending it back."]);
      H(kind === "retAppr" ? "Sent back to the appraiser" : "Sent back to the seafarer", extra.trim());
      if (kind === "retAppr") { next.ack = null; next.reviewer = null; next.office = null; }
      next.stage = { retGoals: "goals", retSelf: "self", retAppr: "appraiser" }[kind];
    } else {
      if (kind === "submitGoals" || kind === "agreeGoals") next.goals = clone(a.goals);
      if (kind === "submitSelf") { next.goals = mergeRatings(next.goals, a.goals, "self", "selfNote"); next.selfSummary = clone(a.selfSummary); }
      if (kind === "submitMgr") { next.goals = mergeRatings(next.goals, a.goals, "mgr", "mgrNote"); next.appraiser = clone(a.appraiser); }
      if (kind === "submitAck") next.ack = clone(a.ack);
      if (kind === "countersign") next.reviewer = clone(a.reviewer);
      if (kind === "approve") next.office = clone(a.office);
      const label = { submitGoals: "Submitted goals for agreement", agreeGoals: "Agreed goals", submitSelf: "Submitted self-evaluation", submitMgr: "Submitted appraiser evaluation", submitAck: a.ack && a.ack.agree ? "Acknowledged and agreed" : "Acknowledged and disagreed", countersign: "Countersigned", approve: "Approved and closed" }[kind];
      const note = kind === "submitSelf" ? "Self " + fmt(overall(next.goals, "self")) : kind === "submitMgr" ? "Overall " + fmt(overall(next.goals, "mgr")) : kind === "submitAck" ? (a.ack.comment || "") : kind === "countersign" ? ((a.reviewer || {}).comment || "") : kind === "approve" ? a.office.decision + (a.office.remarks ? ". " + a.office.remarks : "") : "";
      H(label, note);
      next.stage = { submitGoals: "goals_review", agreeGoals: "self", submitSelf: "appraiser", submitMgr: "ack", submitAck: RANKS[next.rank].rev ? "reviewer" : "office", countersign: "office", approve: "done" }[kind];
    }
    next.updated = today();
    await saveL(next);
    return detailL(next, u);
  },
  async people() { const u = S.user.id; return (L.roster || []).filter(p => p.id === u || OFFICE[u] || (roleOf(u) !== "seafarer" && L.apps[`A${YEAR}-${p.id}`] && inScopeL(u, L.apps[`A${YEAR}-${p.id}`]))).sort((a, b) => a.vessel.localeCompare(b.vessel) || RANK_ORDER.indexOf(a.rank) - RANK_ORDER.indexOf(b.rank)).map(p => ({ id: p.id, name: p.name, rank: p.rank, rankName: rankName(p.rank), vessel: p.vessel, vesselName: vesselName(p.vessel) })); },
  async compare(pid, yr) { return compareL(pid, yr, S.user.id); },
  async fleetVsIndustry(yr) {
    const all = benchRows().filter(r => r[2] === yr);
    return RANK_ORDER.map(rk => { const ours = L.roster.filter(p => p.rank === rk).map(p => scoreOfL(p.id, yr)).filter(Boolean).map(s => s.overall); const ind = all.filter(r => r[1] === rk).map(r => r[3]); if (!ours.length || !ind.length) return null; const om = quant(sortN(ours), .5), im = quant(sortN(ind), .5); return { rankCode: rk, rankName: rankName(rk), level: RANKS[rk].level, ourRated: ours.length, ourMedian: om, industryMedian: im, difference: om - im, industryPercentile: pctRank(ind, om) }; }).filter(Boolean);
  },
  async dashboard() {
    const u = S.user.id; const list = Object.values(L.apps).filter(a => inScopeL(u, a)); const rated = list.filter(a => STAGE_IDX[a.stage] >= STAGE_IDX.ack);
    const byVessel = OFFICE[u] ? VESSELS.map(v => { const xs = rated.filter(a => a.vessel === v.id).map(a => overall(a.goals, "mgr")); return xs.length ? { vesselId: v.id, vesselName: v.name, rated: xs.length, average: xs.reduce((s, x) => s + x, 0) / xs.length } : null; }).filter(Boolean) : [];
    return { total: list.length, rated: rated.length, byStage: STAGES.map(s => ({ stage: ST_TO[s.id], count: list.filter(a => a.stage === s.id).length })), averageGap: rated.length ? rated.reduce((s, a) => s + (overall(a.goals, "self") - overall(a.goals, "mgr")), 0) / rated.length : null, byVessel };
  },
  async bench() {
    const rows = benchRows(); const comps = {};
    rows.forEach(r => { const c = comps[r[0]] = comps[r[0]] || { company: r[0], ratings: 0, years: new Set(), ranks: new Set() }; c.ratings++; c.years.add(r[2]); c.ranks.add(r[1]); });
    return { source: L.benchMeta ? { source: L.benchMeta.source, uploaded: L.benchMeta.uploaded, isSample: false, rows: L.benchMeta.rowCount } : { source: "Sample benchmark: 5 fictional ship managers (illustrative, not real company data)", isSample: true, rows: rows.length },
      companies: Object.values(comps).map(c => ({ company: c.company, ratings: c.ratings, years: [...c.years].sort(), ranks: c.ranks.size })) };
  },
  async parseBench(text, name) { return { name, text, preview: parseBench(text, name) }; },
  async saveBench(up, source) {
    const rows = up.preview.rows;
    if (L.mode !== "db") { L.bench = rows; L.benchMeta = { source, uploaded: today(), rowCount: rows.length, chunks: 0 }; return; }
    const size = 1500, n = Math.ceil(rows.length / size);
    for (let i = 0; i < n; i++) await DB.doc("benchmark/c" + i).set({ rows: rows.slice(i * size, (i + 1) * size) });
    const old = (L.benchMeta && L.benchMeta.chunks) || 0;
    await DB.doc("benchmark/meta").set({ source, uploaded: today(), rowCount: rows.length, chunks: n });
    for (let i = n; i < old; i++) await DB.doc("benchmark/c" + i).delete();
    L.bench = rows; L.benchMeta = { source, uploaded: today(), rowCount: rows.length, chunks: n };
  },
  async resetBench() { if (L.mode !== "db") { L.bench = null; L.benchMeta = null; return; } const n = (L.benchMeta && L.benchMeta.chunks) || 0; await DB.doc("benchmark/meta").delete(); for (let i = 0; i < n; i++) await DB.doc("benchmark/c" + i).delete(); L.bench = null; L.benchMeta = null; },
  async resetDemo() {
    const f = sampleFleet();
    if (L.mode !== "db") { L.roster = f.roster; L.hist = f.hist; L.apps = Object.fromEntries(f.apps.map(a => [a.id, a])); return; }
    await DB.doc("fleet/roster").set({ people: f.roster }); await DB.doc("fleet/history2025").set({ people: f.hist });
    let i = 0; for (const a of f.apps) { await DB.doc("appraisals/" + a.id).set(a); S.busy = `Resetting ${++i} of ${f.apps.length}…`; const b = $("[data-act=resetgo]"); if (b) b.textContent = S.busy; }
  }
};
const DEMO_IDS = ["V1-2O", "V1-AB1", "V1-CO", "V1-CE", "V1-MST", "MSUPT", "TSUPT", "CREWING"];
function meL(id) { const p = personL(id); return { id, name: p.name, title: p.title, role: roleOf(id), office: !!OFFICE[id], rankCode: p.rank || null, vesselId: p.vessel || null, vesselName: p.vessel ? vesselName(p.vessel) : null }; }
function mergeRatings(target, src, key, note) { return target.map(g => { const s = src.find(x => x.id === g.id); return s ? { ...g, [key]: s[key], [note]: s[note] } : g; }); }
function actionLabel(stage) { return { goals: "Set goals", goals_review: "Agree goals", self: "Complete self-evaluation", appraiser: "Evaluate", ack: "Read and acknowledge", reviewer: "Countersign", office: "Approve and close" }[stage] || "Open"; }
function saveL(a) {
  L.apps[a.id] = a;
  if (L.mode !== "db") return Promise.resolve();
  const prev = writeQ[a.id] || Promise.resolve();
  const p = prev.then(() => DB.doc("appraisals/" + a.id).set(a)).catch(e => { throw new ApiError(500, dbErrText(e)); });
  writeQ[a.id] = p.catch(() => {}); return p;
}
function dbErrText(e) { const c = e && e.code; if (c === "invalid_argument") return "You can't save changes on this copy. Ask the owner to share it with you as a Contributor or Editor."; if (c === "quota_exceeded") return "Storage for this page is full."; if (c === "resource_exhausted") return "Too many changes at once. Wait a few seconds and try again."; return "Couldn't save. Check your connection and try again."; }
function goLocalMemory() { const f = sampleFleet(); L.mode = "local"; L.roster = f.roster; L.hist = f.hist; L.apps = Object.fromEntries(f.apps.map(a => [a.id, a])); S.notice = "This copy isn't connected to shared storage, so changes last only until you close the page."; }
LocalBackend.ready = new Promise(resolve => {
  if (API) return resolve();
  let done = false; const finish = () => { if (!done) { done = true; resolve(); } };
  const timer = setTimeout(() => { if (L.mode === "connecting") goLocalMemory(); finish(); }, 12000);
  (async () => {
    let db = null;
    try { db = window.claude && typeof window.claude.use === "function" ? await window.claude.use("db") : null; } catch (e) { db = null; }
    if (!db) { clearTimeout(timer); if (L.mode === "connecting") goLocalMemory(); finish(); return; }
    DB = db; L.mode = "db";
    let got = 0; const ready = () => { if (++got >= 2) { clearTimeout(timer); if (!L.roster || !L.roster.length) { goLocalMemoryIfEmpty(); } finish(); } };
    DB.doc("fleet/roster").onSnapshot(s => { L.roster = s.exists ? clone(s.data().people || []) : []; if (!L.loaded.roster) { L.loaded.roster = true; ready(); } else liveChanged(); });
    DB.doc("fleet/history2025").onSnapshot(s => { L.hist = s.exists ? clone(s.data().people || {}) : {}; liveChanged(); });
    DB.collection("appraisals").onSnapshot(q => { const m = {}; q.docs.forEach(d => { m[d.id] = clone(d.data()); }); L.apps = m; if (!L.loaded.apps) { L.loaded.apps = true; ready(); } else liveChanged(); });
    DB.collection("benchmark").onSnapshot(q => { const meta = q.docs.find(d => d.id === "meta"); if (!meta) { L.bench = null; L.benchMeta = null; liveChanged(); return; } const m = meta.data(); const rows = []; for (let i = 0; i < (m.chunks || 0); i++) { const c = q.docs.find(d => d.id === "c" + i); if (c) rows.push(...clone(c.data().rows || [])); } if (rows.length === m.rowCount) { L.bench = rows; L.benchMeta = clone(m); } liveChanged(); });
  })();
});
function goLocalMemoryIfEmpty() { if (!L.roster || !L.roster.length) { const f = sampleFleet(); L.roster = f.roster; L.hist = f.hist; L.apps = Object.fromEntries(f.apps.map(a => [a.id, a])); S.notice = "Shared storage is empty. Sign in as the Crewing Manager and use Demo data › Reset to load the sample fleet for everyone."; } }
let liveTimer;
function liveChanged() { if (API || !S.user) return; clearTimeout(liveTimer); liveTimer = setTimeout(() => { if (S.edit) return; reload(true); }, 300); }

const B = API ? ApiBackend : LocalBackend;
