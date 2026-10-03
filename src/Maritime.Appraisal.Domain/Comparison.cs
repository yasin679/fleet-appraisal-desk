namespace Maritime.Appraisal.Domain;

public sealed record Distribution(string Label, string Kind, int N, double? P10, double? P25, double? P50, double? P75, double? P90, int? HigherThanPct);
public sealed record CategoryComparison(GoalCategory Category, decimal? Person, double? FleetAverage, double? IndustryAverage);
public sealed record ComparisonResult(
    string SeafarerId, string RankCode, int Year, decimal? Overall, string? Band, decimal? SelfOverall,
    int? FleetRank, int FleetRated, int FleetOthers, int? HigherThanPctOfFleet, int TiesInFleet, bool SmallGroup,
    int? IndustryPercentile, int IndustryOthers, int IndustryRated, int Companies,
    IReadOnlyList<Distribution> Distributions, IReadOnlyList<CategoryComparison> Categories, BenchmarkSource Source);
public sealed record RankVsIndustry(string RankCode, int OurRated, double OurMedian, double IndustryMedian, double Difference, int IndustryPercentile);

/// <summary>BR-16: compares one person with the same rank in our fleet and at other ship managers.</summary>
public sealed class Comparison(IAppraisalStore store, AppraisalSettings s)
{
    /// <summary>The rating used for comparison: a closed earlier-year result, or this year's appraiser rating once submitted.</summary>
    public (decimal Overall, Dictionary<GoalCategory, decimal> Cats, decimal? Self)? ScoreOf(string seafarerId, int year)
    {
        var prior = store.PriorResults.FirstOrDefault(p => p.SeafarerId == seafarerId && p.Year == year);
        if (prior != null) return (prior.Overall, prior.Categories, null);
        var a = store.Appraisals.FirstOrDefault(x => x.SeafarerId == seafarerId && x.Year == year);
        if (a == null || a.Stage < Stage.Ack || AppraisalRules.AppraiserOverall(a) is not decimal ov) return null;
        return (ov, AppraisalRules.Categories(a.Goals, g => g.AppraiserRating), AppraisalRules.SelfOverall(a));
    }

    public ComparisonResult Compare(string seafarerId, int year)
    {
        var sf = store.Seafarers.FirstOrDefault(x => x.Id == seafarerId) ?? throw new NotFoundException($"Seafarer {seafarerId} not found.");
        var rk = sf.RankCode;
        var me = ScoreOf(seafarerId, year);
        var fleet = store.Seafarers.Where(x => x.RankCode == rk).Select(x => (x.Id, Score: ScoreOf(x.Id, year))).Where(x => x.Score != null).Select(x => (x.Id, Score: x.Score!.Value)).ToList();
        var bench = store.Benchmark.Where(b => b.RankCode == rk && b.Year == year).ToList();
        var fleetVals = fleet.Select(x => (double)x.Score.Overall).ToList();
        var pool = bench.Select(b => (double)b.Overall).Concat(fleetVals).ToList();
        double? m = me == null ? null : (double)me.Value.Overall;
        var fO = m == null ? fleetVals : Others(fleetVals, m.Value);
        var iO = m == null ? pool : Others(pool, m.Value);
        var companies = bench.Select(b => b.Company).Distinct().ToList();

        var dists = new List<Distribution> { Dist("Our fleet", "fleet", fleetVals, m, true) };
        dists.AddRange(companies.Select(c => Dist(c, "company", bench.Where(b => b.Company == c).Select(b => (double)b.Overall).ToList(), m, false)));
        dists.Add(Dist("All companies", "all", pool, m, true));

        var cats = Enum.GetValues<GoalCategory>()
            .Where(c => (me?.Cats.ContainsKey(c) ?? false) || fleet.Any(x => x.Score.Cats.ContainsKey(c)))
            .Select(c => new CategoryComparison(c,
                me != null && me.Value.Cats.TryGetValue(c, out var v) ? v : null,
                Avg(fleet.Where(x => x.Score.Cats.ContainsKey(c)).Select(x => (double)x.Score.Cats[c])),
                Avg(bench.Where(b => b.Categories.ContainsKey(c)).Select(b => (double)b.Categories[c]))))
            .ToList();

        return new ComparisonResult(seafarerId, rk, year, me?.Overall, AppraisalRules.Band(me?.Overall), me?.Self,
            m == null ? null : fleetVals.Count(v => v > m) + 1, fleetVals.Count, fO.Count,
            m == null || fO.Count == 0 ? null : HigherThan(fO, m.Value), m == null ? 0 : fO.Count(v => v == m), fO.Count < s.SmallGroup,
            m == null || iO.Count == 0 ? null : PercentileRank(iO, m.Value), iO.Count, pool.Count, companies.Count + 1,
            dists, cats, store.BenchmarkSource);
    }

    public IReadOnlyList<RankVsIndustry> FleetVsIndustry(int year) =>
        Ranks.All.Values.OrderBy(r => r.Order).Select(r =>
        {
            var ours = store.Seafarers.Where(x => x.RankCode == r.Code).Select(x => ScoreOf(x.Id, year)).Where(x => x != null).Select(x => (double)x!.Value.Overall).ToList();
            var ind = store.Benchmark.Where(b => b.RankCode == r.Code && b.Year == year).Select(b => (double)b.Overall).ToList();
            if (ours.Count == 0 || ind.Count == 0) return null;
            var om = Quantile(ours, .5)!.Value; var im = Quantile(ind, .5)!.Value;
            return new RankVsIndustry(r.Code, ours.Count, om, im, om - im, PercentileRank(ind, om));
        }).Where(x => x != null).Select(x => x!).ToList();

