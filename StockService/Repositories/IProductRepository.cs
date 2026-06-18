using StockService.Models;

namespace StockService.Repositories
{
    public interface IProductRepository
    {
        Task<IEnumerable<Product>> GetProductsByReferenceAsync(string reference);
        Task<IEnumerable<string>> GetProductReferencesByDescriptionAsync(string description);
    }
}
