# 06 Test Plan and Test Report

*How the module is tested, every test case with its result, the defects found and fixed, user-acceptance scenarios, and traceability from requirement to rule to test.*

| | |
| --- | --- |
| Document ID | FAD-06 |
| Version | 2.1 · 3 October 2026 |
| Author | Yasin Jariwala |
| Audience | QA, engineering and product reviewers |

**Purpose.** Shows that every business rule, the workflow and the comparison maths are proven by repeatable tests, and records the results of the v2.1 build.

← [05 Technical Design Document](05_Technical_Design_Document.md) · [Index](README.md) · [07 Deployment and Operations Guide](07_Deployment_and_Operations_Guide.md) →

<details><summary><strong>Contents</strong></summary>

- [1. Summary of results](#1-summary-of-results)
- [2. Strategy](#2-strategy)
   - [2.1 Environments and data](#21-environments-and-data)
- [3. Test cases](#3-test-cases)
- [4. API smoke test](#4-api-smoke-test)
- [5. Browser end-to-end test](#5-browser-end-to-end-test)
   - [5.1 Additional manual and scripted checks](#51-additional-manual-and-scripted-checks)
- [6. Defects found and fixed](#6-defects-found-and-fixed)
- [7. User-acceptance scenarios](#7-user-acceptance-scenarios)
- [8. Traceability](#8-traceability)
- [9. Entry and exit criteria](#9-entry-and-exit-criteria)
   - [9.1 How to rerun every test](#91-how-to-rerun-every-test)

</details>

---

## 1. Summary of results

> [!TIP]
> **Result on the v2.1 build (3 October 2026)**
>
> **109 automated checks, 109 passed, 0 failed.** 216 of 216 comparison results match an independent calculation. 7 defects were found during development and review; all are fixed and covered by tests.

**Table 1: Test levels and results**

| Level | What | Tool / location | Checks | Result |
| --- | --- | --- | --- | --- |
| Unit and rule tests | Every business rule, workflow transition, scoring, comparison, demo data, SQLite storage, passwords | `tests/Maritime.Appraisal.Tests` (self-contained C# runner) | 28 (TC-01–TC-28) | 28 passed |
| Comparison cross-check | Every demo seafarer for 2025 and 2026 against an independent JavaScript calculation | TC-18 + `expected-comparison.json` | 216 cases | 216 match |
| API smoke test | Sign-in, one appraisal through every step over HTTP, refusals, comparison, benchmark upload | `tests/api-smoke.sh` (bash + curl, fresh SQLite file) | 31 | 31 passed |
| Browser end-to-end (server) | Real pages in Chromium: sign-in, full cycle as 5 roles, navigation, access, account | `tests/e2e/e2e.js` (Playwright) against the release build on Kestrel (the server IIS hosts in-process) | 27 | 27 passed |
| Browser end-to-end (shareable link) | Same journey on the browser-only backend | Same script, `MODE=local` | 23 | 23 passed |
| Persistence | Data survives a server restart | Restart test + TC-26 | — | Passed |
| Visual review | Every screen at 1280 px and 390 px, light theme; annotated screenshots | Playwright screenshots (04 FSD) | 21 screenshots | Passed after DEF-03 fix |
| SQL scripts | Schema, reference and demo data parse as T-SQL | sqlglot | 41 statements | Parsed; not yet run on SQL Server |
| UAT | Scenarios with real users | Pilot vessels | 10 scenarios | Planned (section 7) |

## 2. Strategy

- **Rules first.** Because every rule lives in the domain library, most risk is covered by fast unit tests that need no server or database (TC-01 to TC-24).
- **Independent oracle for maths.** The comparison was implemented twice, in JavaScript for the browser and C# for the server; the C# results are tested against the JavaScript output for every person-year.
- **Black-box API.** The smoke test calls the running API exactly as a client would, from a fresh database, so routing, authentication, serialisation and error codes are covered.
- **Real browser.** The end-to-end test signs in as each role, clicks the real buttons and checks what the user sees, including navigation and privacy.
- **Same tests for both hosts.** The browser test runs against the IIS build and the shareable link, so the two backends cannot drift apart.
- **Runs offline.** No test needs NuGet or internet access (`RESTORE_ARGS` points restore at an empty folder).

### 2.1 Environments and data

**Table 2: Environments**

| Environment | Set-up | Used for |
| --- | --- | --- |
| Developer | `dotnet run`; SQLite file in `App_Data`; demo fleet | Unit tests, manual checks |
| CI-like run | Fresh SQLite file per run (`Storage__SqlitePath`), port 5077 | API smoke and browser tests |
| Shareable link | claude.ai artifact with shared store; `local.html` for automated runs | Browser test (local mode) |
| UAT (planned) | IIS on a company server; SQL Server or SQLite; 2 client managers × 4 vessels | UAT-01 to UAT-10 |

**Demo data**: 6 vessels, 108 seafarers (17 ranks × 6 vessels + extra ratings), 108 appraisals for 2026 spread across all 8 steps, 108 closed 2025 results, 4,104 benchmark ratings from 5 fictional managers for 2025 and 2026. It is generated deterministically (seeded random), so every run starts from the same state.

## 3. Test cases

**Table 3: Unit and rule test cases**

| ID | Rule | Case | Expected result | Result |
| --- | --- | --- | --- | --- |
| TC-01 | BR-01, BR-10 | Map every rank to its level and approval chain | Officer/Non-Officer correct; Master by Marine Supt; C/O countersigned by Marine Supt; C/E by Technical Supt; Messman by Chief Cook; Chief Cook has no countersign | Pass |
| TC-02 | BR-02 | Open the year twice; open a joiner | One appraisal per seafarer from the level template; second run opens none; joiner opened; non-office user refused | Pass |
| TC-03 | BR-03 | Send goals breaking each rule in turn | Each refused with its message; a valid set moves to goal agreement | Pass |
| TC-04 | BR-04, BR-14 | Send back without and with a remark; agree; agree straight from goal setting | Blank remark refused; back to goal setting; agreed; direct agreement works | Pass |
| TC-05 | BR-15 | Another seafarer or the Master edits or agrees goals; edit after agreement | Refused; agreed goals locked | Pass |
| TC-06 | BR-05 | Submit with goals unrated, a 5 without comment, a rating of 6, no achievements | Each refused; valid self-evaluation gives 4.25 | Pass |
| TC-07 | BR-06 | Who sees self and appraiser ratings before and after each submit | Appraiser can't see draft self ratings; seafarer and Master can't see draft appraiser ratings | Pass |
| TC-08 | BR-07 | Submit with a 2 without evidence, no strengths, no re-hire, no promotion | Each reported; valid evaluation gives 3.60 | Pass |
| TC-09 | BR-08 | Recommended at 2.00; Recommended with Safety 2; Ready now at 3.00; Ready now with Safety 3; a 2 without training; Ready now for an ETO | Each refused; valid evaluations accepted | Pass |
| TC-10 | BR-07, BR-14 | Appraiser sends self-evaluation back without and with a remark | Blank refused; back to self-evaluation | Pass |
| TC-11 | BR-09 | Disagree without and with a comment | Blank refused; disagreement recorded; moves to countersign | Pass |
| TC-12 | BR-10, BR-11 | Countersign by the wrong and right person for 2/O, C/O, C/E; Chief Cook; Master; Messman | Wrong person refused; Chief Cook goes straight to office; Master rated by Marine Supt; Messman by Chief Cook | Pass |
| TC-13 | BR-11, BR-14 | Countersigner sends back; office sends back; Master tries at office step | Back to appraiser with acknowledgement cleared; office send-back works; Master refused | Pass |
| TC-14 | BR-12 | Approve with no decision, Approved at 2.00, NFR without remarks, promotion for ETO | Each refused; valid decisions update re-hire status, training and promotion on the crew record | Pass |
| TC-15 | BR-13 | Weighted overall and band boundaries | 3.60; unrated goal left out; 4.50/4.49/3.50/2.50/2.49/1.49 in the right bands | Pass |
| TC-16 | BR-15 | Wrong person or wrong step for each command | 403 for wrong person; 409 for wrong step; 404 for unknown appraisal | Pass |
| TC-17 | BR-16 | Percentile maths on known numbers | Rahul Mehta 5th of 6, higher than 20%; ties count half; quantiles interpolate | Pass |
| TC-18 | BR-16 | Compare every demo seafarer for 2025 and 2026 | Overall, fleet rank, rated count, higher-than, industry percentile and group size match the independent calculation in all 216 cases | Pass |
| TC-19 | BR-16 | Score source and small groups | No score before the appraiser submits; 2025 from closed results; small Chief Officer groups flagged; 7 distributions | Pass |
| TC-20 | BR-17 | CSV with codes, abbreviations, names, quoted commas and four bad rows; missing column | 3 rows loaded, 4 skipped with reasons; missing column reported | Pass |
| TC-21 | BR-16 | Fleet against industry, 2025 | All 17 ranks; Chief Officer median 2.85 | Pass |
| TC-22 | BR-18 | History of a complete appraisal | Eight entries in order, each with the right person and date | Pass |
| TC-23 | All | Demo data | 108 seafarers, 108 appraisals, 108 prior results, 4,104 benchmark rows; every appraisal obeys the rules of the steps it has passed, including acknowledgements (added after DEF-05) | Pass |
| TC-24 | All | UAT-01 on the demo fleet: Joseph Santos from self-evaluation to closed | Self 4.25, appraiser 3.60, 1st of 2 Second Officers, industry percentile as calculated | Pass |
| TC-25 | Storage | Create a new SQLite file, load the demo fleet, reopen it | Empty on first open only; counts match the demo data | Pass |
| TC-26 | Storage | Submit a self-evaluation, close the database, reopen | Stage Appraiser, self overall 4.00 and the summary survive | Pass |
| TC-27 | Sign-in | Seed passwords twice; right, wrong-case and unknown-user sign-in; hash with two salts | Second seeding changes nothing; only the exact password works; salts change the hash | Pass |
| TC-28 | Sign-in | Must-change flag, then change the password | Flag set after seeding; old password refused; new one accepted; flag cleared | Pass |

## 4. API smoke test

Starts the API on a fresh SQLite file and calls it over HTTP with curl. Sign-in checks use the real cookie; workflow checks use the test-only `X-User` header (enabled for this run only).

**Table 4: API smoke checks (31 of 31 passed; "—" = response body check)**

| # | Check | Expect | # | Check | Expect |
| --- | --- | --- | --- | --- | --- |
| 1 | health check | 200 | 17 | appraiser submits | 200 |
| 2 | API refuses without sign-in | 401 | 18 | seafarer acknowledges | 200 |
| 3 | wrong password refused | 401 | 19 | Master countersigns | 200 |
| 4 | sign in with demo password | 200 | 20 | Approved blocked without decision | 422 |
| 5 | cookie gives access | 200 | 21 | office approves and closes | 200 |
| 6 | unknown API route is 404 | 404 | 22 | appraisal is Done | — |
| 7 | app page served for deep links | 200 | 23 | compare Joseph (2026) | 200 |
| 8 | sign out | 200 | 24 | Joseph is 1st in the fleet | — |
| 9 | cookie no longer works | 401 | 25 | seafarer can't compare a colleague | 403 |
| 10 | seafarer reads own appraisal | 200 | 26 | office sees fleet vs industry | 200 |
| 11 | another seafarer is refused | 403 | 27 | upload benchmark CSV | 200 |
| 12 | submit self-evaluation too early | 422 | 28 | only Crewing uploads benchmark | 403 |
| 13 | save self ratings | 200 | 29 | back to sample benchmark | 200 |
| 14 | submit self-evaluation | 200 | 30 | worklist | 200 |
| 15 | seafarer can't evaluate themselves | 403 | 31 | dashboard | 200 |
| 16 | appraiser saves evaluation | 200 |  |  |  |

## 5. Browser end-to-end test

Playwright drives Chromium against the real pages. The same script runs against the IIS build (served by Kestrel on a fresh database) and against the shareable-link page.

**Table 5: Browser checks (* local file mode keeps data in memory, so the refresh part is skipped)**

| # | Section | Check | Server | Link |
| --- | --- | --- | --- | --- |
| 1 | Sign-in | Unauthenticated deep link (#compare) shows sign-in | Pass | Pass |
| 2 | Sign-in | Wrong password refused with message | Pass | n/a |
| 3 | Sign-in | After sign-in, returns to the deep-linked page | Pass | Pass |
| 4 | Goals | My appraisal tab navigates | Pass | Pass |
| 5 | Goals | Goal editor shown (Able Seaman) | Pass | Pass |
| 6 | Goals | Template weights total 100% | Pass | Pass |
| 7 | Goals | Goals sent to appraiser | Pass | Pass |
| 8 | Agree | HOD lands on My work | Pass | Pass |
| 9 | Agree | Worklist shows Budi Kusuma | Pass | Pass |
| 10 | Agree | Worklist row opens the appraisal by URL | Pass | Pass |
| 11 | Self | Submit disabled before ratings | Pass | Pass |
| 12 | Self | Submit enabled after rating every goal | Pass | Pass |
| 13 | Evaluate | Evaluation submitted (ratings, strengths, re-hire, promotion) | Pass | Pass |
| 14 | Ack | Seafarer sees appraiser ratings now | Pass | Pass |
| 15 | Close | Countersigned, approved; closed appraisal survives refresh | Pass | Pass* |
| 16 | Navigation | Compare tab | Pass | Pass |
| 17 | Navigation | Browser Back returns to Team | Pass | Pass |
| 18 | Navigation | Browser Forward | Pass | Pass |
| 19 | Navigation | Deep link to a person-year comparison survives refresh | Pass | Pass |
| 20 | Navigation | Comparison figures shown | Pass | Pass |
| 21 | Navigation | Unknown page shows Page not found | Pass | Pass |
| 22 | Access | Seafarer cannot open office pages | Pass | Pass |
| 23 | Access | Seafarer comparison hides colleagues' names | Pass | Pass |
| 24 | Account | Account page has change-password form | Pass | n/a |
| 25 | Account | Signed out | Pass | n/a |
| 26 | Account | API refuses after sign-out (401) | Pass | n/a |
| 27 | Quality | No JavaScript errors on any page | Pass | Pass |

### 5.1 Additional manual and scripted checks

- **Restart persistence**: completed an appraisal, restarted the server on the same file, read it back as Done with decision Approved.
- **Forced password change**: with `MustChangePassword=true`, first sign-in lands on Account; old password refused after change; new password lands on the start page.
- **Published build**: `publish/` started on its own, `/health` OK, `App_Data/appraisal.db` returns 404 over HTTP.
- **Payloads**: page 135 KB (49 KB compressed); fleet list 4.6 KB compressed; server time 1–3 ms.
- **Layout**: no horizontal scroll at 390 px; all screens reviewed at 1280 px.

## 6. Defects found and fixed

**Table 6: Defect log**

| ID | Severity | Found by | Defect | Fix | Covered by |
| --- | --- | --- | --- | --- | --- |
| DEF-01 | High | Review of the Compare page | Comparison counted the person as one of their own peers: Rahul Mehta showed "higher than 25%" instead of "20% of the other 5" | Exclude the person once from fleet and industry groups, in JS and C# | TC-17, TC-18 |
| DEF-02 | Medium | API probe during v2.1 | Unknown `/api/...` routes returned the app page with 200, hiding client errors | Explicit 404 JSON fallback for `/api/{**rest}` | Smoke check 6 |
| DEF-03 | Low | Screenshot review | Benchmark page scrolled horizontally at 1280 px because of the long CSV layout line | Constrain the grid column so the code block scrolls inside its panel | Visual review |
| DEF-04 | Medium | Deployment guide review | API returned `mustChangePassword` but the UI ignored it | Send the user to Account with a prompt | Forced-change check |
| DEF-05 | Medium | Screenshot review (closed appraisal said "Disagreed" while history said "agreed") | Demo data field `agree` did not bind to `Agrees`, so every demo acknowledgement loaded as a disagreement without comment | Rename the field in demo data; TC-23 now validates acknowledgements | TC-23 |
| DEF-06 | Low (test) | Running the smoke test offline | `dotnet run` tried NuGet restore and failed | Build once with `RESTORE_ARGS`, then `--no-build` | Smoke test |
| DEF-07 | Low (test) | TC-24 | Test expected 3 items in the Chief Officer's worklist; the correct number is 2 | Expected value corrected after checking the data | TC-24 |

No open defects of severity High or Medium.

## 7. User-acceptance scenarios

Run first in the demo (password `demo`), then in UAT with real users on the pilot vessels. Each scenario is signed off by the Crewing Manager and one Master per pilot vessel.

**Table 7: UAT scenarios**

| ID | Scenario | Users | Pass when | Demo run |
| --- | --- | --- | --- | --- |
| UAT-01 | Joseph Santos (2/O) completes his self-evaluation; Rahul Mehta (C/O) rates him; Joseph agrees; the Master countersigns; Crewing approves | 2/O, C/O, Master, Crewing | Closed in under 30 minutes in total, with no help | Pass (TC-24 + E2E) |
| UAT-02 | Budi Kusuma (AB) adds a goal from the library, fixes the weights and sends; C/O sends back once, then agrees | AB, C/O | Every goal rule shown as it is met; remark visible to the AB | Pass |
| UAT-03 | Appraiser gives a 5 and a 2 without writing anything | C/O | Submit stays disabled and says why | Pass |
| UAT-04 | Seafarer disagrees; Master returns it to the appraiser; seafarer acknowledges again | 2/O, C/O, Master | History shows every step and remark | Pass |
| UAT-05 | Master's appraisal by the Marine Superintendent; Chief Cook's goes straight to the office | MSUPT, Master, Chief Cook, Crewing | No countersign step for either | Pass |
| UAT-06 | Seafarer opens "How I compare" | Any seafarer | Own figures only; colleagues listed as "Colleague" | Pass |
| UAT-07 | Crewing compares a rank and opens "fleet against industry" | Crewing | Harsh or generous ranks are clear; clicking a rank opens its crew | Pass |
| UAT-08 | Crewing uploads a real benchmark file with a few bad rows, then goes back to the sample | Crewing | Bad rows listed; comparisons show the new source and date | Pass |
| UAT-09 | Use the app on a phone on board | Any seafarer | Every step usable at phone width | Pass at 390 px |
| UAT-10 | Auditor reviews three closed appraisals | Superintendent | Goals, ratings, comments, decisions and history all present | Pass |

## 8. Traceability

**Table 8: Requirement → rule → test**

| Requirement | Business rules | Tests |
| --- | --- | --- |
| FR-01 Sign in to role page | BR-15 | E2E 1–3, 8; smoke 2–9 |
| FR-02 Open year / joiner | BR-02 | TC-02 |
| FR-03 Set goals | BR-03, BR-04 | TC-03, E2E 5–7 |
| FR-04 Agree / return goals | BR-04, BR-14 | TC-04, TC-05 |
| FR-05 Self-evaluation | BR-05 | TC-06, E2E 11–12, smoke 12–14 |
| FR-06 Appraiser rates with evidence | BR-06, BR-07 | TC-07, TC-08, smoke 16–17 |
| FR-07 Recommendations | BR-08 | TC-09 |
| FR-08 Return self-evaluation | BR-14 | TC-10 |
| FR-09 Acknowledge | BR-09 | TC-11, smoke 18 |
| FR-10 Countersign / return | BR-10, BR-11, BR-14 | TC-12, TC-13, smoke 19 |
| FR-11 Office decision | BR-12 | TC-14, smoke 20–21 |
| FR-12 Live score | BR-13 | TC-15 |
| FR-13 Seafarer comparison | BR-16 | TC-17–19, E2E 23, smoke 23–25 |
| FR-14 Manager comparison | BR-16 | TC-18 |
| FR-15 Fleet vs industry | BR-16 | TC-21, smoke 26 |
| FR-16 Benchmark upload | BR-17 | TC-20, smoke 27–29 |
| FR-17 Worklists | BR-15 | TC-24, E2E 9, smoke 30 |
| FR-18 Fleet list filters | — | Visual review, UAT-07 |
| FR-19 History | BR-18 | TC-22 |
| FR-21 Navigation | — | E2E 16–21 |
| FR-22 Passwords | — | TC-27, TC-28, forced-change check |

## 9. Entry and exit criteria

**Table 9: Gates**

| Gate | Criterion | Status |
| --- | --- | --- |
| Entry to QA | All automated tests pass on the build | Met (109/109) |
| Entry to QA | API smoke and browser tests pass on a fresh database | Met |
| Entry to QA | SQL scripts parse | Met |
| Exit from QA | SQL scripts run on a SQL Server test instance and a SQL store implementation passes the same tests | Open (v2.2) |
| Exit from QA | No open defect of severity High or Medium | Met |
| Exit from QA | Appraisal page loads in under 3 s on a throttled 256 kbps link | Open (calculated ~2 s; measure in pilot) |
| Go-live | UAT-01 to UAT-10 signed off by the Crewing Manager and one Master per pilot vessel | Open |
| Go-live | Real benchmark source agreed and loaded | Open |
| Go-live | Notification wording N-01 to N-12 approved; go-live settings applied (07) | Open |

### 9.1 How to rerun every test

```
dotnet run --project tests/Maritime.Appraisal.Tests          # 28 passed, 0 failed
bash tests/api-smoke.sh                                       # 31 passed, 0 failed
# browser test: start the app, then
BASE=http://localhost:5077/ node tests/e2e/e2e.js             # 27 passed, 0 failed
# offline machines: add -p:RestoreSources=<empty folder>; RESTORE_ARGS for the smoke test
```

---

← [05 Technical Design Document](05_Technical_Design_Document.md) · [Index](README.md) · [07 Deployment and Operations Guide](07_Deployment_and_Operations_Guide.md) →
