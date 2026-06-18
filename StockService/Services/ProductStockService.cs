using StockService.DTOs;
using StockService.Models;
using StockService.Repositories;

namespace StockService.Services
{
    public class ProductStockService : IProductStockService
    {
        private readonly IProductStockRepository _productStockRepository;
        private readonly IProductRepository _productRepository;
        private readonly ILogService _logService;

        public ProductStockService(IProductStockRepository productStockRepository, IProductRepository productRepository, ILogService logService)
        {
            _productStockRepository = productStockRepository;
            _productRepository = productRepository;
            _logService = logService;
        }

        public async Task<IEnumerable<ProductStockDto>> GetProductStockAsync(string strProducto)
        {
            return await GetProductStockByReferenceAsync(strProducto);
        }

        public async Task<IEnumerable<ProductStockDto>> GetProductStockByProductAsync(string strProducto)
        {
            return await GetProductStockByReferenceAsync(strProducto);
        }

        public async Task<IEnumerable<ProductStockDto>> GetProductStockByReferenceAsync(string reference)
        {
            _logService.LogInformation($"Getting stock for reference: {reference}");

            try
            {
                // First, get stock for the original reference (exact match)
                _logService.LogInformation($"Getting stock for original reference: {reference}");
                var originalStock = await _productStockRepository.GetProductStockByReferenceAsync(reference);
                var originalStockDtos = originalStock.Select(MapToDto).ToList();
                
                _logService.LogInformation($"Found {originalStockDtos.Count} stock records for original reference: {reference}");

                // Second, search for additional product references by description
                _logService.LogInformation($"Searching additional product references by description: {reference}");
                var productReferences = await _productRepository.GetProductReferencesByDescriptionAsync(reference);
                var referencesList = productReferences.ToList();

                var additionalStockDtos = new List<ProductStockDto>();
                if (referencesList.Any())
                {
                    _logService.LogInformation($"Found {referencesList.Count} additional product references for description: {reference}");
                    
                    // Get stock for all found references from description search
                    var additionalStock = await _productStockRepository.GetProductStockByReferencesAsync(referencesList);
                    additionalStockDtos = additionalStock.Select(MapToDto).ToList();
                    
                    _logService.LogInformation($"Found {additionalStockDtos.Count} additional stock records from description search");
                }
                else
                {
                    _logService.LogInformation($"No additional product references found for description: {reference}");
                }

                // Combine results and remove duplicates based on StrProducto + IntBodega combination
                var allStock = originalStockDtos
                    .Concat(additionalStockDtos)
                    .GroupBy(s => new { s.StrProducto, s.IntBodega })
                    .Select(g => g.First())
                    .ToList();

                _logService.LogInformation($"Combined stock results: {allStock.Count} unique records (Original: {originalStockDtos.Count}, Additional: {additionalStockDtos.Count})");
                return allStock;
            }
            catch (Exception ex)
            {
                _logService.LogError($"Error in ProductStockService.GetProductStockByReferenceAsync for reference: {reference}", ex);
                throw;
            }
        }

        private static ProductStockDto MapToDto(ProductStock productStock)
        {
            return new ProductStockDto
            {
                IntEmpresa = productStock.IntEmpresa,
                IntAno = productStock.IntAno,
                IntPeriodo = productStock.IntPeriodo,
                StrProducto = productStock.StrProducto,
                StrDescripcion = productStock.StrDescripcion,
                IntBodega = productStock.IntBodega,
                StrLote = productStock.StrLote,
                StrTalla = productStock.StrTalla,
                StrColor = productStock.StrColor,
                StrUbicacion = productStock.StrUbicacion,
                IntSaldoI = productStock.IntSaldoI,
                IntEntradas = productStock.IntEntradas,
                IntSalidas = productStock.IntSalidas,
                IntCantidadFinal = productStock.IntCantidadFinal
            };
        }
    }
}
