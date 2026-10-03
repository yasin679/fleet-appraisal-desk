using System.Text.Json;
using Maritime.Appraisal.Api;
using Maritime.Appraisal.Api.Storage;
using Maritime.Appraisal.Domain;

// Dependency-free test runner: `dotnet run --project tests/Maritime.Appraisal.Tests`
// Each test is named after its Test Plan case (TC-xx) and business rule (BR-xx).
int passed = 0, failed = 0;
void Test(string name, Action body)
{
    try { body(); passed++; Console.WriteLine($"  PASS  {name}"); }
    catch (Exception ex) { failed++; Console.WriteLine($"  FAIL  {name}\n        {ex.GetType().Name}: {ex.Message}"); }
}
void Eq<T>(T expected, T actual, string what) { if (!Equals(expected, actual)) throw new Exception($"{what}: expected {expected}, got {actual}"); }
void True(bool c, string what) { if (!c) throw new Exception(what); }
void Rejects(Action a, string containing)
{
    try { a(); } catch (ValidationFailedException ex) { if (!ex.Errors.Any(e => e.Contains(containing))) throw new Exception($"Rejected, but not for '{containing}': {ex.Message}"); return; }
    throw new Exception($"Expected a validation failure containing '{containing}'");
}
void Throws<TEx>(Action a) where TEx : Exception { try { a(); } catch (TEx) { return; } catch (Exception ex) { throw new Exception($"Expected {typeof(TEx).Name}, got {ex.GetType().Name}: {ex.Message}"); } throw new Exception($"Expected {typeof(TEx).Name}"); }

var office = new Actor(Roles.CrewingManager, "Farah Khan");
var msupt = new Actor(Roles.MarineSupt, "Capt. Neil Fernandes");
var tsupt = new Actor(Roles.TechnicalSupt, "Priya Nair");
var settings = new AppraisalSettings();

(InMemoryStore s, MovableClock c, AppraisalWorkflow wf) Fresh()
{
    var s = InMemoryStore.Empty();
    foreach (var (r, n) in new[] { ("MST", "Capt. Arvind Rao"), ("CO", "Rahul Mehta"), ("2O", "Joseph Santos"), ("CE", "Marko Horvat"), ("ETO", "Ivan Bondar"), ("AB", "Budi Kusuma"), ("CCK", "Noel Bautista"), ("MSM", "Kyaw Htun") })
        s.Seafarers.Add(new Seafarer { Id = $"V1-{r}", Name = n, RankCode = r, VesselId = "V1" });
    s.Seafarers.Add(new Seafarer { Id = "V2-CO", Name = "Suresh Iyer", RankCode = "CO", VesselId = "V2" });
    var c = new MovableClock(new DateOnly(2026, 1, 2));
    var wf = new AppraisalWorkflow(s, settings, c);
    wf.OpenYear(office, 2026);
    return (s, c, wf);
}
Actor P(InMemoryStore s, string id) => new(id, s.Seafarers.First(x => x.Id == id).Name);
Actor Who(InMemoryStore s, string id) => Roles.IsOffice(id) ? new Actor(id, id) : P(s, id);
List<RatingInput> Rate(SeafarerAppraisal a, Func<Goal, int> r, string note = "Evidence: see log book.") => a.Goals.Select(g => new RatingInput(g.Id, r(g), note)).ToList();
AppraiserAssessment Assess(RehireRecommendation rh = RehireRecommendation.Recommended, PromotionReadiness pr = PromotionReadiness.NotYetReady, params string[] training) =>
    new() { Strengths = "Calm on watch.", Improvements = "Close audit items sooner.", Rehire = rh, Promotion = pr, Training = training.ToList() };
/// <summary>Moves one appraisal to the given step the normal way, every goal rated the same.</summary>
SeafarerAppraisal To(InMemoryStore s, AppraisalWorkflow wf, string sf, Stage stage, int rating = 4)
{
    var a = wf.Find(sf, 2026)!; var me = P(s, sf); var apA = Who(s, wf.AppraiserOf(a)!);
    if (stage == Stage.Goals) return a;
    wf.SubmitGoals(me, a.Id); if (stage == Stage.GoalsReview) return a;
    wf.AgreeGoals(apA, a.Id); if (stage == Stage.Self) return a;
    wf.SaveSelf(me, a.Id, Rate(a, _ => rating), new SelfSummary { Achievements = "Clean audits." }); wf.SubmitSelf(me, a.Id); if (stage == Stage.Appraiser) return a;
    var next = Ranks.Get(a.RankCode).NextRank;
    wf.SaveEvaluation(apA, a.Id, Rate(a, _ => rating), Assess(rating < 3 ? RehireRecommendation.WithReservations : RehireRecommendation.Recommended,
        next == null ? PromotionReadiness.NotApplicable : PromotionReadiness.NotYetReady, rating <= 2 ? ["Maritime English"] : []));
    wf.SubmitEvaluation(apA, a.Id); if (stage == Stage.Ack) return a;
    wf.Acknowledge(me, a.Id, true, null); if (stage == a.Stage) return a;
    if (a.Stage == Stage.Reviewer) wf.Countersign(Who(s, wf.ReviewerOf(a)!), a.Id, "Fair.");
    if (stage == Stage.Office) return a;
    wf.Approve(office, a.Id, new OfficeDecision { Decision = OfficeDecisionKind.Approved });
    return a;
}

