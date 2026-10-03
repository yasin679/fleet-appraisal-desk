using System.Security.Claims;
using System.Text.Json.Serialization;
using Maritime.Appraisal.Api;
using Maritime.Appraisal.Api.Storage;
using Maritime.Appraisal.Domain;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.DataProtection;

var builder = WebApplication.CreateBuilder(args);
var cfg = builder.Configuration;
string Abs(string p) => Path.IsPathRooted(p) ? p : Path.Combine(builder.Environment.ContentRootPath, p);

// ---------- storage: one SQLite file (App_Data/appraisal.db by default) ----------
var dbPath = Abs(cfg["Storage:SqlitePath"] ?? "App_Data/appraisal.db");
var store = new SqliteStore(dbPath);
var firstRun = store.Initialise();
if (firstRun && cfg.GetValue("Demo:SeedDemoData", true)) store.ReplaceAllWith(InMemoryStore.Demo());
else store.Load();
store.SeedPasswords(cfg["Demo:SeedPassword"] ?? "demo", cfg.GetValue("Demo:MustChangePassword", false));

builder.Services.AddSingleton(store);
builder.Services.AddSingleton<IAppraisalStore>(store);
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddResponseCompression(o => { o.EnableForHttps = true; o.MimeTypes = new[] { "application/json", "text/html", "text/csv" }; });
builder.Services.AddSingleton(new AppraisalSettings());
builder.Services.AddSingleton<AppraisalWorkflow>();
builder.Services.AddSingleton<Comparison>();
builder.Services.ConfigureHttpJsonOptions(o => o.SerializerOptions.Converters.Add(new JsonStringEnumConverter()));

// ---------- sign-in: cookie; keys kept in App_Data so sign-ins survive an IIS app-pool recycle ----------
builder.Services.AddDataProtection().PersistKeysToFileSystem(new DirectoryInfo(Abs(cfg["Storage:KeysPath"] ?? "App_Data/keys"))).SetApplicationName("FleetAppraisalDesk");
builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme).AddCookie(o =>
{
    o.Cookie.Name = "fad.auth";
    o.Cookie.HttpOnly = true;
    o.Cookie.SameSite = SameSiteMode.Lax;
    o.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
    o.ExpireTimeSpan = TimeSpan.FromHours(8);
    o.SlidingExpiration = true;
    o.Events.OnRedirectToLogin = c => { c.Response.StatusCode = 401; return Task.CompletedTask; };
    o.Events.OnRedirectToAccessDenied = c => { c.Response.StatusCode = 403; return Task.CompletedTask; };
});
builder.Services.AddAuthorization();

var app = builder.Build();
app.UseResponseCompression();
app.UseMiddleware<ErrorMiddleware>();
app.UseDefaultFiles();
app.UseStaticFiles();
app.UseAuthentication();
app.UseAuthorization();
app.MapAppraisalEndpoints(cfg);
app.MapFallback("/api/{**rest}", () => Results.Json(new { error = "Not found" }, statusCode: 404));
app.MapFallbackToFile("index.html");
app.Logger.LogInformation("Fleet Appraisal Desk: database {Db} (SQLite {Version}), first run {First}", dbPath, SqliteDb.Version, firstRun);
app.Run();

public partial class Program;

namespace Maritime.Appraisal.Api
{
    public sealed record LoginBody(string UserId, string Password);
    public sealed record ChangePasswordBody(string Current, string New);
    public sealed record GoalsBody(List<GoalInput> Goals);
    public sealed record SelfBody(List<RatingInput> Ratings, SelfSummary? Summary);
    public sealed record EvaluationBody(List<RatingInput> Ratings, AppraiserAssessment? Assessment);
    public sealed record RemarkBody(string Remark);
    public sealed record AckBody(bool Agrees, string? Comment);
    public sealed record CommentBody(string? Comment);
    public sealed record OpenYearBody(int Year);

    public static class Endpoints
    {
        public static readonly string[] DemoAccounts = ["V1-2O", "V1-AB1", "V1-CO", "V1-CE", "V1-MST", "MSUPT", "TSUPT", "CREWING"];

