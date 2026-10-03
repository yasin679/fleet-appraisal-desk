/* ===== Global comparison (BR-16) — renders the comparison result from either backend ===== */
const ord = n => n == null ? "–" : n + (n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] || "th");
const plural = name => name.replace(/(Officer|Engineer|Cadet|Seaman|Cook|Master)$/, m => ({ Officer: "Officers", Engineer: "Engineers", Cadet: "Cadets", Seaman: "Seamen", Cook: "Cooks", Master: "Masters" }[m])).replace(/^(Bosun|Fitter|Oiler|Messman)$/, m => m === "Messman" ? "Messmen" : m + "s");

function viewCompare() {
  const d = S.view.data;
  if (d.none) return `<div class="panel empty">There is nobody in your scope to compare yet.</div>`;
  const { people, pid, yr, cmp } = d; const r = cmp.result;
  const isMe = pid === S.user.id, anon = S.user.role === "seafarer";
  const who = isMe ? "You" : cmp.name;
  const pl = plural(cmp.rankName);
  const src = r.source && !r.source.isSample ? `Industry data: ${esc(r.source.source)}, uploaded ${esc(fdate(r.source.uploaded))}.` : `Industry data: built-in sample of 5 fictional ship managers. It is illustrative, not real company data.${S.user.role === "crewing" ? ` <a href="#bench">Upload real figures</a>.` : ""}`;
  const fleetDots = cmp.ranking.filter(x => !x.isPerson).map(x => x.overall);
  return `<div class="page-head"><div><h1>${isMe ? "How I compare" : "Compare"}</h1><p class="sub">${esc(cmp.name)} against every ${esc(cmp.rankName)} in our fleet and at other ship managers</p></div>
    <div class="filters">${people.length > 1 ? `<label class="f" for="cmpP">Seafarer<select id="cmpP" data-nav="person">${people.map(x => `<option value="${esc(x.id)}" ${x.id === pid ? "selected" : ""}>${esc(x.name)} · ${esc(x.rankName)} · ${esc(x.vessel)}</option>`).join("")}</select></label>` : ""}
    <label class="f" for="cmpY">Year<select id="cmpY" data-nav="year">${[YEAR, YEAR - 1].map(y => `<option ${y === yr ? "selected" : ""}>${y}</option>`).join("")}</select></label></div></div>
  ${r.overall != null ? "" : `<div class="notice" style="margin:0;display:flex;gap:12px;align-items:center;flex-wrap:wrap"><span>${esc(cmp.name)} has no appraiser rating for ${yr} yet, so the figures below are blank and the chart shows where the rank stands. They fill in as soon as the appraiser submits.</span>${yr === YEAR && cmp.hasPreviousYear ? `<a class="btn btn-sm" href="#compare.${esc(pid)}.${YEAR - 1}">Show ${YEAR - 1} result</a>` : ""}</div>`}
  <div class="tiles">
    <div class="tile hl"><span class="eyebrow">Appraiser rating ${yr}</span><span class="big num">${fmt(r.overall)}<small> / 5</small></span><span class="small muted">${r.band ? esc(r.band) : "Not rated yet"}</span></div>
    <div class="tile"><span class="eyebrow">Within our fleet</span><span class="big num">${r.overall != null ? ord(r.fleetRank) : "–"}<small> of ${r.fleetRated}</small></span><span class="small muted">${r.overall != null ? (r.fleetOthers ? `Higher than ${r.higherThanPctOfFleet}% of the other ${r.fleetOthers} ${esc(pl)} in our fleet${r.tiesInFleet ? `; level with ${r.tiesInFleet}` : ""}${r.smallGroup ? `. Only ${r.fleetOthers} rated so far, so read this with care` : ""}` : `No other ${esc(pl)} rated yet`) : `${r.fleetRated} ${esc(pl)} rated so far`}</span></div>
    <div class="tile"><span class="eyebrow">Across the industry</span><span class="big num">${r.overall != null ? ord(r.industryPercentile) : "–"}<small> percentile</small></span><span class="small muted">${r.overall != null ? `Compared with ${r.industryOthers} other ${esc(pl)}` : `${r.industryRated} ${esc(pl)} rated`} at ${r.companies} companies, our fleet included</span></div>
    ${yr === YEAR ? `<div class="tile"><span class="eyebrow">Self vs appraiser</span><span class="big num">${r.overall != null && r.selfOverall != null ? (r.selfOverall - r.overall >= 0 ? "+" : "") + (r.selfOverall - r.overall).toFixed(2) : "–"}</span><span class="small muted">${r.overall != null && r.selfOverall != null ? `Self ${fmt(r.selfOverall)}, appraiser ${fmt(r.overall)}` : "Shown after both have rated"}</span></div>` : ""}
  </div>
  <div class="panel"><header><h2>Where ${isMe ? "you stand" : esc(cmp.name) + " stands"} among ${esc(pl)}</h2><div class="legend"><span><i style="background:var(--accent)"></i>${esc(who)}</span><span><i style="background:var(--fleet)"></i>Our fleet</span><span><i style="background:var(--ink-3)"></i>Other companies</span></div></header>
    <div class="tbl-wrap" style="margin-top:6px">${boxChart(r, fleetDots, who, cmp.rankName)}</div>
    <p class="faint small" style="margin-top:8px">Bars run from the 10th to the 90th percentile; the box is the middle half and the tick is the median. Hover a row for its numbers. ${src}</p></div>
  <div class="grid2">
    <div class="panel"><header><h2>By goal area</h2><div class="legend"><span><i style="background:var(--accent)"></i>${esc(isMe ? "You" : cmp.name.split(" ")[0])}</span><span><i style="background:var(--fleet);border-radius:2px"></i>Fleet average</span><span><i style="background:var(--ink-3);transform:rotate(45deg) scale(.8);border-radius:1px"></i>Industry average</span></div></header>
      <div class="tbl-wrap" style="margin-top:6px">${catChart(r.categories)}</div></div>
    <div class="panel"><header><h2>Our ${esc(pl)}, ${yr}</h2><span class="faint small">${anon ? "Colleagues are not named" : "Appraiser rating"}</span></header>
      <div class="tbl-wrap" style="margin-top:8px"><table><thead><tr><th class="r">#</th><th>${anon ? "Seafarer" : "Name"}</th><th>Vessel</th><th class="r">Rating</th></tr></thead><tbody>
      ${cmp.ranking.map(x => `<tr class="${x.isPerson ? "me" : ""}"><td class="r num">${x.position}</td><td>${x.isPerson ? `<b>${esc(isMe ? "You" : x.name)}</b>` : x.name ? `<a href="#compare.${esc(x.id)}.${yr}">${esc(x.name)}</a>` : "Colleague"}</td><td class="small">${esc(x.vesselName || "–")}</td><td class="r num">${fmt(x.overall)}</td></tr>`).join("") || `<tr><td colspan="4" class="empty">Nobody rated yet.</td></tr>`}
      </tbody></table></div></div>
  </div>
  ${d.fvi ? fleetVsIndustry(d.fvi, yr) : ""}`;
}