    // ---------- statistics (same method as the working model) ----------
    /// <summary>The group with the person's own score taken out once.</summary>
    public static List<double> Others(List<double> vals, double x) { var o = vals.ToList(); var i = o.IndexOf(x); if (i >= 0) o.RemoveAt(i); return o; }
    /// <summary>Share of the group scoring strictly lower, rounded half away from zero.</summary>
    public static int HigherThan(List<double> vals, double x) => (int)Math.Round(vals.Count(v => v < x) * 100.0 / vals.Count, MidpointRounding.AwayFromZero);
    /// <summary>Percentile rank with ties counted half: (below + level/2) / n.</summary>
    public static int PercentileRank(List<double> vals, double x) => (int)Math.Round((vals.Count(v => v < x) + vals.Count(v => v == x) / 2.0) / vals.Count * 100, MidpointRounding.AwayFromZero);
    /// <summary>Linear interpolation between closest ranks (Excel PERCENTILE.INC).</summary>
    public static double? Quantile(IEnumerable<double> values, double p)
    {
        var s = values.OrderBy(v => v).ToList();
        if (s.Count == 0) return null;
        var i = (s.Count - 1) * p; var lo = (int)Math.Floor(i); var hi = (int)Math.Ceiling(i);
        return s[lo] + (s[hi] - s[lo]) * (i - lo);
    }
    private static double? Avg(IEnumerable<double> xs) { var l = xs.ToList(); return l.Count == 0 ? null : l.Average(); }
    private static Distribution Dist(string label, string kind, List<double> vals, double? me, bool includesMe) =>
        new(label, kind, vals.Count, Quantile(vals, .1), Quantile(vals, .25), Quantile(vals, .5), Quantile(vals, .75), Quantile(vals, .9),
            me == null ? null : (includesMe ? Others(vals, me.Value) : vals) is { Count: > 0 } g ? HigherThan(g, me.Value) : null);
}

/// <summary>BR-17: reads a benchmark CSV (company, rank, year, overall, optional category columns).</summary>
public static class BenchmarkCsv
{
    public sealed record ParseResult(List<BenchmarkRating> Rows, List<string> Errors);

    public static ParseResult Parse(string text)
    {
        var rows = new List<BenchmarkRating>(); var errors = new List<string>();
        var lines = text.TrimStart('﻿').Split('\n').Select(l => l.TrimEnd('\r')).Where(l => l.Trim().Length > 0).ToList();
        if (lines.Count == 0) return new(rows, ["BR-17: The file is empty."]);
        var head = Split(lines[0]).Select(h => h.ToLowerInvariant()).ToList();
        int Col(string k) => head.IndexOf(k);
        foreach (var k in new[] { "company", "rank", "year", "overall" }) if (Col(k) < 0) errors.Add($"BR-17: Column '{k}' is missing from the first row.");
        if (errors.Count > 0) return new(rows, errors);
        for (var i = 1; i < lines.Count; i++)
        {
            var c = Split(lines[i]);
            string Cell(int j) => j >= 0 && j < c.Count ? c[j] : "";
            var company = Cell(Col("company")); var rank = Ranks.Parse(Cell(Col("rank")));
            var yearOk = int.TryParse(Cell(Col("year")), out var year) && year is >= 2000 and <= 2100;
            var ovOk = decimal.TryParse(Cell(Col("overall")), System.Globalization.NumberStyles.Number, System.Globalization.CultureInfo.InvariantCulture, out var ov) && ov is >= 1 and <= 5;
            if (company.Length == 0) { errors.Add($"BR-17: Line {i + 1}: company is empty."); continue; }
            if (rank == null) { errors.Add($"BR-17: Line {i + 1}: rank '{Cell(Col("rank"))}' is not one we know."); continue; }
            if (!yearOk) { errors.Add($"BR-17: Line {i + 1}: year '{Cell(Col("year"))}' is not valid."); continue; }
            if (!ovOk) { errors.Add($"BR-17: Line {i + 1}: overall must be between 1 and 5."); continue; }
            var cats = new Dictionary<GoalCategory, decimal>();
            foreach (var cat in Enum.GetValues<GoalCategory>())
                if (decimal.TryParse(Cell(Col(cat.ToString().ToLowerInvariant())), System.Globalization.NumberStyles.Number, System.Globalization.CultureInfo.InvariantCulture, out var v) && v is >= 1 and <= 5) cats[cat] = v;
            rows.Add(new BenchmarkRating(company.Length > 60 ? company[..60] : company, rank, year, Math.Round(ov, 2, MidpointRounding.AwayFromZero), cats));
        }
        return new(rows, errors);
    }

    private static List<string> Split(string line)
    {
        var o = new List<string>(); var cur = new System.Text.StringBuilder(); var q = false;
        for (var i = 0; i < line.Length; i++)
        {
            var ch = line[i];
            if (q) { if (ch == '"' && i + 1 < line.Length && line[i + 1] == '"') { cur.Append('"'); i++; } else if (ch == '"') q = false; else cur.Append(ch); }
            else if (ch == '"') q = true; else if (ch == ',') { o.Add(cur.ToString().Trim()); cur.Clear(); } else cur.Append(ch);
        }
        o.Add(cur.ToString().Trim());
        return o;
    }
}
