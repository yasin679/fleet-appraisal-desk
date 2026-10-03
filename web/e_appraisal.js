/* ===== Appraisal page ===== */
const nm = (a, id) => (a.names && a.names[id]) || (id === "CREWING" ? OFFICE.CREWING.name : id) || "–";
function editableFor(a) {
  const u = S.user.id;
  switch (a.stage) {
    case "goals": return u === a.personId || u === a.appraiserId ? "goals" : null;
    case "goals_review": return u === a.appraiserId ? "goals" : null;
    case "self": return u === a.personId ? "self" : null;
    case "appraiser": return u === a.appraiserId ? "mgr" : null;
    case "ack": return u === a.personId ? "ack" : null;
    case "reviewer": return u === a.reviewerId ? "rev" : null;
    case "office": return u === "CREWING" ? "office" : null;
  }
  return null;
}
function working(live) {
  const mode = editableFor(live);
  if (!mode) return { a: live, mode: null };
  if (!S.edit || S.edit.id !== live.id || S.edit.stage !== live.stage) {
    const c = clone(live);
    if (mode === "mgr" && !c.appraiser) c.appraiser = { strengths: "", improvements: "", rehire: "", promotion: c.nextRank ? "" : "Not applicable", training: [], comment: "" };
    if (mode === "ack") c.ack = { agree: null, comment: "" };
    if (mode === "rev") c.reviewer = { comment: "" };
    if (mode === "office") c.office = { decision: "", promotionApproved: (c.appraiser || {}).promotion === "Ready now", training: clone((c.appraiser || {}).training || []), remarks: "" };
    S.edit = { id: live.id, stage: live.stage, app: c, ret: "", dirty: false };
  }
  return { a: S.edit.app, mode };
}
const pill = (v, cls) => v ? `<span class="pill5 ${cls}"><b>${v}</b>${esc(SCALE[v - 1].label)}</span>` : `<span class="faint small">Not rated</span>`;
function rateCtl(gi, key, val) {
  return `<div class="rate" role="group" aria-label="Rating 1 to 5">${SCALE.map(s => `<button type="button" data-act="rate" data-gi="${gi}" data-key="${key}" data-v="${s.v}" aria-pressed="${val === s.v}" title="${esc(s.label)}">${s.v}</button>`).join("")}</div><div class="rate-lbl" id="rl-${key}-${gi}">${val ? esc(SCALE[val - 1].label) : "Not rated yet"}</div>`;
}
function stepper(a) {
  const si = STAGE_IDX[a.stage];
  const who = { goals: nm(a, a.personId), goals_review: nm(a, a.appraiserId), self: nm(a, a.personId), appraiser: nm(a, a.appraiserId), ack: nm(a, a.personId), reviewer: a.hasReviewer ? nm(a, a.reviewerId) : "Not needed for this rank", office: nm(a, "CREWING"), done: "" };
  return `<ol class="steps" aria-label="Steps">${STAGES.map((s, i) => { const skip = s.id === "reviewer" && !a.hasReviewer; const st = skip ? "skip" : i < si || a.stage === "done" ? "done" : i === si ? "now" : ""; return `<li class="step ${st}" ${st === "now" ? 'aria-current="step"' : ""}><b>${esc(s.short)}</b>${esc(who[s.id])}</li>`; }).join("")}</ol>`;
}
function turnText(mode, a) {
  return {
    goals: a.stage === "goals_review" ? "Check the goals the seafarer proposed. Adjust them if needed, then agree them or send them back." : (S.user.id === a.personId ? "Set 3 to 6 goals for the year. Start from the template, add goals from the library or write your own, then send them to your appraiser." : "The seafarer is still drafting goals. You can adjust them and agree them now."),
    self: "Rate yourself on each goal from 1 to 5. Explain any 1, 2 or 5, and summarise your year.",
    mgr: "Rate each goal from 1 to 5. The seafarer's own rating is shown beside yours. Explain any 1, 2 or 5 with evidence.",
    ack: "Read your appraiser's ratings. Say whether you agree. If you disagree, explain why; it goes on record.",
    rev: "Check the appraisal is fair and well evidenced. Countersign it, or send it back to the appraiser with remarks.",
    office: "Record the office decision on re-hire, promotion and training, then close the appraisal."
  }[mode];
}