Console.WriteLine("Levels, approval chain and year opening");
Test("TC-01 BR-01/BR-10 rank maps to level and approval chain", () =>
{
    foreach (var r in new[] { "MST", "CO", "2O", "3O", "CE", "2E", "3E", "4E", "ETO" }) Eq(Level.Officer, Ranks.LevelOf(r), r);
    foreach (var r in new[] { "DCD", "BSN", "AB", "OS", "FTR", "OLR", "CCK", "MSM" }) Eq(Level.NonOfficer, Ranks.LevelOf(r), r);
    var (_, _, wf) = Fresh();
    SeafarerAppraisal F(string id) => wf.Find(id, 2026)!;
    Eq("MSUPT", wf.AppraiserOf(F("V1-MST")), "Master appraised by"); Eq(null, wf.ReviewerOf(F("V1-MST")), "Master countersign");
    Eq("V1-MST", wf.AppraiserOf(F("V1-CO")), "C/O appraised by"); Eq("MSUPT", wf.ReviewerOf(F("V1-CO")), "C/O countersigned by");
    Eq("TSUPT", wf.ReviewerOf(F("V1-CE")), "C/E countersigned by");
    Eq("V1-CO", wf.AppraiserOf(F("V1-2O")), "2/O appraised by"); Eq("V1-MST", wf.ReviewerOf(F("V1-2O")), "2/O countersigned by");
    Eq("V1-CE", wf.AppraiserOf(F("V1-ETO")), "ETO appraised by");
    Eq("V1-CCK", wf.AppraiserOf(F("V1-MSM")), "Messman appraised by"); Eq(null, wf.ReviewerOf(F("V1-CCK")), "Chief Cook countersign");
    Eq("2O", Ranks.Parse("2/O"), "abbreviation"); Eq("CE", Ranks.Parse("chief engineer"), "name"); Eq(null, Ranks.Parse("XX"), "unknown");
});
Test("TC-02 BR-02 one appraisal per seafarer per year, from the level template; joiners at sign-on", () =>
{
    var (s, _, wf) = Fresh();
    Eq(9, s.Appraisals.Count, "opened"); Eq(0, wf.OpenYear(office, 2026), "second run opens none");
    Eq(5, wf.Find("V1-2O", 2026)!.Goals.Count, "officer template"); Eq(4, wf.Find("V1-AB", 2026)!.Goals.Count, "non-officer template");
    Eq(Stage.Goals, wf.Find("V1-AB", 2026)!.Stage, "starts at goal setting");
    s.Seafarers.Add(new Seafarer { Id = "V1-OS", Name = "New Joiner", RankCode = "OS", VesselId = "V1" });
    Eq("A2026-V1-OS", wf.OpenForJoiner(office, "V1-OS", 2026).Id, "joiner");
    Throws<ForbiddenException>(() => wf.OpenYear(P(s, "V1-CO"), 2027));
});

