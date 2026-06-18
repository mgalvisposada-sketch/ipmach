using StockService.DTOs;

namespace StockService.Services
{
    public interface IClientBIService
    {
        Task<IEnumerable<ClientBIDto>> GetAllClientsAsync();
        Task<IEnumerable<ClientBIDto>> SearchClientsAsync(string searchTerm);
    }
}
