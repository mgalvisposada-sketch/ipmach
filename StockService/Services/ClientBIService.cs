using StockService.DTOs;
using StockService.Models;
using StockService.Repositories;
using Microsoft.Extensions.Caching.Memory;

namespace StockService.Services
{
    public class ClientBIService : IClientBIService
    {
        private readonly IClientBIRepository _clientBIRepository;
        private readonly IMemoryCache _memoryCache;
        private readonly ILogService _logService;
        private const string ALL_CLIENTS_CACHE_KEY = "AllClients";
        private const string CLIENT_CACHE_KEY_PREFIX = "Client_";
        private const string SEARCH_CACHE_KEY_PREFIX = "ClientSearch_";
        private static readonly TimeSpan CACHE_DURATION = TimeSpan.FromMinutes(30); // 30 minutes cache

        public ClientBIService(IClientBIRepository clientBIRepository, IMemoryCache memoryCache, ILogService logService)
        {
            _clientBIRepository = clientBIRepository;
            _memoryCache = memoryCache;
            _logService = logService;
        }

        public async Task<IEnumerable<ClientBIDto>> GetAllClientsAsync()
        {
            if (_memoryCache.TryGetValue(ALL_CLIENTS_CACHE_KEY, out IEnumerable<ClientBIDto>? cachedClients))
            {
                _logService.LogCacheOperation("GET", ALL_CLIENTS_CACHE_KEY, true);
                return cachedClients!;
            }

            _logService.LogCacheOperation("GET", ALL_CLIENTS_CACHE_KEY, false);
            _logService.LogInformation("Cache miss for all clients, fetching from database");

            var clients = await _clientBIRepository.GetAllClientsAsync();
            var clientDtos = clients.Select(MapToDto).ToList();

            var cacheOptions = new MemoryCacheEntryOptions()
                .SetAbsoluteExpiration(CACHE_DURATION)
                .SetSlidingExpiration(TimeSpan.FromMinutes(10));

            _memoryCache.Set(ALL_CLIENTS_CACHE_KEY, clientDtos, cacheOptions);
            _logService.LogCacheOperation("SET", ALL_CLIENTS_CACHE_KEY, true);

            return clientDtos;
        }

        public async Task<IEnumerable<ClientBIDto>> SearchClientsAsync(string searchTerm)
        {
            var cacheKey = $"{SEARCH_CACHE_KEY_PREFIX}{searchTerm.ToLower()}";

            if (_memoryCache.TryGetValue(cacheKey, out IEnumerable<ClientBIDto>? cachedResults))
            {
                _logService.LogCacheOperation("GET", cacheKey, true);
                return cachedResults!;
            }

            _logService.LogCacheOperation("GET", cacheKey, false);
            _logService.LogInformation($"Cache miss for client search '{searchTerm}', fetching from database");

            var clients = await _clientBIRepository.SearchClientsAsync(searchTerm);
            var clientDtos = clients.Select(MapToDto).ToList();

            var cacheOptions = new MemoryCacheEntryOptions()
                .SetAbsoluteExpiration(TimeSpan.FromMinutes(15)) // Shorter cache for search results
                .SetSlidingExpiration(TimeSpan.FromMinutes(5));

            _memoryCache.Set(cacheKey, clientDtos, cacheOptions);
            _logService.LogCacheOperation("SET", cacheKey, true);

            return clientDtos;
        }

        private static ClientBIDto MapToDto(ClientBI client)
        {
            return new ClientBIDto
            {
                StrTercero = client.StrTercero,
                NombreTercero = client.NombreTercero,
                StrTipoId = client.StrTipoId,
                IntIdentificacion = client.IntIdentificacion,
                StrApellido1 = client.StrApellido1,
                StrDireccion = client.StrDireccion,
                StrCodPostal = client.StrCodPostal,
                StrTelefono = client.StrTelefono,
                StrCelular = client.StrCelular,
                IntTipoTercero = client.IntTipoTercero
            };
        }
    }
}
