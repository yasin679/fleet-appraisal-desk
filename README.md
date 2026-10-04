# Fleet Appraisal Desk — Seafarer Annual Appraisal

[![CI](https://github.com/yasin679/fleet-appraisal-desk/actions/workflows/ci.yml/badge.svg)](https://github.com/yasin679/fleet-appraisal-desk/actions/workflows/ci.yml)
![.NET 8](https://img.shields.io/badge/.NET-8-512BD4)
![Tests](https://img.shields.io/badge/automated%20checks-109%20passing-2E7D4F)
![License](https://img.shields.io/badge/license-all%20rights%20reserved-6B7A86)

An HR module for ship managers that runs the **yearly appraisal of every seafarer**, Officers and Non-Officers (ratings). The seafarer sets goals and evaluates themselves, the head of department rates them with evidence, the Master or a superintendent countersigns and the office approves. Each seafarer can then be **compared with the same rank across the fleet and at other ship managers**.

Designed and built by Yasin Jariwala. The full 12-document documentation pack is in [`docs/`](docs/README.md).

<p align="center"><img src="docs/images/06-appraiser-evaluation.png" alt="Appraiser evaluation screen" width="820"></p>

## Highlights

- **Eight-step workflow with four approval levels**: goal setting → goal agreement → self-evaluation (L1) → appraiser evaluation (L2) → acknowledgement → countersign (L3) → office approval (L4) → closed, with send-backs that require a remark.
- **17 ranks, two levels.** The approval chain follows the line of command on board, e.g. deck ratings → Chief Officer → Master → Crewing Manager.
- **Goal-based, evidence-driven.** 3–6 weighted goals with exactly one Safety goal. Ratings use a 1–5 scale, and any 1, 2 or 5 needs a written reason. Re-hire and promotion recommendations are limited by the ratings.
- **Global comparison.** Each seafarer gets a fleet rank, a "higher than x% of the others" figure and an industry percentile, with box plots by company, a goal-area profile, and a fleet-vs-industry view by rank. The person is excluded from their own group, and small groups are flagged.
- **Privacy by design.** Seafarers see only themselves; colleagues' names are stripped on the server. Benchmark data carries no personal data.
- **Deployable.** One ASP.NET Core 8 site for IIS, using a SQLite file through the OS library, so no database server or NuGet packages are needed. Sign-in uses hashed passwords, and every screen has its own link.
- **Tested.** 28 rule and storage tests, 31 API checks, and 27 + 23 browser checks. All 216 person-year comparisons are cross-checked against an independent calculation.

| Seafarer: how I compare | Office: fleet against industry |
| --- | --- |
| <img src="docs/images/11-compare-seafarer.png" alt="Seafarer comparison"> | <img src="docs/images/13-fleet-vs-industry.png" alt="Fleet against industry"> |

## Quick start

Requires the [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0).

```bash
git clone https://github.com/yasin679/fleet-appraisal-desk.git
cd fleet-appraisal-desk
dotnet run --project src/Maritime.Appraisal.Api --urls http://localhost:5077
```

Open http://localhost:5077. The first start creates `App_Data/appraisal.db` with a demo fleet, which takes about 10 seconds. Sign in with any demo account; the password is `demo` for all of them.

| Account | Person | Try this |
| --- | --- | --- |
| `V1-2O` | Joseph Santos, Second Officer | Complete the self-evaluation |
| `V1-AB1` | Budi Kusuma, Able Seaman | Set goals (Non-Officer template) |
| `V1-CO` | Rahul Mehta, Chief Officer | Evaluate the team; compare |
| `V1-MST` | Capt. Arvind Rao, Master | Countersign |
| `CREWING` | Farah Khan, Crewing Manager | Approve, fleet view, benchmark upload, reset demo |

There's also a no-install version: open [`prototype/fleet-appraisal-desk.html`](prototype/fleet-appraisal-desk.html) in a browser. It runs the same screens, rules and maths with in-memory demo data.

## Mobile app

An offline demo of the same module for Android and iPhone is in [`mobile/`](mobile/README.md): an Android APK (`com.yasinjariwala.fleetappraisal`, Android 7+), an Xcode project for iOS 14+, and an installable web app for "Add to Home Screen". The [Mobile workflow](.github/workflows/mobile.yml) builds the APK, an unsigned `.ipa` and a simulator build, and publishes the web app to GitHub Pages.

## Repository layout

```
src/
  Maritime.Appraisal.Domain/   business rules BR-01..BR-18, workflow, comparison maths (no dependencies)
  Maritime.Appraisal.Api/      ASP.NET Core 8 site: API, sign-in, SQLite storage, wwwroot/index.html
web/                           front-end sources; build.sh produces wwwroot/index.html and the prototype
tests/
  Maritime.Appraisal.Tests/    TC-01..TC-28 (self-contained runner) + expected-comparison.json
  api-smoke.sh                 31 HTTP checks against a fresh database
  e2e/                         Playwright browser test
database/                      SQL Server schema (appr), reference data, demo data
prototype/                     stand-alone single-file version
mobile/                        Android APK build, iOS (Capacitor) project, installable web app
docs/                          12-document documentation pack (Markdown) and images
.github/workflows/ci.yml       build, all tests, publish artifact for IIS
.github/workflows/mobile.yml   APK, iOS builds, web app on GitHub Pages
```

## Architecture

<p align="center"><img src="docs/images/arch.png" alt="Architecture" width="820"></p>

- **One domain library** holds every rule. The API authenticates the caller, calls the domain, saves the result and shapes the response to what the caller may see.
- **Storage** sits behind `IAppraisalStore`. The current implementation is SQLite in WAL mode. The `database/` scripts carry the same model for SQL Server.
- **Front end**: a single small HTML/JS file for low-bandwidth ship links. It uses hash routing, so Back, Forward, refresh and deep links all work.

Details are in [05 Technical Design](docs/05_Technical_Design_Document.md).

## Tests

```bash
dotnet run --project tests/Maritime.Appraisal.Tests          # 28 passed
bash tests/api-smoke.sh                                       # 31 passed
# browser test (Node 18+): start the app on :5077, then
cd tests/e2e && npm install && npx playwright install chromium && npm test     # 27 passed
npm run test:standalone                                                         # 23 passed
```

On a machine without NuGet access, add `-p:RestoreSources=<an empty folder>` to `dotnet` commands. For the smoke test, set `RESTORE_ARGS` to the same value.

## Deploy on IIS

```bash
dotnet publish src/Maritime.Appraisal.Api -c Release -o publish
```

1. Install the ASP.NET Core 8 Hosting Bundle on the server.
2. Copy `publish/` to the server and point an IIS site at it. Use an app pool with *No Managed Code* and 64-bit.
3. Give the app pool *Modify* rights on `App_Data`.

Before going live, change the demo settings in `appsettings.json`. The full checklist is in [07 Deployment and Operations Guide](docs/07_Deployment_and_Operations_Guide.md).

## Documentation

| # | Document |
| --- | --- |
| 00 | [Project Overview](docs/00_Project_Overview.md) |
| 01 | [Business Process Document](docs/01_Business_Process_Document.md) |
| 02 | [Product Requirements Document](docs/02_Product_Requirements_Document.md) |
| 03 | [Workflow Specification](docs/03_Workflow_Specification.md) |
| 04 | [Functional Specification](docs/04_Functional_Specification.md) |
| 05 | [Technical Design Document](docs/05_Technical_Design_Document.md) |
| 06 | [Test Plan and Test Report](docs/06_Test_Plan_and_Test_Report.md) |
| 07 | [Deployment and Operations Guide](docs/07_Deployment_and_Operations_Guide.md) |
| 08 | [Release Notes](docs/08_Release_Notes.md) |
| 09 | [Maritime ERP Integration and Fit](docs/09_Maritime_ERP_Integration_and_Fit.md) |
| 10 | [Decisions, Assumptions, Risks and Roadmap](docs/10_Decisions_Assumptions_Risks_and_Roadmap.md) |
| 11 | [Demo Script and FAQ](docs/11_Demo_Script_and_FAQ.md) |

Word and PDF versions are attached to the [v2.1 release](https://github.com/yasin679/fleet-appraisal-desk/releases).

## Licence

Copyright © 2026 Yasin Jariwala. All rights reserved. The code is published for portfolio and evaluation purposes; see [LICENSE](LICENSE). All vessel, company and crew names in the demo data are fictional.
