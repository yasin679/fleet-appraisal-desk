/* ===== Navigation =====
   Every page has its own address after the #, so the browser's Back and Forward buttons, refresh and bookmarks work:
   #work  #mine  #team  #app.A2026-V1-2O  #compare  #compare.V1-2O  #compare.V1-2O.2025  #bench  #admin  #account  #login */
const anchorSvg = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="5" r="2"/><path d="M12 7v14M7 11h10M4 15c0 3.5 3.6 6 8 6s8-2.5 8-6"/></svg>`;
function parseHash() { const h = (location.hash || "").replace(/^#/, ""); const [name, ...args] = h.split("."); return { name: name || "", args }; }
function go(token) { if (location.hash === "#" + token) reload(); else location.hash = token; }
function defaultRoute(u) { return u.role === "seafarer" ? "mine" : "work"; }
function tabsFor(u) {
  const r = u.role;
  if (r === "seafarer") return [{ id: "mine", label: "My appraisal" }, { id: "compare", label: "How I compare" }];
  if (r === "hod") return [{ id: "work", label: "My work" }, { id: "team", label: "My team" }, { id: "mine", label: "My appraisal" }, { id: "compare", label: "Compare" }];
  if (r === "master") return [{ id: "work", label: "My work" }, { id: "team", label: "Vessel crew" }, { id: "mine", label: "My appraisal" }, { id: "compare", label: "Compare" }];
  if (r === "supt") return [{ id: "work", label: "My work" }, { id: "team", label: "Fleet" }, { id: "compare", label: "Compare" }];
  return [{ id: "work", label: "My work" }, { id: "team", label: "Fleet" }, { id: "compare", label: "Compare" }, { id: "bench", label: "Benchmark data" }, { id: "admin", label: "Demo data" }];
}
const ALLOWED = { seafarer: ["mine", "compare", "app", "account"], hod: ["work", "team", "mine", "compare", "app", "account"], master: ["work", "team", "mine", "compare", "app", "account"], supt: ["work", "team", "compare", "app", "account"], crewing: ["work", "team", "compare", "bench", "admin", "app", "account"] };

async function route() {
  const { name, args } = parseHash();
  if (!S.user) {
    if (S.view.name === "boot") { try { S.user = await B.me(); } catch (e) { S.user = null; } }
    if (!S.user) { if (name && name !== "login") S.afterLogin = location.hash.slice(1); S.view = { name: "login", args: [], data: null }; if (!S.demo) B.demoAccounts().then(d => { S.demo = d; if (S.view.name === "login") render(); }); render(); return; }
  }
  if (!name || name === "login") { history.replaceState(null, "", "#" + defaultRoute(S.user)); return route(); }
  if (!(ALLOWED[S.user.role] || []).includes(name)) { S.view = { name: "notfound", args, data: null }; render(); return; }
  S.view = { name, args, data: null, loading: true }; S.errors = null; S.open = {};
  if (!S.edit || name !== "app" || S.edit.id !== args.join(".")) S.edit = null;
  render();
  await load();
}
async function load(quiet) {
  const v = S.view; const token = location.hash;
  try {
    let data = null;
    switch (v.name) {
      case "work": { const [w, mine, scope] = await Promise.all([B.worklist(), B.list("mine"), B.list()]); data = { work: w, own: mine[0] || null, others: scope.filter(a => a.waitingOn && a.waitingOn !== S.user.id) }; break; }
      case "team": { const [list, dash] = await Promise.all([B.list(), B.dashboard()]); data = { list, dash }; break; }
      case "mine": { const mine = await B.list("mine"); data = { a: mine[0] ? await B.get(mine[0].id) : null }; break; }
      case "app": data = { a: await B.get(v.args.join(".")) }; break;
      case "compare": {
        const people = await B.people(); const pid = v.args[0] && people.some(p => p.id === v.args[0]) ? v.args[0] : (people.some(p => p.id === S.user.id) ? S.user.id : (people[0] || {}).id);
        if (!pid) { data = { people, none: true }; break; }
        let yr = +v.args[1] || YEAR; let cmp = await B.compare(pid, yr);
        if (!v.args[1] && cmp.result.overall == null && cmp.hasPreviousYear) { yr = YEAR - 1; cmp = await B.compare(pid, yr); }
        const fvi = S.user.office ? await B.fleetVsIndustry(yr) : null;
        data = { people, pid, yr, cmp, fvi }; break;
      }
      case "bench": data = { bench: await B.bench() }; break;
      default: data = {};
    }
    if (token !== location.hash) return; // the user navigated away while this was loading
    v.data = data; v.loading = false; v.error = null;
  } catch (e) {
    if (token !== location.hash) return;
    v.loading = false; v.error = e;
  }
  if (quiet) changed(); else render();
}
function reload(quiet) { if (S.user && S.view.name !== "login") load(quiet); }
function onSignedOut() { if (!S.user) return; S.user = null; S.edit = null; S.notice = "Your session ended. Please sign in again."; S.afterLogin = location.hash.slice(1); S.view = { name: "login", args: [] }; render(); }

/* ===== Rendering plumbing ===== */
function changed() {
  const ae = document.activeElement;
  if (ae && ae.closest && ae.closest("#main") && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName)) { renderPending = true; return; }
  render();
}
document.addEventListener("focusout", () => { if (renderPending) setTimeout(() => { const ae = document.activeElement; if (!(ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName) && ae.closest("#main"))) { renderPending = false; render(); } }, 0); });
let toastT;
function toast(msg) { let t = $(".toast"); if (!t) { t = document.createElement("div"); t.className = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); } t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 4200); }

function render() {
  renderPending = false;
  const root = $("#app");
  const v = S.view;
  if (v.name === "boot") { root.innerHTML = `<div class="empty" style="padding:60px">Loading…</div>`; return; }
  if (!S.user || v.name === "login") { root.innerHTML = renderLogin(); document.title = "Sign in · Fleet Appraisal Desk"; return; }
  const u = S.user, tabs = tabsFor(u);
  const cur = v.name === "app" ? (S.from || "") : v.name;
  let body;
  if (v.loading) body = `<div class="panel empty">Loading…</div>`;
  else if (v.error) body = errorPage(v.error);
  else body = viewHtml();
  root.innerHTML = `<header class="bar"><div class="bar-in"><a class="brand" href="#${defaultRoute(u)}" style="color:inherit;text-decoration:none">${anchorSvg} FLEET APPRAISAL DESK</a>
    <div class="who"><div style="min-width:0;text-align:right"><b>${esc(u.name)}</b><br><span>${esc(u.office ? u.title : `${u.title} · ${u.vesselName || ""}`)}</span></div>
    ${API ? `<a class="btn btn-ghost btn-sm" href="#account">Account</a>` : ""}<button class="btn btn-ghost btn-sm" data-act="logout" type="button">Sign out</button></div></div>
    <nav class="tabs" aria-label="Sections">${tabs.map(t => `<a href="#${t.id}" ${t.id === cur ? 'aria-current="page"' : ""}>${esc(t.label)}</a>`).join("")}</nav></header>
    ${S.notice ? `<div style="padding-inline:16px"><div class="notice">${esc(S.notice)}</div></div>` : ""}
    <main class="wrap" id="main">${crumbs()}${body}</main>`;
  const titles = { work: "My work", mine: "My appraisal", team: tabs.find(t => t.id === "team") ? tabs.find(t => t.id === "team").label : "Team", compare: "Compare", bench: "Benchmark data", admin: "Demo data", account: "Account", app: "Appraisal", notfound: "Not found" };
  document.title = (titles[v.name] || "Fleet Appraisal Desk") + " · Fleet Appraisal Desk";
  afterRender();
}
function crumbs() {
  const v = S.view; const home = tabsFor(S.user)[0];
  const parts = [`<a href="#${home.id}">${esc(home.label)}</a>`];
  if (v.name === "app") {
    const from = tabsFor(S.user).find(t => t.id === S.from) || null;
    if (from && from.id !== home.id) parts.push(`<a href="#${from.id}">${esc(from.label)}</a>`);
    parts.push(`<span>${esc(v.data && v.data.a ? (v.data.a.names[v.data.a.personId] || v.data.a.personId) : "Appraisal")}</span>`);
  } else if (v.name === "compare" && v.data && v.data.cmp) {
    if (home.id !== "compare") parts.push(`<a href="#compare">${S.user.role === "seafarer" ? "How I compare" : "Compare"}</a>`);
    parts.push(`<span>${esc(v.data.cmp.name)} · ${v.data.yr}</span>`);
  } else if (v.name !== home.id) {
    const t = tabsFor(S.user).find(t => t.id === v.name); parts.push(`<span>${esc(t ? t.label : v.name === "account" ? "Account" : "Not found")}</span>`);
  } else return "";
  return `<nav class="crumbs" aria-label="You are here">${parts.join('<span class="sep" aria-hidden="true">›</span>')}</nav>`;
}
function errorPage(e) {
  const msg = e.status === 403 ? "You don't have access to this page." : e.status === 404 ? "We couldn't find that appraisal or person." : e.message || "Something went wrong.";
  return `<div class="panel empty" style="display:grid;gap:12px;justify-items:center"><h2>${esc(msg)}</h2><div class="actions"><button class="btn" type="button" data-act="back">Go back</button><a class="btn btn-primary" href="#${defaultRoute(S.user)}">Go to my start page</a></div></div>`;
}
function viewHtml() {
  switch (S.view.name) {
    case "work": return viewWork();
    case "team": return viewTeam();
    case "mine": return S.view.data.a ? viewAppraisal(S.view.data.a) : `<div class="panel empty">No appraisal is open for you this year.</div>`;
    case "app": return viewAppraisal(S.view.data.a);
    case "compare": return viewCompare();
    case "bench": return viewBench();
    case "admin": return viewAdmin();
    case "account": return viewAccount();
  }
  return `<div class="panel empty" style="display:grid;gap:12px;justify-items:center"><h2>Page not found</h2><p class="muted">That address doesn't match a page you can open.</p><a class="btn btn-primary" href="#${defaultRoute(S.user)}">Go to my start page</a></div>`;
}
const stageChip = stage => `<span class="chip st-${stage}">${esc(STAGES[STAGE_IDX[stage]].name)}</span>`;
const appLink = (a, label, cls) => `<a class="${cls || ""}" href="#app.${esc(a.id)}" data-from="${S.view.name}">${label}</a>`;

