namespace Maritime.Appraisal.Domain;

public sealed record Actor(string Id, string Name);
public sealed record GoalInput(string? Id, string Title, GoalCategory Category, string Target, int Weight);
public sealed record RatingInput(string GoalId, int? Rating, string? Note);
public sealed record WorkItem(SeafarerAppraisal Appraisal, string Action);

public interface IAppraisalStore
{
    IList<Vessel> Vessels { get; }
    IList<Seafarer> Seafarers { get; }
    IList<ShoreUser> ShoreUsers { get; }
    IList<SeafarerAppraisal> Appraisals { get; }
    IList<PriorResult> PriorResults { get; }
    IList<BenchmarkRating> Benchmark { get; }
    BenchmarkSource BenchmarkSource { get; set; }
    void SaveChanges();
}

/// <summary>All commands and queries for the appraisal workflow (Workflow Document; BR-02 to BR-15, BR-18).</summary>
public sealed class AppraisalWorkflow(IAppraisalStore store, AppraisalSettings s, TimeProvider clock)
{
    public DateOnly Today => DateOnly.FromDateTime(clock.GetUtcNow().UtcDateTime);
    public AppraisalSettings Settings => s;
    public IAppraisalStore Store => store;

    // ======================= Queries =======================
    public SeafarerAppraisal Get(string id) => store.Appraisals.FirstOrDefault(a => a.Id == id) ?? throw new NotFoundException($"Appraisal {id} not found.");
    public SeafarerAppraisal? Find(string seafarerId, int year) => store.Appraisals.FirstOrDefault(a => a.SeafarerId == seafarerId && a.Year == year);
    public Seafarer Seafarer(string id) => store.Seafarers.FirstOrDefault(x => x.Id == id) ?? throw new NotFoundException($"Seafarer {id} not found.");

    /// <summary>BR-10/BR-18: an office role stays as is; an onboard rank resolves to whoever holds it on the vessel.</summary>
    public string? Resolve(string? role, string vesselId)
    {
        if (role == null) return null;
        if (Roles.IsOffice(role)) return role;
        return store.Seafarers.FirstOrDefault(x => x.VesselId == vesselId && x.RankCode == role)?.Id;
    }
    public string? AppraiserOf(SeafarerAppraisal a) => Resolve(Ranks.Get(a.RankCode).Appraiser, a.VesselId);
    public string? ReviewerOf(SeafarerAppraisal a) => Resolve(Ranks.Get(a.RankCode).Reviewer, a.VesselId);
    public bool HasReviewer(SeafarerAppraisal a) => Ranks.Get(a.RankCode).Reviewer != null;

    public string? ActorFor(SeafarerAppraisal a) => a.Stage switch
    {
        Stage.Goals or Stage.Self or Stage.Ack => a.SeafarerId,
        Stage.GoalsReview or Stage.Appraiser => AppraiserOf(a),
        Stage.Reviewer => ReviewerOf(a),
        Stage.Office => Roles.CrewingManager,
        _ => null,
    };

    public bool CanView(Actor u, SeafarerAppraisal a) =>
        Roles.IsOffice(u.Id) || u.Id == a.SeafarerId || u.Id == AppraiserOf(a) || u.Id == ReviewerOf(a) || u.Id == Resolve("MST", a.VesselId);

    /// <summary>The team, vessel-crew or fleet list a user sees.</summary>
    public bool InScope(Actor u, SeafarerAppraisal a)
    {
        if (Roles.IsOffice(u.Id)) return true;
        if (a.SeafarerId == u.Id) return false;
        if (store.Seafarers.FirstOrDefault(x => x.Id == u.Id) is { RankCode: "MST" } m) return a.VesselId == m.VesselId;
        return u.Id == AppraiserOf(a) || u.Id == ReviewerOf(a);
    }

