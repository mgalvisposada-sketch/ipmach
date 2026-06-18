namespace StockService.Services
{
    public interface ILogService
    {
        void LogRequest(string method, string path, string? queryString, string? userAgent, string? ipAddress, int statusCode, long durationMs);
        void LogError(string message, Exception? exception = null);
        void LogInformation(string message);
        void LogWarning(string message);
        void LogDatabaseQuery(string query, TimeSpan duration);
        void LogCacheOperation(string operation, string key, bool hit);
    }
}
