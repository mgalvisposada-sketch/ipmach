using StockService.Models;
using StockService.DTOs;

namespace StockService.Repositories
{
    public interface IProductStockRepository
    {
        Task<IEnumerable<ProductStock>> GetProductStockAsync(string strProducto);
        Task<IEnumerable<ProductStock>> GetProductStockByProductAsync(string strProducto);
        Task<IEnumerable<ProductStock>> GetProductStockByReferenceAsync(string reference);
        Task<IEnumerable<ProductStock>> GetProductStockByReferencesAsync(IEnumerable<string> references);
    }
}