Console.WriteLine("Goals");
Test("TC-03 BR-03 goal rules: 3–6, total 100, each ≥10, one Safety ≥20, title and target", () =>
{
    var (s, _, wf) = Fresh(); var me = P(s, "V1-AB"); var a = wf.Find("V1-AB", 2026)!;
    GoalInput G(string t, GoalCategory c, int w, string target = "Measured target") => new(null, t, c, target, w);
    wf.SaveGoals(me, a.Id, [G("Safe", GoalCategory.Safety, 50), G("Work", GoalCategory.Operations, 50)]); Rejects(() => wf.SubmitGoals(me, a.Id), "3 to 6 goals");
    wf.SaveGoals(me, a.Id, [G("Safe", GoalCategory.Safety, 30), G("Work", GoalCategory.Operations, 30), G("Learn", GoalCategory.Development, 30)]); Rejects(() => wf.SubmitGoals(me, a.Id), "add up to 100%");
    wf.SaveGoals(me, a.Id, [G("Safe", GoalCategory.Safety, 45), G("Work", GoalCategory.Operations, 50), G("Learn", GoalCategory.Development, 5)]); Rejects(() => wf.SubmitGoals(me, a.Id), "at least 10%");
    wf.SaveGoals(me, a.Id, [G("Safe", GoalCategory.Safety, 40), G("Safe 2", GoalCategory.Safety, 40), G("Learn", GoalCategory.Development, 20)]); Rejects(() => wf.SubmitGoals(me, a.Id), "Exactly one Safety");
    wf.SaveGoals(me, a.Id, [G("Safe", GoalCategory.Safety, 15), G("Work", GoalCategory.Operations, 65), G("Learn", GoalCategory.Development, 20)]); Rejects(() => wf.SubmitGoals(me, a.Id), "Safety goal needs at least 20%");
    wf.SaveGoals(me, a.Id, [G("Safe", GoalCategory.Safety, 30), G("Work", GoalCategory.Operations, 50, " "), G("Learn", GoalCategory.Development, 20)]); Rejects(() => wf.SubmitGoals(me, a.Id), "title and a measurable target");
    Rejects(() => wf.SaveGoals(me, a.Id, Enumerable.Range(0, 7).Select(i => G("x" + i, GoalCategory.Operations, 10)).ToList()), "3 to 6 goals");
    wf.SaveGoals(me, a.Id, [G("Safe", GoalCategory.Safety, 30), G("Work", GoalCategory.Operations, 30), G("Speak up", GoalCategory.Teamwork, 20), G("Learn", GoalCategory.Development, 20)]);
    wf.SubmitGoals(me, a.Id); Eq(Stage.GoalsReview, a.Stage, "submitted");
});
Test("TC-04 BR-04/BR-14 appraiser agrees, or returns with a remark; can also agree straight from goal setting", () =>
{
    var (s, _, wf) = Fresh(); var co = P(s, "V1-CO");
    var a = To(s, wf, "V1-AB", Stage.GoalsReview);
    Rejects(() => wf.ReturnGoals(co, a.Id, " "), "BR-14");
    wf.ReturnGoals(co, a.Id, "Add a mooring safety goal."); Eq(Stage.Goals, a.Stage, "back to the seafarer");
    wf.SubmitGoals(P(s, "V1-AB"), a.Id); wf.AgreeGoals(co, a.Id); Eq(Stage.Self, a.Stage, "agreed");
    var b = wf.Find("V1-2O", 2026)!; wf.AgreeGoals(co, b.Id); Eq(Stage.Self, b.Stage, "agreed directly from goal setting");
});
Test("TC-05 BR-15 only the seafarer and appraiser edit goals; agreed goals are locked", () =>
{
    var (s, _, wf) = Fresh(); var a = wf.Find("V1-AB", 2026)!;
    var goals = a.Goals.Select(g => new GoalInput(g.Id, g.Title, g.Category, g.Target, g.Weight)).ToList();
    wf.SaveGoals(P(s, "V1-CO"), a.Id, goals);
    Throws<ForbiddenException>(() => wf.SaveGoals(P(s, "V1-2O"), a.Id, goals));
    Throws<ForbiddenException>(() => wf.AgreeGoals(P(s, "V1-MST"), a.Id));
    To(s, wf, "V1-2O", Stage.Self);
    Throws<DomainException>(() => wf.SaveGoals(P(s, "V1-CO"), "A2026-V1-2O", goals));
});

