using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Authorization;

namespace StockService.Middleware
{
    public class SimpleAuthMiddleware
    {
        private readonly RequestDelegate _next;
        private readonly IConfiguration _configuration;

        public SimpleAuthMiddleware(RequestDelegate next, IConfiguration configuration)
        {
            _next = next;
            _configuration = configuration;
        }

        public async Task InvokeAsync(HttpContext context)
        {
            // Skip authentication for Swagger endpoints
            if (context.Request.Path.StartsWithSegments("/swagger"))
            {
                await _next(context);
                return;
            }

            // Check if the endpoint requires authentication
            var endpoint = context.GetEndpoint();
            if (endpoint?.Metadata?.GetMetadata<AuthorizeAttribute>() == null)
            {
                await _next(context);
                return;
            }

            // Get Authorization header
            var authHeader = context.Request.Headers["Authorization"].FirstOrDefault();
            if (string.IsNullOrEmpty(authHeader) || !authHeader.StartsWith("Basic "))
            {
                context.Response.StatusCode = 401;
                context.Response.Headers["WWW-Authenticate"] = "Basic realm=\"StockService\"";
                await context.Response.WriteAsync("Unauthorized");
                return;
            }

            // Decode credentials
            var encodedCredentials = authHeader.Substring("Basic ".Length);
            var credentials = Encoding.UTF8.GetString(Convert.FromBase64String(encodedCredentials));
            var parts = credentials.Split(':', 2);

            if (parts.Length != 2)
            {
                context.Response.StatusCode = 401;
                await context.Response.WriteAsync("Invalid credentials format");
                return;
            }

            var username = parts[0];
            var password = parts[1];

            // Check against hardcoded credentials (in production, use secure configuration)
            var validUsername = _configuration["Auth:Username"] ?? "admin";
            var validPassword = _configuration["Auth:Password"] ?? "Admin123!";

            if (username != validUsername || password != validPassword)
            {
                context.Response.StatusCode = 401;
                await context.Response.WriteAsync("Invalid credentials");
                return;
            }

            // Create claims identity
            var claims = new List<Claim>
            {
                new Claim(ClaimTypes.Name, username),
                new Claim(ClaimTypes.NameIdentifier, username),
                new Claim(ClaimTypes.Role, "SystemUser")
            };

            var identity = new ClaimsIdentity(claims, "Basic");
            context.User = new ClaimsPrincipal(identity);

            await _next(context);
        }
    }

    public static class SimpleAuthMiddlewareExtensions
    {
        public static IApplicationBuilder UseSimpleAuth(this IApplicationBuilder builder)
        {
            return builder.UseMiddleware<SimpleAuthMiddleware>();
        }
    }
}
