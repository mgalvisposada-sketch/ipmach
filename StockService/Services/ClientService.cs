using StockService.DTOs;
using StockService.Models;
using StockService.Repositories;

namespace StockService.Services
{
    public class ClientService : IClientService
    {
        private readonly IClientRepository _clientRepository;

        public ClientService(IClientRepository clientRepository)
        {
            _clientRepository = clientRepository;
        }

        public async Task<IEnumerable<ClientDto>> GetAllAsync()
        {
            var clients = await _clientRepository.GetAllAsync();
            return clients.Select(MapToDto);
        }

        public async Task<ClientDto?> GetByIdAsync(int id)
        {
            var client = await _clientRepository.GetByIdAsync(id);
            return client != null ? MapToDto(client) : null;
        }

        public async Task<ClientDto> CreateAsync(ClientCreateDto createDto)
        {
            var client = new Client
            {
                Name = createDto.Name,
                Email = createDto.Email,
                Phone = createDto.Phone,
                Address = createDto.Address,
                City = createDto.City,
                Country = createDto.Country,
                DiscountRate = createDto.DiscountRate,
                IsActive = true
            };

            var createdClient = await _clientRepository.CreateAsync(client);
            return MapToDto(createdClient);
        }

        public async Task<ClientDto> UpdateAsync(int id, ClientUpdateDto updateDto)
        {
            var client = await _clientRepository.GetByIdAsync(id);
            if (client == null)
                throw new ArgumentException($"Client with ID {id} not found");

            if (updateDto.Name != null)
                client.Name = updateDto.Name;
            if (updateDto.Email != null)
                client.Email = updateDto.Email;
            if (updateDto.Phone != null)
                client.Phone = updateDto.Phone;
            if (updateDto.Address != null)
                client.Address = updateDto.Address;
            if (updateDto.City != null)
                client.City = updateDto.City;
            if (updateDto.Country != null)
                client.Country = updateDto.Country;
            if (updateDto.DiscountRate.HasValue)
                client.DiscountRate = updateDto.DiscountRate.Value;
            if (updateDto.IsActive.HasValue)
                client.IsActive = updateDto.IsActive.Value;

            var updatedClient = await _clientRepository.UpdateAsync(client);
            return MapToDto(updatedClient);
        }

        public async Task DeleteAsync(int id)
        {
            await _clientRepository.DeleteAsync(id);
        }

        private static ClientDto MapToDto(Client client)
        {
            return new ClientDto
            {
                Id = client.Id,
                Name = client.Name,
                Email = client.Email,
                Phone = client.Phone,
                Address = client.Address,
                City = client.City,
                Country = client.Country,
                DiscountRate = client.DiscountRate,
                IsActive = client.IsActive,
                CreatedAt = client.CreatedAt,
                UpdatedAt = client.UpdatedAt
            };
        }
    }
}