function viewAppraisal(live) {
  const { a, mode } = working(live);
  const si = STAGE_IDX[a.stage];
  const showSelf = live.seesSelf;
  const showMgr = live.seesAppr || mode === "mgr";
  const so = showSelf && (si >= STAGE_IDX.appraiser || a.personId === S.user.id) ? overall(a.goals, "self") : null, mo = showMgr ? overall(a.goals, "mgr") : null;
  const mine = a.personId === S.user.id;
  return `<div class="page-head"><div><div class="eyebrow">${a.year} appraisal · ${esc(a.id)}</div><h1 style="margin-top:4px">${esc(nm(a, a.personId))}</h1>
    <p class="sub">${esc(rankName(a.rank))} · <span class="lvl">${esc(a.level)}</span> · ${esc(vesselName(a.vessel))} · appraiser ${esc(nm(a, a.appraiserId))}${a.hasReviewer ? " · countersign " + esc(nm(a, a.reviewerId)) : ""}</p></div>
    <div class="actions">${S.view.name === "app" ? `<button class="btn btn-sm" type="button" data-act="back">Back</button>` : ""}<a class="btn btn-sm" href="#compare.${esc(a.personId)}">How ${mine ? "I" : "they"} compare</a></div></div>
  <div class="panel">${stepper(a)}</div>
  ${mode ? `<div class="panel" style="border-color:var(--accent)"><div class="eyebrow" style="color:var(--accent)">Your turn · ${esc(STAGES[si].name)}</div><p style="margin-top:4px">${esc(turnText(mode, a))}</p></div>` : a.stage !== "done" ? `<p class="muted small" style="margin:0">Waiting on <b>${esc(nm(a, a.waitingOn))}</b> · ${esc(STAGES[si].name)}</p>` : ""}
  <div class="tiles">
    <div class="tile"><span class="eyebrow">Self-evaluation</span><span class="big num" id="sc-self">${fmt(so)}<small> / 5</small></span><span class="small muted">${so ? esc(band(so).label) : showSelf ? "Not rated yet" : "Shown once submitted"}</span></div>
    <div class="tile hl"><span class="eyebrow">Appraiser rating</span><span class="big num" id="sc-mgr">${fmt(mo)}<small> / 5</small></span><span class="small muted" id="sc-mgr-b">${mo ? esc(band(mo).label) : showMgr ? "Not rated yet" : "Shown once the appraiser submits"}</span></div>
    <div class="tile"><span class="eyebrow">Gap</span><span class="big num" id="sc-gap">${so && mo ? (so - mo >= 0 ? "+" : "") + (so - mo).toFixed(2) : "–"}</span><span class="small muted">Self minus appraiser</span></div>
  </div>
  ${mode === "goals" ? goalsEditor(a) : goalsView(a, mode, showSelf, showMgr)}
  ${summarySections(a, mode, showSelf, showMgr)}
  ${mode ? actionPanel(a, mode) : ""}
  <div class="panel"><h2>History</h2><ul class="timeline" style="margin-top:12px">${a.history.slice().reverse().map(h => `<li><span class="d">${esc(fdate(h.on))}</span><span><b>${esc(nm(a, h.by))}</b> · ${esc(h.action)}${h.note ? `<br><span class="muted">${esc(h.note)}</span>` : ""}</span></li>`).join("")}</ul></div>`;
}