Console.WriteLine("Self-evaluation and appraiser evaluation");
Test("TC-06 BR-05 every goal rated 1–5; a note for 1, 2 or 5; key achievements", () =>
{
    var (s, _, wf) = Fresh(); var me = P(s, "V1-2O"); var a = To(s, wf, "V1-2O", Stage.Self);
    Rejects(() => wf.SubmitSelf(me, a.Id), "Rate 'Lead safe operations");
    wf.SaveSelf(me, a.Id, Rate(a, g => g.Category == GoalCategory.Safety ? 5 : 4, ""), null); Rejects(() => wf.SubmitSelf(me, a.Id), "Explain your rating of 5");
    Rejects(() => wf.SaveSelf(me, a.Id, [new RatingInput(a.Goals[0].Id, 6, "x")], null), "1 to 5");
    wf.SaveSelf(me, a.Id, Rate(a, g => g.Category == GoalCategory.Safety ? 5 : 4, "Led every drill."), null); Rejects(() => wf.SubmitSelf(me, a.Id), "key achievements");
    wf.SaveSelf(me, a.Id, [], new SelfSummary { Achievements = "Clean passage plan audits." });
    wf.SubmitSelf(me, a.Id); Eq(Stage.Appraiser, a.Stage, "submitted"); Eq(4.25m, AppraisalRules.SelfOverall(a), "self overall (25×5 + 75×4)/100");
});
Test("TC-07 BR-06 self ratings hidden from the appraiser until submitted; appraiser ratings hidden from the seafarer until submitted", () =>
{
    var (s, _, wf) = Fresh(); var me = P(s, "V1-2O"); var co = P(s, "V1-CO"); var a = To(s, wf, "V1-2O", Stage.Self);
    wf.SaveSelf(me, a.Id, Rate(a, _ => 4), null);
    True(wf.SeesSelfRatings(me, a), "seafarer sees own draft"); True(!wf.SeesSelfRatings(co, a), "appraiser can't see draft self ratings");
    wf.SaveSelf(me, a.Id, [], new SelfSummary { Achievements = "x" }); wf.SubmitSelf(me, a.Id);
    True(wf.SeesSelfRatings(co, a), "appraiser sees submitted self ratings");
    wf.SaveEvaluation(co, a.Id, Rate(a, _ => 3), null);
    True(wf.SeesAppraiserRatings(co, a), "appraiser sees own draft"); True(!wf.SeesAppraiserRatings(me, a), "seafarer can't see draft");
    True(!wf.SeesAppraiserRatings(P(s, "V1-MST"), a), "Master can't see draft");
});
Test("TC-08 BR-07 every goal rated with evidence for 1, 2 or 5; strengths, improvements, re-hire and promotion", () =>
{
    var (s, _, wf) = Fresh(); var co = P(s, "V1-CO"); var a = To(s, wf, "V1-2O", Stage.Appraiser);
    Rejects(() => wf.SubmitEvaluation(co, a.Id), "Rate 'Clean inspections'");
    wf.SaveEvaluation(co, a.Id, Rate(a, g => g.Category == GoalCategory.Compliance ? 2 : 4, ""), new AppraiserAssessment());
    var errs = AppraisalRules.AppraiserErrors(a, settings);
    True(errs.Any(e => e.Contains("evidence for the rating of 2")), "evidence"); True(errs.Any(e => e.Contains("strengths")), "strengths");
    True(errs.Any(e => e.Contains("re-hire")), "re-hire"); True(errs.Any(e => e.Contains("promotion readiness")), "promotion");
    wf.SaveEvaluation(co, a.Id, Rate(a, g => g.Category == GoalCategory.Compliance ? 2 : 4), Assess(training: "ECDIS type-specific"));
    wf.SubmitEvaluation(co, a.Id); Eq(Stage.Ack, a.Stage, "submitted"); Eq(3.60m, AppraisalRules.AppraiserOverall(a), "overall (25×4 + 20×2 + 20×4 + 15×4 + 20×4)/100");
});
Test("TC-09 BR-08 recommendation rules", () =>
{
    var (s, _, wf) = Fresh(); var co = P(s, "V1-CO"); var a = To(s, wf, "V1-2O", Stage.Appraiser);
    wf.SaveEvaluation(co, a.Id, Rate(a, _ => 2), Assess(training: "Maritime English"));
    Rejects(() => wf.SubmitEvaluation(co, a.Id), "'Recommended' needs an overall of 2.50");
    wf.SaveEvaluation(co, a.Id, Rate(a, g => g.Category == GoalCategory.Safety ? 2 : 4), Assess(training: "Behavioural safety workshop"));
    Rejects(() => wf.SubmitEvaluation(co, a.Id), "Safety 3 or more");
    wf.SaveEvaluation(co, a.Id, Rate(a, _ => 3), Assess(RehireRecommendation.Recommended, PromotionReadiness.ReadyNow));
    Rejects(() => wf.SubmitEvaluation(co, a.Id), "'Ready now' needs 3.50");
    wf.SaveEvaluation(co, a.Id, Rate(a, g => g.Category == GoalCategory.Safety ? 3 : 5), Assess(RehireRecommendation.Recommended, PromotionReadiness.ReadyNow));
    Rejects(() => wf.SubmitEvaluation(co, a.Id), "Safety 4 or 5");
    wf.SaveEvaluation(co, a.Id, Rate(a, g => g.Category == GoalCategory.Teamwork ? 2 : 4), Assess());
    Rejects(() => wf.SubmitEvaluation(co, a.Id), "Choose training");
    var e = To(s, wf, "V1-ETO", Stage.Appraiser); var ce = P(s, "V1-CE");
    wf.SaveEvaluation(ce, e.Id, Rate(e, _ => 5), Assess(pr: PromotionReadiness.ReadyNow));
    Rejects(() => wf.SubmitEvaluation(ce, e.Id), "no next rank");
    wf.SaveEvaluation(ce, e.Id, Rate(e, _ => 5), Assess(pr: PromotionReadiness.NotApplicable)); wf.SubmitEvaluation(ce, e.Id);
    wf.SaveEvaluation(co, a.Id, Rate(a, _ => 4), Assess(pr: PromotionReadiness.ReadyNow)); wf.SubmitEvaluation(co, a.Id);
    Eq(Stage.Ack, a.Stage, "valid evaluation accepted");
});
Test("TC-10 BR-07/BR-14 appraiser returns the self-evaluation with a remark", () =>
{
    var (s, _, wf) = Fresh(); var a = To(s, wf, "V1-2O", Stage.Appraiser);
    Rejects(() => wf.ReturnToSeafarer(P(s, "V1-CO"), a.Id, ""), "BR-14");
    wf.ReturnToSeafarer(P(s, "V1-CO"), a.Id, "Add evidence for the drills."); Eq(Stage.Self, a.Stage, "back to self-evaluation");
});

