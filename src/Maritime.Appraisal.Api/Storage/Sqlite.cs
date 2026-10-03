using System.Reflection;
using System.Runtime.InteropServices;
using System.Text;

namespace Maritime.Appraisal.Api.Storage;

/// <summary>
/// A minimal SQLite binding with no NuGet packages. It calls the SQLite library that ships with the operating system:
/// winsqlite3.dll on Windows 10 / Windows Server 2016 and later, libsqlite3.so.0 on Linux, libsqlite3.dylib on macOS.
/// A sqlite3.dll / libsqlite3 placed next to the app is used first if present.
/// </summary>
public static class SqliteNative
{
    private const string Lib = "sqlite3";
    private static bool _resolverSet;
    private static readonly object Gate = new();

    public static void EnsureResolver()
    {
        lock (Gate)
        {
            if (_resolverSet) return;
            NativeLibrary.SetDllImportResolver(typeof(SqliteNative).Assembly, Resolve);
            _resolverSet = true;
        }
    }

    private static IntPtr Resolve(string name, Assembly asm, DllImportSearchPath? path)
    {
        if (name != Lib) return IntPtr.Zero;
        var candidates = OperatingSystem.IsWindows() ? new[] { "sqlite3", "winsqlite3" }
            : OperatingSystem.IsMacOS() ? new[] { "libsqlite3.dylib", "libsqlite3" }
            : new[] { "libsqlite3.so.0", "libsqlite3.so", "libsqlite3" };
        foreach (var c in candidates)
            if (NativeLibrary.TryLoad(c, asm, path, out var h)) return h;
        throw new DllNotFoundException("SQLite was not found. On Windows Server 2016+ winsqlite3.dll is built in; on Linux install libsqlite3 (e.g. apt install libsqlite3-0).");
    }

    public const int OK = 0, ROW = 100, DONE = 101;
    public const int OPEN_READWRITE = 0x2, OPEN_CREATE = 0x4, OPEN_FULLMUTEX = 0x10000;
    public static readonly IntPtr TRANSIENT = new(-1);

    [DllImport(Lib, CallingConvention = CallingConvention.Cdecl)] public static extern int sqlite3_open_v2(byte[] filename, out IntPtr db, int flags, IntPtr vfs);
    [DllImport(Lib, CallingConvention = CallingConvention.Cdecl)] public static extern int sqlite3_close_v2(IntPtr db);
    [DllImport(Lib, CallingConvention = CallingConvention.Cdecl)] public static extern int sqlite3_busy_timeout(IntPtr db, int ms);
    [DllImport(Lib, CallingConvention = CallingConvention.Cdecl)] public static extern int sqlite3_prepare_v2(IntPtr db, byte[] sql, int nByte, out IntPtr stmt, IntPtr tail);
    [DllImport(Lib, CallingConvention = CallingConvention.Cdecl)] public static extern int sqlite3_step(IntPtr stmt);
    [DllImport(Lib, CallingConvention = CallingConvention.Cdecl)] public static extern int sqlite3_finalize(IntPtr stmt);
    [DllImport(Lib, CallingConvention = CallingConvention.Cdecl)] public static extern int sqlite3_bind_text(IntPtr stmt, int index, byte[] value, int n, IntPtr destructor);
    [DllImport(Lib, CallingConvention = CallingConvention.Cdecl)] public static extern int sqlite3_bind_int64(IntPtr stmt, int index, long value);
    [DllImport(Lib, CallingConvention = CallingConvention.Cdecl)] public static extern int sqlite3_bind_double(IntPtr stmt, int index, double value);
    [DllImport(Lib, CallingConvention = CallingConvention.Cdecl)] public static extern int sqlite3_bind_null(IntPtr stmt, int index);
    [DllImport(Lib, CallingConvention = CallingConvention.Cdecl)] public static extern int sqlite3_column_count(IntPtr stmt);
    [DllImport(Lib, CallingConvention = CallingConvention.Cdecl)] public static extern int sqlite3_column_type(IntPtr stmt, int col);
    [DllImport(Lib, CallingConvention = CallingConvention.Cdecl)] public static extern IntPtr sqlite3_column_text(IntPtr stmt, int col);
    [DllImport(Lib, CallingConvention = CallingConvention.Cdecl)] public static extern int sqlite3_column_bytes(IntPtr stmt, int col);
    [DllImport(Lib, CallingConvention = CallingConvention.Cdecl)] public static extern long sqlite3_column_int64(IntPtr stmt, int col);
    [DllImport(Lib, CallingConvention = CallingConvention.Cdecl)] public static extern double sqlite3_column_double(IntPtr stmt, int col);
    [DllImport(Lib, CallingConvention = CallingConvention.Cdecl)] public static extern IntPtr sqlite3_errmsg(IntPtr db);
    [DllImport(Lib, CallingConvention = CallingConvention.Cdecl)] public static extern IntPtr sqlite3_libversion();