    /// <summary>BR-06: what each person may see of the ratings.</summary>
    public bool SeesSelfRatings(Actor u, SeafarerAppraisal a) => u.Id == a.SeafarerId || a.Stage >= Stage.Appraiser;
    public bool SeesAppraiserRatings(Actor u, SeafarerAppraisal a) => a.Stage >= Stage.Ack || (a.Stage == Stage.Appraiser && u.Id == AppraiserOf(a));

    public static string ActionLabel(Stage st) => st switch
    {
        Stage.Goals => "Set goals", Stage.GoalsReview => "Agree goals", Stage.Self => "Complete self-evaluation", Stage.Appraiser => "Evaluate",
        Stage.Ack => "Read and acknowledge", Stage.Reviewer => "Countersign", Stage.Office => "Approve and close", _ => "Open",
    };
    public IEnumerable<WorkItem> Worklist(Actor u, int year) =>
        store.Appraisals.Where(a => a.Year == year && ActorFor(a) == u.Id).Select(a => new WorkItem(a, ActionLabel(a.Stage)));

    // ======================= BR-02 year opening =======================
    public int OpenYear(Actor by, int year)
    {
        RequireOffice(by);
        var n = 0;
        foreach (var sf in store.Seafarers) if (Find(sf.Id, year) == null) { Create(by, sf, year); n++; }
        if (n > 0) store.SaveChanges();
        return n;
    }
    /// <summary>BR-02: a joiner gets an appraisal at first sign-on in the year.</summary>
    public SeafarerAppraisal OpenForJoiner(Actor by, string seafarerId, int year)
    {
        RequireOffice(by);
        var sf = Seafarer(seafarerId);
        var a = Find(sf.Id, year) ?? Create(by, sf, year);
        store.SaveChanges();
        return a;
    }
    private SeafarerAppraisal Create(Actor by, Seafarer sf, int year)
    {
        var a = new SeafarerAppraisal
        {
            Id = $"A{year}-{sf.Id}", SeafarerId = sf.Id, Year = year, RankCode = sf.RankCode, VesselId = sf.VesselId, Updated = Today,
            Goals = GoalTemplates.For(Ranks.LevelOf(sf.RankCode)).Select((t, i) => new Goal { Id = "g" + (i + 1), Title = t.Title, Category = t.Category, Target = t.Target, Weight = t.Weight }).ToList(),
        };
        a.History.Add(new HistoryEntry(Today, by.Id, $"Appraisal opened for {year}"));
        store.Appraisals.Add(a);
        return a;
    }

    // ======================= BR-03, BR-04 goals =======================
    public SeafarerAppraisal SaveGoals(Actor u, string id, IReadOnlyList<GoalInput> goals)
    {
        var a = Get(id);
        RequireGoalEditor(u, a);
        if (goals.Count > s.MaxGoals) throw new ValidationFailedException([$"BR-03: Set {s.MinGoals} to {s.MaxGoals} goals (now {goals.Count})."]);
        a.Goals = goals.Select(g => new Goal { Id = string.IsNullOrWhiteSpace(g.Id) ? "g" + Guid.NewGuid().ToString("N")[..8] : g.Id!, Title = g.Title.Trim(), Category = g.Category, Target = g.Target.Trim(), Weight = g.Weight }).ToList();
        return Touch(a);
    }
    public SeafarerAppraisal SubmitGoals(Actor u, string id)
    {
        var a = Get(id);
        RequireStep(u, a, Stage.Goals, a.SeafarerId);
        Validate(AppraisalRules.GoalErrors(a.Goals, s));
        return Move(a, u, Stage.GoalsReview, "Submitted goals for agreement");
    }
    /// <summary>BR-04: the appraiser agrees the goals, from Goal agreement or directly from Goal setting.</summary>
    public SeafarerAppraisal AgreeGoals(Actor u, string id)
    {
        var a = Get(id);
        if (a.Stage is not (Stage.Goals or Stage.GoalsReview)) throw new DomainException("Goals can only be agreed during goal setting or goal agreement.");
        if (u.Id != AppraiserOf(a)) throw new ForbiddenException($"BR-15: Only the appraiser ({AppraiserOf(a)}) can agree these goals.");
        Validate(AppraisalRules.GoalErrors(a.Goals, s));
        return Move(a, u, Stage.Self, "Agreed goals");
    }
    public SeafarerAppraisal ReturnGoals(Actor u, string id, string remark)
    {
        var a = Get(id);
        RequireStep(u, a, Stage.GoalsReview, AppraiserOf(a));
        return Move(a, u, Stage.Goals, "Sent back to the seafarer", Remark(remark));
    }

