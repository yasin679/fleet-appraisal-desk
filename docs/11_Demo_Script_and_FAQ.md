# 11 Demo Script and FAQ

*A timed 15-minute walkthrough of the working application with what to click and what to say, a 5-minute short version, set-up steps, and answers to frequently asked questions.*

| | |
| --- | --- |
| Document ID | FAD-11 |
| Version | 2.1 · 3 October 2026 |
| Author | Yasin Jariwala |
| Audience | Presenters, trainers and evaluators |

**Purpose.** Makes the live demonstration repeatable and focused on the points that matter most: a real workflow, enforced rules, a correct comparison, deployability and product fit.

← [10 Decisions, Assumptions, Risks and Roadmap](10_Decisions_Assumptions_Risks_and_Roadmap.md) · [Index](README.md)

<details><summary><strong>Contents</strong></summary>

- [1. Before the demo](#1-before-the-demo)
- [2. 15-minute walkthrough](#2-15-minute-walkthrough)
   - [2.1 0:00–1:30  Frame the problem](#21-000130--frame-the-problem)
   - [2.2 1:30–3:00  Goals (Non-Officer)](#22-130300--goals-non-officer)
   - [2.3 3:00–5:00  Self-evaluation (Officer)](#23-300500--self-evaluation-officer)
   - [2.4 5:00–7:30  Appraiser evaluation](#24-500730--appraiser-evaluation)
   - [2.5 7:30–9:00  Acknowledge, countersign, approve](#25-730900--acknowledge-countersign-approve)
   - [2.6 9:00–11:30  The comparison](#26-9001130--the-comparison)
   - [2.7 11:30–13:00  Deployable and navigable](#27-11301300--deployable-and-navigable)
   - [2.8 13:00–15:00  ERP fit and next steps](#28-13001500--erp-fit-and-next-steps)
- [3. 5-minute version](#3-5-minute-version)
- [4. If something goes wrong](#4-if-something-goes-wrong)
- [5. Frequently asked questions](#5-frequently-asked-questions)

</details>

---

## 1. Before the demo

**Table 1: Set-up (5 minutes before)**

| # | Step | Check |
| --- | --- | --- |
| 1 | Open the shareable link, or start the local install (`dotnet run --project src/Maritime.Appraisal.Api --urls http://localhost:5077`) | Sign-in page shows demo accounts |
| 2 | Sign in as CREWING → Demo data → Reset demo data | Joseph Santos is at Self-evaluation; Budi Kusuma at Goal setting |
| 3 | Open a second browser window (private) for quick role switches | Two windows side by side |
| 4 | Have document 04 open at the Compare section for the maths question |  |
| 5 | Zoom the browser to 110–125% for screen sharing | Text readable on the call |

**Table 2: Accounts (password demo)**

| Account | Name | Use in the demo |
| --- | --- | --- |
| V1-2O | Joseph Santos, Second Officer | Self-evaluation, acknowledgement, own comparison |
| V1-AB1 | Budi Kusuma, Able Seaman | Goal setting (Non-Officer) |
| V1-CO | Rahul Mehta, Chief Officer | Appraiser evaluation, team comparison |
| V1-MST | Capt. Arvind Rao, Master | Countersign |
| CREWING | Farah Khan, Crewing Manager | Office approval, fleet, benchmark |

## 2. 15-minute walkthrough

### 2.1 0:00–1:30  Frame the problem

| Do | Say |
| --- | --- |
| Show the sign-in page. | "Ship managers appraise seafarers on paper, once per contract. Ratings cluster at good, the seafarer's view is rarely asked, and nobody can say whether a 3.6 is good for a Second Officer. I built a yearly, goal-based appraisal with four approval levels and a comparison against the same rank in the fleet and at other managers." |
| Point at the demo accounts. | "Each role signs in separately; these are the eight people on MV Coral Meridian and in the office." |

### 2.2 1:30–3:00  Goals (Non-Officer)

| Do | Say |
| --- | --- |
| Sign in as V1-AB1. Open My appraisal. Show the Non-Officer template. | "The seafarer drafts goals from a template for their level, the library or their own words." |
| Change a weight to 25 → checklist turns red; change back. | "Rules are live: 3–6 goals, weights total 100, exactly one Safety goal of at least 20%. The server enforces the same rules." |
| Send goals to Rahul Mehta. | "The appraiser now sees it in their worklist." |

### 2.3 3:00–5:00  Self-evaluation (Officer)

| Do | Say |
| --- | --- |
| Switch to V1-2O. Open the appraisal; note the stepper with names. | "Every step shows who acts. Joseph is at Level 1, his self-evaluation." |
| Rate goal 1 as 5 → comment becomes required. Rate others 4. Write achievements. Note the live score. | "A 1, 2 or 5 needs a reason. That one rule changes the conversation on board." |
| Submit. | "Until now Rahul could not see these ratings." |

### 2.4 5:00–7:30  Appraiser evaluation

| Do | Say |
| --- | --- |
| Switch to V1-CO → My work → Evaluate Joseph. | "Rahul sees Joseph's own rating beside his buttons." |
| Rate goal 2 as 2 without evidence → Submit disabled; checklist explains (evidence, training). | "The appraiser must evidence a low rating and choose training. Ratings of 2 or below make training mandatory." |
| Write evidence, choose ECDIS training, strengths, improvements, Recommended, Ready next year. Try "Ready now" → explain rule. | "Ready now needs 3.50 and Safety 4+. Recommendations are bounded by the ratings." |
| Submit. Point at the gap tile. | "The self–appraiser gap is visible on every appraisal and on the fleet dashboard." |

### 2.5 7:30–9:00  Acknowledge, countersign, approve

| Do | Say |
| --- | --- |
| V1-2O → Acknowledge → Agree. | "If he disagreed, his comment would stay on record for the Master and the office." |
| V1-MST → Countersign. | "The Master checks fairness; he can send it back, which clears the acknowledgement so the seafarer re-reads the corrected ratings." |
| CREWING → Approve: Approved, training kept → Approve and close. Show history. | "Level 4. The decision is written to the crew record; the history is append-only for TMSA audits." |

### 2.6 9:00–11:30  The comparison

| Do | Say |
| --- | --- |
| As CREWING: Compare → Joseph, 2026. | "Fleet position, higher than x% of the others, industry percentile; the box plots show our fleet and each benchmark company." |
| Switch year to 2025, person Rahul Mehta. | "Rahul is 5th of 6 Chief Officers. Higher than 20% — one of the other five. An early version said 25% because it counted him against himself; I found it, fixed it, and now 216 person-years are cross-checked against an independent calculation." |
| Open fleet against industry. | "Ranks where we rate harshly or generously stand out. This is where calibration starts." |
| Switch to V1-2O → How I compare. | "A seafarer sees only himself; colleagues are 'Colleague' and the server never sends their names." |

### 2.7 11:30–13:00  Deployable and navigable

| Do | Say |
| --- | --- |
| Press Back, Forward, refresh on a comparison; open an unknown link. | "Every screen has a link; refresh and bookmarks work; bad links show Page not found." |
| Show the publish folder and `/health` (or 07 Deployment Guide). | "It installs on IIS with a SQLite file; no database server for a pilot. 28 unit tests, 31 API checks and 27 browser checks pass." |

### 2.8 13:00–15:00  ERP fit and next steps

| Do | Say |
| --- | --- |
| Show the integration diagram (09). | "Inside a maritime ERP this is a Crew sub-module: sign-on/off opens and times appraisals; decisions flow back to crew planning and training; QHSE and PMS records appear as evidence beside ratings." |
| Close. | "And a multi-client ERP can do what no single manager can: an opt-in anonymised benchmark across clients. Next I would validate with three clients and pilot with two of them on four vessels each." |

## 3. 5-minute version

1. Sign-in and problem (30 s).
2. Joseph's self-evaluation with the evidence rule (1 min).
3. Rahul's evaluation: blocked submit, then submit (1 min 30 s).
4. Compare page and the 20% vs 25% story (1 min 30 s).
5. Back/Forward/refresh and the ERP fit slide (30 s).

## 4. If something goes wrong

**Table 3: Fallbacks**

| Problem | Recovery |
| --- | --- |
| Data already moved on from a previous run | CREWING → Demo data → Reset |
| Shareable link slow or unavailable | Switch to the local install; same screens |
| A rule blocks a step unexpectedly | Read the checklist aloud — it is part of the demo |
| Someone asks to see code | Open `AppraisalRules.cs` (rules) and `Comparison.cs` (maths) in the zip |

## 5. Frequently asked questions

**Table 4: FAQ**

| Question | Answer |
| --- | --- |
| Why goals and not competencies? | Competence is already evidenced by certificates, training records and the crew matrix. What crewing lacks is a fair view of delivery on board. Goals with targets and weights give that, and the library keeps them consistent across vessels. |
| Isn't a yearly appraisal too infrequent with 4-month contracts? | One yearly record avoids two or three fragmented forms by different appraisers. The evaluation happens in the last 14 days on board, with the appraiser who saw the work, and the office decides once before crew planning. A contract-based period can be configured for clients who need it. |
| How do you stop everyone getting a 4? | Evidence is mandatory for 1, 2 and 5; the fleet-vs-industry view shows ranks and vessels that rate generously; the countersigner can return an appraisal; and the self–appraiser gap is visible. |
| How is the comparison calculated? | Score = appraiser's overall once submitted, or a closed earlier result. Fleet rank = 1 + number higher. "Higher than" = share of the others below. Industry percentile = (below + ½ equal) ÷ others across all companies. The person is excluded from their own group; groups under 4 are flagged. 216 cases are verified. |
| Where does industry data come from? | Today: uploaded CSV or labelled sample. Realistic sources: a manning agency pool, a bilateral data-sharing agreement, or — the opportunity for a multi-client ERP — an opt-in anonymised pool across clients with k-anonymity thresholds. |
| What about privacy and MLC? | Seafarers see only themselves; names are stripped on the server; benchmark rows carry no personal data. Appraisal results are internal HR records and never appear on the MLC record of employment, which must not state quality of work. |
| Why SQLite? Is it production-grade? | For one ship manager on one server, yes: it is transactional, in WAL mode, and needs no install. For multi-tenant scale the same model moves to SQL Server; the schema and scripts are included. |
| How would this work offline on a vessel? | Drafts saved on board and synced; each submit carries the step it expects; the server accepts only if the appraisal is still at that step (today's 409 rule). Each step has one actor, so conflicts are rare. |
| What would you build next? | Discovery with three clients, then the pilot build: SQL Server store, SSO, notifications with reminders, Crew master integration and evidence panels from QHSE and PMS. |
| How did you validate the maritime process? | Against typical ship-manager appraisal forms and procedures (self-assessment, HOD, Master countersign, office), ISM Code section 6, MLC Standard A2.1 and TMSA Element 3 expectations. The next step is validation with real clients. |
| What was the hardest part? | Getting the comparison both correct and fair: excluding the person from their group, handling ties and small groups, and making sure a seafarer never receives colleagues' identities — then proving it with an independent calculation. |
| What did you leave out deliberately? | Pay linkage, competency scoring, shore staff, and automated notifications (specified, scheduled for v2.2). Each is listed with its reason in documents 02 and 08. |

---

← [10 Decisions, Assumptions, Risks and Roadmap](10_Decisions_Assumptions_Risks_and_Roadmap.md) · [Index](README.md)