function goalsEditor(a) {
  const dept = RANKS[a.rank].dept;
  const lib = GOAL_LIBRARY.filter(g => g.for === "All" || g.for === dept || g.for === a.level);
  return `<div class="panel"><header><h2>Goals for ${a.year}</h2><span class="small muted">Weights total <b class="num" id="wt-total">${a.goals.reduce((s, g) => s + (+g.weight || 0), 0)}%</b></span></header>
  <div>${a.goals.map((g, i) => `<div class="goal"><div class="goal-edit">
      <label class="f" for="gt${i}">Goal<input id="gt${i}" type="text" data-bind="goals.${i}.title" value="${esc(g.title)}" maxlength="120"></label>
      <label class="f catf" for="gc${i}">Area<select id="gc${i}" data-bind="goals.${i}.category">${CATS.map(c => `<option ${g.category === c ? "selected" : ""}>${c}</option>`).join("")}</select></label>
      <label class="f" for="gw${i}">Weight %<input id="gw${i}" class="w" type="number" min="10" max="60" step="5" data-bind="goals.${i}.weight" data-num="1" value="${esc(g.weight)}"></label>
      <button class="btn btn-sm btn-ghost" type="button" data-act="rmgoal" data-gi="${i}" aria-label="Remove goal ${i + 1}">Remove</button>
      <label class="f t2" for="gg${i}">Target (how it will be measured)<textarea id="gg${i}" data-bind="goals.${i}.target" rows="2" maxlength="300">${esc(g.target)}</textarea></label>
    </div></div>`).join("") || `<p class="empty">No goals yet. Load the ${esc(a.level)} template or add a goal.</p>`}</div>
  <div class="filters" style="margin-top:14px">
    <label class="f" for="libSel" style="flex:1;min-width:220px">Add a goal<select id="libSel"><option value="">Write my own goal</option>${lib.map(g => `<option value="${GOAL_LIBRARY.indexOf(g)}">${esc(g.category)} · ${esc(g.title)}</option>`).join("")}</select></label>
    <button class="btn" type="button" data-act="addgoal" ${a.goals.length >= 6 ? "disabled" : ""}>Add goal</button>
    <button class="btn btn-ghost" type="button" data-act="tplgoals">Reset to the ${esc(a.level)} template</button>
  </div></div>`;
}
function goalsView(a, mode, showSelf, showMgr) {
  return `<div class="panel"><header><h2>Goals and ratings</h2><span class="faint small">1 Unsatisfactory · 2 Needs improvement · 3 Meets · 4 Exceeds · 5 Outstanding</span></header><div>
  ${a.goals.map((g, i) => {
    const selfCol = mode === "self"
      ? `<div><div class="who-rated">Self rating</div>${rateCtl(i, "self", g.self)}<label class="f" for="sn${i}" style="margin-top:6px"><span>Comment <span class="faint" id="need-self-${i}">${needsNote(g.self) ? "(required for this rating)" : "(optional)"}</span></span><textarea id="sn${i}" data-bind="goals.${i}.selfNote" rows="2" maxlength="500">${esc(g.selfNote)}</textarea></label></div>`
      : `<div><div class="who-rated">Self rating</div>${showSelf ? pill(g.self, "s") + (g.selfNote ? `<p class="small muted" style="margin-top:6px">${esc(g.selfNote)}</p>` : "") : `<span class="faint small">Shown once submitted</span>`}</div>`;
    const mgrCol = mode === "mgr"
      ? `<div><div class="who-rated">Appraiser rating</div>${rateCtl(i, "mgr", g.mgr)}<label class="f" for="mn${i}" style="margin-top:6px"><span>Evidence <span class="faint" id="need-mgr-${i}">${needsNote(g.mgr) ? "(required for this rating)" : "(optional)"}</span></span><textarea id="mn${i}" data-bind="goals.${i}.mgrNote" rows="2" maxlength="500">${esc(g.mgrNote)}</textarea></label></div>`
      : `<div><div class="who-rated">Appraiser rating</div>${showMgr ? pill(g.mgr, "m") + (g.mgrNote ? `<p class="small muted" style="margin-top:6px">${esc(g.mgrNote)}</p>` : "") : `<span class="faint small">Shown once the appraiser submits</span>`}</div>`;
    return `<div class="goal"><div class="goal-top"><div><div class="goal-title">${esc(g.title)}</div><div class="goal-meta"><span class="cat ${g.category}">${esc(g.category)}</span><span class="num">${g.weight}%</span></div></div></div>
    <p class="small muted">${esc(g.target)}</p>
    ${STAGE_IDX[a.stage] >= STAGE_IDX.self ? `<div class="rate-row">${selfCol}${mgrCol}</div>` : ""}</div>`;
  }).join("")}</div></div>`;
}
function ta(id, bind, label, val, hint) { return `<label class="f" for="${id}"><span>${esc(label)}${hint ? ` <span class="faint">${esc(hint)}</span>` : ""}</span><textarea id="${id}" data-bind="${bind}" rows="2" maxlength="1000">${esc(val || "")}</textarea></label>`; }
function sel(id, bind, label, val, opts) { return `<label class="f" for="${id}">${esc(label)}<select id="${id}" data-bind="${bind}"><option value="">Choose…</option>${opts.map(o => `<option ${val === o ? "selected" : ""}>${esc(o)}</option>`).join("")}</select></label>`; }
function trainingBoxes(list, bind) {
  return `<fieldset style="border:0;padding:0;margin:0"><legend class="small" style="font-weight:600;color:var(--ink-2);margin-bottom:6px">Training needed</legend><div class="cols">${TRAINING.map((t, i) => `<label class="small" style="display:flex;gap:6px;align-items:flex-start"><input type="checkbox" id="tr-${bind.replace(/\W/g, "")}-${i}" data-act="train" data-bind="${bind}" data-t="${esc(t)}" ${list.includes(t) ? "checked" : ""}> ${esc(t)}</label>`).join("")}</div></fieldset>`;
}
function summarySections(a, mode, showSelf, showMgr) {
  const si = STAGE_IDX[a.stage]; let h = "";
  if (mode === "self") h += `<div class="panel"><h2>My year in summary</h2><div style="display:grid;gap:12px;margin-top:12px">${ta("ss1", "selfSummary.achievements", "Key achievements", a.selfSummary.achievements, "(required)")}${ta("ss2", "selfSummary.challenges", "Challenges I faced", a.selfSummary.challenges)}${ta("ss3", "selfSummary.support", "Support or training I'd like", a.selfSummary.support)}</div></div>`;
  else if (showSelf && si >= STAGE_IDX.appraiser) h += `<div class="panel"><h2>Seafarer's summary</h2><dl class="kv" style="margin-top:12px"><dt>Achievements</dt><dd>${esc(a.selfSummary.achievements) || "–"}</dd><dt>Challenges</dt><dd>${esc(a.selfSummary.challenges) || "–"}</dd><dt>Support wanted</dt><dd>${esc(a.selfSummary.support) || "–"}</dd></dl></div>`;
  if (mode === "mgr") {
    const p = a.appraiser; const nx = a.nextRank;
    h += `<div class="panel"><h2>Appraiser's assessment</h2><div style="display:grid;gap:12px;margin-top:12px">
      <div class="rate-row">${ta("ap1", "appraiser.strengths", "Strengths", p.strengths, "(required)")}${ta("ap2", "appraiser.improvements", "Areas to improve", p.improvements, "(required)")}</div>
      <div class="rate-row">${sel("ap3", "appraiser.rehire", "Re-hire recommendation", p.rehire, ["Recommended", "With reservations", "Not recommended"])}${sel("ap4", "appraiser.promotion", "Promotion readiness" + (nx ? " to " + rankName(nx) : ""), p.promotion, nx ? ["Ready now", "Ready next year", "Not yet ready"] : ["Not applicable"])}</div>
      ${trainingBoxes(p.training, "appraiser.training")}
      ${ta("ap5", "appraiser.comment", "Other comments", p.comment)}</div></div>`;
  } else if (showMgr && a.appraiser) {
    const p = a.appraiser;
    h += `<div class="panel"><h2>Appraiser's assessment</h2><dl class="kv" style="margin-top:12px"><dt>Strengths</dt><dd>${esc(p.strengths)}</dd><dt>To improve</dt><dd>${esc(p.improvements)}</dd><dt>Re-hire</dt><dd>${esc(p.rehire)}</dd><dt>Promotion</dt><dd>${esc(p.promotion)}</dd><dt>Training</dt><dd>${esc((p.training || []).join(", ") || "None")}</dd>${p.comment ? `<dt>Comments</dt><dd>${esc(p.comment)}</dd>` : ""}</dl></div>`;
  }
  if (mode === "ack") h += `<div class="panel"><h2>Your acknowledgement</h2><div style="display:grid;gap:10px;margin-top:12px"><div class="actions" role="radiogroup" aria-label="Do you agree?">
      <label class="btn"><input type="radio" name="agree" data-bind="ack.agree" value="true" ${a.ack.agree === true ? "checked" : ""}> I agree with this appraisal</label>
      <label class="btn"><input type="radio" name="agree" data-bind="ack.agree" value="false" ${a.ack.agree === false ? "checked" : ""}> I disagree</label></div>
      ${ta("ak1", "ack.comment", "Comment", a.ack.comment, "(required if you disagree)")}</div></div>`;
  else if (a.ack && si > STAGE_IDX.ack) h += `<div class="panel"><h2>Seafarer's acknowledgement</h2><p style="margin-top:8px">${a.ack.agree ? "Agreed with the appraisal." : "<b>Disagreed</b> with the appraisal."}${a.ack.comment ? ` <span class="muted">“${esc(a.ack.comment)}”</span>` : ""}</p></div>`;
  if (mode === "rev") h += `<div class="panel"><h2>Countersign</h2><div style="margin-top:12px">${ta("rv1", "reviewer.comment", "Remarks", a.reviewer.comment, "(optional)")}</div></div>`;
  else if (a.reviewer && si > STAGE_IDX.reviewer) h += `<div class="panel"><h2>Countersigned by ${esc(nm(a, a.reviewerId))}</h2>${a.reviewer.comment ? `<p class="muted" style="margin-top:8px">${esc(a.reviewer.comment)}</p>` : ""}</div>`;
  if (mode === "office") {
    const o = a.office; const nx = a.nextRank;
    h += `<div class="panel"><h2>Office decision</h2><div style="display:grid;gap:12px;margin-top:12px">
      <div class="rate-row">${sel("of1", "office.decision", "Re-hire decision", o.decision, ["Approved", "Approved with reservations", "Not for re-hire"])}
      <label class="f" style="align-self:end"><span><input type="checkbox" id="of2" data-bind="office.promotionApproved" data-check="1" ${o.promotionApproved ? "checked" : ""} ${nx ? "" : "disabled"}> Approve promotion${nx ? " to " + esc(rankName(nx)) : " (no next rank)"}</span></label></div>
      ${trainingBoxes(o.training, "office.training")}
      ${ta("of3", "office.remarks", "Remarks", o.remarks, "(required for not for re-hire)")}</div></div>`;
  } else if (a.office && a.stage === "done") h += `<div class="panel"><h2>Office decision</h2><dl class="kv" style="margin-top:12px"><dt>Re-hire</dt><dd>${esc(a.office.decision)}</dd><dt>Promotion</dt><dd>${a.office.promotionApproved ? "Approved" : "Not approved"}</dd><dt>Training</dt><dd>${esc((a.office.training || []).join(", ") || "None")}</dd>${a.office.remarks ? `<dt>Remarks</dt><dd>${esc(a.office.remarks)}</dd>` : ""}</dl></div>`;
  return h;
}
function checksFor(a, mode) { return mode === "goals" ? goalChecks(a.goals) : mode === "self" ? selfChecks(a) : mode === "mgr" ? mgrChecks(a) : mode === "ack" ? ackChecks(a) : mode === "office" ? officeChecks(a) : []; }
function actionPanel(a, mode) {
  const cs = checksFor(a, mode); const ok = allOk(cs); const isSf = S.user.id === a.personId;
  let primary = "", extra = "", save = `<button class="btn" type="button" data-act="do" data-k="save" ${S.busy ? "disabled" : ""}>Save draft</button>`, ret = null;
  const dis = !ok || S.busy ? "disabled" : "";
  if (mode === "goals") {
    if (a.stage === "goals" && isSf) primary = `<button class="btn btn-primary" id="submit-btn" type="button" data-act="do" data-k="submitGoals" ${dis}>Send goals to ${esc(nm(a, a.appraiserId))}</button>`;
    else { primary = `<button class="btn btn-primary" id="submit-btn" type="button" data-act="do" data-k="agreeGoals" ${dis}>Agree goals</button>`; if (a.stage === "goals_review") ret = { to: "the seafarer", k: "retGoals" }; }
  }
  if (mode === "self") primary = `<button class="btn btn-primary" id="submit-btn" type="button" data-act="do" data-k="submitSelf" ${dis}>Submit self-evaluation</button>`;
  if (mode === "mgr") { primary = `<button class="btn btn-primary" id="submit-btn" type="button" data-act="do" data-k="submitMgr" ${dis}>Submit evaluation</button>`; ret = { to: "the seafarer", k: "retSelf" }; }
  if (mode === "ack") { save = ""; primary = `<button class="btn btn-primary" id="submit-btn" type="button" data-act="do" data-k="submitAck" ${dis}>Submit acknowledgement</button>`; }
  if (mode === "rev") { save = ""; primary = `<button class="btn btn-primary" id="submit-btn" type="button" data-act="do" data-k="countersign" ${S.busy ? "disabled" : ""}>Countersign</button>`; ret = { to: "the appraiser", k: "retAppr" }; }
  if (mode === "office") { save = ""; primary = `<button class="btn btn-primary" id="submit-btn" type="button" data-act="do" data-k="approve" ${dis}>Approve and close</button>`; ret = { to: "the appraiser", k: "retAppr" }; }
  if (ret) extra = S.open.ret ? `<div class="confirm" style="flex-basis:100%">${ta("retNote", "__ret", "What should " + ret.to + " change?", S.edit.ret, "(required)")}<div class="actions"><button class="btn btn-primary" type="button" data-act="do" data-k="${ret.k}">Send back to ${esc(ret.to)}</button><button class="btn btn-ghost" type="button" data-act="retclose">Cancel</button></div></div>` : `<button class="btn btn-ghost" type="button" data-act="retopen">Send back to ${esc(ret.to)}</button>`;
  return `<div class="panel" id="act-panel"><h2>Before you submit</h2><div id="live-checks" style="margin-top:10px">${checksHtml(cs)}</div>
  ${S.errors ? `<ul class="checks" style="margin-top:8px" role="alert">${S.errors.map(e => `<li class="bad">${esc(e)}</li>`).join("")}</ul>` : ""}
  <div class="actions" style="margin-top:14px">${primary}${save}${extra}</div></div>`;
}
function updateLive() {
  if (!S.edit) return;
  const live = S.view.data && S.view.data.a; if (!live) return;
  const a = S.edit.app, mode = editableFor(live); if (!mode) return;
  S.edit.dirty = true;
  const cs = checksFor(a, mode);
  const lc = $("#live-checks"); if (lc) lc.innerHTML = checksHtml(cs);
  const sb = $("#submit-btn"); if (sb && mode !== "rev") sb.disabled = !allOk(cs) || !!S.busy;
  const wt = $("#wt-total"); if (wt) wt.textContent = a.goals.reduce((s, g) => s + (+g.weight || 0), 0) + "%";
  if (mode === "self" || mode === "mgr") {
    a.goals.forEach((g, i) => { for (const k of ["self", "mgr"]) { const n = $(`#need-${k}-${i}`); if (n) n.textContent = needsNote(g[k]) ? "(required for this rating)" : "(optional)"; } });
    const so = overall(a.goals, "self"), mo = mode === "mgr" ? overall(a.goals, "mgr") : null;
    if (mode === "self") { const e = $("#sc-self"); if (e) e.innerHTML = `${fmt(so)}<small> / 5</small>`; }
    if (mode === "mgr") { const e = $("#sc-mgr"); if (e) e.innerHTML = `${fmt(mo)}<small> / 5</small>`; const b = $("#sc-mgr-b"); if (b) b.textContent = mo ? band(mo).label : "Not rated yet"; const gp = $("#sc-gap"); if (gp) gp.textContent = so && mo ? (so - mo >= 0 ? "+" : "") + (so - mo).toFixed(2) : "–"; }
  }
}
async function doAction(k) {
  const e = S.edit; if (!e || S.busy) return;
  const live = S.view.data.a; const mode = editableFor(live); const A = e.app;
  if (k.startsWith("ret") && !e.ret.trim()) { toast("Write what needs to change before sending it back."); return; }
  if (!k.startsWith("ret") && k !== "save" && k !== "countersign") { const bad = checksFor(A, mode).filter(c => !c.ok); if (bad.length) { toast("Some items still need attention. See the list above the buttons."); return; } }
  S.busy = "Saving…"; S.errors = null; render();
  try {
    const kind = k === "save" ? "save" : k;
    const extra = k === "save" ? (mode === "goals" ? "goals" : mode) : k.startsWith("ret") ? e.ret.trim() : undefined;
    const updated = await B.act(A.id, kind, A, extra);
    S.busy = ""; S.view.data.a = updated;
    if (k === "save") { S.edit = { id: updated.id, stage: updated.stage, app: mergeEdit(updated, A), ret: e.ret, dirty: false }; render(); toast("Draft saved"); return; }
    S.edit = null; S.open.ret = false; render(); window.scrollTo({ top: 0 });
    toast(updated.stage === "done" ? "Appraisal approved and closed" : `Sent on: now with ${nm(updated, updated.waitingOn)}`);
  } catch (err) {
    S.busy = ""; S.errors = err.errors || null;
    if (err.status === 409) { S.edit = null; toast("This appraisal has moved on since you opened it. Showing the latest version."); reload(); return; }
    render(); toast(err.message || "Couldn't save.");
  }
}
/* keep the user's working copy after a draft save, but take ids from the server */
function mergeEdit(server, local) { const c = clone(local); c.goals = c.goals.map((g, i) => ({ ...g, id: (server.goals[i] || g).id, _new: false })); return c; }
