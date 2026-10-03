# 07 Deployment and Operations Guide

*Installing the module on IIS, configuring it for production, running it day to day, backing it up, upgrading it and fixing common problems; plus the shareable demo link.*

| | |
| --- | --- |
| Document ID | FAD-07 |
| Version | 2.1 · 3 October 2026 |
| Author | Yasin Jariwala |
| Audience | IT administrators, DevOps and engineering reviewers |

**Purpose.** Gives an administrator everything needed to install, secure and operate v2.1, and a reviewer the evidence that the module is genuinely deployable.

← [06 Test Plan and Test Report](06_Test_Plan_and_Test_Report.md) · [Index](README.md) · [08 Release Notes](08_Release_Notes.md) →

<details><summary><strong>Contents</strong></summary>

- [1. Deployment options](#1-deployment-options)
- [2. Requirements](#2-requirements)
- [3. Install on IIS](#3-install-on-iis)
   - [3.1 What is in the publish folder](#31-what-is-in-the-publish-folder)
- [4. Configuration](#4-configuration)
- [5. Go-live checklist](#5-go-live-checklist)
- [6. Operations](#6-operations)
   - [6.1 Monitoring](#61-monitoring)
   - [6.2 Backup and restore](#62-backup-and-restore)
   - [6.3 Upgrade](#63-upgrade)
   - [6.4 User administration](#64-user-administration)
- [7. Troubleshooting](#7-troubleshooting)
- [8. Developer machine and tests](#8-developer-machine-and-tests)
- [9. Shareable link](#9-shareable-link)
- [10. Pages and links](#10-pages-and-links)

</details>

---

## 1. Deployment options

**Table 1: Options**

| Option | Who it suits | Data stored in | Sign-in |
| --- | --- | --- | --- |
| IIS on a Windows server | Real use by crew and office; pilot | `App_Data\appraisal.db` (SQLite) on the server | Crew ID or office user + password (cookie, 8 h) |
| Developer machine (Kestrel) | Evaluation, development, tests | `App_Data` in the project folder | Same |
| Shareable link (claude.ai) | Demos, reviews, process sign-off | The artifact's shared store | Demo accounts; password demo |
| Production at scale (roadmap) | Multi-vessel managers, ERP platform | SQL Server schema `appr` | Company SSO |

## 2. Requirements

**Table 2: Requirements**

| Item | Requirement |
| --- | --- |
| Operating system | Windows Server 2016 or later (Windows 10/11 for a pilot). SQLite is built in as `winsqlite3.dll`. |
| Web server | IIS 10 with the **ASP.NET Core 8 Hosting Bundle** (Microsoft download; run it, then `iisreset`). |
| Runtime | .NET 8 runtime (installed by the Hosting Bundle). |
| Certificate | An HTTPS certificate for the site name, e.g. `appraisal.company.com`. |
| Hardware | 2 vCPU, 4 GB RAM, 1 GB disk is ample for one ship manager (the demo database is under 10 MB). |
| Network | HTTPS (443) reachable from offices and vessels (VSAT/LEO). No outbound internet needed. |
| Browser | Any current Chrome, Edge, Safari or Firefox, desktop or mobile. |

## 3. Install on IIS

1. Copy the `publish` folder from the zip to the server, for example `D:\Sites\FleetAppraisal`.
2. In IIS Manager → Application Pools → **Add**: name `FleetAppraisal`, .NET CLR version **No Managed Code**, pipeline **Integrated**. Advanced settings: *Enable 32-bit applications* = **False**, *Start mode* = AlwaysRunning (optional, avoids the first-request delay).
3. Sites → **Add Website** (or Add Application under an existing site): physical path = the folder, application pool = `FleetAppraisal`, binding **https** with the certificate.
4. Create the folder `App_Data` inside the site folder and give `IIS AppPool\FleetAppraisal` **Modify** permission on it. Only the database and the sign-in keys (`App_Data\keys`) are written there.
5. Edit `appsettings.json` for production (section 4) **before** the first start if you do not want the demo data.
6. Browse to the site. The first start creates `appraisal.db`, loads data and hashes every account's password: allow about 10 seconds. Check `https://<site>/health` returns `"status":"ok"`.
7. Sign in as `CREWING` with the seed password and walk one appraisal through to confirm.

```
PowerShell equivalent (run as administrator):
Import-Module WebAdministration
New-WebAppPool -Name FleetAppraisal
Set-ItemProperty IIS:\AppPools\FleetAppraisal -Name managedRuntimeVersion -Value ""
Set-ItemProperty IIS:\AppPools\FleetAppraisal -Name enable32BitAppOnWin64 -Value $false
New-Website -Name FleetAppraisal -PhysicalPath D:\Sites\FleetAppraisal -ApplicationPool FleetAppraisal -Port 443 -Ssl
New-Item D:\Sites\FleetAppraisal\App_Data -ItemType Directory
icacls D:\Sites\FleetAppraisal\App_Data /grant "IIS AppPool\FleetAppraisal:(OI)(CI)M"
```

### 3.1 What is in the publish folder

**Table 3: Publish folder**

| File / folder | Purpose |
| --- | --- |
| `Maritime.Appraisal.Api.dll`, `Maritime.Appraisal.Domain.dll` | The application |
| `web.config` | IIS: AspNetCoreModuleV2, in-process hosting, `App_Data` hidden from the web |
| `appsettings.json` | Configuration |
| `wwwroot/index.html` | The front end |
| `DemoData/` | Demo fleet and sample benchmark (used only when seeding demo data) |
| `App_Data/` (created) | Database and keys; back this up |

## 4. Configuration

Settings live in `appsettings.json`. Any setting can also be set as an IIS environment variable using double underscores, e.g. `Demo__ShowDemoAccounts=false` (in `web.config` under `<environmentVariables>`).

**Table 4: Settings**

| Setting | Demo value | Production value | Why |
| --- | --- | --- | --- |
| `Storage:SqlitePath` | App_Data/appraisal.db | keep, or a path on a backed-up volume | Location of the database |
| `Storage:KeysPath` | App_Data/keys | keep | Cookie encryption keys; must survive restarts |
| `Demo:SeedDemoData` | true | **false** | Start with an empty database instead of the sample fleet |
| `Demo:SeedPassword` | demo | **a strong temporary password** | Set for every account that has none |
| `Demo:MustChangePassword` | false | **true** | Each user picks their own password at first sign-in |
| `Demo:ShowDemoAccounts` | true | **false** | Hides the demo account cards on the sign-in page |
| `Demo:AllowReset` | true | **false** | Removes the Demo data reset |
| `Demo:AllowHeaderAuth` | false | **false** | Test-only shortcut; never enable on a server |
| `Logging:LogLevel:Default` | Information | Information or Warning | Log volume |

> [!NOTE]
> **Loading real crew data**
>
> With `SeedDemoData=false` the database starts empty. For the pilot, crew, vessels and office users are loaded from the crew system (see 09 Integration): either by the integration endpoint planned for v2.2, or once by running the SQL demo-data script pattern with real data against SQL Server. The demo JSON format in `DemoData/fleet.json` documents the expected fields.

## 5. Go-live checklist

**Table 5: Go-live checklist**

| # | Check | Done |
| --- | --- | --- |
| 1 | HTTPS binding with a valid certificate; HTTP redirected or closed | ☐ |
| 2 | `SeedDemoData=false`, `ShowDemoAccounts=false`, `AllowReset=false`, `AllowHeaderAuth=false` | ☐ |
| 3 | Strong `SeedPassword`; `MustChangePassword=true`; temporary password sent to users through a separate channel | ☐ |
| 4 | App pool identity has Modify on `App_Data` only; site folder read-only | ☐ |
| 5 | `https://<site>/App_Data/appraisal.db` returns 404 | ☐ |
| 6 | `/health` monitored (status ok, appraisal count) | ☐ |
| 7 | Daily backup of `App_Data` scheduled and one restore tested | ☐ |
| 8 | Crewing Manager, superintendents and Masters of pilot vessels trained (20 min, using 11 Demo Script) | ☐ |
| 9 | Benchmark source agreed and loaded, or sample left clearly labelled | ☐ |
| 10 | Year opened (`POST /api/appraisals/open-year`) for the pilot vessels | ☐ |

## 6. Operations

### 6.1 Monitoring

**Table 6: Monitoring**

| What | How | Healthy |
| --- | --- | --- |
| Availability | `GET /health` every minute | 200 with `"status":"ok"` |
| Errors | Windows Event Log / stdout log; ERROR lines from "Unhandled error" | None |
| Sign-ins | `sign_in_log` table (user, time, success) | No bursts of failures |
| Process KPIs | Fleet page stage counts; KPIs in 01 section 13 | On target |

### 6.2 Backup and restore

- **Back up** `App_Data` daily: copy `appraisal.db` (and `-wal`/`-shm` if present) and the `keys` folder. Safest: stop the app pool, copy, start (a few seconds). Keep 30 daily and 12 monthly copies.
- **Restore**: stop the app pool, replace the files in `App_Data`, start. Without the `keys` folder everyone simply has to sign in again.
- **Retention**: appraisal records must be kept at least 5 years after closure (01 section 13); do not purge the database.

### 6.3 Upgrade

1. Back up `App_Data`.
2. Stop the app pool.
3. Replace every file in the site folder **except** `App_Data` and your edited `appsettings.json`.
4. Start the app pool and check `/health`.

### 6.4 User administration

- Users are seafarers (Crew ID) and office users: MSUPT, TSUPT, CREWING and ADMIN (Rohit Kulkarni, HR Systems Administrator, who has the Crewing Manager's office view for reference-data upkeep but cannot approve appraisals) in the demo.
- Users change their own password under Account (minimum 8 characters).
- To reset a forgotten password in v2.1, an administrator deletes the user's row from the `users` table and restarts the app: the seed password is assigned again (with must-change if enabled). An admin screen and SSO are on the roadmap.

## 7. Troubleshooting

**Table 7: Troubleshooting**

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| HTTP Error 500.19 | ASP.NET Core Hosting Bundle not installed | Install the Hosting Bundle, run `iisreset` |
| HTTP Error 500.30 / 502.5 | App failed to start | Set `stdoutLogEnabled="true"` in `web.config`, create a `logs` folder, read the log |
| Log: "unable to open database file" | App pool identity cannot write `App_Data` | Grant Modify on `App_Data` to `IIS AppPool\<pool>` |
| Log: "Unable to load DLL winsqlite3" | Very old Windows, or 32-bit pool | Use Windows Server 2016+; set *Enable 32-bit applications* = False |
| Everyone signed out after restart | `App_Data\keys` not writable or not persisted | Fix permissions; keep `keys` with backups |
| First page takes ~10 s | First start is hashing passwords / app pool idle start | Normal once; set Start mode AlwaysRunning |
| "That Crew ID or password is wrong." | Wrong credentials, or user has no password row | Check ID; see password reset above |
| A screen says "moved on since you opened it" | Someone else acted on the appraisal first | Expected; the latest version is shown |

## 8. Developer machine and tests

```
# requires the .NET 8 SDK
dotnet run --project src/Maritime.Appraisal.Api --urls http://localhost:5077
#   open http://localhost:5077  (delete src/Maritime.Appraisal.Api/App_Data to start fresh)

dotnet run --project tests/Maritime.Appraisal.Tests      # 28 passed
bash tests/api-smoke.sh                                   # 31 passed
BASE=http://localhost:5077/ node tests/e2e/e2e.js         # 27 passed (needs Node + Playwright)

# rebuild the deploy folder
dotnet publish src/Maritime.Appraisal.Api -c Release -o publish
# offline: add -p:RestoreSources=<an empty folder>
```

## 9. Shareable link

The same `index.html` runs as a claude.ai artifact. Without `window.FAD_API` it uses the browser backend: identical rules, workflow and comparison maths, with data kept in the artifact's shared store so everyone the link is shared with sees the same appraisals. Use it for demos and process sign-off; use the IIS server for real crew data. Access is controlled from the page's Share menu; a "Demo data" reset is available to the CREWING account.

## 10. Pages and links

**Table 8: Links**

| Link | Screen | Who can open it |
| --- | --- | --- |
| `#login` | Sign in | Everyone |
| `#work` | My work | Appraisers, Master, superintendents, office |
| `#mine` | My appraisal | Seafarers, HODs, Master |
| `#team` | My team / vessel crew / fleet | Appraisers, Master, superintendents, office |
| `#app.A2026-V1-2O` | One appraisal | The seafarer, their approval chain, office |
| `#compare`, `#compare.V1-2O`, `#compare.V1-2O.2025` | Comparison (person, year) | Seafarers see only themselves; others their scope |
| `#bench` | Benchmark data | Crewing |
| `#admin` | Demo data reset | Crewing (demo) |
| `#account` | Change password | Signed-in users (server) |

---

← [06 Test Plan and Test Report](06_Test_Plan_and_Test_Report.md) · [Index](README.md) · [08 Release Notes](08_Release_Notes.md) →
