namespace Maritime.Appraisal.Domain;

/// <summary>Pure scoring and validation rules. Each message starts with its business rule number.</summary>
public static class AppraisalRules
{
    // ---------- BR-13 scoring ----------
    /// <summary>Weighted average of the given ratings over the goals that have one, to 2 decimals.</summary>
    public static decimal? Overall(IEnumerable<Goal> goals, Func<Goal, int?> rating)
    {
        decimal s = 0; int w = 0;
        foreach (var g in goals) if (rating(g) is int r) { s += r * g.Weight; w += g.Weight; }
        return w == 0 ? null : Math.Round(s / w, 2, MidpointRounding.AwayFromZero);
    }
    public static decimal? SelfOverall(SeafarerAppraisal a) => Overall(a.Goals, g => g.SelfRating);
    public static decimal? AppraiserOverall(SeafarerAppraisal a) => Overall(a.Goals, g => g.AppraiserRating);

    public static Dictionary<GoalCategory, decimal> Categories(IEnumerable<Goal> goals, Func<Goal, int?> rating) =>
        goals.Where(g => rating(g) != null).GroupBy(g => g.Category)
             .ToDictionary(x => x.Key, x => Math.Round((decimal)x.Sum(g => rating(g)!.Value * g.Weight) / x.Sum(g => g.Weight), 2, MidpointRounding.AwayFromZero));

    public static string? Band(decimal? x) => x switch
    {
        null => null,
        >= 4.5m => Scale.Labels[5],
        >= 3.5m => Scale.Labels[4],
        >= 2.5m => Scale.Labels[3],
        >= 1.5m => Scale.Labels[2],
        _ => Scale.Labels[1],
    };

    // ---------- BR-03 goals ----------
    public static List<string> GoalErrors(IReadOnlyList<Goal> goals, AppraisalSettings s)
    {
        var e = new List<string>();
        if (goals.Count < s.MinGoals || goals.Count > s.MaxGoals) e.Add($"BR-03: Set {s.MinGoals} to {s.MaxGoals} goals (now {goals.Count}).");
        var total = goals.Sum(g => g.Weight);
        if (total != 100) e.Add($"BR-03: Weights must add up to 100% (now {total}%).");
        if (goals.Any(g => g.Weight < s.MinGoalWeight)) e.Add($"BR-03: Each goal needs at least {s.MinGoalWeight}%.");
        var safety = goals.Where(g => g.Category == GoalCategory.Safety).ToList();
        if (safety.Count != 1) e.Add($"BR-03: Exactly one Safety goal is required (now {safety.Count}).");
        else if (safety[0].Weight < s.MinSafetyWeight) e.Add($"BR-03: The Safety goal needs at least {s.MinSafetyWeight}%.");
        if (goals.Any(g => string.IsNullOrWhiteSpace(g.Title) || string.IsNullOrWhiteSpace(g.Target))) e.Add("BR-03: Every goal needs a title and a measurable target.");
        return e;
    }

    // ---------- BR-05 self-evaluation ----------
    public static List<string> SelfErrors(SeafarerAppraisal a)
    {
        var e = new List<string>();
        foreach (var g in a.Goals)
        {
            if (!Scale.Valid(g.SelfRating)) e.Add($"BR-05: Rate '{g.Title}' from 1 to 5.");
            else if (Scale.NeedsNote(g.SelfRating) && string.IsNullOrWhiteSpace(g.SelfNote)) e.Add($"BR-05: Explain your rating of {g.SelfRating} for '{g.Title}'.");
        }
        if (string.IsNullOrWhiteSpace(a.SelfSummary.Achievements)) e.Add("BR-05: Fill in your key achievements.");
        return e;
    }

    // ---------- BR-07 and BR-08 appraiser evaluation ----------
    public static List<string> AppraiserErrors(SeafarerAppraisal a, AppraisalSettings s)
    {
        var e = new List<string>();
        foreach (var g in a.Goals)
        {
            if (!Scale.Valid(g.AppraiserRating)) e.Add($"BR-07: Rate '{g.Title}' from 1 to 5.");
            else if (Scale.NeedsNote(g.AppraiserRating) && string.IsNullOrWhiteSpace(g.AppraiserNote)) e.Add($"BR-07: Give evidence for the rating of {g.AppraiserRating} on '{g.Title}'.");
        }
        var p = a.Assessment ?? new AppraiserAssessment();
        if (string.IsNullOrWhiteSpace(p.Strengths) || string.IsNullOrWhiteSpace(p.Improvements)) e.Add("BR-07: Fill in strengths and areas to improve.");
        if (p.Rehire == null) e.Add("BR-07: Choose a re-hire recommendation.");
        if (p.Promotion == null) e.Add("BR-07: Choose promotion readiness.");
        var ov = AppraiserOverall(a);
        var saf = a.Goals.FirstOrDefault(g => g.Category == GoalCategory.Safety)?.AppraiserRating;
        if (p.Rehire == RehireRecommendation.Recommended && ov != null && (ov < s.RecommendedMinOverall || saf < s.RecommendedMinSafety))
            e.Add($"BR-08: 'Recommended' needs an overall of {s.RecommendedMinOverall:0.00} or more and Safety {s.RecommendedMinSafety} or more.");
        var next = Ranks.Get(a.RankCode).NextRank;
        if (p.Promotion == PromotionReadiness.ReadyNow && (next == null || ov < s.ReadyNowMinOverall || !(saf >= s.ReadyNowMinSafety)))
            e.Add(next == null ? "BR-08: This rank has no next rank, so promotion is not applicable." : $"BR-08: 'Ready now' needs {s.ReadyNowMinOverall:0.00} or more overall and Safety {s.ReadyNowMinSafety} or 5.");
        if (next == null && p.Promotion is PromotionReadiness.ReadyNextYear or PromotionReadiness.NotYetReady)
            e.Add("BR-08: This rank has no next rank; choose 'Not applicable'.");
        if (a.Goals.Any(g => g.AppraiserRating <= s.TrainingAtOrBelow) && p.Training.Count == 0)
            e.Add($"BR-08: Choose training for any goal rated {s.TrainingAtOrBelow} or below.");
        return e;
    }

    // ---------- BR-09 acknowledgement ----------
    public static List<string> AckErrors(Acknowledgement k) =>
        !k.Agrees && string.IsNullOrWhiteSpace(k.Comment) ? ["BR-09: Explain what you disagree with."] : [];

    // ---------- BR-12 office decision ----------
    public static List<string> OfficeErrors(SeafarerAppraisal a, OfficeDecision o, AppraisalSettings s)
    {
        var e = new List<string>();
        if (o.Decision == null) e.Add("BR-12: Choose a re-hire decision.");
        if (o.Decision == OfficeDecisionKind.Approved && AppraiserOverall(a) < s.ApprovedMinOverall) e.Add($"BR-12: 'Approved' needs an overall of {s.ApprovedMinOverall:0.00} or more.");
        if (o.Decision == OfficeDecisionKind.NotForRehire && string.IsNullOrWhiteSpace(o.Remarks)) e.Add("BR-12: Give remarks for a not-for-re-hire decision.");
        if (o.PromotionApproved && Ranks.Get(a.RankCode).NextRank == null) e.Add("BR-12: This rank has no next rank to promote to.");
        return e;
    }
}