    // ======================= BR-05 self-evaluation =======================
    public SeafarerAppraisal SaveSelf(Actor u, string id, IReadOnlyList<RatingInput> ratings, SelfSummary? summary)
    {
        var a = Get(id);
        RequireStep(u, a, Stage.Self, a.SeafarerId);
        Apply(a, ratings, (g, r) => { g.SelfRating = r.Rating; g.SelfNote = (r.Note ?? "").Trim(); });
        if (summary != null) a.SelfSummary = summary;
        return Touch(a);
    }
    public SeafarerAppraisal SubmitSelf(Actor u, string id)
    {
        var a = Get(id);
        RequireStep(u, a, Stage.Self, a.SeafarerId);
        Validate(AppraisalRules.SelfErrors(a));
        return Move(a, u, Stage.Appraiser, "Submitted self-evaluation", $"Self {AppraisalRules.SelfOverall(a):0.00}");
    }

    // ======================= BR-07, BR-08 appraiser evaluation =======================
    public SeafarerAppraisal SaveEvaluation(Actor u, string id, IReadOnlyList<RatingInput> ratings, AppraiserAssessment? assessment)
    {
        var a = Get(id);
        RequireStep(u, a, Stage.Appraiser, AppraiserOf(a));
        Apply(a, ratings, (g, r) => { g.AppraiserRating = r.Rating; g.AppraiserNote = (r.Note ?? "").Trim(); });
        if (assessment != null) a.Assessment = assessment;
        return Touch(a);
    }
    public SeafarerAppraisal SubmitEvaluation(Actor u, string id)
    {
        var a = Get(id);
        RequireStep(u, a, Stage.Appraiser, AppraiserOf(a));
        Validate(AppraisalRules.AppraiserErrors(a, s));
        return Move(a, u, Stage.Ack, "Submitted appraiser evaluation", $"Overall {AppraisalRules.AppraiserOverall(a):0.00}");
    }
    public SeafarerAppraisal ReturnToSeafarer(Actor u, string id, string remark)
    {
        var a = Get(id);
        RequireStep(u, a, Stage.Appraiser, AppraiserOf(a));
        return Move(a, u, Stage.Self, "Sent back to the seafarer", Remark(remark));
    }

    // ======================= BR-09 acknowledgement =======================
    public SeafarerAppraisal Acknowledge(Actor u, string id, bool agrees, string? comment)
    {
        var a = Get(id);
        RequireStep(u, a, Stage.Ack, a.SeafarerId);
        var k = new Acknowledgement { Agrees = agrees, Comment = (comment ?? "").Trim() };
        Validate(AppraisalRules.AckErrors(k));
        a.Ack = k;
        return Move(a, u, HasReviewer(a) ? Stage.Reviewer : Stage.Office, agrees ? "Acknowledged and agreed" : "Acknowledged and disagreed", k.Comment);
    }

