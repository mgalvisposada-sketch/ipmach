using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using StockService.DTOs;
using StockService.Services;

namespace StockService.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class ClientBIController : ControllerBase
    {
        private readonly IClientBIService _clientBIService;
        private readonly ILogService _logService;

        public ClientBIController(IClientBIService clientBIService, ILogService logService)
        {
            _clientBIService = clientBIService;
            _logService = logService;
        }

        /// <summary>
        /// Get all clients from the BI view (cached for 30 minutes)
        /// </summary>
        /// <returns>List of all clients</returns>
        [HttpGet]
        public async Task<ActionResult<IEnumerable<ClientBIDto>>> GetAllClients()
        {
            try
            {
                _logService.LogInformation("Get all clients request");
                
                var clients = await _clientBIService.GetAllClientsAsync();
                
                _logService.LogInformation($"All clients retrieved: Count={clients?.Count() ?? 0}");
                return Ok(clients);
            }
            catch (Exception ex)
            {
                _logService.LogError("Error retrieving all clients", ex);
                return StatusCode(500, $"Internal server error: {ex.Message}");
            }
        }

        /// <summary>
        /// Search clients by code or name (cached for 15 minutes)
        /// </summary>
        /// <param name="searchTerm">Search term for client code or name</param>
        /// <returns>Matching clients</returns>
        [HttpGet("search")]
        public async Task<ActionResult<IEnumerable<ClientBIDto>>> SearchClients([FromQuery] string searchTerm)
        {
            try
            {
                _logService.LogInformation($"Client search request: Term={searchTerm}");

                if (string.IsNullOrWhiteSpace(searchTerm))
                {
                    _logService.LogWarning("Invalid client search request: Empty search term");
                    return BadRequest("Search term is required");
                }

                if (searchTerm.Length < 2)
                {
                    _logService.LogWarning($"Invalid client search request: Search term too short: {searchTerm}");
                    return BadRequest("Search term must be at least 2 characters long");
                }

                var clients = await _clientBIService.SearchClientsAsync(searchTerm);
                
                _logService.LogInformation($"Client search completed: Term={searchTerm}, Count={clients?.Count() ?? 0}");
                return Ok(clients);
            }
            catch (Exception ex)
            {
                _logService.LogError($"Error searching clients with term '{searchTerm}'", ex);
                return StatusCode(500, $"Internal server error: {ex.Message}");
            }
        }
    }
}
