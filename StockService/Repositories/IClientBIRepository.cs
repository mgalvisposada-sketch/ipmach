using StockService.Models;
using StockService.DTOs;

namespace StockService.Repositories
{
    public interface IClientBIRepository
    {
        Task<IEnumerable<ClientBI>> GetAllClientsAsync();
        Task<IEnumerable<ClientBI>> SearchClientsAsync(string searchTerm);
    }
}