Console.WriteLine("Acknowledgement, countersign and office approval");
Test("TC-11 BR-09 disagreeing needs a comment; agreeing or disagreeing moves to countersign", () =>
{
    var (s, _, wf) = Fresh(); var me = P(s, "V1-2O"); var a = To(s, wf, "V1-2O", Stage.Ack);
    Rejects(() => wf.Acknowledge(me, a.Id, false, " "), "BR-09");
    wf.Acknowledge(me, a.Id, false, "The Safety rating misses the drills I led."); Eq(Stage.Reviewer, a.Stage, "to countersign");
    True(a.History.Last().Action.Contains("disagreed"), "disagreement on record");
});
Test("TC-12 BR-10/BR-11 countersign by the Master or a superintendent; no countersign step for the Chief Cook", () =>
{
    var (s, _, wf) = Fresh();
    var a = To(s, wf, "V1-2O", Stage.Reviewer); Throws<ForbiddenException>(() => wf.Countersign(P(s, "V1-CO"), a.Id, null));
    wf.Countersign(P(s, "V1-MST"), a.Id, null); Eq(Stage.Office, a.Stage, "2/O countersigned by Master");
    var co = To(s, wf, "V1-CO", Stage.Reviewer); wf.Countersign(msupt, co.Id, "Fair."); Eq(Stage.Office, co.Stage, "C/O countersigned by Marine Superintendent");
    var ce = To(s, wf, "V1-CE", Stage.Reviewer); Throws<ForbiddenException>(() => wf.Countersign(msupt, ce.Id, null)); wf.Countersign(tsupt, ce.Id, null);
    var ck = To(s, wf, "V1-CCK", Stage.Ack); wf.Acknowledge(P(s, "V1-CCK"), ck.Id, true, null); Eq(Stage.Office, ck.Stage, "Chief Cook goes straight to the office");
    var m = To(s, wf, "V1-MST", Stage.Ack); Eq("MSUPT", m.History.First(h => h.Action == "Submitted appraiser evaluation").By, "Master rated by Marine Superintendent");
    var ms = To(s, wf, "V1-MSM", Stage.Ack); Eq("V1-CCK", ms.History.First(h => h.Action == "Submitted appraiser evaluation").By, "Messman rated by Chief Cook");
});
Test("TC-13 BR-11/BR-14 countersigner or office sends it back to the appraiser; the seafarer acknowledges again", () =>
{
    var (s, _, wf) = Fresh(); var a = To(s, wf, "V1-2O", Stage.Reviewer);
    Rejects(() => wf.ReturnToAppraiser(P(s, "V1-MST"), a.Id, ""), "BR-14");
    wf.ReturnToAppraiser(P(s, "V1-MST"), a.Id, "Ratings of 5 need evidence."); Eq(Stage.Appraiser, a.Stage, "back to appraiser"); Eq(null, a.Ack, "acknowledgement cleared");
    wf.SubmitEvaluation(P(s, "V1-CO"), a.Id); wf.Acknowledge(P(s, "V1-2O"), a.Id, true, null); wf.Countersign(P(s, "V1-MST"), a.Id, null);
    Throws<ForbiddenException>(() => wf.ReturnToAppraiser(P(s, "V1-MST"), a.Id, "x"));
    wf.ReturnToAppraiser(office, a.Id, "Check training."); Eq(Stage.Appraiser, a.Stage, "office return");
});
Test("TC-14 BR-12 office decision rules and crew record update", () =>
{
    var (s, _, wf) = Fresh(); var a = To(s, wf, "V1-AB", Stage.Office, rating: 2);
    Rejects(() => wf.Approve(office, a.Id, new OfficeDecision()), "Choose a re-hire decision");
    Rejects(() => wf.Approve(office, a.Id, new OfficeDecision { Decision = OfficeDecisionKind.Approved }), "'Approved' needs an overall of 2.50");
    Rejects(() => wf.Approve(office, a.Id, new OfficeDecision { Decision = OfficeDecisionKind.NotForRehire }), "remarks");
    wf.Approve(office, a.Id, new OfficeDecision { Decision = OfficeDecisionKind.ApprovedWithReservations, Training = ["Maritime English"] });
    Eq(Stage.Done, a.Stage, "closed"); Eq("ApprovedWithReservations", s.Seafarers.First(x => x.Id == "V1-AB").RehireStatus, "re-hire status");
    True(s.Seafarers.First(x => x.Id == "V1-AB").TrainingAssigned.Contains("Maritime English"), "training on crew record");
    var b = To(s, wf, "V1-2O", Stage.Office, rating: 5);
    wf.Approve(office, b.Id, new OfficeDecision { Decision = OfficeDecisionKind.Approved, PromotionApproved = true });
    Eq("CO", s.Seafarers.First(x => x.Id == "V1-2O").PromotionApprovedTo, "promotion to C/O recorded");
    var e = To(s, wf, "V1-ETO", Stage.Office);
    Rejects(() => wf.Approve(office, e.Id, new OfficeDecision { Decision = OfficeDecisionKind.Approved, PromotionApproved = true }), "no next rank");
});
Test("TC-15 BR-13 weighted overall and bands", () =>
{
    Goal G(int w, int? r) => new() { Id = "x", Title = "t", Target = "t", Weight = w, AppraiserRating = r };
    Eq(3.60m, AppraisalRules.Overall([G(25, 4), G(20, 2), G(20, 4), G(15, 4), G(20, 4)], g => g.AppraiserRating), "weighted");
    Eq(4.00m, AppraisalRules.Overall([G(60, 4), G(40, null)], g => g.AppraiserRating), "unrated goal left out");
    Eq("Outstanding", AppraisalRules.Band(4.5m), "4.50"); Eq("Exceeds expectations", AppraisalRules.Band(4.49m), "4.49");
    Eq("Exceeds expectations", AppraisalRules.Band(3.5m), "3.50"); Eq("Meets expectations", AppraisalRules.Band(2.5m), "2.50");
    Eq("Needs improvement", AppraisalRules.Band(2.49m), "2.49"); Eq("Unsatisfactory", AppraisalRules.Band(1.49m), "1.49");
});
Test("TC-16 BR-15 only the person whose step it is can act; the wrong step is refused", () =>
{
    var (s, _, wf) = Fresh(); var a = To(s, wf, "V1-2O", Stage.Self);
    Throws<ForbiddenException>(() => wf.SaveSelf(P(s, "V1-CO"), a.Id, [], null));
    Throws<ForbiddenException>(() => wf.SubmitSelf(P(s, "V2-CO"), a.Id));
    Throws<DomainException>(() => wf.SubmitEvaluation(P(s, "V1-CO"), a.Id));
    var o = To(s, wf, "V1-AB", Stage.Office);
    Throws<ForbiddenException>(() => wf.Approve(msupt, o.Id, new OfficeDecision { Decision = OfficeDecisionKind.Approved }));
    Throws<NotFoundException>(() => wf.Get("A2026-NOPE"));
});

