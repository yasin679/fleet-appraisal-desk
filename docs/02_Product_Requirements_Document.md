# 02 Product Requirements Document

*Problem, users, scope, user stories with acceptance criteria, non-functional requirements, success metrics and release plan for the seafarer appraisal module.*

| | |
| --- | --- |
| Document ID | FAD-02 |
| Version | 2.1 · 3 October 2026 |
| Author | Yasin Jariwala |
| Audience | Product and engineering reviewers |

**Purpose.** States what the product must do and why, in enough detail for engineering to build and QA to test, and for a ship-manager client to recognise their own process.

← [01 Business Process Document](01_Business_Process_Document.md) · [Index](README.md) · [03 Workflow Specification](03_Workflow_Specification.md) →

<details><summary><strong>Contents</strong></summary>

- [1. Problem and background](#1-problem-and-background)
- [2. Vision and goals](#2-vision-and-goals)
   - [2.1 Non-goals](#21-non-goals)
- [3. Users and personas](#3-users-and-personas)
   - [3.1 Key user journeys](#31-key-user-journeys)
- [4. Scope](#4-scope)
- [5. User stories and acceptance criteria](#5-user-stories-and-acceptance-criteria)
   - [5.1 Acceptance criteria for the core stories](#51-acceptance-criteria-for-the-core-stories)
- [6. Non-functional requirements](#6-non-functional-requirements)
- [7. Release plan](#7-release-plan)
   - [7.1 Dependencies](#71-dependencies)
   - [7.2 Risks](#72-risks)
   - [7.3 Open questions](#73-open-questions)

</details>

---

## 1. Problem and background

Ship managers appraise seafarers on paper forms or spreadsheets, usually one form per contract completed by the Master or head of department and sent ashore at sign-off. A review of typical ship-manager appraisal forms and procedures points to five recurring problems (to be validated with clients in discovery):

**Table 1: Problems observed**

| # | Problem | Consequence |
| --- | --- | --- |
| P1 | Forms score generic traits ("initiative", "reliability") instead of what the person delivered | Ratings cannot justify a promotion or a non-re-hire decision |
| P2 | The seafarer's own view is rarely asked for | Poor ratings arrive as surprises; disputes and attrition follow |
| P3 | Ratings cluster at "good" because nobody has to justify them | Talent and risk are both invisible |
| P4 | Results sit in crew files and email attachments | Nobody can say whether a 3.6 is good for a Second Officer, or how a vessel rates compared with the fleet |
| P5 | Forms arrive late or not at all, and the approval trail is a scanned signature | Crew planning decides re-hire without the appraisal; TMSA and audit evidence is weak |

The rotation matters. Our seafarers work about **4 months on board and 4 months at home**, so an appraisal per contract produces two or three disconnected forms per year, often by different appraisers. The company wants:

- **one appraisal per seafarer per calendar year**;
- **two levels, Officers and Non-Officers**;
- **weighted goals instead of competency scores**;
- a **self-evaluation before the appraiser rates**;
- the **four approval levels** used by ship managers: seafarer, head of department, Master or superintendent, office;
- a **global comparison** showing how good each person is compared with others in the same rank, in the company and at other companies.

## 2. Vision and goals

> [!IMPORTANT]
> **Product vision**
>
> Every seafarer starts the year knowing what good looks like, is heard before being judged, and is compared fairly with their peers; every crewing decision is made with that evidence open.

**Table 2: Objectives and success metrics**

| Objective | Metric | Target in the first full year | Baseline (typical paper process) |
| --- | --- | --- | --- |
| Every seafarer starts the year with agreed goals | Goals agreed by 31 January (joiners: within 14 days) | 95% | No goals agreed |
| The seafarer's voice is heard | Appraisals with a self-evaluation before the appraiser rated | 100% | Rare |
| No surprises | Appraisals the seafarer disagreed with | under 10% | Not measured |
| Decisions are on time | Appraisals closed by 31 January of the next year | 90% | Forms often missing at re-hire |
| Ratings mean the same across the fleet | Spread of median rating between vessels, same rank | under 0.5 | Not measurable |
| Crewing uses the comparison | Office decisions made with the comparison page opened | 80% | Not available |
| It is quick on board | Median time to complete a self or appraiser evaluation | under 15 minutes | 30–45 minutes per paper form |

### 2.1 Non-goals

- Competency assessment (removed by design; certificates and training records remain the source).
- Shore-staff appraisals.
- Linking ratings to pay.
- Replacing the disciplinary process.

## 3. Users and personas

**Table 3: Personas**

| Persona | Context | Goals | Pain points today |
| --- | --- | --- | --- |
| **Joseph, Second Officer** (Officer seafarer) | On board 4 months, then home; phone and ship PC; limited bandwidth | Know what is expected; show what he achieved; see where he stands for promotion to C/O | Learns his rating at sign-off; never sees how he compares |
| **Budi, Able Seaman** (Non-Officer) | Phone only; English as a working language | Simple goals; quick form; fair treatment | Long forms in formal English; ratings feel arbitrary |
| **Rahul, Chief Officer** (appraiser) | Appraises 6–8 deck ratings and junior officers while running cargo work | Rate quickly with the seafarer's view in front of him; avoid conflict without inflating | Writes the same comments every contract; no reference for what a 4 means |
| **Capt. Arvind Rao, Master** (appraiser and countersigner) | Signs everything on board; accountable for fairness | See consistency across HODs; return poor appraisals easily | Countersigns stacks of paper at sign-off |
| **Capt. Neil, Marine Superintendent** | Office; visits vessels; owns deck performance | Appraise Masters; spot weak vessels and ranks | No fleet view |
| **Farah, Crewing Manager** | Office; plans crew changes months ahead | Decide re-hire and promotion with evidence; meet TMSA KPIs; know where we stand against the market | Chases forms; cannot compare with other managers |
| **HR administrator** | Office | Change templates, thresholds and chain without a release | Every change is a new paper form version |

### 3.1 Key user journeys

1. **Start of year.** Joseph opens his appraisal on his phone, adapts the Officer template, adds "Mentor a cadet" from the library, fixes the weights until the checklist is green, and sends the goals to Rahul, who agrees them.
2. **End of contract.** Two weeks before sign-off Joseph rates himself and writes his achievements. Rahul sees Joseph's ratings beside his own buttons, rates each goal, writes evidence for the 2 he gives, recommends training, discusses it with Joseph and submits.
3. **Sign-off.** Joseph acknowledges and agrees. The Master countersigns the same day.
4. **Office.** In January Farah opens Joseph's appraisal, checks the comparison (top third of the fleet's Second Officers, 68th percentile in the industry), approves re-hire and assigns ECDIS training. Joseph's crew record now shows re-hire approved and the training due before his next contract.

## 4. Scope

**Table 4: Scope**

| In scope (v2.x) | Out of scope (v2.x) |
| --- | --- |
| Sign-in with role-based pages for seafarer, HOD, Master, superintendents and Crewing Manager | Competency assessment |
| One appraisal per seafarer per calendar year; joiners at first sign-on | Shore-staff appraisals |
| Goals from level templates, the goal library or the seafarer's own, with goal rules | Linking ratings to pay |
| Goal agreement by the appraiser, with send-back | Automatic reminders and escalations (specified; built with production notifications) |
| Self-evaluation on a 1–5 scale with comments and a year summary | Offline use on board and a native mobile app (the web app works on tablet and phone) |
| Appraiser evaluation with evidence, recommendations and training | Pulling evidence automatically from PMS or inspection systems (roadmap) |
| Acknowledgement, countersign and office approval, each with send-back where it makes sense | Multi-language user interface (roadmap) |
| Global comparison: fleet rank, industry percentile, goal areas, fleet against industry by rank |  |
| Benchmark upload by CSV, with a clearly labelled sample data set |  |
| Worklists, team and fleet lists, dashboard, full audit history, page links and browser navigation |  |

## 5. User stories and acceptance criteria

Priority: **M** must, **S** should, **C** could. Rules are defined in 04 Functional Specification; test cases in 06 Test Plan.

**Table 5: User stories**

| ID | As a… | I want to… | So that… | Pri. | Rules / tests |
| --- | --- | --- | --- | --- | --- |
| FR-01 | Any user | sign in and land on the page for my role | I see only what is mine to do | M | BR-15 · E2E |
| FR-02 | Crewing Manager | have every seafarer's appraisal opened for the year, and joiners' at sign-on | nobody is missed | M | BR-02 · TC-02 |
| FR-03 | Seafarer | set my goals from the template, the library or my own, and send them | I agree what I am measured on | M | BR-03, BR-04 · TC-03 |
| FR-04 | Appraiser | adjust and agree goals, or send them back with a remark | goals fit the vessel and the person | M | BR-04, BR-14 · TC-04 |
| FR-05 | Seafarer | rate myself on each goal and summarise my year | my view is on record before I am rated | M | BR-05 · TC-06 |
| FR-06 | Appraiser | see the self-evaluation, then rate each goal with evidence | ratings are fair and evidenced | M | BR-06, BR-07 · TC-07, TC-08 |
| FR-07 | Appraiser | recommend re-hire, promotion and training | crewing has a recommendation from the person who saw the work | M | BR-08 · TC-09 |
| FR-08 | Appraiser | send an incomplete self-evaluation back | the seafarer can complete it | S | BR-14 · TC-10 |
| FR-09 | Seafarer | agree or disagree with my rating, with a comment | the result is transparent | M | BR-09 · TC-11 |
| FR-10 | Countersigner | countersign or return to the appraiser with remarks | appraisals are consistent | M | BR-10, BR-11 · TC-12, TC-13 |
| FR-11 | Crewing Manager | decide re-hire, promotion and training and close | the crew record is updated | M | BR-12 · TC-14 |
| FR-12 | Any user | see the score update as ratings are entered | I know the result before I submit | M | BR-13 · TC-15 |
| FR-13 | Seafarer | see how I compare with my rank in the fleet and the industry, without colleagues' names | I know where I stand | M | BR-16 · TC-17–19, E2E |
| FR-14 | Appraiser, Master, superintendent | compare anyone in my team, vessel or fleet | I can calibrate my ratings | M | BR-16 |
| FR-15 | Crewing Manager | see our fleet against the industry, rank by rank | I can spot ranks we rate harshly or generously | S | BR-16 · TC-21 |
| FR-16 | Crewing Manager | upload benchmark data from other companies, or go back to the sample | the comparison uses real data | M | BR-17 · TC-20 |
| FR-17 | Each role | have a worklist of what is waiting for me | I know what to do next | M | BR-15 · TC-24 |
| FR-18 | Office | filter the fleet list by vessel, level and step, with stage counts and averages | we manage the fleet, not single forms | S | E2E |
| FR-19 | Auditor | see the full history of every appraisal | we can show TMSA Element 3 evidence | M | BR-18 · TC-22 |
| FR-20 | Seafarer | get reminders before a step is due | nothing is missed | S | N-12 (roadmap) |
| FR-21 | Any user | use links, Back, Forward and refresh on every page | the app behaves like any website | M | E2E |
| FR-22 | Any user | change my password, and be forced to on first sign-in if the company requires it | my account is mine | M | TC-27, TC-28 |

### 5.1 Acceptance criteria for the core stories

#### 5.1.1 FR-03 Set goals

| # | Given | When | Then |
| --- | --- | --- | --- |
| 1 | my appraisal is at Goal setting | I open it | the level template is loaded as draft goals and the weight total is shown |
| 2 | my goals total 95% | I look at the checklist | "Weights add up to 100%" is red and Send is disabled |
| 3 | I have two Safety goals | I try to send | the checklist shows "Exactly one Safety goal"; the server also refuses with 422 if called directly |
| 4 | all goal rules pass | I press Send goals | the appraisal moves to Goal agreement, the appraiser sees it in My work, and the history records it |

#### 5.1.2 FR-05 Self-evaluation

| # | Given | When | Then |
| --- | --- | --- | --- |
| 1 | goals are agreed | I rate a goal 5 | the comment becomes required and the checklist shows it |
| 2 | one goal is unrated | I try to submit | Submit stays disabled |
| 3 | I have submitted | the appraiser opens the appraisal | they see my ratings and comments beside their own rating buttons |

#### 5.1.3 FR-06 / FR-07 Appraiser evaluation

| # | Given | When | Then |
| --- | --- | --- | --- |
| 1 | the self-evaluation is not yet submitted | the appraiser opens the appraisal | self ratings show "Shown once submitted" |
| 2 | I rate a goal 2 with no evidence | I look at the checklist | "Evidence written for every 1, 2 or 5 rating" is red; "Training chosen" is red |
| 3 | overall is 3.00 | I pick promotion "Ready now" | the checklist shows the rule (needs 3.50 and Safety 4) and Submit stays disabled |
| 4 | all rules pass | I submit | the seafarer can now see my ratings and must acknowledge |

#### 5.1.4 FR-13 Comparison for a seafarer

| # | Given | When | Then |
| --- | --- | --- | --- |
| 1 | my appraiser has submitted | I open How I compare | I see my overall, fleet position (e.g. 3rd of 7), "higher than x% of the others" and my industry percentile |
| 2 | I look at the fleet ranking | other people are listed | they appear as "Colleague" without names; the server never sends their names |
| 3 | fewer than 4 others in my rank are rated | I open the page | a notice says the group is small and to read the figures with care |

#### 5.1.5 FR-21 Navigation

| # | Given | When | Then |
| --- | --- | --- | --- |
| 1 | I am signed out | I open a link to a comparison page | I see sign-in, and after signing in I land on that comparison page |
| 2 | I moved Team → Compare | I press Back | I am on Team, and Forward returns me to Compare |
| 3 | I am a seafarer | I open the Benchmark data link | I see "Page not found" with a link to my start page |

## 6. Non-functional requirements

**Table 6: Non-functional requirements**

| ID | Area | Requirement | How verified |
| --- | --- | --- | --- |
| NFR-01 | Bandwidth | Appraisal page usable on a 256 kbps satellite link: the app is one HTML file (135 KB, 49 KB compressed) loaded once; API responses are compressed (appraisal 2 KB, full fleet list of 108 appraisals 4.6 KB compressed) | Sizes measured; at 256 kbps the first load is calculated at about 2 s and each screen under 0.2 s (to be measured in the pilot) |
| NFR-02 | Performance | API responses under 300 ms at 1,000 appraisals on a single server | Measured 1–3 ms server time on the demo fleet (108 appraisals); load test at 1,000+ planned for the pilot |
| NFR-03 | Security | Passwords hashed (PBKDF2-SHA256, 100,000 iterations, salt); HttpOnly cookie; every call checks role, scope and step | TC-27, TC-28, TC-16, API smoke |
| NFR-04 | Privacy | Seafarers never see colleagues' names; benchmark data holds no personal data | E2E access checks; BR-17 |
| NFR-05 | Audit | Every step logged with user, date and note; history is append-only | TC-22 |
| NFR-06 | Retention | Records kept at least 5 years after closure | Operational policy (07) |
| NFR-07 | Accessibility | Works on phone, tablet and laptop; WCAG 2.1 AA contrast; keyboard use; light and dark themes | Visual checks at 390 px and 1280 px |
| NFR-08 | Configurability | Templates, library, thresholds and chain changeable without a code release (reference tables) | Design (05); admin UI on roadmap |
| NFR-09 | Deployability | Single site on IIS, no external database required for the pilot | 07 Deployment Guide; publish folder tested |
| NFR-10 | Reliability | Data survives restarts; concurrent edits detected (409) rather than overwritten | TC-26; stage check on every command |
| NFR-11 | Navigation | Every screen addressable by URL; Back, Forward and refresh work | E2E navigation checks |

## 7. Release plan

**Table 7: Releases**

| Release | Contents | Status |
| --- | --- | --- |
| v1.0 Model | Office-set goals, per-tour reviews (superseded) | Superseded |
| v2.0 Working model | All must-have stories, demo fleet, .NET rules and API, SQL schema | Done |
| v2.1 Deployable | IIS hosting, SQLite storage, sign-in and passwords, page links and navigation, browser tests, documentation pack | Done |
| v2.2 Pilot build | SQL Server store, company SSO, notifications N-01 to N-12 with reminders, crew master integration, admin for templates and thresholds, real benchmark source | Next |
| v2.3 Pilot | Offline drafts on board, PMS/QHSE/training evidence beside ratings; 2 client managers × 4 vessels | Planned |
| v3.0 GA | Configurable forms per tenant, BI dashboards, multi-tenant hardening, cross-client benchmark, multi-language | Planned |

### 7.1 Dependencies

- Crew planning supplies rank, vessel and sign-on/sign-off dates.
- The identity provider maps each user to a Crew ID or office role.
- A source of benchmark data: a manning agency, a data-sharing pool between managers, a survey, or (on a multi-client ERP platform) an opt-in anonymised pool across clients.

### 7.2 Risks

**Table 8: Product risks (full register in document 10)**

| Risk | Mitigation |
| --- | --- |
| Everyone rated 4 to avoid conflict | Evidence required for 1, 2 and 5; fleet-vs-industry view exposes generous ranks; countersign can return |
| Self-ratings inflated | The self–appraiser gap is shown on every appraisal and on the dashboard |
| Benchmark data not comparable between companies | Upload only on the same 1–5 scale; source and date shown on every comparison; sample data clearly labelled |
| Small groups give misleading percentiles | Flag when fewer than four others of the rank are rated |
| Low adoption on board | Phone-first layout, live checklist, under 15 minutes per evaluation, templates pre-filled |

### 7.3 Open questions

- Which benchmark source will be used for the pilot?
- Should cadets have their own template built on training record book tasks?
- Should two consecutive years below 2.50 trigger an automatic not-for-re-hire review?
- Should the Master see appraiser drafts before submission on small crews?

---

← [01 Business Process Document](01_Business_Process_Document.md) · [Index](README.md) · [03 Workflow Specification](03_Workflow_Specification.md) →
