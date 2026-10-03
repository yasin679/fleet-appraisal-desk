# 08 Release Notes

*What changed in each version of the seafarer appraisal module, what was fixed, and the known limitations of the current build.*

| | |
| --- | --- |
| Document ID | FAD-08 |
| Version | 2.1 · 3 October 2026 |
| Author | Yasin Jariwala |
| Audience | All reviewers |

**Purpose.** Records the evolution of the module from the first model to the deployable v2.1, so reviewers can see how feedback shaped the design.

← [07 Deployment and Operations Guide](07_Deployment_and_Operations_Guide.md) · [Index](README.md) · [09 Maritime ERP Integration and Fit](09_Maritime_ERP_Integration_and_Fit.md) →

<details><summary><strong>Contents</strong></summary>

- [1. Version 2.1 — deployable release (3 October 2026)](#1-version-21--deployable-release-3-october-2026)
   - [1.1 Fixed in 2.1](#11-fixed-in-21)
   - [1.2 Upgrade from 2.0](#12-upgrade-from-20)
- [2. Version 2.0 — working model, .NET code and database (3 October 2026)](#2-version-20--working-model-net-code-and-database-3-october-2026)
   - [2.1 Highlights](#21-highlights)
   - [2.2 Fixed during review](#22-fixed-during-review)
- [3. Version 1.x — first models (29 September – 1 October 2026)](#3-version-1x--first-models-29-september--1-october-2026)
- [4. Known limitations of 2.1](#4-known-limitations-of-21)

</details>

---

## 1. Version 2.1 — deployable release (3 October 2026)

Version 2.1 turns the working model into an application that can be installed on a Windows server under IIS, with real sign-in, a SQLite database and a link for every page. The same pages also run as a private shareable link for demos.

**Table 1: New in 2.1**

| Area | What's new |
| --- | --- |
| Hosting | One ASP.NET Core 8 site serves the pages and the API; `web.config` for IIS; ready-to-copy `publish` folder |
| Database | SQLite file `App_Data/appraisal.db`, created and seeded on first start; changes survive restarts; no database server needed for a pilot |
| Sign-in | Crew ID or office user plus password; salted PBKDF2 hashes; 8-hour session; Account page to change password; optional forced change on first sign-in |
| Navigation | Every screen has its own link; Back, Forward, refresh and bookmarks work; breadcrumbs; "Page not found" for bad links or pages a role cannot open; deep links survive sign-in |
| Privacy | A seafarer's comparison is calculated on the server and never contains colleagues' names |
| Performance | Response compression: fleet list 37 KB → 4.6 KB; page 135 KB → 49 KB |
| Settings | Demo switches (`SeedDemoData`, `ShowDemoAccounts`, `AllowReset`, `MustChangePassword`) to turn off before going live |
| Testing | 28 unit/storage tests, 31 API smoke checks, 27 browser checks on the server and 23 on the shareable link, all passing |
| Documentation | 12-document documentation pack in Word and PDF, with annotated screenshots of every screen |

### 1.1 Fixed in 2.1

- Unknown `/api/...` routes now return 404 JSON instead of the app page (DEF-02).
- Benchmark page no longer scrolls sideways at 1280 px (DEF-03).
- The must-change-password flag now sends the user to Account (DEF-04).
- Demo acknowledgements loaded as "disagree" because of a field-name mismatch; fixed and now validated by TC-23 (DEF-05).

### 1.2 Upgrade from 2.0

1. v2.0 had no persistent server store, so there is no data to migrate.
2. Deploy the `publish` folder (07 Deployment Guide).
3. Set the production settings before first start.

## 2. Version 2.0 — working model, .NET code and database (3 October 2026)

Version 2.0 rebuilt the appraisal around goals, a self-evaluation and four approval levels, after review of v1.1 with the business.

**Table 2: v1.1 → v2.0**

| Area | v1.1 | v2.0 |
| --- | --- | --- |
| Who sets goals | Crewing Manager in January | The seafarer drafts from a template or the goal library; the appraiser agrees |
| Self-evaluation | None | Seafarer rates every goal 1–5 before the appraiser |
| Rating scale | Not met / Partly met / Met / Exceeded (0–120%) | 1 Unsatisfactory to 5 Outstanding, weighted by goal |
| Ratings during the year | One review per tour, averaged by days on board | One appraiser evaluation per year, with evidence, before sign-off |
| Approval levels | Appraiser, countersign, office | Seafarer, appraiser, countersign, office (four levels) |
| Comparison | None | Fleet rank and industry percentile for the same rank, with benchmark upload |
| Sign-in | Persona switch | Login screen; pages for seafarer, HOD, Master, superintendent and Crewing Manager |

### 2.1 Highlights

- Role pages and worklists for five roles.
- Goal editor with live checks; template and 13-goal library.
- Self-evaluation then appraiser evaluation, evidence required for 1, 2 and 5.
- Send-backs on four paths (goals, self-evaluation, from countersign, from office), each with a remark.
- Global comparison: fleet rank, industry percentile, goal areas, fleet against industry by rank.
- Benchmark CSV upload with row checks.
- .NET domain library with 24 tests; API with 22 smoke checks; SQL Server schema with reference and demo data.

### 2.2 Fixed during review

- The comparison counted the person as one of their own peers; Rahul Mehta (C/O, 2025) now shows "higher than 20% of the other 5" instead of 25% (DEF-01).
- The comparison page now says plainly when a person has no rating yet, and flags groups with fewer than four others rated.

## 3. Version 1.x — first models (29 September – 1 October 2026)

**Table 3: Early versions**

| Version | Summary |
| --- | --- |
| 1.0 (29 Sep) | First static model of the appraisal form for officers and ratings |
| 1.1 (1 Oct) | Office-set goals with per-tour reviews averaged by days on board; two levels (Officer, Non-Officer); no competency scoring. Superseded by v2.0 after feedback asking for an interactive model with self-evaluation and comparison. |

## 4. Known limitations of 2.1

**Table 4: Known limitations**

| Limitation | Impact | Plan |
| --- | --- | --- |
| Industry comparison uses fictional sample data until real benchmark data is uploaded | Percentiles are illustrative | Agree a source (agency pool, data-sharing agreement, or an ERP cross-client pool) — 09, 10 |
| Reminders, escalations and notifications N-01 to N-12 are specified, not sent | Users rely on worklists | v2.2 |
| SQLite store; SQL Server scripts not yet run against a live instance | Fine for one manager; not for multi-tenant scale | SQL Server store in v2.2 |
| Password sign-in only; no lockout or SSO | Weaker than corporate SSO | SSO / identity provider in v2.2 |
| No admin screens for templates, thresholds or chain | Changes need a data edit | v2.2 |
| No offline use on board | Needs connectivity to save | Offline drafts with sync in v2.3 |
| English only | Some crew less comfortable in English | Multi-language UI in v3.0 |
| Shareable link: anyone with access can pick any demo account | Demo only | Use IIS for real data |

---

← [07 Deployment and Operations Guide](07_Deployment_and_Operations_Guide.md) · [Index](README.md) · [09 Maritime ERP Integration and Fit](09_Maritime_ERP_Integration_and_Fit.md) →