Console.WriteLine("Global comparison and benchmark data");
Test("TC-17 BR-16 percentile maths (Rahul Mehta, 2025)", () =>
{
    var fleet = new List<double> { 3.60, 3.35, 3.00, 2.70, 2.65, 2.20 };
    var others = Comparison.Others(fleet, 2.65);
    Eq(5, others.Count, "others"); Eq(20, Comparison.HigherThan(others, 2.65), "higher than 1 of the other 5");
    Eq(5, fleet.Count(v => v > 2.65) + 1, "fleet rank");
    Eq(50, Comparison.PercentileRank([3.0, 3.5, 4.0, 4.0], 3.75), "percentile rank");
    Eq(63, Comparison.PercentileRank([3.0, 3.5, 3.75, 4.0], 3.75), "ties count half: (2 + 0.5) / 4");
    Eq(3.25, Comparison.Quantile([3.0, 3.5], .5), "median interpolates"); Eq(3.1, Math.Round(Comparison.Quantile([3.0, 3.5, 4.0], .1)!.Value, 6), "10th percentile");
});
var demo = InMemoryStore.Demo();
var cmp = new Comparison(demo, settings);
Test("TC-18 BR-16 every comparison in the demo fleet matches an independent calculation (216 person-years)", () =>
{
    var exp = JsonDocument.Parse(File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "expected-comparison.json"))).RootElement;
    var n = 0;
    foreach (var e in exp.EnumerateArray())
    {
        var id = e.GetProperty("id").GetString()!; var yr = e.GetProperty("year").GetInt32();
        var r = cmp.Compare(id, yr); var tag = $"{id} {yr}";
        Eq(e.GetProperty("fleetRated").GetInt32(), r.FleetRated, tag + " fleet rated");
        n++;
        if (e.GetProperty("overall").ValueKind == JsonValueKind.Null) { Eq(null, r.Overall, tag + " no score"); continue; }
        Eq(e.GetProperty("overall").GetDecimal(), r.Overall, tag + " overall");
        Eq(e.GetProperty("fleetRank").GetInt32(), r.FleetRank, tag + " fleet rank");
        var ht = e.GetProperty("higherThan"); Eq(ht.ValueKind == JsonValueKind.Null ? null : ht.GetInt32(), r.HigherThanPctOfFleet, tag + " higher than");
        Eq(e.GetProperty("industryPercentile").GetInt32(), r.IndustryPercentile, tag + " industry percentile");
        Eq(e.GetProperty("industryOthers").GetInt32(), r.IndustryOthers, tag + " industry others");
    }
    Eq(216, n, "cases checked");
});
Test("TC-19 BR-16 score source: none before the appraiser submits; last year from closed results; small groups flagged", () =>
{
    Eq(null, cmp.Compare("V1-CO", 2026).Overall, "C/O still with the Master");
    Eq(2.65m, cmp.Compare("V1-CO", 2025).Overall, "2025 result");
    True(cmp.Compare("V1-2E", 2026).Overall != null, "2/E is at acknowledgement, so rated");
    True(cmp.Compare("V1-CO", 2026).SmallGroup, "only 2 Chief Officers rated in 2026");
    True(!cmp.Compare("V1-CO", 2025).SmallGroup, "6 in 2025");
    Eq(7, cmp.Compare("V1-2O", 2025).Distributions.Count, "our fleet + 5 companies + all");
});
Test("TC-20 BR-17 benchmark CSV: aliases, optional categories, row errors", () =>
{
    var r = BenchmarkCsv.Parse("company,rank,year,overall,safety\nPool Co,2O,2026,3.9,4\nPool Co,2/O,2026,3.1,\n\"Pool, Ltd\",Second Officer,2026,2.5,2\nBad,XX,2026,3,3\nBad,AB,1890,3,3\nBad,AB,2026,7,3\n,AB,2026,3,3\n");
    Eq(3, r.Rows.Count, "good rows"); Eq(4, r.Errors.Count, "bad rows"); Eq("Pool, Ltd", r.Rows[2].Company, "quoted comma");
    True(r.Rows.All(x => x.RankCode == "2O"), "aliases"); Eq(4m, r.Rows[0].Categories[GoalCategory.Safety], "category"); Eq(0, r.Rows[1].Categories.Count, "blank category skipped");
    var missing = BenchmarkCsv.Parse("company,rank\nx,2O");
    True(missing.Errors.Any(e => e.Contains("Column 'year' is missing")), "missing column reported"); Eq(0, missing.Rows.Count, "no rows");
});
Test("TC-21 BR-16 fleet against industry by rank", () =>
{
    var rows = cmp.FleetVsIndustry(2025);
    Eq(17, rows.Count, "every rank"); var co = rows.First(x => x.RankCode == "CO");
    Eq(6, co.OurRated, "Chief Officers"); Eq(2.85, Math.Round(co.OurMedian, 2), "median of 3.60, 3.35, 3.00, 2.70, 2.65, 2.20");
});

