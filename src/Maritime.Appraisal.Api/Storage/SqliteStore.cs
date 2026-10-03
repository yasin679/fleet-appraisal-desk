using System.Security.Cryptography;
using System.Text.Json;
using Maritime.Appraisal.Domain;

namespace Maritime.Appraisal.Api.Storage;

/// <summary>
/// IAppraisalStore kept in one SQLite file. Everything is loaded into memory at start-up and written through on every
/// SaveChanges, inside a transaction, only for the records that changed. Suits one server (IIS site or container)
/// with a few hundred seafarers. For several servers, implement IAppraisalStore over the SQL Server schema in /database.
/// </summary>
public sealed class SqliteStore : IAppraisalStore, IDisposable
{
    public IList<Vessel> Vessels { get; } = new List<Vessel>();
    public IList<Seafarer> Seafarers { get; } = new List<Seafarer>();
    public IList<ShoreUser> ShoreUsers { get; } = new List<ShoreUser>();
    public IList<SeafarerAppraisal> Appraisals { get; } = new List<SeafarerAppraisal>();
    public IList<PriorResult> PriorResults { get; } = new List<PriorResult>();
    public IList<BenchmarkRating> Benchmark { get; } = new List<BenchmarkRating>();
    public BenchmarkSource BenchmarkSource { get; set; } = new("None", DateOnly.MinValue, true, 0);
    /// <summary>Hold this while running a command so two requests never change the store at once.</summary>
    public object Sync { get; } = new();

    private readonly SqliteDb _db;
    private readonly Dictionary<string, string> _saved = new();   // "kind:id" -> json last written
    private string _savedBenchmarkSource = "";
    private static readonly JsonSerializerOptions J = InMemoryStore.Json;

    public SqliteStore(string path) { _db = new SqliteDb(path); }
    public string FilePath => _db.Path;

    /// <summary>Creates the tables if missing. Returns true when the database is empty (first run).</summary>
    public bool Initialise()
    {
        foreach (var sql in new[]
        {
            "CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)",
            "CREATE TABLE IF NOT EXISTS vessels (id TEXT PRIMARY KEY, json TEXT NOT NULL)",
            "CREATE TABLE IF NOT EXISTS shore_users (code TEXT PRIMARY KEY, json TEXT NOT NULL)",
            "CREATE TABLE IF NOT EXISTS seafarers (id TEXT PRIMARY KEY, rank TEXT NOT NULL, vessel TEXT NOT NULL, json TEXT NOT NULL)",
            "CREATE TABLE IF NOT EXISTS appraisals (id TEXT PRIMARY KEY, seafarer_id TEXT NOT NULL, year INTEGER NOT NULL, stage TEXT NOT NULL, updated TEXT NOT NULL, json TEXT NOT NULL)",
            "CREATE UNIQUE INDEX IF NOT EXISTS ux_appraisal_year ON appraisals (seafarer_id, year)",
            "CREATE TABLE IF NOT EXISTS prior_results (seafarer_id TEXT NOT NULL, year INTEGER NOT NULL, overall REAL NOT NULL, json TEXT NOT NULL, PRIMARY KEY (seafarer_id, year))",
            "CREATE TABLE IF NOT EXISTS benchmark (id INTEGER PRIMARY KEY AUTOINCREMENT, company TEXT NOT NULL, rank TEXT NOT NULL, year INTEGER NOT NULL, overall REAL NOT NULL, json TEXT NOT NULL)",
            "CREATE INDEX IF NOT EXISTS ix_benchmark_rank_year ON benchmark (rank, year)",
            "CREATE TABLE IF NOT EXISTS users (user_id TEXT PRIMARY KEY, salt TEXT NOT NULL, hash TEXT NOT NULL, must_change INTEGER NOT NULL DEFAULT 0, last_login TEXT)",
            "CREATE TABLE IF NOT EXISTS sign_in_log (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, at TEXT NOT NULL, ok INTEGER NOT NULL)",
        }) _db.Execute(sql);
        return _db.Query("SELECT COUNT(*) FROM seafarers")[0][0] is long n && n == 0;
    }

