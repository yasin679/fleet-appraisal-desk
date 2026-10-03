namespace Maritime.Appraisal.Domain;

/// <summary>The eight steps of one appraisal (Workflow Document, section 2).</summary>
public enum Stage { Goals, GoalsReview, Self, Appraiser, Ack, Reviewer, Office, Done }
public enum RehireRecommendation { Recommended, WithReservations, NotRecommended }
public enum PromotionReadiness { ReadyNow, ReadyNextYear, NotYetReady, NotApplicable }
public enum OfficeDecisionKind { Approved, ApprovedWithReservations, NotForRehire }

public sealed class Vessel { public required string Id { get; init; } public required string Name { get; init; } public string Type { get; init; } = ""; }

public sealed class Seafarer
{
    public required string Id { get; init; }
    public required string Name { get; init; }
    public required string RankCode { get; set; }
    public required string VesselId { get; set; }
    public int Joined { get; init; }
    /// <summary>Written by office approval (BR-12).</summary>
    public string? RehireStatus { get; set; }
    public string? PromotionApprovedTo { get; set; }
    public List<string> TrainingAssigned { get; set; } = new();
}

public sealed class ShoreUser { public required string Code { get; init; } public required string Name { get; init; } public required string Title { get; init; } }

public sealed class Goal
{
    public required string Id { get; set; }
    public required string Title { get; set; }
    public GoalCategory Category { get; set; }
    public required string Target { get; set; }
    public int Weight { get; set; }
    public int? SelfRating { get; set; }
    public string SelfNote { get; set; } = "";
    public int? AppraiserRating { get; set; }
    public string AppraiserNote { get; set; } = "";
}

public sealed class SelfSummary { public string Achievements { get; set; } = ""; public string Challenges { get; set; } = ""; public string Support { get; set; } = ""; }

public sealed class AppraiserAssessment
{
    public string Strengths { get; set; } = "";
    public string Improvements { get; set; } = "";
    public RehireRecommendation? Rehire { get; set; }
    public PromotionReadiness? Promotion { get; set; }
    public List<string> Training { get; set; } = new();
    public string Comment { get; set; } = "";
}

public sealed class Acknowledgement { public bool Agrees { get; set; } public string Comment { get; set; } = ""; }
public sealed class ReviewerSignOff { public string Comment { get; set; } = ""; }
public sealed class OfficeDecision
{
    public OfficeDecisionKind? Decision { get; set; }
    public bool PromotionApproved { get; set; }
    public List<string> Training { get; set; } = new();
    public string Remarks { get; set; } = "";
}

public sealed record HistoryEntry(DateOnly On, string By, string Action, string Note = "");

public sealed class SeafarerAppraisal
{
    public required string Id { get; init; }
    public required string SeafarerId { get; init; }
    public int Year { get; init; }
    public required string RankCode { get; init; }
    public required string VesselId { get; init; }
    public Level Level => Ranks.LevelOf(RankCode);
    public Stage Stage { get; set; } = Stage.Goals;
    public List<Goal> Goals { get; set; } = new();
    public SelfSummary SelfSummary { get; set; } = new();
    public AppraiserAssessment? Assessment { get; set; }
    public Acknowledgement? Ack { get; set; }
    public ReviewerSignOff? Reviewer { get; set; }
    public OfficeDecision? Office { get; set; }
    public List<HistoryEntry> History { get; set; } = new();
    public DateOnly Updated { get; set; }
}

/// <summary>A closed result from an earlier year (before this system, or archived).</summary>
public sealed record PriorResult(string SeafarerId, int Year, decimal Overall, Dictionary<GoalCategory, decimal> Categories, string Decision);

/// <summary>One anonymised rating from another ship manager (BR-17).</summary>
public sealed record BenchmarkRating(string Company, string RankCode, int Year, decimal Overall, Dictionary<GoalCategory, decimal> Categories);
public sealed record BenchmarkSource(string Source, DateOnly Uploaded, bool IsSample, int Rows);
