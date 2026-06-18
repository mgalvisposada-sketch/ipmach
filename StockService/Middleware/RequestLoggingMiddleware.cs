using StockService.Services;

namespace StockService.Middleware
{
    public class RequestLoggingMiddleware
    {
        private readonly RequestDelegate _next;

        public RequestLoggingMiddleware(RequestDelegate next)
        {
            _next = next;
        }

        public async Task InvokeAsync(HttpContext context, IServiceProvider serviceProvider)
        {
            var logService = serviceProvider.GetRequiredService<ILogService>();
            var startTime = DateTime.UtcNow;
            var originalBodyStream = context.Response.Body;

            try
            {
                using var memoryStream = new MemoryStream();
                context.Response.Body = memoryStream;

                // Get request details
                var method = context.Request.Method;
                var path = context.Request.Path;
                var queryString = context.Request.QueryString.HasValue ? context.Request.QueryString.Value : null;
                var userAgent = context.Request.Headers["User-Agent"].FirstOrDefault();
                var ipAddress = GetClientIpAddress(context);

                // Process the request
                await _next(context);

                // Calculate duration
                var duration = DateTime.UtcNow - startTime;
                var durationMs = (long)duration.TotalMilliseconds;

                // Copy response back to original stream
                memoryStream.Position = 0;
                await memoryStream.CopyToAsync(originalBodyStream);

                // Log the request
                logService.LogRequest(method, path, queryString, userAgent, ipAddress, context.Response.StatusCode, durationMs);
            }
            catch (Exception ex)
            {
                // Restore original body stream
                context.Response.Body = originalBodyStream;

                // Calculate duration
                var duration = DateTime.UtcNow - startTime;
                var durationMs = (long)duration.TotalMilliseconds;

                // Log the error
                logService.LogError($"Request failed: {context.Request.Method} {context.Request.Path}", ex);
                logService.LogRequest(context.Request.Method, context.Request.Path, 
                    context.Request.QueryString.HasValue ? context.Request.QueryString.Value : null,
                    context.Request.Headers["User-Agent"].FirstOrDefault(),
                    GetClientIpAddress(context), 500, durationMs);

                throw;
            }
        }

        private static string? GetClientIpAddress(HttpContext context)
        {
            // Try to get the real IP address from various headers
            var forwardedHeader = context.Request.Headers["X-Forwarded-For"].FirstOrDefault();
            if (!string.IsNullOrEmpty(forwardedHeader))
            {
                return forwardedHeader.Split(',')[0].Trim();
            }

            var realIpHeader = context.Request.Headers["X-Real-IP"].FirstOrDefault();
            if (!string.IsNullOrEmpty(realIpHeader))
            {
                return realIpHeader;
            }

            return context.Connection.RemoteIpAddress?.ToString();
        }
    }

    public static class RequestLoggingMiddlewareExtensions
    {
        public static IApplicationBuilder UseRequestLogging(this IApplicationBuilder builder)
        {
            return builder.UseMiddleware<RequestLoggingMiddleware>();
        }
    }
}