    /// <summary>Loads everything into memory.</summary>
    public void Load()
    {
        lock (Sync)
        {
            Clear();
            foreach (var r in _db.Query("SELECT json FROM vessels")) Vessels.Add(De<Vessel>(r[0]));
            foreach (var r in _db.Query("SELECT json FROM shore_users")) ShoreUsers.Add(De<ShoreUser>(r[0]));
            foreach (var r in _db.Query("SELECT id, json FROM seafarers ORDER BY vessel, id")) { Seafarers.Add(De<Seafarer>(r[1])); _saved["s:" + r[0]] = (string)r[1]!; }
            foreach (var r in _db.Query("SELECT id, json FROM appraisals")) { Appraisals.Add(De<SeafarerAppraisal>(r[1])); _saved["a:" + r[0]] = (string)r[1]!; }
            foreach (var r in _db.Query("SELECT json FROM prior_results")) PriorResults.Add(De<PriorResult>(r[0]));
            foreach (var r in _db.Query("SELECT json FROM benchmark ORDER BY id")) Benchmark.Add(De<BenchmarkRating>(r[0]));
            var src = _db.Query("SELECT value FROM meta WHERE key = 'benchmark_source'");
            if (src.Count > 0) { BenchmarkSource = De<BenchmarkSource>(src[0][0]); _savedBenchmarkSource = (string)src[0][0]!; }
        }
    }

    /// <summary>Replaces all data with the given store's (first run, or "Reset demo data").</summary>
    public void ReplaceAllWith(IAppraisalStore src)
    {
        lock (Sync)
        {
            _db.InTransaction(db =>
            {
                foreach (var t in new[] { "vessels", "shore_users", "seafarers", "appraisals", "prior_results", "benchmark" }) db.Execute($"DELETE FROM {t}");
                db.Execute("DELETE FROM meta WHERE key = 'benchmark_source'");
                foreach (var v in src.Vessels) db.Execute("INSERT INTO vessels (id, json) VALUES (?, ?)", v.Id, Se(v));
                foreach (var u in src.ShoreUsers) db.Execute("INSERT INTO shore_users (code, json) VALUES (?, ?)", u.Code, Se(u));
                foreach (var s in src.Seafarers) db.Execute("INSERT INTO seafarers (id, rank, vessel, json) VALUES (?, ?, ?, ?)", s.Id, s.RankCode, s.VesselId, Se(s));
                foreach (var a in src.Appraisals) db.Execute("INSERT INTO appraisals (id, seafarer_id, year, stage, updated, json) VALUES (?, ?, ?, ?, ?, ?)", a.Id, a.SeafarerId, a.Year, a.Stage.ToString(), a.Updated.ToString("yyyy-MM-dd"), Se(a));
                foreach (var p in src.PriorResults) db.Execute("INSERT INTO prior_results (seafarer_id, year, overall, json) VALUES (?, ?, ?, ?)", p.SeafarerId, p.Year, p.Overall, Se(p));
                WriteBenchmark(db, src.Benchmark, src.BenchmarkSource);
            });
            _saved.Clear();
            Load();
        }
    }