/* ===== Login ===== */
function renderLogin() {
  const accts = (S.demo || []).map(d => {
    const own = d.ownStage ? ST_FROM[d.ownStage] : null;
    const status = own ? (d.ownIsMine ? actionLabel(own) : STAGES[STAGE_IDX[own]].name) : "";
    const extra = [status, d.waiting ? `${d.waiting} waiting for them` : ""].filter(Boolean).join(" · ");
    let rk = (d.id.split("-")[1] || ""); if (!RANKS[rk]) rk = rk.replace(/\d+$/, "");
    const roleLbl = d.role === "seafarer" ? (RANKS[rk] && RANKS[rk].level === "Officer" ? "Seafarer · Officer" : "Seafarer · Non-Officer") : d.role === "hod" ? "Appraiser · head of dept" : d.role === "master" ? "Master · countersigns" : d.role === "crewing" ? "Crewing Manager · office" : (d.title || "Office");
    return `<button class="acct" type="button" data-act="quick" data-id="${esc(d.id)}"><span class="role">${esc(roleLbl)}</span><span class="nm">${esc(d.name)}</span><span class="meta">${esc(d.id)}${extra ? " · " + esc(extra) : ""}</span></button>`;
  }).join("");
  return `<div class="login">
  <aside class="login-side">
    <div><div class="brand">${anchorSvg} FLEET APPRAISAL DESK</div>
      <h1 style="margin-top:28px">Yearly crew appraisal, from goals to sign-off</h1>
      <p>Every seafarer sets goals and rates themselves. The head of department then rates them, the Master countersigns and the office approves. Then see how each person compares with their rank across the fleet and the industry.</p></div>
    <div class="scale"><div class="eyebrow" style="color:inherit;opacity:.7">Rating scale</div>${SCALE.slice().reverse().map(s => `<div><b>${s.v}</b>${esc(s.label)}</div>`).join("")}</div>
  </aside>
  <main class="login-main">
    <div><h2>Sign in</h2><p class="muted small" style="margin-top:4px">Use your Crew ID (for example V1-2O) or office user name.${S.demo && S.demo.length ? " Demo accounts use the password <b class=\"num\">demo</b>." : ""}</p></div>
    ${S.notice && !S.user ? `<p class="notice" style="margin:0">${esc(S.notice)}</p>` : ""}
    <form class="login-form" id="loginForm" novalidate>
      <label class="f" for="lid">Crew ID or office user<input id="lid" type="text" autocomplete="username" autocapitalize="characters" placeholder="e.g. V1-2O or CREWING" value="${esc(S.loginId || "")}"></label>
      <label class="f" for="lpw">Password<input id="lpw" type="password" autocomplete="current-password"></label>
      ${S.loginErr ? `<p class="err small" role="alert">${esc(S.loginErr)}</p>` : ""}
      <div class="actions"><button class="btn btn-primary" type="submit" ${S.busy ? "disabled" : ""}>${S.busy || "Sign in"}</button></div>
    </form>
    ${accts ? `<div style="display:grid;gap:10px"><div class="eyebrow">Demo accounts · MV Coral Meridian and office</div><div class="acct-grid">${accts}</div>
      <p class="faint small">Any crew member can sign in with their Crew ID, for example V3-OLR or V2-AB2.</p></div>` : ""}
  </main></div>`;
}
async function doLogin(id, pw) {
  S.loginId = (id || "").trim().toUpperCase(); S.loginErr = ""; S.busy = "Signing in…"; render();
  try {
    S.user = await B.login(S.loginId, pw); S.busy = ""; S.notice = API ? "" : S.notice; S.loginId = "";
    let target = S.afterLogin && S.afterLogin !== "login" ? S.afterLogin : defaultRoute(S.user); S.afterLogin = null;
    if (S.user.mustChange) { target = "account"; S.pwOk = false; S.pwMsg = "Please choose your own password before you continue."; }
    if (location.hash === "#" + target) route(); else location.hash = target;
    window.scrollTo(0, 0);
  } catch (e) { S.busy = ""; S.loginErr = e.message || "Couldn't sign in."; render(); const f = $("#lpw"); if (f) f.focus(); }
}

