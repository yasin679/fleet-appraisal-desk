/* ===== Benchmark data (Crewing Manager) ===== */
const CSV_TEMPLATE = `company,rank,year,overall,safety,operations,compliance,teamwork,development,conduct
Manager X,2O,2025,3.6,4,3,4,3,4,
Manager X,AB,2025,3.2,3,3,,,3,4
Manager Y,Chief Engineer,2025,4.1,4,4,5,4,4,`;
const RANK_ALIAS = { "C/O": "CO", "2/O": "2O", "3/O": "3O", "C/E": "CE", "2/E": "2E", "3/E": "3E", "4/E": "4E", "D/CDT": "DCD", "CADET": "DCD", "BOSUN": "BSN", "BOATSWAIN": "BSN", "FITTER": "FTR", "OILER": "OLR", "CH/COOK": "CCK", "COOK": "CCK", "MESSMAN": "MSM", "CAPTAIN": "MST" };
function rankCode(x) { const u = String(x || "").trim().toUpperCase(); if (RANKS[u]) return u; if (RANK_ALIAS[u]) return RANK_ALIAS[u]; return Object.keys(RANKS).find(k => RANKS[k].name.toUpperCase() === u) || null; }
function splitCsv(line) { const out = []; let cur = "", qd = false; for (let i = 0; i < line.length; i++) { const c = line[i]; if (qd) { if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') qd = false; else cur += c; } else if (c === '"') qd = true; else if (c === ",") { out.push(cur); cur = ""; } else cur += c; } out.push(cur); return out.map(s => s.trim()); }
function parseBench(text, name) {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter(l => l.trim());
  const errors = [], rows = [];
  if (!lines.length) return { name, rows, errors: ["The file is empty."] };
  const head = splitCsv(lines[0]).map(h => h.toLowerCase()); const col = k => head.indexOf(k);
  for (const k of ["company", "rank", "year", "overall"]) if (col(k) < 0) errors.push(`Column “${k}” is missing from the first row.`);
  if (errors.length) return { name, rows, errors };
  for (let i = 1; i < lines.length; i++) {
    const c = splitCsv(lines[i]);
    const rk = rankCode(c[col("rank")]), yr = parseInt(c[col("year")], 10), ov = parseFloat(c[col("overall")]), co = c[col("company")];
    if (!co) { errors.push(`Line ${i + 1}: company is empty.`); continue; }
    if (!rk) { errors.push(`Line ${i + 1}: rank “${c[col("rank")]}” is not one we know.`); continue; }
    if (!(yr >= 2000 && yr <= 2100)) { errors.push(`Line ${i + 1}: year “${c[col("year")]}” is not valid.`); continue; }
    if (!(ov >= 1 && ov <= 5)) { errors.push(`Line ${i + 1}: overall must be between 1 and 5.`); continue; }
    const cats = CATS.map(k => { const j = col(k.toLowerCase()); const v = j >= 0 ? parseFloat(c[j]) : NaN; return v >= 1 && v <= 5 ? v : null; });
    rows.push([co.slice(0, 60), rk, yr, round2(ov), ...cats]);
  }
  return { name, rows, errors };
}
function viewBench() {
  const b = S.view.data.bench; const up = S.upload; const src = b.source;
  return `<div class="page-head"><div><h1>Benchmark data</h1><p class="sub">Ratings from other ship managers, used for the industry comparison</p></div></div>
  <div class="grid2">
    <div class="panel"><header><h2>In use now</h2>${src.isSample ? `<span class="chip st-self">Sample data</span>` : `<span class="chip st-done">Uploaded data</span>`}</header>
      <p class="muted" style="margin-top:8px">${src.isSample ? "A built-in sample of five fictional ship managers. It shows how the comparison works; it is not real company data." : `${esc(src.source)} · uploaded ${esc(fdate(src.uploaded))} · ${src.rows} ratings`}</p>
      <div class="tbl-wrap" style="margin-top:10px"><table><thead><tr><th>Company</th><th class="r">Ratings</th><th>Years</th><th class="r">Ranks</th></tr></thead><tbody>${b.companies.map(c => `<tr><td>${esc(c.company)}</td><td class="r num">${c.ratings}</td><td class="num small">${esc(c.years.join(", "))}</td><td class="r num">${c.ranks}</td></tr>`).join("")}</tbody></table></div>
      ${src.isSample ? "" : `<div class="actions" style="margin-top:12px"><button class="btn" type="button" data-act="benchclear">Go back to the sample data</button></div>`}</div>
    <div class="panel"><h2>Upload real benchmark data</h2>
      <p class="muted small" style="margin-top:8px">Use anonymised ratings from a manning agency, a data-sharing pool or a survey. One row per seafarer rating, on the same 1–5 scale. Category columns are optional. Uploading replaces the data in use for everyone.</p>
      <div style="display:grid;grid-template-columns:minmax(0,1fr);gap:10px;margin-top:12px">
        <label class="f" for="benchFile">CSV file<input id="benchFile" type="file" accept=".csv,text/csv"></label>
        ${up ? `<div class="confirm"><b>${esc(up.name)}</b><span>${up.preview.rows.length} rows ready${up.preview.errors.length ? ` · ${up.preview.errors.length} rows skipped` : ""}</span>
          ${up.preview.errors.length ? `<ul class="checks">${up.preview.errors.slice(0, 6).map(e => `<li class="bad">${esc(e)}</li>`).join("")}${up.preview.errors.length > 6 ? `<li class="bad">…and ${up.preview.errors.length - 6} more</li>` : ""}</ul>` : ""}
          ${up.preview.rows.length ? `<label class="f" for="benchSrc">Where the data comes from<input id="benchSrc" type="text" value="${esc(up.name)}" placeholder="e.g. Manning agency pool, Q3 2026"></label>
          <div class="actions"><button class="btn btn-primary" type="button" data-act="benchsave" ${S.busy ? "disabled" : ""}>${S.busy || "Use this data"}</button><button class="btn btn-ghost" type="button" data-act="benchcancel">Cancel</button></div>` : ""}</div>` : ""}
        <div><div class="eyebrow" style="margin-bottom:6px">File layout</div><pre id="csvTpl" class="num small" style="margin:0;padding:10px;background:var(--surface-2);border-radius:var(--r);overflow-x:auto">${esc(CSV_TEMPLATE)}</pre>
        <div class="actions" style="margin-top:8px"><button class="btn btn-sm" type="button" data-act="copytpl">Copy layout</button><span class="faint small">Rank can be a code (2O), an abbreviation (2/O) or a name (Second Officer).</span></div></div>
      </div></div>
  </div>`;
}

/* ===== Demo data (Crewing Manager) ===== */
function viewAdmin() {
  return `<div class="page-head"><div><h1>Demo data</h1><p class="sub">What everyone sees on this desk</p></div></div>
  <div class="panel" style="max-width:720px"><h2>Reset to the starting point</h2>
  <p class="muted" style="margin-top:8px">Puts every ${YEAR} appraisal back to how the demo started, so you can run the walkthrough again: Joseph Santos (2/O) has a self-evaluation to do, Budi Kusuma (AB) has goals to set, Rahul Mehta (C/O) has evaluations waiting and the Master has countersigns waiting. Uploaded benchmark data and passwords are kept.</p>
  <div style="margin-top:14px">${S.open.reset ? `<div class="confirm"><b>Reset every appraisal for everyone?</b><span class="small">Anything people entered since the start is lost.</span><div class="actions"><button class="btn btn-primary" type="button" data-act="resetgo" ${S.busy ? "disabled" : ""}>${S.busy || "Yes, reset demo data"}</button><button class="btn btn-ghost" type="button" data-act="resetno">Cancel</button></div></div>` : `<button class="btn" type="button" data-act="reset">Reset demo data</button>`}</div></div>`;
}

/* ===== Events ===== */
function setPath(obj, path, val) { const ks = path.split("."); let o = obj; for (let i = 0; i < ks.length - 1; i++) o = o[/^\d+$/.test(ks[i]) ? +ks[i] : ks[i]]; o[ks[ks.length - 1]] = val; }
const ACT = {
  quick: d => doLogin(d.id, "demo"),
  logout: async () => { await B.logout(); S.user = null; S.edit = null; S.open = {}; S.notice = API ? "" : S.notice; S.demo = null; S.view = { name: "login", args: [] }; history.replaceState(null, "", "#login"); route(); window.scrollTo(0, 0); },
  back: () => { if (history.length > 1) history.back(); else go(defaultRoute(S.user)); },
  rate: (d, el) => {
    const a = S.edit && S.edit.app; if (!a) return;
    const v = +d.v; a.goals[+d.gi][d.key] = v;
    el.parentElement.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(+b.dataset.v === v)));
    const l = $(`#rl-${d.key}-${d.gi}`); if (l) l.textContent = SCALE[v - 1].label;
    updateLive();
  },
  rmgoal: d => { S.edit.app.goals.splice(+d.gi, 1); S.edit.dirty = true; render(); },
  addgoal: () => { const a = S.edit.app; if (a.goals.length >= 6) return; const i = $("#libSel") ? $("#libSel").value : ""; const g = i !== "" ? GOAL_LIBRARY[+i] : { title: "", category: "Operations", target: "" }; a.goals.push({ id: "n" + Date.now().toString(36), _new: true, title: g.title, category: g.category, target: g.target, weight: 10, self: null, selfNote: "", mgr: null, mgrNote: "" }); S.edit.dirty = true; render(); const n = a.goals.length - 1; const el = $("#gt" + n); if (el) { el.scrollIntoView({ block: "center" }); if (!g.title) el.focus(); } },
  tplgoals: () => { const a = S.edit.app; a.goals = TEMPLATES[a.level].map((g, i) => ({ id: "g" + (i + 1), ...g, self: null, selfNote: "", mgr: null, mgrNote: "" })); S.edit.dirty = true; render(); },
  retopen: () => { S.open.ret = true; render(); const t = $("#retNote"); if (t) t.focus(); },
  retclose: () => { S.open.ret = false; render(); },
  do: d => doAction(d.k),
  reset: () => { S.open.reset = true; render(); },
  resetno: () => { S.open.reset = false; render(); },
  resetgo: async () => { if (S.busy) return; S.busy = "Resetting…"; S.edit = null; render(); try { await B.resetDemo(); toast("Demo data reset"); } catch (e) { toast(e.message || "Couldn't reset."); } S.busy = ""; S.open.reset = false; render(); },
  benchsave: async () => { if (S.busy) return; const src = (($("#benchSrc") || {}).value || S.upload.name).trim() || S.upload.name; S.busy = "Saving…"; render(); try { await B.saveBench(S.upload, src); S.upload = null; toast("Benchmark data saved. Every comparison now uses it."); } catch (e) { toast(e.message || "Couldn't save."); } S.busy = ""; reload(); },
  benchcancel: () => { S.upload = null; render(); },
  benchclear: async () => { try { await B.resetBench(); toast("Back to the sample benchmark"); } catch (e) { toast(e.message); } reload(); },
  copytpl: () => { const done = () => toast("Layout copied"); try { navigator.clipboard.writeText(CSV_TEMPLATE).then(done, () => selectTpl()); } catch (e) { selectTpl(); } }
};
function selectTpl() { const el = $("#csvTpl"); if (!el) return; const r = document.createRange(); r.selectNodeContents(el); const s = getSelection(); s.removeAllRanges(); s.addRange(r); toast("Layout selected. Press Ctrl+C or Cmd+C to copy."); }

document.addEventListener("click", e => {
  const link = e.target.closest && e.target.closest("a[href^='#app.']");
  if (link) { S.from = S.view.name === "app" ? S.from : S.view.name; }
  const el = e.target.closest("[data-act]");
  if (!el || el.tagName === "INPUT") return;
  if (el.tagName === "A") e.preventDefault();
  const fn = ACT[el.dataset.act]; if (fn) fn(el.dataset, el);
});
document.addEventListener("submit", async e => {
  if (e.target.id === "loginForm") { e.preventDefault(); doLogin($("#lid").value, $("#lpw").value); }
  if (e.target.id === "pwForm") {
    e.preventDefault(); const a = $("#pw0").value, b = $("#pw1").value, c = $("#pw2").value;
    if (b !== c) { S.pwMsg = "The two new passwords don't match."; S.pwOk = false; render(); return; }
    try { await B.changePassword(a, b); S.pwMsg = "Password changed."; S.pwOk = true; } catch (err) { S.pwMsg = (err.errors && err.errors[0]) || err.message; S.pwOk = false; }
    render();
  }
});
document.addEventListener("input", e => {
  const t = e.target;
  if (t.dataset.bind && S.edit && !["checkbox", "radio"].includes(t.type) && t.tagName !== "SELECT") {
    if (t.dataset.bind === "__ret") { S.edit.ret = t.value; return; }
    setPath(S.edit.app, t.dataset.bind, t.dataset.num ? (t.value === "" ? "" : parseInt(t.value, 10)) : t.value);
    updateLive(); return;
  }
  if (t.dataset.filter === "q") { S.fleetF.q = t.value; clearTimeout(t._d); t._d = setTimeout(() => { const pos = t.selectionStart; renderPending = false; render(); const n = $("#fq"); if (n) { n.focus(); n.setSelectionRange(pos, pos); } }, 250); }
});
document.addEventListener("change", e => {
  const t = e.target;
  if (t.dataset.bind && S.edit) {
    if (t.dataset.act === "train") { const ks = t.dataset.bind.split("."); const list = S.edit.app[ks[0]][ks[1]]; const i = list.indexOf(t.dataset.t); if (t.checked && i < 0) list.push(t.dataset.t); if (!t.checked && i >= 0) list.splice(i, 1); updateLive(); return; }
    if (t.type === "radio") { setPath(S.edit.app, t.dataset.bind, t.value === "true"); updateLive(); return; }
    if (t.type === "checkbox") { setPath(S.edit.app, t.dataset.bind, t.checked); updateLive(); return; }
    if (t.tagName === "SELECT") { setPath(S.edit.app, t.dataset.bind, t.value); updateLive(); return; }
  }
  if (t.dataset.filter && t.dataset.filter !== "q") { S.fleetF[t.dataset.filter] = t.value; t.blur(); render(); return; }
  if (t.dataset.nav) { const d = S.view.data; const pid = t.dataset.nav === "person" ? t.value : d.pid; const yr = t.dataset.nav === "year" ? +t.value : (t.dataset.nav === "person" ? "" : d.yr); t.blur(); go("compare." + pid + (yr ? "." + yr : "")); return; }
  if (t.id === "benchFile" && t.files && t.files[0]) { const f = t.files[0]; f.text().then(async txt => { S.upload = await B.parseBench(txt, f.name); render(); }, () => toast("Couldn't read that file.")); }
});
let tipEl;
document.addEventListener("mousemove", e => {
  const h = e.target.closest && e.target.closest("[data-tip]");
  if (!h) { if (tipEl) tipEl.hidden = true; return; }
  if (!tipEl) { tipEl = document.createElement("div"); tipEl.className = "tip"; document.body.appendChild(tipEl); }
  tipEl.textContent = h.getAttribute("data-tip"); tipEl.hidden = false;
  const x = Math.min(e.clientX + 14, innerWidth - tipEl.offsetWidth - 8); tipEl.style.left = x + "px"; tipEl.style.top = (e.clientY + 16) + "px";
});
function afterRender() { if (tipEl) tipEl.hidden = true; }
window.addEventListener("hashchange", () => {
  if (S.edit && S.edit.dirty && S.view.name !== "login") {
    // Unsaved changes: keep them in memory; they come back if the user returns to the same appraisal at the same step.
    toast("Your unsaved changes are kept until you leave the app. Save a draft to keep them for good.");
  }
  route();
});
window.addEventListener("beforeunload", e => { if (S.edit && S.edit.dirty) { e.preventDefault(); e.returnValue = ""; } });

/* ===== Boot ===== */
render();
route();