    // ======================= BR-11 countersign =======================
    public SeafarerAppraisal Countersign(Actor u, string id, string? comment)
    {
        var a = Get(id);
        RequireStep(u, a, Stage.Reviewer, ReviewerOf(a));
        a.Reviewer = new ReviewerSignOff { Comment = (comment ?? "").Trim() };
        return Move(a, u, Stage.Office, "Countersigned", a.Reviewer.Comment);
    }
    /// <summary>BR-11/BR-14: the countersigner or the office can send it back to the appraiser; the seafarer then acknowledges again.</summary>
    public SeafarerAppraisal ReturnToAppraiser(Actor u, string id, string remark)
    {
        var a = Get(id);
        var who = a.Stage == Stage.Reviewer ? ReviewerOf(a) : a.Stage == Stage.Office ? Roles.CrewingManager : null;
        if (who == null) throw new DomainException("Only a countersign or office step can be sent back to the appraiser.");
        if (u.Id != who) throw new ForbiddenException($"BR-15: {a.Id} is not waiting for you.");
        var note = Remark(remark);
        a.Ack = null; a.Reviewer = null; a.Office = null;
        return Move(a, u, Stage.Appraiser, "Sent back to the appraiser", note);
    }

    // ======================= BR-12 office approval =======================
    public SeafarerAppraisal Approve(Actor u, string id, OfficeDecision decision)
    {
        var a = Get(id);
        RequireStep(u, a, Stage.Office, Roles.CrewingManager);
        Validate(AppraisalRules.OfficeErrors(a, decision, s));
        a.Office = decision;
        var sf = Seafarer(a.SeafarerId);
        sf.RehireStatus = decision.Decision.ToString();
        if (decision.PromotionApproved) sf.PromotionApprovedTo = Ranks.Get(a.RankCode).NextRank;
        foreach (var t in decision.Training) if (!sf.TrainingAssigned.Contains(t)) sf.TrainingAssigned.Add(t);
        return Move(a, u, Stage.Done, "Approved and closed", decision.Decision + (string.IsNullOrWhiteSpace(decision.Remarks) ? "" : ". " + decision.Remarks));
    }

    // ======================= helpers =======================
    private static void RequireOffice(Actor by) { if (!Roles.IsOffice(by.Id) && by.Id != Roles.System) throw new ForbiddenException("BR-15: Only the office can open appraisals."); }
    private void RequireGoalEditor(Actor u, SeafarerAppraisal a)
    {
        var ok = (a.Stage == Stage.Goals && (u.Id == a.SeafarerId || u.Id == AppraiserOf(a))) || (a.Stage == Stage.GoalsReview && u.Id == AppraiserOf(a));
        if (a.Stage is not (Stage.Goals or Stage.GoalsReview)) throw new DomainException($"Goals of {a.Id} are agreed and can no longer be edited.");
        if (!ok) throw new ForbiddenException($"BR-15: {a.Id} is not waiting for you.");
    }
    private void RequireStep(Actor u, SeafarerAppraisal a, Stage stage, string? who)
    {
        if (a.Stage != stage) throw new DomainException($"{a.Id} is at '{a.Stage}', not '{stage}'.");
        if (who == null || u.Id != who) throw new ForbiddenException($"BR-15: {a.Id} is not waiting for you.");
    }
    private static string Remark(string? r) => string.IsNullOrWhiteSpace(r) ? throw new ValidationFailedException(["BR-14: Say what needs to change before sending it back."]) : r.Trim();
    private static void Validate(List<string> errors) { if (errors.Count > 0) throw new ValidationFailedException(errors); }
    private static void Apply(SeafarerAppraisal a, IReadOnlyList<RatingInput> ratings, Action<Goal, RatingInput> set)
    {
        foreach (var r in ratings)
        {
            var g = a.Goals.FirstOrDefault(x => x.Id == r.GoalId) ?? throw new ValidationFailedException([$"Goal {r.GoalId} is not part of this appraisal."]);
            if (r.Rating != null && !Scale.Valid(r.Rating)) throw new ValidationFailedException([$"Ratings run from 1 to 5 (got {r.Rating})."]);
            set(g, r);
        }
    }
    private SeafarerAppraisal Touch(SeafarerAppraisal a) { a.Updated = Today; store.SaveChanges(); return a; }
    private SeafarerAppraisal Move(SeafarerAppraisal a, Actor u, Stage to, string action, string note = "")
    {
        a.Stage = to;
        a.History.Add(new HistoryEntry(Today, u.Id, action, note ?? ""));
        return Touch(a);
    }
}