Console.WriteLine("Audit trail, demo data and walkthrough");
Test("TC-22 BR-18 every step is recorded with who and when", () =>
{
    var (s, c, wf) = Fresh(); c.Day = new DateOnly(2026, 9, 20); var a = To(s, wf, "V1-2O", Stage.Done);
    Eq("Appraisal opened for 2026,Submitted goals for agreement,Agreed goals,Submitted self-evaluation,Submitted appraiser evaluation,Acknowledged and agreed,Countersigned,Approved and closed",
        string.Join(",", a.History.Select(h => h.Action)), "history");
    Eq("V1-2O,V1-CO,V1-2O,V1-CO,V1-2O,V1-MST,CREWING", string.Join(",", a.History.Skip(1).Select(h => h.By)), "who");
    Eq(new DateOnly(2026, 9, 20), a.History.Last().On, "when");
});
Test("TC-23 demo data loads and every appraisal obeys the rules of the steps it has passed", () =>
{
    Eq(108, demo.Seafarers.Count, "seafarers"); Eq(108, demo.Appraisals.Count, "appraisals"); Eq(108, demo.PriorResults.Count, "2025 results"); Eq(4104, demo.Benchmark.Count, "benchmark rows");
    True(demo.BenchmarkSource.IsSample, "sample flagged");
    foreach (var a in demo.Appraisals)
    {
        if (a.Stage >= Stage.GoalsReview) Eq(0, AppraisalRules.GoalErrors(a.Goals, settings).Count, a.Id + " goals");
        if (a.Stage >= Stage.Appraiser) Eq("", string.Join(" ", AppraisalRules.SelfErrors(a)), a.Id + " self");
        if (a.Stage >= Stage.Ack) Eq("", string.Join(" ", AppraisalRules.AppraiserErrors(a, settings)), a.Id + " evaluation");
        if (a.Stage > Stage.Ack) { True(a.Ack != null, a.Id + " acknowledged"); Eq("", string.Join(" ", AppraisalRules.AckErrors(a.Ack!)), a.Id + " acknowledgement"); }
    }
    True(demo.Appraisals.Count(a => a.Ack is { Agrees: true }) > demo.Appraisals.Count(a => a.Ack is { Agrees: false }), "most acknowledgements agree");
});
Test("TC-24 UAT-01 walkthrough on the demo fleet: Joseph Santos from self-evaluation to closed", () =>
{
    var s = InMemoryStore.Demo(); var wf = new AppraisalWorkflow(s, settings, new MovableClock(new DateOnly(2026, 10, 3)));
    var a = wf.Get("A2026-V1-2O"); Eq(Stage.Self, a.Stage, "starts at self-evaluation");
    Actor J = new("V1-2O", "Joseph Santos"), R = new("V1-CO", "Rahul Mehta"), M = new("V1-MST", "Capt. Arvind Rao");
    Eq(2, wf.Worklist(R, 2026).Count(), "Rahul's worklist: 3/O to evaluate, OS goals to agree");
    wf.SaveSelf(J, a.Id, a.Goals.Select((g, i) => new RatingInput(g.Id, i == 0 ? 5 : 4, i == 0 ? "Led every drill." : "")).ToList(), new SelfSummary { Achievements = "Clean audits." });
    wf.SubmitSelf(J, a.Id);
    wf.SaveEvaluation(R, a.Id, a.Goals.Select((g, i) => new RatingInput(g.Id, i == 1 ? 2 : 4, i == 1 ? "Two late items at audit." : "")).ToList(), Assess(pr: PromotionReadiness.ReadyNextYear, training: "ECDIS type-specific"));
    wf.SubmitEvaluation(R, a.Id); wf.Acknowledge(J, a.Id, true, null); wf.Countersign(M, a.Id, null);
    wf.Approve(office, a.Id, new OfficeDecision { Decision = OfficeDecisionKind.Approved, Training = ["ECDIS type-specific"] });
    Eq(Stage.Done, a.Stage, "closed"); Eq(3.60m, AppraisalRules.AppraiserOverall(a), "appraiser"); Eq(4.25m, AppraisalRules.SelfOverall(a), "self");
    var c = new Comparison(s, settings).Compare("V1-2O", 2026);
    Eq(1, c.FleetRank, "1st of 2 Second Officers"); Eq(2, c.FleetRated, "of 2");
    var pool = s.Benchmark.Where(b => b.RankCode == "2O" && b.Year == 2026).Select(b => (double)b.Overall).Append(3.50).ToList();
    Eq((int)Math.Round((pool.Count(v => v < 3.6) + pool.Count(v => v == 3.6) / 2.0) / pool.Count * 100, MidpointRounding.AwayFromZero), c.IndustryPercentile, "industry percentile against the other Second Officers");
});