    public void SaveChanges()
    {
        lock (Sync)
        {
            _db.InTransaction(db =>
            {
                foreach (var s in Seafarers)
                {
                    var json = Se(s);
                    if (_saved.TryGetValue("s:" + s.Id, out var old) && old == json) continue;
                    db.Execute("INSERT INTO seafarers (id, rank, vessel, json) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET rank = excluded.rank, vessel = excluded.vessel, json = excluded.json", s.Id, s.RankCode, s.VesselId, json);
                    _saved["s:" + s.Id] = json;
                }
                foreach (var a in Appraisals)
                {
                    var json = Se(a);
                    if (_saved.TryGetValue("a:" + a.Id, out var old) && old == json) continue;
                    db.Execute("INSERT INTO appraisals (id, seafarer_id, year, stage, updated, json) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET stage = excluded.stage, updated = excluded.updated, json = excluded.json",
                        a.Id, a.SeafarerId, a.Year, a.Stage.ToString(), a.Updated.ToString("yyyy-MM-dd"), json);
                    _saved["a:" + a.Id] = json;
                }
                var src = Se(BenchmarkSource);
                if (src != _savedBenchmarkSource) { db.Execute("DELETE FROM benchmark"); WriteBenchmark(db, Benchmark, BenchmarkSource); }
            });
            _savedBenchmarkSource = Se(BenchmarkSource);
        }
    }

    private static void WriteBenchmark(SqliteDb db, IEnumerable<BenchmarkRating> rows, BenchmarkSource source)
    {
        foreach (var b in rows) db.Execute("INSERT INTO benchmark (company, rank, year, overall, json) VALUES (?, ?, ?, ?, ?)", b.Company, b.RankCode, b.Year, b.Overall, Se(b));
        db.Execute("INSERT INTO meta (key, value) VALUES ('benchmark_source', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", Se(source));
    }

    // ---------------- users and passwords ----------------
    public bool HasCredentials(string userId) => _db.Query("SELECT 1 FROM users WHERE user_id = ?", userId).Count > 0;
    public void SetPassword(string userId, string password, bool mustChange)
    {
        var salt = RandomNumberGenerator.GetBytes(16);
        var hash = Hash(password, salt);
        _db.Execute("INSERT INTO users (user_id, salt, hash, must_change) VALUES (?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET salt = excluded.salt, hash = excluded.hash, must_change = excluded.must_change",
            userId, Convert.ToBase64String(salt), Convert.ToBase64String(hash), mustChange ? 1 : 0);
    }
    /// <summary>Creates a password for every user who has none (first run, new seafarers).</summary>
    public int SeedPasswords(string password, bool mustChange)
    {
        var n = 0;
        foreach (var id in Seafarers.Select(s => s.Id).Concat(ShoreUsers.Select(u => u.Code)))
            if (!HasCredentials(id)) { SetPassword(id, password, mustChange); n++; }
        return n;
    }
    public (bool Ok, bool MustChange) CheckPassword(string userId, string password)
    {
        var r = _db.Query("SELECT salt, hash, must_change FROM users WHERE user_id = ?", userId);
        bool ok = false, must = false;
        if (r.Count == 1)
        {
            var expected = Convert.FromBase64String((string)r[0][1]!);
            ok = CryptographicOperations.FixedTimeEquals(Hash(password, Convert.FromBase64String((string)r[0][0]!)), expected);
            must = (long)r[0][2]! == 1;
        }
        _db.Execute("INSERT INTO sign_in_log (user_id, at, ok) VALUES (?, ?, ?)", userId, DateTime.UtcNow.ToString("o"), ok ? 1 : 0);
        if (ok) _db.Execute("UPDATE users SET last_login = ? WHERE user_id = ?", DateTime.UtcNow.ToString("o"), userId);
        return (ok, must);
    }
    /// <summary>PBKDF2-SHA256, 100,000 iterations, 32-byte key.</summary>
    public static byte[] Hash(string password, byte[] salt) => Rfc2898DeriveBytes.Pbkdf2(password, salt, 100_000, HashAlgorithmName.SHA256, 32);

    private void Clear() { Vessels.Clear(); ShoreUsers.Clear(); Seafarers.Clear(); Appraisals.Clear(); PriorResults.Clear(); Benchmark.Clear(); }
    private static string Se<T>(T o) => JsonSerializer.Serialize(o, J);
    private static T De<T>(object? json) => JsonSerializer.Deserialize<T>((string)json!, J)!;
    public void Dispose() => _db.Dispose();
}
