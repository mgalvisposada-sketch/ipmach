using StockService.DTOs;

namespace StockService.Services
{
    public interface IProductStockService
    {
        Task<IEnumerable<ProductStockDto>> GetProductStockAsync(string strProducto);
        Task<IEnumerable<ProductStockDto>> GetProductStockByProductAsync(string strProducto);
        Task<IEnumerable<ProductStockDto>> GetProductStockByReferenceAsync(string reference);
    }
}