        public static string RoleOf(IAppraisalStore s, string id) => id switch
        {
            Roles.CrewingManager or Roles.Admin => "crewing",
            Roles.MarineSupt or Roles.TechnicalSupt => "supt",
            _ => s.Seafarers.FirstOrDefault(x => x.Id == id)?.RankCode switch { "MST" => "master", "CO" or "CE" or "CCK" => "hod", _ => "seafarer" },
        };
        public static string NameOf(IAppraisalStore s, string? id) => id == null ? "" : id == Roles.System ? "System"
            : s.ShoreUsers.FirstOrDefault(u => u.Code == id)?.Name ?? s.Seafarers.FirstOrDefault(x => x.Id == id)?.Name ?? id;
        public static string VesselName(IAppraisalStore s, string? id) => s.Vessels.FirstOrDefault(v => v.Id == id)?.Name ?? id ?? "";
        public static string TitleOf(IAppraisalStore s, string id) => s.ShoreUsers.FirstOrDefault(u => u.Code == id)?.Title
            ?? (s.Seafarers.FirstOrDefault(x => x.Id == id) is { } sf ? Ranks.Get(sf.RankCode).Name : "");

        public static object Me(IAppraisalStore s, string id)
        {
            var sf = s.Seafarers.FirstOrDefault(x => x.Id == id);
            return new { Id = id, Name = NameOf(s, id), Title = TitleOf(s, id), Role = RoleOf(s, id), Office = Roles.IsOffice(id), RankCode = sf?.RankCode, VesselId = sf?.VesselId, VesselName = sf == null ? null : VesselName(s, sf.VesselId) };
        }

        public static Actor CurrentUser(HttpContext ctx, IAppraisalStore store, IConfiguration cfg)
        {
            var id = ctx.User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (id == null && cfg.GetValue("Demo:AllowHeaderAuth", false)) id = ctx.Request.Headers["X-User"].ToString().Trim().ToUpperInvariant();
            if (string.IsNullOrEmpty(id)) throw new UnauthorizedAccessException();
            return new Actor(id, NameOf(store, id));
        }