/* ===== My work ===== */
function viewWork() {
  const d = S.view.data;
  const row = (a, action) => `<tr><td>${appLink(a, `<b>${esc(a.name)}</b>`)}<div class="faint small">${esc(a.rankName)} · ${esc(a.vesselName)}</div></td><td><span class="lvl">${esc(a.level)}</span></td><td>${stageChip(a.stage)}</td><td>${action ? appLink(a, esc(action), "btn btn-sm btn-primary") : esc(a.waitingOnName || "–")}</td></tr>`;
  return `<div class="page-head"><div><h1>My work</h1><p class="sub">${esc(S.user.title)}</p></div></div>
  ${d.own ? `<div class="panel"><header><h2>My own appraisal ${d.own.year || YEAR}</h2>${stageChip(d.own.stage)}</header><p class="muted">${d.own.waitingOn === S.user.id ? "It's your turn: " + esc(actionLabel(d.own.stage).toLowerCase()) + "." : d.own.waitingOn ? "Waiting on " + esc(d.own.waitingOnName) + "." : "Closed."} <a href="#mine">Open my appraisal</a></p></div>` : ""}
  <div class="panel"><header><h2>Waiting for you</h2><span class="faint small">${d.work.length} item${d.work.length === 1 ? "" : "s"}</span></header>
  ${d.work.length ? `<div class="tbl-wrap"><table><thead><tr><th>Seafarer</th><th>Level</th><th>Step</th><th></th></tr></thead><tbody>${d.work.map(w => row(w.a, w.action)).join("")}</tbody></table></div>` : `<p class="empty">Nothing is waiting for you right now.</p>`}</div>
  <div class="panel"><header><h2>With others</h2><span class="faint small">${d.others.length} in progress</span></header>
  ${d.others.length ? `<div class="tbl-wrap"><table><thead><tr><th>Seafarer</th><th>Level</th><th>Step</th><th>Waiting on</th></tr></thead><tbody>${d.others.slice(0, 80).map(a => row(a, null)).join("")}</tbody></table></div>` : `<p class="empty">Nothing in progress with others.</p>`}</div>`;
}

