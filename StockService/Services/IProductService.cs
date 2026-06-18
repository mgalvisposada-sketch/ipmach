using StockService.DTOs;

namespace StockService.Services
{
    public interface IProductService
    {
        Task<IEnumerable<ProductDto>> GetProductsByReferenceAsync(string reference);
    }
}
