using StockService.Models;
using StockService.DTOs;

namespace StockService.Services
{
    public interface IClientService
    {
        Task<IEnumerable<ClientDto>> GetAllAsync();
        Task<ClientDto?> GetByIdAsync(int id);
        Task<ClientDto> CreateAsync(ClientCreateDto createDto);
        Task<ClientDto> UpdateAsync(int id, ClientUpdateDto updateDto);
        Task DeleteAsync(int id);
    }
}
