namespace Maritime.Appraisal.Domain;

public enum Level { Officer, NonOfficer }
public enum Department { Deck, Engine, Catering }
public enum GoalCategory { Safety, Operations, Compliance, Teamwork, Development, Conduct }

/// <summary>A rank and its approval chain (BR-01, BR-10). Appraiser/Reviewer hold either an onboard rank code
/// (resolved to the person holding that rank on the same vessel) or an office role code.</summary>
public sealed record Rank(string Code, string Name, Department Dept, Level Level, string Appraiser, string? Reviewer, string? NextRank, int Order);

public static class Ranks
{
    public static readonly IReadOnlyDictionary<string, Rank> All = new List<Rank>
    {
        new("MST", "Master", Department.Deck, Level.Officer, Roles.MarineSupt, null, null, 1),
        new("CO", "Chief Officer", Department.Deck, Level.Officer, "MST", Roles.MarineSupt, "MST", 2),
        new("2O", "Second Officer", Department.Deck, Level.Officer, "CO", "MST", "CO", 3),
        new("3O", "Third Officer", Department.Deck, Level.Officer, "CO", "MST", "2O", 4),
        new("CE", "Chief Engineer", Department.Engine, Level.Officer, "MST", Roles.TechnicalSupt, null, 5),
        new("2E", "Second Engineer", Department.Engine, Level.Officer, "CE", "MST", "CE", 6),
        new("3E", "Third Engineer", Department.Engine, Level.Officer, "CE", "MST", "2E", 7),
        new("4E", "Fourth Engineer", Department.Engine, Level.Officer, "CE", "MST", "3E", 8),
        new("ETO", "Electro-Technical Officer", Department.Engine, Level.Officer, "CE", "MST", null, 9),
        new("DCD", "Deck Cadet", Department.Deck, Level.NonOfficer, "CO", "MST", "3O", 10),
        new("BSN", "Bosun", Department.Deck, Level.NonOfficer, "CO", "MST", null, 11),
        new("AB", "Able Seaman", Department.Deck, Level.NonOfficer, "CO", "MST", "BSN", 12),
        new("OS", "Ordinary Seaman", Department.Deck, Level.NonOfficer, "CO", "MST", "AB", 13),
        new("FTR", "Fitter", Department.Engine, Level.NonOfficer, "CE", "MST", null, 14),
        new("OLR", "Oiler", Department.Engine, Level.NonOfficer, "CE", "MST", "FTR", 15),
        new("CCK", "Chief Cook", Department.Catering, Level.NonOfficer, "MST", null, null, 16),
        new("MSM", "Messman", Department.Catering, Level.NonOfficer, "CCK", "MST", "CCK", 17),
    }.ToDictionary(r => r.Code);

    public static Rank Get(string code) => All.TryGetValue(code, out var r) ? r : throw new DomainException($"Unknown rank '{code}'.");
    public static Level LevelOf(string code) => Get(code).Level;

    private static readonly Dictionary<string, string> Alias = new(StringComparer.OrdinalIgnoreCase)
    {
        ["C/O"] = "CO", ["2/O"] = "2O", ["3/O"] = "3O", ["C/E"] = "CE", ["2/E"] = "2E", ["3/E"] = "3E", ["4/E"] = "4E",
        ["D/CDT"] = "DCD", ["CADET"] = "DCD", ["BOSUN"] = "BSN", ["BOATSWAIN"] = "BSN", ["FITTER"] = "FTR", ["OILER"] = "OLR",
        ["CH/COOK"] = "CCK", ["COOK"] = "CCK", ["MESSMAN"] = "MSM", ["CAPTAIN"] = "MST",
    };
    /// <summary>Accepts a code (2O), an abbreviation (2/O) or a name (Second Officer). Null when unknown.</summary>
    public static string? Parse(string? text)
    {
        var u = (text ?? "").Trim().ToUpperInvariant();
        if (All.ContainsKey(u)) return u;
        if (Alias.TryGetValue(u, out var a)) return a;
        return All.Values.FirstOrDefault(r => r.Name.Equals(u, StringComparison.OrdinalIgnoreCase))?.Code;
    }
}

public static class Roles
{
    public const string MarineSupt = "MSUPT", TechnicalSupt = "TSUPT", CrewingManager = "CREWING", Admin = "ADMIN", System = "SYSTEM";
    public static bool IsOffice(string id) => id is MarineSupt or TechnicalSupt or CrewingManager or Admin;
}

public static class Scale
{
    public static readonly IReadOnlyDictionary<int, string> Labels = new Dictionary<int, string>
    { [1] = "Unsatisfactory", [2] = "Needs improvement", [3] = "Meets expectations", [4] = "Exceeds expectations", [5] = "Outstanding" };
    public static bool Valid(int? v) => v is >= 1 and <= 5;
    /// <summary>Ratings that must be explained in writing (BR-05, BR-07).</summary>
    public static bool NeedsNote(int? v) => v is 1 or 2 or 5;
}

