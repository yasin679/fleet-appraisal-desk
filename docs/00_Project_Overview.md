# 00 Project Overview

*What was asked, what was built, how to review it in 15 minutes, and where every detail lives in the pack.*

| | |
| --- | --- |
| Document ID | FAD-00 |
| Version | 2.1 · 3 October 2026 |
| Author | Yasin Jariwala |
| Audience | Product, engineering and domain reviewers; ship-manager crewing and HR leads |

**Purpose.** Gives readers a single entry point to the project: the problem as understood, the solution delivered, the evidence that it works, and a guided path through the other eleven documents.

[Index](README.md) · [01 Business Process Document](01_Business_Process_Document.md) →

<details><summary><strong>Contents</strong></summary>

- [1. Executive summary](#1-executive-summary)
- [2. The problem as understood](#2-the-problem-as-understood)
   - [2.1 Requirements captured at the start](#21-requirements-captured-at-the-start)
   - [2.2 Key domain choices](#22-key-domain-choices)
- [3. What was delivered](#3-what-was-delivered)
   - [3.1 At a glance](#31-at-a-glance)
- [4. How to evaluate the module in 15 minutes](#4-how-to-evaluate-the-module-in-15-minutes)
- [5. Guide to the pack](#5-guide-to-the-pack)
- [6. Technology summary](#6-technology-summary)
- [7. What comes next](#7-what-comes-next)

</details>

---

## 1. Executive summary

This project designs and builds an **annual appraisal module for seafarers**, the part of crew HR that decides who is re-hired, who is promoted and what training each person needs before the next contract. It covers Officers and Non-Officers (ratings), follows the four-level approval chain used by ship managers, and adds something paper and spreadsheet appraisals cannot give: a **comparison of each seafarer with the same rank across the fleet and across other ship managers**.

The work is delivered as a **running application, not a slide**. It is packaged for IIS on a Windows server (publish folder and web.config, verified on the same in-process server IIS hosts), it is also available as a private shareable demo link, and it is backed by .NET code, a database, 28 automated tests, 31 API checks and 27 browser end-to-end checks, all passing.

**Table 1: Claims and where they are proven**

| What a reviewer can verify | Evidence in the pack |
| --- | --- |
| A complete appraisal moves through all 8 steps for both levels, with every approval role signing in separately | Live demo (11 Demo Script); browser test log (06 Test Plan, section 5) |
| Rules are enforced on the server, not just in the screen | 18 business rules BR-01 to BR-18 (04 FSD); TC-01 to TC-28 (06 Test Plan) |
| The global comparison maths is correct | 216 person-year comparisons cross-checked against an independent calculation (TC-18) |
| It is deployable | IIS publish folder, web.config, SQLite storage, health check (07 Deployment Guide) |
| It fits a maritime ERP | Module-by-module integration proposal and multi-tenant benchmark idea (09 Integration and Fit) |
| The product thinking behind it | Problem, personas, success metrics (02 PRD); decisions and trade-offs (10 Decisions, Risks and Roadmap) |

## 2. The problem as understood

The scope was framed from the business requirements gathered at the start and from how crew appraisals work at ship managers today:

> [!IMPORTANT]
> **Problem statement**
>
> Design and build an HR module for maritime employees that runs the yearly appraisal of every seafarer, Officer and Non-Officer: the seafarer sets goals and evaluates themselves, the head of department evaluates them, the appraisal is countersigned and approved by the office, and each person can be compared with others in the same rank, in the company and at other companies. It must be a working model, not a static mock-up, with a login and pages for each role.

### 2.1 Requirements captured at the start

**Table 2: Requirements and how they are met**

| # | Requirement | How it is met |
| --- | --- | --- |
| 1 | Working model where goals can be added, the seafarer evaluates themselves, then the manager evaluates | Goal editor (SC-04), self-evaluation (SC-05), appraiser evaluation (SC-06), all saved to a database |
| 2 | Both Officer and Non-Officer | Two levels with their own goal templates (BR-01); 17 ranks mapped |
| 3 | Appraisal levels standard as per maritime norms | 5-point scale, four approval levels (self, HOD, Master/superintendent, office) as on ship-manager forms |
| 4 | Global comparison of an individual against others in the same role, including other companies | Fleet rank, "higher than x% of others", industry percentile, goal-area profile, fleet vs industry by rank (BR-16) |
| 5 | Multiple pages for different roles | Role-specific tabs and worklists for seafarer, HOD, Master, superintendents, Crewing Manager |
| 6 | Login screen | Crew ID or office user plus password; hashed passwords; 8-hour session; change password |
| 7 | Deployable application with navigation | IIS-ready build; every screen has its own link; Back, Forward, refresh and bookmarks work |
| 8 | .NET code, database, documentation and testing | ASP.NET Core 8, SQLite (with SQL Server scripts), this 12-document pack, automated tests |

### 2.2 Key domain choices

- **Goal-based, not competency-scored.** The company runs a 4-months-on, 4-months-off rotation; one yearly appraisal against 3–6 agreed, weighted goals gives a clearer signal than repeating a generic competency grid each tour. Competence assessment stays where it belongs: certificates, training records and the crew matrix.
- **Self-evaluation before the appraiser rates.** Industry guidance says an appraisal should hold no surprises; asking the seafarer first puts their view on record and exposes the gap between self and appraiser.
- **Evidence for extremes.** Any 1, 2 or 5 needs a written comment, which counters the "everyone gets a 4" pattern that makes paper appraisals useless for decisions.
- **Ratings never feed pay automatically.** They inform re-hire, promotion and training decisions made by people.
- **MLC-aware records.** The Maritime Labour Convention bars quality-of-work statements on the seafarer's record of employment (Standard A2.1, 1(e)); appraisal data is therefore kept as an internal HR record, separate from the discharge document.

## 3. What was delivered

**Table 3: Deliverables**

| Deliverable | Description | Location in the zip |
| --- | --- | --- |
| Working application | ASP.NET Core 8 site with sign-in, role pages, 8-step workflow, comparison and benchmark upload | `publish/` (ready for IIS), `src/` |
| Shareable demo link | The same pages running on claude.ai with shared demo data, no install needed | Link available on request |
| Domain library | All business rules, workflow and comparison maths in one dependency-free .NET library | `src/Maritime.Appraisal.Domain` |
| Database | SQLite file created on first start; SQL Server schema, reference data and demo data scripts for the production path | `App_Data/` (created), `database/` |
| Automated tests | 28 unit/storage tests, 31-check API smoke test, Playwright browser test | `tests/` |
| Demo data | 6 vessels, 108 seafarers, 108 appraisals spread across all 8 steps, prior-year results, 4,104 benchmark ratings from 5 fictional managers | `src/Maritime.Appraisal.Api/DemoData` |
| Documentation | This 12-document pack in Word and PDF | `docs/` |

### 3.1 At a glance

**Table 4: Key numbers**

| Measure | Value |
| --- | --- |
| Ranks covered | 17 (9 Officer, 8 Non-Officer) across Deck, Engine and Catering |
| Workflow steps / approval levels | 8 steps / 4 levels, with 4 send-back paths |
| Business rules | 18 (BR-01 to BR-18), each enforced on the server and shown live on screen |
| Screens | 14 (SC-01 to SC-14), each with its own link |
| API endpoints | 33 REST endpoints under `/api`, plus `/health` |
| Automated checks | 28 unit/storage + 31 API + 27 browser (server) + 23 browser (shareable link) = 109, all passing |
| Comparison accuracy | 216 of 216 person-year results match an independent calculation |

<p align="center"><img src="images/workflow.png" alt="The appraisal workflow: 8 steps, 4 approval levels (shaded) and the send-back paths"></p>

<p align="center"><em>Figure 1: The appraisal workflow: 8 steps, 4 approval levels (shaded) and the send-back paths</em></p>

## 4. How to evaluate the module in 15 minutes

1. Open the shareable link (or a local install) and sign in as **V1-2O / demo** (Joseph Santos, Second Officer). Complete the self-evaluation: rate each goal, notice the live "Before you submit" checklist and the score.
2. Sign out, sign in as **V1-CO / demo** (Rahul Mehta, Chief Officer). Open Joseph from "My work" and evaluate him. Try a 2 without evidence: the Submit button stays disabled and says why.
3. Sign in as **V1-2O** again to acknowledge, as **V1-MST** to countersign, and as **CREWING** to approve. The appraisal closes and the crew record is updated.
4. Open **Compare** as CREWING, then as Joseph. The office sees the named fleet ranking; the seafarer sees only their own position, with colleagues anonymised.
5. Use the browser Back and Forward buttons and refresh on any page: the address always reflects the screen.
6. Skim 02 PRD for the product reasoning and 09 Integration and Fit for how this would sit inside a maritime ERP.

**Table 5: Demo accounts (password "demo" for all, on the server and the shareable link)**

| Account | Person | Role in the demo |
| --- | --- | --- |
| V1-2O | Joseph Santos | Second Officer, Officer level; appraisal waiting for his self-evaluation |
| V1-AB1 | Budi Kusuma | Able Seaman, Non-Officer level; appraisal at goal setting |
| V1-CO | Rahul Mehta | Chief Officer; appraiser for deck ranks; 2 items waiting |
| V1-CE | Marko Horvat | Chief Engineer; appraiser for engine ranks |
| V1-MST | Capt. Arvind Rao | Master; countersigns most ranks, appraises C/O, C/E, Chief Cook |
| MSUPT | Capt. Neil Fernandes | Marine Superintendent; appraises the Master, countersigns the C/O |
| TSUPT | Priya Nair | Technical Superintendent; countersigns the C/E |
| CREWING | Farah Khan | Crewing Manager; office approval, fleet view, benchmark data |
| ADMIN | Rohit Kulkarni | HR Systems Administrator; office view for reference-data upkeep; cannot approve |

> [!NOTE]
> **Resetting the demo**
>
> Signed in as CREWING, the "Demo data" tab resets every appraisal to its starting state, so the walkthrough can be repeated for each reviewer.

## 5. Guide to the pack

**Table 6: Documentation pack**

| Doc | Title | Read it if you want to know… | Pages |
| --- | --- | --- | --- |
| 00 | Project Overview | what was built and how to evaluate it | this |
| 01 | Business Process Document | how appraisals work at sea: roles, timetable, rating guidance, regulation (ISM, MLC, TMSA) | SOP |
| 02 | Product Requirements Document | the problem, personas, user stories with acceptance criteria, NFRs, metrics | PRD |
| 03 | Workflow Specification | states, transitions, who acts, visibility, reminders, notifications, exceptions | Workflow |
| 04 | Functional Specification | every screen with annotated screenshots, fields, rules, calculations | FSD |
| 05 | Technical Design Document | architecture, data model, API, security, comparison algorithm, design decisions | TDD |
| 06 | Test Plan and Test Report | test strategy, all test cases and results, defects found, traceability | QA |
| 07 | Deployment and Operations Guide | IIS install, configuration, go-live checklist, backup, troubleshooting | Ops |
| 08 | Release Notes | what changed in each version and known limitations | RN |
| 09 | Maritime ERP Integration and Fit | how the module would plug into a maritime ERP's Crew, QHSE, PMS and BI modules and a multi-tenant SaaS | Fit |
| 10 | Decisions, Assumptions, Risks and Roadmap | why each choice was made, what was assumed, what could go wrong, what comes next | Strategy |
| 11 | Demo Script and FAQ | a timed walkthrough and answers to common questions | Demo |

## 6. Technology summary

**Table 7: Technology choices**

| Layer | Choice | Why |
| --- | --- | --- |
| Front end | Single-page app in plain HTML/CSS/JavaScript; hash routing; light and dark themes; phone to desktop | Runs on low-bandwidth ship links, no build chain, identical in IIS and the shareable link |
| API | ASP.NET Core 8 minimal API, cookie authentication | Matches a .NET/SQL Server estate; one process for IIS |
| Domain | Dependency-free C# library (rules, workflow, comparison) | Rules testable in isolation; reusable from a vessel copy or ERP services |
| Storage | SQLite via the operating system library; SQL Server scripts supplied | Zero-install pilot database; same model ports to SQL Server |
| Security | PBKDF2-SHA256 password hashes, HttpOnly cookie, role and step checks on every call, hidden ratings until submitted | Appraisal data is sensitive personal data |
| Testing | Self-contained test runner, bash API smoke test, Playwright browser test | Builds and runs without NuGet access |

## 7. What comes next

The roadmap in document 10 sets out a 12-month path. The three highest-value next steps are:

1. **Validate with three ship-manager clients** (a tanker operator under TMSA, a container operator and a bulk operator): test the goal templates, the 1–5 scale and the four-level chain against their current paper forms.
2. **Wire the module into the Crew module** so rank, vessel, sign-on and sign-off drive the appraisal automatically, and the office decision writes back re-hire status, promotion and training.
3. **Turn the industry comparison into a product feature.** A multi-client SaaS platform is one of the few parties able to offer an anonymised, opt-in benchmark across ship managers, with minimum group sizes so no individual or company can be identified.

> [!NOTE]
> **About this pack**
>
> All vessels, companies and people are fictional demo data. Public sources used for regulatory and product context are cited in document 01. ERP module names in document 09 are generic; integration interfaces are proposals for discussion.

---

[Index](README.md) · [01 Business Process Document](01_Business_Process_Document.md) →
