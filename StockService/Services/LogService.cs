using System.Text;

namespace StockService.Services
{
    public class LogService : ILogService
    {
        private readonly string _logDirectory;
        private readonly object _lockObject = new object();
        private readonly IConfiguration _configuration;

        public LogService(IConfiguration configuration)
        {
            _configuration = configuration;
            _logDirectory = _configuration["Logging:LogDirectory"] ?? "logs";
            
            // Ensure log directory exists
            if (!Directory.Exists(_logDirectory))
            {
                Directory.CreateDirectory(_logDirectory);
            }
        }

        public void LogRequest(string method, string path, string? queryString, string? userAgent, string? ipAddress, int statusCode, long durationMs)
        {
            var logEntry = new StringBuilder();
            logEntry.AppendLine($"[{DateTime.Now:yyyy-MM-dd HH:mm:ss.fff}] REQUEST");
            logEntry.AppendLine($"  Method: {method}");
            logEntry.AppendLine($"  Path: {path}");
            logEntry.AppendLine($"  Query: {queryString ?? "N/A"}");
            logEntry.AppendLine($"  User-Agent: {userAgent ?? "N/A"}");
            logEntry.AppendLine($"  IP Address: {ipAddress ?? "N/A"}");
            logEntry.AppendLine($"  Status Code: {statusCode}");
            logEntry.AppendLine($"  Duration: {durationMs}ms");
            logEntry.AppendLine("  " + new string('-', 50));

            WriteToFile("requests", logEntry.ToString());
        }

        public void LogError(string message, Exception? exception = null)
        {
            var logEntry = new StringBuilder();
            logEntry.AppendLine($"[{DateTime.Now:yyyy-MM-dd HH:mm:ss.fff}] ERROR");
            logEntry.AppendLine($"  Message: {message}");
            
            if (exception != null)
            {
                logEntry.AppendLine($"  Exception: {exception.GetType().Name}");
                logEntry.AppendLine($"  Message: {exception.Message}");
                logEntry.AppendLine($"  Stack Trace: {exception.StackTrace}");
            }
            
            logEntry.AppendLine("  " + new string('-', 50));

            WriteToFile("errors", logEntry.ToString());
        }

        public void LogInformation(string message)
        {
            var logEntry = $"[{DateTime.Now:yyyy-MM-dd HH:mm:ss.fff}] INFO: {message}";
            WriteToFile("info", logEntry);
        }

        public void LogWarning(string message)
        {
            var logEntry = $"[{DateTime.Now:yyyy-MM-dd HH:mm:ss.fff}] WARN: {message}";
            WriteToFile("warnings", logEntry);
        }

        public void LogDatabaseQuery(string query, TimeSpan duration)
        {
            var logEntry = new StringBuilder();
            logEntry.AppendLine($"[{DateTime.Now:yyyy-MM-dd HH:mm:ss.fff}] DATABASE");
            logEntry.AppendLine($"  Query: {query}");
            logEntry.AppendLine($"  Duration: {duration.TotalMilliseconds:F2}ms");
            logEntry.AppendLine("  " + new string('-', 50));

            WriteToFile("database", logEntry.ToString());
        }

        public void LogCacheOperation(string operation, string key, bool hit)
        {
            var logEntry = $"[{DateTime.Now:yyyy-MM-dd HH:mm:ss.fff}] CACHE {operation.ToUpper()}: {key} ({(hit ? "HIT" : "MISS")})";
            WriteToFile("cache", logEntry);
        }

        private void WriteToFile(string logType, string content)
        {
            var fileName = $"{logType}_{DateTime.Now:yyyy-MM-dd}.log";
            var filePath = Path.Combine(_logDirectory, fileName);

            lock (_lockObject)
            {
                try
                {
                    File.AppendAllText(filePath, content + Environment.NewLine, Encoding.UTF8);
                }
                catch (Exception ex)
                {
                    // Fallback to console if file writing fails
                    Console.WriteLine($"[{DateTime.Now:yyyy-MM-dd HH:mm:ss.fff}] LOG ERROR: {ex.Message}");
                    Console.WriteLine($"Failed to write to {filePath}");
                }
            }
        }
    }
}