public sealed record GoalTemplate(string Title, GoalCategory Category, string Target, int Weight);
public sealed record LibraryGoal(string Title, GoalCategory Category, string Target, string For);

public static class GoalTemplates
{
    public static readonly IReadOnlyList<GoalTemplate> Officer =
    [
        new("Lead safe operations in my department", GoalCategory.Safety, "Zero lost-time injuries; 100% drills and toolbox talks; permits to work closed correctly", 25),
        new("Clean inspections", GoalCategory.Compliance, "No PSC, vetting or audit findings in my area of responsibility", 20),
        new("Planned work on time", GoalCategory.Operations, "100% of PMS jobs (engine) or voyage and cargo plans (deck) done on time", 20),
        new("Lead and develop the team", GoalCategory.Teamwork, "Familiarisation and on-board training complete for every junior I supervise", 15),
        new("My own development", GoalCategory.Development, "All assigned CBTs complete; one competence course before next contract", 20),
    ];
    public static readonly IReadOnlyList<GoalTemplate> NonOfficer =
    [
        new("Work safely", GoalCategory.Safety, "Zero injuries; PPE and permit to work always followed; 100% drill attendance", 30),
        new("Assigned work done well", GoalCategory.Operations, "PMS jobs and daily work orders done on time and to standard", 30),
        new("Reliable and disciplined", GoalCategory.Conduct, "No warnings; work and rest hours recorded accurately", 20),
        new("Keep learning", GoalCategory.Development, "Assigned CBTs and training record book tasks complete", 20),
    ];
    public static IReadOnlyList<GoalTemplate> For(Level l) => l == Level.Officer ? Officer : NonOfficer;

    public static readonly IReadOnlyList<LibraryGoal> Library =
    [
        new("Mooring operations without incident", GoalCategory.Safety, "Zero mooring incidents; snap-back zones briefed before every operation", "Deck"),
        new("Enclosed space entry done right", GoalCategory.Safety, "100% entries with permit, gas test and rescue team ready", "All"),
        new("Cargo operations without claims", GoalCategory.Operations, "No cargo damage or shortage claims; stability checked every stage", "Deck"),
        new("Bunkering without spills", GoalCategory.Operations, "Zero spills; checklist and soundings complete for every bunkering", "Engine"),
        new("Fuel efficiency", GoalCategory.Operations, "Main engine fuel consumption within 2% of the performance curve", "Engine"),
        new("Navigation records in order", GoalCategory.Compliance, "ECDIS, passage plans and log books 100% compliant at every audit", "Deck"),
        new("Environmental records in order", GoalCategory.Compliance, "Oil Record Book and Garbage Record Book with no findings", "All"),
        new("Mentor a cadet", GoalCategory.Teamwork, "Cadet's training record book tasks for this period signed off", "Officer"),
        new("Speak up for safety", GoalCategory.Teamwork, "At least one near-miss or improvement report each month", "All"),
        new("Galley hygiene", GoalCategory.Compliance, "No findings in Master's weekly galley and provisions inspection", "Catering"),
        new("Food within budget", GoalCategory.Operations, "Victualling within the daily allowance; crew satisfaction 4 of 5 or better", "Catering"),
        new("Prepare for promotion", GoalCategory.Development, "Complete the next-rank familiarisation and a competency check with the HOD", "All"),
        new("Rest-hour compliance", GoalCategory.Conduct, "No MLC rest-hour non-conformities", "All"),
    ];

    public static readonly IReadOnlyList<string> Training =
    [
        "Bridge Resource Management", "Engine Room Resource Management", "ECDIS type-specific", "Leadership & Managerial Skills",
        "Advanced fire fighting refresher", "Behavioural safety workshop", "Maritime English", "Food safety & hygiene",
        "Cargo handling & stability", "High-voltage safety", "Enclosed space entry & rescue", "Mooring safety",
    ];
}

/// <summary>Every threshold in one place; production reads them from appr.Setting.</summary>
public sealed record AppraisalSettings
{
    public int MinGoals { get; init; } = 3;
    public int MaxGoals { get; init; } = 6;
    public int MinGoalWeight { get; init; } = 10;
    public int MinSafetyWeight { get; init; } = 20;
    public decimal RecommendedMinOverall { get; init; } = 2.50m;
    public int RecommendedMinSafety { get; init; } = 3;
    public decimal ReadyNowMinOverall { get; init; } = 3.50m;
    public int ReadyNowMinSafety { get; init; } = 4;
    public int TrainingAtOrBelow { get; init; } = 2;
    public decimal ApprovedMinOverall { get; init; } = 2.50m;
    public int SmallGroup { get; init; } = 4;
}

public class DomainException(string message) : Exception(message);
public sealed class NotFoundException(string message) : DomainException(message);
public sealed class ForbiddenException(string message) : DomainException(message);
public sealed class ValidationFailedException(List<string> errors) : DomainException(string.Join(" ", errors))
{
    public List<string> Errors { get; } = errors;
}