// ---------- v2.1: SQLite storage and sign-in ----------
string TempDb() => Path.Combine(Path.GetTempPath(), $"fad-test-{Guid.NewGuid():N}.db");
void Drop(string p) { foreach (var f in new[] { p, p + "-wal", p + "-shm" }) if (File.Exists(f)) File.Delete(f); }

Test("TC-25 SQLite: a new database is created and seeded with the demo fleet", () =>
{
    var p = TempDb();
    try
    {
        using (var s = new SqliteStore(p)) { Eq(true, s.Initialise(), "empty on first open"); s.ReplaceAllWith(InMemoryStore.Demo()); }
        using (var s = new SqliteStore(p))
        {
            Eq(false, s.Initialise(), "not empty on second open"); s.Load();
            var demo = InMemoryStore.Demo();
            Eq(demo.Appraisals.Count, s.Appraisals.Count, "appraisals"); Eq(demo.Seafarers.Count, s.Seafarers.Count, "seafarers");
            Eq(demo.Benchmark.Count, s.Benchmark.Count, "benchmark rows"); Eq(demo.PriorResults.Count, s.PriorResults.Count, "prior results");
        }
    }
    finally { Drop(p); }
});

Test("TC-26 SQLite: workflow changes survive a restart", () =>
{
    var p = TempDb();
    try
    {
        using (var s = new SqliteStore(p))
        {
            s.Initialise(); s.ReplaceAllWith(InMemoryStore.Demo());
            var wf = new AppraisalWorkflow(s, settings, new MovableClock(new DateOnly(2026, 10, 3)));
            var a = wf.Get("A2026-V1-2O"); var J = new Actor("V1-2O", "Joseph Santos");
            wf.SaveSelf(J, a.Id, a.Goals.Select(g => new RatingInput(g.Id, 4, "")).ToList(), new SelfSummary { Achievements = "Clean audits." });
            wf.SubmitSelf(J, a.Id); s.SaveChanges();
        }
        using (var s = new SqliteStore(p))
        {
            s.Initialise(); s.Load();
            var a = s.Appraisals.Single(x => x.Id == "A2026-V1-2O");
            Eq(Stage.Appraiser, a.Stage, "stage after reopen"); Eq(4.00m, AppraisalRules.SelfOverall(a), "self overall after reopen");
            Eq("Clean audits.", a.SelfSummary?.Achievements, "summary after reopen");
        }
    }
    finally { Drop(p); }
});

Test("TC-27 Sign-in: passwords are salted PBKDF2 hashes and are checked correctly", () =>
{
    var p = TempDb();
    try
    {
        using var s = new SqliteStore(p); s.Initialise(); s.ReplaceAllWith(InMemoryStore.Demo());
        var n = s.SeedPasswords("demo", false);
        Eq(true, n > 0, "accounts seeded"); Eq(0, s.SeedPasswords("other", false), "seeding never overwrites existing passwords");
        Eq(true, s.CheckPassword("V1-2O", "demo").Ok, "right password"); Eq(false, s.CheckPassword("V1-2O", "Demo").Ok, "case-sensitive");
        Eq(false, s.CheckPassword("NOBODY", "demo").Ok, "unknown user");
        var salt = new byte[16]; Eq(false, SqliteStore.Hash("demo", salt).SequenceEqual(SqliteStore.Hash("demo", new byte[] { 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16 })), "salt changes the hash");
    }
    finally { Drop(p); }
});

Test("TC-28 Sign-in: changing a password replaces the old one", () =>
{
    var p = TempDb();
    try
    {
        using var s = new SqliteStore(p); s.Initialise(); s.ReplaceAllWith(InMemoryStore.Demo()); s.SeedPasswords("demo", true);
        Eq(true, s.CheckPassword("CREWING", "demo").MustChange, "must change after seeding");
        s.SetPassword("CREWING", "Harbour-Light-42", false);
        Eq(false, s.CheckPassword("CREWING", "demo").Ok, "old password refused");
        var r = s.CheckPassword("CREWING", "Harbour-Light-42"); Eq(true, r.Ok, "new password accepted"); Eq(false, r.MustChange, "flag cleared");
    }
    finally { Drop(p); }
});

Console.WriteLine($"\n{passed} passed, {failed} failed");
return failed == 0 ? 0 : 1;
