using System.Text.Json;
using System.Text.Json.Serialization;
using Maritime.Appraisal.Domain;

namespace Maritime.Appraisal.Api;

/// <summary>A clock the demo and tests can move.</summary>
public sealed class MovableClock(DateOnly day) : TimeProvider
{
    public DateOnly Day { get; set; } = day;
    public override DateTimeOffset GetUtcNow() => new(Day.ToDateTime(new TimeOnly(9, 0)), TimeSpan.Zero);
}

/// <summary>DEV/demo store. Production implements IAppraisalStore over database/01_schema.sql.</summary>
public sealed class InMemoryStore : IAppraisalStore
{
    public IList<Vessel> Vessels { get; } = new List<Vessel>();
    public IList<Seafarer> Seafarers { get; } = new List<Seafarer>();
    public IList<ShoreUser> ShoreUsers { get; } = new List<ShoreUser>();
    public IList<SeafarerAppraisal> Appraisals { get; } = new List<SeafarerAppraisal>();
    public IList<PriorResult> PriorResults { get; } = new List<PriorResult>();
    public IList<BenchmarkRating> Benchmark { get; } = new List<BenchmarkRating>();
    public BenchmarkSource BenchmarkSource { get; set; } = new("None", DateOnly.MinValue, true, 0);
    public int Saves { get; private set; }
    public void SaveChanges() => Saves++;

    public static readonly JsonSerializerOptions Json = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase, Converters = { new JsonStringEnumConverter() }, DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull };

    /// <summary>Office users only, for tests that build their own crew.</summary>
    public static InMemoryStore Empty()
    {
        var s = new InMemoryStore();
        s.ShoreUsers.Add(new ShoreUser { Code = Roles.MarineSupt, Name = "Capt. Neil Fernandes", Title = "Marine Superintendent" });
        s.ShoreUsers.Add(new ShoreUser { Code = Roles.TechnicalSupt, Name = "Priya Nair", Title = "Technical Superintendent" });
        s.ShoreUsers.Add(new ShoreUser { Code = Roles.CrewingManager, Name = "Farah Khan", Title = "Crewing Manager" });
        return s;
    }

    /// <summary>The same 6 vessels, 108 seafarers and 2026 appraisals as the clickable working model, plus the sample benchmark.</summary>
    public static InMemoryStore Demo(string? folder = null)
    {
        folder ??= Path.Combine(AppContext.BaseDirectory, "DemoData");
        var d = JsonSerializer.Deserialize<DemoFile>(File.ReadAllText(Path.Combine(folder, "fleet.json")), Json)!;
        var s = new InMemoryStore();
        foreach (var x in d.Vessels) s.Vessels.Add(x);
        foreach (var x in d.ShoreUsers) s.ShoreUsers.Add(x);
        foreach (var x in d.Seafarers) s.Seafarers.Add(x);
        foreach (var x in d.PriorResults) s.PriorResults.Add(x);
        foreach (var x in d.Appraisals) s.Appraisals.Add(x);
        s.UseSampleBenchmark(folder);
        return s;
    }
    public void UseSampleBenchmark(string? folder = null)
    {
        folder ??= Path.Combine(AppContext.BaseDirectory, "DemoData");
        var rows = JsonSerializer.Deserialize<List<BenchmarkRating>>(File.ReadAllText(Path.Combine(folder, "benchmark-sample.json")), Json)!;
        Benchmark.Clear(); foreach (var r in rows) Benchmark.Add(r);
        BenchmarkSource = new("Sample benchmark: 5 fictional ship managers (illustrative, not real company data)", new DateOnly(2026, 10, 1), true, rows.Count);
    }
    private sealed record DemoFile(List<Vessel> Vessels, List<ShoreUser> ShoreUsers, List<Seafarer> Seafarers, List<PriorResult> PriorResults, List<SeafarerAppraisal> Appraisals);
}