function boxChart(r, fleetDots, meLabel, rankNm) {
  const W = 760, L = 200, R = 32, top = 34, rh = 38;
  const X = v => L + (v - 1) / 4 * (W - L - R);
  const series = r.distributions; const me = r.overall;
  const H = top + series.length * rh + 30;
  let s = `<svg class="chart box" viewBox="0 0 ${W} ${H}" role="img" aria-label="Distribution of ratings for ${esc(rankNm)} by company">`;
  for (let v = 1; v <= 5; v++) s += `<line x1="${X(v)}" x2="${X(v)}" y1="${top - 6}" y2="${H - 26}" stroke="var(--line)" stroke-width="1"/><text class="tick" x="${X(v)}" y="${H - 10}" text-anchor="middle">${v}</text>`;
  series.forEach((st, i) => {
    const y = top + i * rh + rh / 2;
    const col = st.kind === "fleet" ? "var(--fleet)" : "var(--ink-3)", fill = st.kind === "fleet" ? "var(--fleet-soft)" : "var(--surface-2)";
    if (st.kind === "all") s += `<line x1="0" x2="${W}" y1="${y - rh / 2}" y2="${y - rh / 2}" stroke="var(--line-2)"/>`;
    s += `<text class="lbl" x="0" y="${y + 4}" style="${st.kind !== "company" ? "font-weight:700" : ""}">${esc(st.label)}</text><text class="lbl2" x="${L - 12}" y="${y + 4}" text-anchor="end">n=${st.n}</text>`;
    if (st.n) {
      s += `<line x1="${X(st.p10)}" x2="${X(st.p90)}" y1="${y}" y2="${y}" stroke="${col}" stroke-width="2" stroke-linecap="round"/>`;
      s += `<rect x="${X(st.p25)}" y="${y - 8}" width="${Math.max(2, X(st.p75) - X(st.p25))}" height="16" rx="3" fill="${fill}" stroke="${col}" stroke-width="1.5"/>`;
      s += `<line x1="${X(st.p50)}" x2="${X(st.p50)}" y1="${y - 8}" y2="${y + 8}" stroke="var(--ink)" stroke-width="2"/>`;
      if (st.kind === "fleet") fleetDots.forEach(v => { s += `<circle cx="${X(v)}" cy="${y}" r="3.5" fill="var(--fleet)" stroke="var(--surface)" stroke-width="1.5"/>`; });
    }
    const tip = st.n ? `${st.label} · ${plural(rankNm)}: ${st.n} rated. Median ${st.p50.toFixed(2)}; middle half ${st.p25.toFixed(2)}–${st.p75.toFixed(2)}.${me != null && st.higherThanPct != null ? ` ${meLabel === "You" ? "You scored" : meLabel + " scored"} higher than ${st.higherThanPct}% of ${st.kind === "company" ? "them" : "the others"}.` : ""}` : `${st.label}: no ratings`;
    s += `<rect x="0" y="${y - rh / 2}" width="${W}" height="${rh}" fill="transparent" data-tip="${esc(tip)}"/>`;
  });
  if (me != null) {
    const x = X(me);
    s += `<line x1="${x}" x2="${x}" y1="${top - 8}" y2="${H - 26}" stroke="var(--accent)" stroke-width="2"/><text x="${Math.min(x, W - 4)}" y="${top - 14}" text-anchor="${x > W - 120 ? "end" : "middle"}" fill="var(--accent)" style="font-size:12px;font-weight:700">${esc(meLabel)} · ${Number(me).toFixed(2)}</text>`;
    s += `<circle cx="${x}" cy="${top + rh / 2}" r="6" fill="var(--accent)" stroke="var(--surface)" stroke-width="2"/>`;
  }
  return s + `</svg>`;
}
function catChart(cats) {
  const W = 560, L = 110, R = 24, top = 10, rh = 40;
  const X = v => L + (v - 1) / 4 * (W - L - R);
  const H = top + cats.length * rh + 26;
  let s = `<svg class="chart cat" viewBox="0 0 ${W} ${H}" role="img" aria-label="Ratings by goal area compared with fleet and industry averages">`;
  for (let v = 1; v <= 5; v++) s += `<line x1="${X(v)}" x2="${X(v)}" y1="${top}" y2="${H - 22}" stroke="var(--line)"/><text class="tick" x="${X(v)}" y="${H - 6}" text-anchor="middle">${v}</text>`;
  cats.forEach((c, i) => {
    const y = top + i * rh + rh / 2; const ind = c.industryAverage, fl = c.fleetAverage, mv = c.person;
    const vals = [ind, fl, mv].filter(v => v != null);
    s += `<text class="lbl" x="0" y="${y + 4}">${esc(c.category)}</text>`;
    if (vals.length > 1) s += `<line x1="${X(Math.min(...vals))}" x2="${X(Math.max(...vals))}" y1="${y}" y2="${y}" stroke="var(--line-2)" stroke-width="3" stroke-linecap="round"/>`;
    if (ind != null) s += `<rect x="${X(ind) - 5}" y="${y - 5}" width="10" height="10" transform="rotate(45 ${X(ind)} ${y})" fill="var(--ink-3)" stroke="var(--surface)" stroke-width="1.5"/>`;
    if (fl != null) s += `<rect x="${X(fl) - 5.5}" y="${y - 5.5}" width="11" height="11" rx="2" fill="var(--fleet)" stroke="var(--surface)" stroke-width="1.5"/>`;
    if (mv != null) s += `<circle cx="${X(mv)}" cy="${y}" r="7" fill="var(--accent)" stroke="var(--surface)" stroke-width="2"/>`;
    s += `<rect x="0" y="${y - rh / 2}" width="${W}" height="${rh}" fill="transparent" data-tip="${esc(`${c.category}: ${mv != null ? "rating " + Number(mv).toFixed(1) + " · " : ""}fleet average ${fl != null ? fl.toFixed(2) : "–"} · industry average ${ind != null ? ind.toFixed(2) : "–"}`)}"/>`;
  });
  return s + `</svg>`;
}
function fleetVsIndustry(lines, yr) {
  const maxD = Math.max(0.3, ...lines.map(l => Math.abs(l.difference)));
  return `<div class="panel"><header><h2>Our fleet against the industry, ${yr}</h2><span class="faint small">Median appraiser rating per rank</span></header>
  <div class="tbl-wrap" style="margin-top:8px"><table><thead><tr><th>Rank</th><th>Level</th><th class="r">Our crew rated</th><th class="r">Our median</th><th class="r">Industry median</th><th style="min-width:180px">Difference</th><th class="r">Industry percentile</th></tr></thead><tbody>
  ${lines.map(l => `<tr><td><b>${esc(l.rankName)}</b></td><td><span class="lvl">${esc(LEVEL_FROM(l.level))}</span></td><td class="r num">${l.ourRated}</td><td class="r num">${l.ourMedian.toFixed(2)}</td><td class="r num">${l.industryMedian.toFixed(2)}</td>
    <td><div style="position:relative;height:14px;background:var(--surface-2);border-radius:3px"><span style="position:absolute;left:50%;top:-2px;bottom:-2px;width:1px;background:var(--ink-3)"></span><span style="position:absolute;top:2px;height:10px;${l.difference >= 0 ? `left:50%;border-radius:0 3px 3px 0;background:var(--good)` : `right:50%;border-radius:3px 0 0 3px;background:var(--crit)`};width:${(Math.abs(l.difference) / maxD * 50).toFixed(1)}%"></span></div><span class="num small ${l.difference >= 0 ? "" : "err"}">${(l.difference >= 0 ? "+" : "") + l.difference.toFixed(2)}</span></td>
    <td class="r num">${ord(l.industryPercentile)}</td></tr>`).join("")}</tbody></table></div></div>`;
}