    public static byte[] Utf8z(string s) { var b = Encoding.UTF8.GetBytes(s); Array.Resize(ref b, b.Length + 1); return b; }
}

/// <summary>One open SQLite database file. Thread-safe: every call takes the connection lock.</summary>
public sealed class SqliteDb : IDisposable
{
    private IntPtr _db;
    private readonly object _lock = new();
    public string Path { get; }

    public SqliteDb(string path)
    {
        SqliteNative.EnsureResolver();
        Path = path;
        var dir = System.IO.Path.GetDirectoryName(System.IO.Path.GetFullPath(path));
        if (!string.IsNullOrEmpty(dir)) Directory.CreateDirectory(dir);
        var rc = SqliteNative.sqlite3_open_v2(SqliteNative.Utf8z(path), out _db, SqliteNative.OPEN_READWRITE | SqliteNative.OPEN_CREATE | SqliteNative.OPEN_FULLMUTEX, IntPtr.Zero);
        if (rc != SqliteNative.OK) throw new InvalidOperationException($"Can't open database '{path}' (SQLite error {rc}). Check the folder exists and the app may write to it.");
        SqliteNative.sqlite3_busy_timeout(_db, 5000);
        Execute("PRAGMA journal_mode=WAL;");
        Execute("PRAGMA foreign_keys=ON;");
    }

    public static string Version => Marshal.PtrToStringUTF8(SqliteNative.sqlite3_libversion()) ?? "?";

    public void Execute(string sql, params object?[] args) { lock (_lock) { using var s = Prepare(sql, args); while (s.Step()) { } } }

    public List<object?[]> Query(string sql, params object?[] args)
    {
        lock (_lock)
        {
            using var s = Prepare(sql, args);
            var rows = new List<object?[]>();
            while (s.Step()) rows.Add(s.Row());
            return rows;
        }
    }

    /// <summary>Runs the action inside one transaction; rolls back if it throws.</summary>
    public void InTransaction(Action<SqliteDb> work)
    {
        lock (_lock)
        {
            Execute("BEGIN IMMEDIATE;");
            try { work(this); Execute("COMMIT;"); }
            catch { Execute("ROLLBACK;"); throw; }
        }
    }

    private Statement Prepare(string sql, object?[] args)
    {
        var bytes = SqliteNative.Utf8z(sql);
        var rc = SqliteNative.sqlite3_prepare_v2(_db, bytes, bytes.Length, out var stmt, IntPtr.Zero);
        if (rc != SqliteNative.OK) throw new InvalidOperationException($"SQLite: {Error()} in: {sql}");
        var st = new Statement(this, stmt);
        for (var i = 0; i < args.Length; i++) st.Bind(i + 1, args[i]);
        return st;
    }

    internal string Error() => Marshal.PtrToStringUTF8(SqliteNative.sqlite3_errmsg(_db)) ?? "unknown error";

    public void Dispose() { if (_db != IntPtr.Zero) { SqliteNative.sqlite3_close_v2(_db); _db = IntPtr.Zero; } }

    private sealed class Statement(SqliteDb db, IntPtr h) : IDisposable
    {
        public void Bind(int i, object? v)
        {
            var rc = v switch
            {
                null => SqliteNative.sqlite3_bind_null(h, i),
                string s => BindText(i, s),
                int n => SqliteNative.sqlite3_bind_int64(h, i, n),
                long n => SqliteNative.sqlite3_bind_int64(h, i, n),
                bool b => SqliteNative.sqlite3_bind_int64(h, i, b ? 1 : 0),
                double d => SqliteNative.sqlite3_bind_double(h, i, d),
                decimal m => SqliteNative.sqlite3_bind_double(h, i, (double)m),
                _ => BindText(i, v.ToString() ?? ""),
            };
            if (rc != SqliteNative.OK) throw new InvalidOperationException($"SQLite bind: {db.Error()}");
        }
        private int BindText(int i, string s) { var b = System.Text.Encoding.UTF8.GetBytes(s); return SqliteNative.sqlite3_bind_text(h, i, b, b.Length, SqliteNative.TRANSIENT); }
        public bool Step()
        {
            var rc = SqliteNative.sqlite3_step(h);
            if (rc == SqliteNative.ROW) return true;
            if (rc == SqliteNative.DONE) return false;
            throw new InvalidOperationException($"SQLite: {db.Error()}");
        }
        public object?[] Row()
        {
            var n = SqliteNative.sqlite3_column_count(h);
            var r = new object?[n];
            for (var c = 0; c < n; c++)
                r[c] = SqliteNative.sqlite3_column_type(h, c) switch
                {
                    1 => SqliteNative.sqlite3_column_int64(h, c),
                    2 => SqliteNative.sqlite3_column_double(h, c),
                    5 => null,
                    _ => Marshal.PtrToStringUTF8(SqliteNative.sqlite3_column_text(h, c), SqliteNative.sqlite3_column_bytes(h, c)),
                };
            return r;
        }
        public void Dispose() => SqliteNative.sqlite3_finalize(h);
    }
}
