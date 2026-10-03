/* ===== Rules (validation) ===== */
function goalChecks(goals) {
  const total = goals.reduce((s, g) => s + (Number(g.weight) || 0), 0);
  const safety = goals.filter(g => g.category === "Safety");
  return [
    { ok: goals.length >= 3 && goals.length <= 6, t: `3 to 6 goals (now ${goals.length})` },
    { ok: total === 100, t: `Weights add up to 100% (now ${total}%)` },
    { ok: goals.every(g => Number.isInteger(+g.weight) && +g.weight >= 10), t: "Each goal is a whole number of at least 10%" },
    { ok: safety.length === 1, t: `Exactly one Safety goal (now ${safety.length})` },
    { ok: safety.length !== 1 || +safety[0].weight >= 20, t: "Safety goal carries at least 20%" },
    { ok: goals.every(g => g.title.trim() && g.target.trim()), t: "Every goal has a title and a measurable target" }
  ];
}
const needsNote = v => v === 1 || v === 2 || v === 5;
function selfChecks(a) {
  return [
    { ok: a.goals.every(g => g.self), t: "Every goal rated" },
    { ok: a.goals.every(g => !needsNote(g.self) || g.selfNote.trim()), t: "A comment on every 1, 2 or 5 rating" },
    { ok: !!a.selfSummary.achievements.trim(), t: "Key achievements filled in" }
  ];
}
function mgrChecks(a) {
  const p = a.appraiser || {};
  const ov = overall(a.goals, "mgr");
  const saf = (a.goals.find(g => g.category === "Safety") || {}).mgr;
  const low = a.goals.some(g => g.mgr && g.mgr <= 2);
  const next = RANKS[a.rank].next;
  return [
    { ok: a.goals.every(g => g.mgr), t: "Every goal rated" },
    { ok: a.goals.every(g => !needsNote(g.mgr) || g.mgrNote.trim()), t: "Evidence written for every 1, 2 or 5 rating" },
    { ok: !!(p.strengths || "").trim() && !!(p.improvements || "").trim(), t: "Strengths and areas to improve filled in" },
    { ok: !!p.rehire, t: "Re-hire recommendation chosen" },
    { ok: p.rehire !== "Recommended" || ov == null || (ov >= 2.5 && !(saf <= 2)), t: "“Recommended” needs an overall of 2.50 or more and Safety above 2" },
    { ok: !!p.promotion, t: "Promotion readiness chosen" },
    { ok: p.promotion !== "Ready now" || (!!next && ov >= 3.5 && saf >= 4), t: next ? "“Ready now” needs 3.50 or more overall and Safety 4 or 5" : "No next rank, so promotion is not applicable" },
    { ok: !low || (p.training || []).length > 0, t: "Training chosen for any goal rated 1 or 2" }
  ];
}
function ackChecks(a) { const k = a.ack || {}; return [{ ok: k.agree === true || k.agree === false, t: "Agree or disagree chosen" }, { ok: k.agree !== false || !!(k.comment || "").trim(), t: "A comment explaining what you disagree with" }]; }
function officeChecks(a) {
  const o = a.office || {}; const ov = overall(a.goals, "mgr");
  return [
    { ok: !!o.decision, t: "Re-hire decision chosen" },
    { ok: o.decision !== "Approved" || ov >= 2.5, t: "“Approved” needs an overall of 2.50 or more" },
    { ok: o.decision !== "Not for re-hire" || !!(o.remarks || "").trim(), t: "Remarks for a not-for-re-hire decision" }
  ];
}
const allOk = cs => cs.every(c => c.ok);
const checksHtml = cs => `<ul class="checks">${cs.map(c => `<li class="${c.ok ? "" : "bad"}">${esc(c.t)}</li>`).join("")}</ul>`;

function checksForKind(kind, a) {
  const cs = kind === "submitGoals" || kind === "agreeGoals" ? goalChecks(a.goals) : kind === "submitSelf" ? selfChecks(a) : kind === "submitMgr" ? mgrChecks(a) : kind === "submitAck" ? ackChecks(a) : kind === "approve" ? officeChecks(a) : [];
  return cs.filter(c => !c.ok).map(c => c.t);
}