/* ===== Team, vessel crew or fleet ===== */
function viewTeam() {
  const { list: all, dash } = S.view.data; const f = S.fleetF; const off = S.user.office;
  let list = all;
  if (f.vessel) list = list.filter(a => a.vessel === f.vessel);
  if (f.level) list = list.filter(a => a.level === f.level);
  if (f.stage) list = list.filter(a => a.stage === f.stage);
  if (f.q) { const q = f.q.toLowerCase(); list = list.filter(a => a.name.toLowerCase().includes(q) || a.rankName.toLowerCase().includes(q) || a.personId.toLowerCase().includes(q)); }
  const title = tabsFor(S.user).find(t => t.id === "team").label;
  const max = Math.max(1, ...dash.byStage.map(c => c.count));
  return `<div class="page-head"><div><h1>${esc(title)}</h1><p class="sub">${all.length} appraisals for ${YEAR}${off ? " across the fleet" : S.user.role === "master" ? " on " + esc(S.user.vesselName) : " where you are appraiser or countersigner"}</p></div></div>
  <div class="grid2">
    <div class="panel"><h2>Where the appraisals are</h2><div class="funnel" style="margin-top:12px">${dash.byStage.map(c => `<div><span>${esc(STAGES[STAGE_IDX[ST_FROM[c.stage]]].name)}</span><span class="track"><span class="fill" style="display:block;width:${(c.count / max * 100).toFixed(1)}%"></span></span><span class="num r">${c.count}</span></div>`).join("")}</div></div>
    <div class="panel"><h2>Appraiser ratings so far</h2>
      <div class="tiles" style="margin-top:12px"><div class="tile"><span class="eyebrow">Rated by appraiser</span><span class="big num">${dash.rated}<small> of ${dash.total}</small></span></div>
      <div class="tile"><span class="eyebrow">Self minus appraiser</span><span class="big num">${dash.averageGap == null ? "–" : (dash.averageGap >= 0 ? "+" : "") + Number(dash.averageGap).toFixed(2)}</span><span class="faint small">Average gap; positive means people rate themselves higher</span></div></div>
      ${dash.byVessel && dash.byVessel.length ? `<div class="funnel" style="margin-top:14px">${dash.byVessel.map(x => `<div><span>${esc(x.vesselName)}</span><span class="track"><span class="fill" style="display:block;width:${((x.average - 1) / 4 * 100).toFixed(1)}%"></span></span><span class="num">${Number(x.average).toFixed(2)}</span></div>`).join("")}</div><p class="faint small" style="margin-top:6px">Average appraiser rating by vessel, on the 1–5 scale</p>` : ""}
    </div>
  </div>
  <div class="panel"><div class="filters">
    ${off ? `<label class="f" for="fv">Vessel<select id="fv" data-filter="vessel"><option value="">All vessels</option>${VESSELS.map(v => `<option value="${v.id}" ${f.vessel === v.id ? "selected" : ""}>${esc(v.name)}</option>`).join("")}</select></label>` : ""}
    <label class="f" for="fl">Level<select id="fl" data-filter="level"><option value="">Officer and Non-Officer</option><option ${f.level === "Officer" ? "selected" : ""}>Officer</option><option ${f.level === "Non-Officer" ? "selected" : ""}>Non-Officer</option></select></label>
    <label class="f" for="fs">Step<select id="fs" data-filter="stage"><option value="">Any step</option>${STAGES.map(s => `<option value="${s.id}" ${f.stage === s.id ? "selected" : ""}>${esc(s.name)}</option>`).join("")}</select></label>
    <label class="f" for="fq" style="flex:1">Search<input id="fq" type="text" data-filter="q" placeholder="Name, rank or Crew ID" value="${esc(f.q)}"></label></div>
  <div class="tbl-wrap" style="margin-top:12px"><table><thead><tr><th>Seafarer</th><th>Vessel</th><th>Level</th><th>Step</th><th>Waiting on</th><th class="r">Self</th><th class="r">Appraiser</th><th></th></tr></thead><tbody>
  ${list.map(a => `<tr><td>${appLink(a, `<b>${esc(a.name)}</b>`)}<div class="faint small">${esc(a.rankName)} · ${esc(a.personId)}</div></td><td class="small">${esc(a.vesselName)}</td><td><span class="lvl">${esc(a.level)}</span></td><td>${stageChip(a.stage)}</td><td class="small">${esc(a.waitingOnName || "–")}</td><td class="r num">${fmt(a.selfOverall)}</td><td class="r num">${fmt(a.apprOverall)}</td><td><a class="btn btn-sm" href="#compare.${esc(a.personId)}">Compare</a></td></tr>`).join("") || `<tr><td colspan="8" class="empty">No appraisals match these filters.</td></tr>`}
  </tbody></table></div></div>`;
}

/* ===== Account (server version) ===== */
function viewAccount() {
  if (!API) return `<div class="panel empty">Passwords are managed in the server version of the app.</div>`;
  return `<div class="page-head"><div><h1>Account</h1><p class="sub">${esc(S.user.name)} · ${esc(S.user.id)}</p></div></div>
  <div class="panel" style="max-width:520px"><h2>Change password</h2>
  <form id="pwForm" style="display:grid;gap:12px;margin-top:12px" novalidate>
    <label class="f" for="pw0">Current password<input id="pw0" type="password" autocomplete="current-password"></label>
    <label class="f" for="pw1">New password <span class="faint">(at least 8 characters)</span><input id="pw1" type="password" autocomplete="new-password"></label>
    <label class="f" for="pw2">New password again<input id="pw2" type="password" autocomplete="new-password"></label>
    ${S.pwMsg ? `<p class="${S.pwOk ? "" : "err"} small" role="status">${esc(S.pwMsg)}</p>` : ""}
    <div class="actions"><button class="btn btn-primary" type="submit">Change password</button></div></form></div>`;
}