        public static void MapAppraisalEndpoints(this WebApplication app, IConfiguration cfg)
        {
            app.MapGet("/health", (SqliteStore s) => new { Status = "ok", Database = Path.GetFileName(s.FilePath), Sqlite = SqliteDb.Version, Appraisals = s.Appraisals.Count });

            // ---------------- sign-in ----------------
            var auth = app.MapGroup("/api/auth");
            auth.MapPost("/login", async (LoginBody b, HttpContext c, SqliteStore s) =>
            {
                var id = (b.UserId ?? "").Trim().ToUpperInvariant();
                var known = s.Seafarers.Any(x => x.Id == id) || s.ShoreUsers.Any(u => u.Code == id);
                var (ok, mustChange) = known ? s.CheckPassword(id, b.Password ?? "") : (false, false);
                if (!ok) return Results.Json(new { status = 401, message = "That Crew ID or password is wrong." }, statusCode: 401);
                var who = new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, id), new Claim(ClaimTypes.Name, NameOf(s, id))], CookieAuthenticationDefaults.AuthenticationScheme);
                await c.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, new ClaimsPrincipal(who));
                return Results.Ok(new { User = Me(s, id), MustChangePassword = mustChange });
            });
            auth.MapPost("/logout", async (HttpContext c) => { await c.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme); return Results.Ok(new { SignedOut = true }); });
            auth.MapGet("/me", (HttpContext c, SqliteStore s) => Me(s, CurrentUser(c, s, cfg).Id));
            auth.MapPost("/change-password", (ChangePasswordBody b, HttpContext c, SqliteStore s) =>
            {
                var u = CurrentUser(c, s, cfg);
                if (!s.CheckPassword(u.Id, b.Current ?? "").Ok) throw new ValidationFailedException(["Your current password is wrong."]);
                if ((b.New ?? "").Length < 8) throw new ValidationFailedException(["Use at least 8 characters for the new password."]);
                s.SetPassword(u.Id, b.New!, false);
                return Results.Ok(new { Changed = true });
            });
            auth.MapGet("/demo-accounts", (SqliteStore s, AppraisalWorkflow wf) => !cfg.GetValue("Demo:ShowDemoAccounts", true) ? new List<object>() :
                DemoAccounts.Where(id => s.Seafarers.Any(x => x.Id == id) || s.ShoreUsers.Any(u => u.Code == id)).Select(id =>
                {
                    var own = wf.Find(id, wf.Today.Year);
                    var waiting = s.Appraisals.Count(a => a.Year == wf.Today.Year && a.SeafarerId != id && wf.ActorFor(a) == id);
                    return (object)new { Id = id, Name = NameOf(s, id), Title = TitleOf(s, id), Role = RoleOf(s, id), OwnStage = own?.Stage, OwnIsMine = own != null && wf.ActorFor(own) == id, Waiting = waiting };
                }).ToList());

            // ---------------- everything below needs a signed-in user ----------------
            var api = cfg.GetValue("Demo:AllowHeaderAuth", false) ? app.MapGroup("/api") : app.MapGroup("/api").RequireAuthorization();
            Actor U(HttpContext c, IAppraisalStore s) => CurrentUser(c, s, cfg);
            int Year(AppraisalWorkflow wf, int? y) => y ?? wf.Today.Year;

            api.MapGet("/reference/all", (IAppraisalStore s, AppraisalSettings st) => new
            {
                Ranks = Ranks.All.Values.OrderBy(r => r.Order), Scale = Scale.Labels, Templates = new { GoalTemplates.Officer, GoalTemplates.NonOfficer },
                Library = GoalTemplates.Library, Training = GoalTemplates.Training, Settings = st, Vessels = s.Vessels, Office = s.ShoreUsers,
            });
            api.MapGet("/vessels", (IAppraisalStore s) => s.Vessels);

            api.MapGet("/appraisals", (int? year, string? vesselId, Level? level, Stage? stage, string? scope, HttpContext c, IAppraisalStore s, AppraisalWorkflow wf) =>
            {
                var u = U(c, s);
                return s.Appraisals.Where(a => a.Year == Year(wf, year) && (vesselId == null || a.VesselId == vesselId) && (level == null || a.Level == level) && (stage == null || a.Stage == stage)
                        && (scope == "mine" ? a.SeafarerId == u.Id : wf.InScope(u, a)))
                    .OrderBy(a => a.VesselId).ThenBy(a => Ranks.Get(a.RankCode).Order).ThenBy(a => a.SeafarerId)
                    .Select(a => Dto.Summary(a, u, wf)).ToList();
            });
            api.MapGet("/appraisals/{id}", (string id, HttpContext c, IAppraisalStore s, AppraisalWorkflow wf) =>
            {
                var u = U(c, s); var a = wf.Get(id);
                if (!wf.CanView(u, a)) throw new ForbiddenException("You can't view this appraisal.");
                return Dto.Detail(a, u, wf);
            });
            api.MapPost("/appraisals/open-year", (OpenYearBody b, HttpContext c, SqliteStore s, AppraisalWorkflow wf) => { lock (s.Sync) return new { Opened = wf.OpenYear(U(c, s), b.Year) }; });
            api.MapPost("/appraisals/joiner/{seafarerId}", (string seafarerId, int? year, HttpContext c, SqliteStore s, AppraisalWorkflow wf) => { var u = U(c, s); lock (s.Sync) return Dto.Detail(wf.OpenForJoiner(u, seafarerId, Year(wf, year)), u, wf); });

            IResult Do(HttpContext c, SqliteStore s, AppraisalWorkflow wf, Func<Actor, SeafarerAppraisal> f) { var u = U(c, s); lock (s.Sync) return Results.Ok(Dto.Detail(f(u), u, wf)); }
            api.MapPut("/appraisals/{id}/goals", (string id, GoalsBody b, HttpContext c, SqliteStore s, AppraisalWorkflow wf) => Do(c, s, wf, u => wf.SaveGoals(u, id, b.Goals)));
            api.MapPost("/appraisals/{id}/goals/submit", (string id, HttpContext c, SqliteStore s, AppraisalWorkflow wf) => Do(c, s, wf, u => wf.SubmitGoals(u, id)));
            api.MapPost("/appraisals/{id}/goals/agree", (string id, HttpContext c, SqliteStore s, AppraisalWorkflow wf) => Do(c, s, wf, u => wf.AgreeGoals(u, id)));
            api.MapPost("/appraisals/{id}/goals/return", (string id, RemarkBody b, HttpContext c, SqliteStore s, AppraisalWorkflow wf) => Do(c, s, wf, u => wf.ReturnGoals(u, id, b.Remark)));
            api.MapPut("/appraisals/{id}/self", (string id, SelfBody b, HttpContext c, SqliteStore s, AppraisalWorkflow wf) => Do(c, s, wf, u => wf.SaveSelf(u, id, b.Ratings, b.Summary)));
            api.MapPost("/appraisals/{id}/self/submit", (string id, HttpContext c, SqliteStore s, AppraisalWorkflow wf) => Do(c, s, wf, u => wf.SubmitSelf(u, id)));
            api.MapPut("/appraisals/{id}/evaluation", (string id, EvaluationBody b, HttpContext c, SqliteStore s, AppraisalWorkflow wf) => Do(c, s, wf, u => wf.SaveEvaluation(u, id, b.Ratings, b.Assessment)));
            api.MapPost("/appraisals/{id}/evaluation/submit", (string id, HttpContext c, SqliteStore s, AppraisalWorkflow wf) => Do(c, s, wf, u => wf.SubmitEvaluation(u, id)));
            api.MapPost("/appraisals/{id}/evaluation/return", (string id, RemarkBody b, HttpContext c, SqliteStore s, AppraisalWorkflow wf) => Do(c, s, wf, u => wf.ReturnToSeafarer(u, id, b.Remark)));
            api.MapPost("/appraisals/{id}/acknowledge", (string id, AckBody b, HttpContext c, SqliteStore s, AppraisalWorkflow wf) => Do(c, s, wf, u => wf.Acknowledge(u, id, b.Agrees, b.Comment)));
            api.MapPost("/appraisals/{id}/countersign", (string id, CommentBody b, HttpContext c, SqliteStore s, AppraisalWorkflow wf) => Do(c, s, wf, u => wf.Countersign(u, id, b.Comment)));
            api.MapPost("/appraisals/{id}/return-to-appraiser", (string id, RemarkBody b, HttpContext c, SqliteStore s, AppraisalWorkflow wf) => Do(c, s, wf, u => wf.ReturnToAppraiser(u, id, b.Remark)));
            api.MapPost("/appraisals/{id}/approve", (string id, OfficeDecision b, HttpContext c, SqliteStore s, AppraisalWorkflow wf) => Do(c, s, wf, u => wf.Approve(u, id, b)));

            api.MapGet("/worklist", (int? year, HttpContext c, IAppraisalStore s, AppraisalWorkflow wf) =>
            {
                var u = U(c, s);
                return wf.Worklist(u, Year(wf, year)).OrderByDescending(w => w.Appraisal.Stage).Select(w => new { w.Action, Appraisal = Dto.Summary(w.Appraisal, u, wf) }).ToList();
            });

            // ---------------- comparison (BR-16) ----------------
            api.MapGet("/people", (HttpContext c, IAppraisalStore s, AppraisalWorkflow wf) =>
            {
                var u = U(c, s); var y = wf.Today.Year;
                return s.Seafarers.Where(p => p.Id == u.Id || Roles.IsOffice(u.Id) || (RoleOf(s, u.Id) != "seafarer" && wf.Find(p.Id, y) is { } a && wf.InScope(u, a)))
                    .OrderBy(p => p.VesselId).ThenBy(p => Ranks.Get(p.RankCode).Order)
                    .Select(p => new { p.Id, p.Name, p.RankCode, RankName = Ranks.Get(p.RankCode).Name, p.VesselId, VesselName = VesselName(s, p.VesselId) }).ToList();
            });
            api.MapGet("/compare/fleet-vs-industry", (int? year, HttpContext c, IAppraisalStore s, AppraisalWorkflow wf, Comparison cmp) =>
            {
                if (!Roles.IsOffice(U(c, s).Id)) throw new ForbiddenException("Only office users see the fleet-wide comparison.");
                return cmp.FleetVsIndustry(Year(wf, year)).Select(r => new { r.RankCode, RankName = Ranks.Get(r.RankCode).Name, Level = Ranks.Get(r.RankCode).Level, r.OurRated, r.OurMedian, r.IndustryMedian, r.Difference, r.IndustryPercentile });
            });
            api.MapGet("/compare/{seafarerId}", (string seafarerId, int? year, HttpContext c, IAppraisalStore s, AppraisalWorkflow wf, Comparison cmp) =>
            {
                var u = U(c, s); var y = Year(wf, year);
                var a = wf.Find(seafarerId, wf.Today.Year);
                var self = u.Id == seafarerId;
                if (!self && !Roles.IsOffice(u.Id) && (RoleOf(s, u.Id) == "seafarer" || a == null || !wf.InScope(u, a))) throw new ForbiddenException("You can only compare people in your team.");
                var r = cmp.Compare(seafarerId, y);
                var anon = RoleOf(s, u.Id) == "seafarer";
                var ranking = s.Seafarers.Where(p => p.RankCode == r.RankCode).Select(p => (p, sc: cmp.ScoreOf(p.Id, y))).Where(x => x.sc != null)
                    .OrderByDescending(x => x.sc!.Value.Overall).ThenBy(x => x.p.Id).ToList()
                    .Select((x, i) =>
                    {
                        var hide = anon && x.p.Id != seafarerId;
                        return new { Position = i + 1, Id = hide ? null : x.p.Id, Name = hide ? null : x.p.Name, VesselName = hide ? null : VesselName(s, x.p.VesselId), Overall = x.sc!.Value.Overall, IsPerson = x.p.Id == seafarerId };
                    }).ToList();
                return new { Result = r, Name = NameOf(s, seafarerId), RankName = Ranks.Get(r.RankCode).Name, Ranking = ranking, HasPreviousYear = cmp.ScoreOf(seafarerId, y - 1) != null };
            });

            // ---------------- benchmark data (BR-17) ----------------
            api.MapGet("/benchmark", (IAppraisalStore s) => new { Source = s.BenchmarkSource, Companies = s.Benchmark.GroupBy(b => b.Company).Select(g => new { Company = g.Key, Ratings = g.Count(), Years = g.Select(x => x.Year).Distinct().Order().ToList(), Ranks = g.Select(x => x.RankCode).Distinct().Count() }).ToList() });
            api.MapPost("/benchmark", async (string? source, HttpContext c, SqliteStore s, AppraisalWorkflow wf) =>
            {
                if (U(c, s).Id != Roles.CrewingManager) throw new ForbiddenException("Only the Crewing Manager can replace benchmark data.");
                using var r = new StreamReader(c.Request.Body);
                var parsed = BenchmarkCsv.Parse(await r.ReadToEndAsync());
                if (parsed.Rows.Count == 0) throw new ValidationFailedException(parsed.Errors.Count > 0 ? parsed.Errors : ["BR-17: The file has no usable rows."]);
                lock (s.Sync)
                {
                    s.Benchmark.Clear(); foreach (var row in parsed.Rows) s.Benchmark.Add(row);
                    s.BenchmarkSource = new(string.IsNullOrWhiteSpace(source) ? "Uploaded file" : source.Trim(), wf.Today, false, parsed.Rows.Count);
                    s.SaveChanges();
                }
                return Results.Ok(new { Source = s.BenchmarkSource, Skipped = parsed.Errors });
            });
            api.MapDelete("/benchmark", (HttpContext c, SqliteStore s) =>
            {
                if (U(c, s).Id != Roles.CrewingManager) throw new ForbiddenException("Only the Crewing Manager can change benchmark data.");
                var sample = InMemoryStore.Demo();
                lock (s.Sync) { s.Benchmark.Clear(); foreach (var b in sample.Benchmark) s.Benchmark.Add(b); s.BenchmarkSource = sample.BenchmarkSource; s.SaveChanges(); }
                return s.BenchmarkSource;
            });

            // ---------------- dashboard and admin ----------------
            api.MapGet("/dashboard", (int? year, HttpContext c, IAppraisalStore s, AppraisalWorkflow wf) =>
            {
                var u = U(c, s); var y = Year(wf, year);
                var list = s.Appraisals.Where(a => a.Year == y && wf.InScope(u, a)).ToList();
                var rated = list.Where(a => a.Stage >= Stage.Ack).ToList();
                return new
                {
                    Year = y, Total = list.Count, Rated = rated.Count,
                    ByStage = Enum.GetValues<Stage>().Select(st => new { Stage = st, Count = list.Count(a => a.Stage == st) }).ToList(),
                    AverageGap = rated.Count == 0 ? (decimal?)null : Math.Round(rated.Average(a => (AppraisalRules.SelfOverall(a) ?? 0) - (AppraisalRules.AppraiserOverall(a) ?? 0)), 2),
                    ByVessel = Roles.IsOffice(u.Id) ? rated.GroupBy(a => a.VesselId).OrderBy(g => g.Key).Select(g => (object)new { VesselId = g.Key, VesselName = VesselName(s, g.Key), Rated = g.Count(), Average = Math.Round(g.Average(a => AppraisalRules.AppraiserOverall(a) ?? 0), 2) }).ToList() : new List<object>(),
                };
            });
            api.MapPost("/admin/reset-demo", (HttpContext c, SqliteStore s) =>
            {
                if (U(c, s).Id != Roles.CrewingManager) throw new ForbiddenException("Only the Crewing Manager can reset the demo data.");
                if (!cfg.GetValue("Demo:AllowReset", true)) throw new ForbiddenException("Resetting is switched off on this server.");
                (List<BenchmarkRating> Rows, BenchmarkSource Source)? keep = s.BenchmarkSource.IsSample ? null : (s.Benchmark.ToList(), s.BenchmarkSource);
                s.ReplaceAllWith(InMemoryStore.Demo());
                if (keep != null) lock (s.Sync) { s.Benchmark.Clear(); foreach (var b in keep.Value.Rows) s.Benchmark.Add(b); s.BenchmarkSource = keep.Value.Source; s.SaveChanges(); }
                return new { Reset = true, Appraisals = s.Appraisals.Count };
            });
        }
    }

    public static class Dto
    {
        public static object Summary(SeafarerAppraisal a, Actor u, AppraisalWorkflow wf)
        {
            var s = wf.Store; var actor = wf.ActorFor(a);
            return new
            {
                a.Id, a.SeafarerId, Name = Endpoints.NameOf(s, a.SeafarerId), a.Year, a.RankCode, RankName = Ranks.Get(a.RankCode).Name, a.Level, a.VesselId,
                VesselName = Endpoints.VesselName(s, a.VesselId), a.Stage, WaitingOn = actor, WaitingOnName = actor == null ? null : Endpoints.NameOf(s, actor),
                Action = AppraisalWorkflow.ActionLabel(a.Stage),
                SelfOverall = a.Stage >= Stage.Appraiser && wf.SeesSelfRatings(u, a) ? AppraisalRules.SelfOverall(a) : null,
                AppraiserOverall = wf.SeesAppraiserRatings(u, a) ? AppraisalRules.AppraiserOverall(a) : null,
                a.Updated,
            };
        }

        /// <summary>BR-06: ratings the viewer may not see yet are left out.</summary>
        public static object Detail(SeafarerAppraisal a, Actor u, AppraisalWorkflow wf)
        {
            var s = wf.Store;
            bool self = wf.SeesSelfRatings(u, a), appr = wf.SeesAppraiserRatings(u, a);
            var ids = new[] { a.SeafarerId, wf.AppraiserOf(a), wf.ReviewerOf(a), wf.ActorFor(a), Roles.CrewingManager }.Concat(a.History.Select(h => h.By)).Where(x => x != null).Distinct();
            return new
            {
                a.Id, a.SeafarerId, a.Year, a.RankCode, RankName = Ranks.Get(a.RankCode).Name, NextRank = Ranks.Get(a.RankCode).NextRank, a.Level, a.VesselId,
                VesselName = Endpoints.VesselName(s, a.VesselId), a.Stage,
                AppraiserId = wf.AppraiserOf(a), ReviewerId = wf.ReviewerOf(a), HasReviewer = wf.HasReviewer(a), WaitingOn = wf.ActorFor(a), YourTurn = wf.ActorFor(a) == u.Id,
                Names = ids.ToDictionary(id => id!, id => Endpoints.NameOf(s, id)),
                Goals = a.Goals.Select(g => new
                {
                    g.Id, g.Title, g.Category, g.Target, g.Weight,
                    SelfRating = self ? g.SelfRating : null, SelfNote = self ? g.SelfNote : null,
                    AppraiserRating = appr ? g.AppraiserRating : null, AppraiserNote = appr ? g.AppraiserNote : null,
                }).ToList(),
                SeesSelf = self, SeesAppraiser = appr,
                SelfSummary = self ? a.SelfSummary : null, Assessment = appr ? a.Assessment : null, a.Ack, Countersign = a.Reviewer, a.Office, a.History, a.Updated,
            };
        }
    }

    public sealed class ErrorMiddleware(RequestDelegate next, ILogger<ErrorMiddleware> log)
    {
        public async Task Invoke(HttpContext ctx)
        {
            try { await next(ctx); }
            catch (ValidationFailedException ex) { await Write(ctx, 422, "Some items still need attention.", ex.Errors); }
            catch (UnauthorizedAccessException) { await Write(ctx, 401, "Please sign in.", null); }
            catch (ForbiddenException ex) { await Write(ctx, 403, ex.Message, null); }
            catch (NotFoundException ex) { await Write(ctx, 404, ex.Message, null); }
            catch (DomainException ex) { await Write(ctx, 409, ex.Message, null); }
            catch (BadHttpRequestException ex) { await Write(ctx, 400, ex.Message, null); }
            catch (Exception ex) when (!ctx.Response.HasStarted) { log.LogError(ex, "Unhandled error"); await Write(ctx, 500, "Something went wrong on the server. Try again; if it keeps happening, tell the system administrator.", null); }
        }
        private static Task Write(HttpContext ctx, int status, string message, List<string>? errors)
        {
            ctx.Response.StatusCode = status;
            return ctx.Response.WriteAsJsonAsync(new { status, message, errors });
        }
    }
}
