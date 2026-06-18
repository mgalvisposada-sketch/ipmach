using StockService.DTOs;
using StockService.Models;
using StockService.Repositories;
using Microsoft.Extensions.Caching.Memory;

namespace StockService.Services
{
    public class ProductService : IProductService
    {
        private readonly IProductRepository _productRepository;
        private readonly ILogService _logService;
        private readonly IMemoryCache _cache;

        public ProductService(IProductRepository productRepository, ILogService logService, IMemoryCache cache)
        {
            _productRepository = productRepository;
            _logService = logService;
            _cache = cache;
        }

        public async Task<IEnumerable<ProductDto>> GetProductsByReferenceAsync(string reference)
        {
            var cacheKey = $"products_search_{reference}";
            
            if (_cache.TryGetValue(cacheKey, out IEnumerable<ProductDto>? cachedResult))
            {
                _logService.LogInformation($"Returning cached product search results for reference: {reference}");
                return cachedResult!;
            }

            _logService.LogInformation($"Cache miss for product search, querying database for reference: {reference}");

            try
            {
                // Get products by reference (existing search by product ID and alternate code)
                var productsByReference = await _productRepository.GetProductsByReferenceAsync(reference);
                var productDtosByReference = productsByReference.Select(MapToDto).ToList();
                
                _logService.LogInformation($"Found {productDtosByReference.Count} products by reference search");

                // Get additional products by description search
                var productReferencesByDescription = await _productRepository.GetProductReferencesByDescriptionAsync(reference);
                var referencesList = productReferencesByDescription.ToList();
                
                _logService.LogInformation($"Found {referencesList.Count} product references by description search");

                // Get full product details for description-based references
                var additionalProducts = new List<ProductDto>();
                if (referencesList.Any())
                {
                    // Get full product details for each reference found by description
                    foreach (var refId in referencesList)
                    {
                        var products = await _productRepository.GetProductsByReferenceAsync(refId);
                        additionalProducts.AddRange(products.Select(MapToDto));
                    }
                }

                // Combine results and remove duplicates based on StrIdProducto
                var allProducts = productDtosByReference
                    .Concat(additionalProducts)
                    .GroupBy(p => p.StrIdProducto)
                    .Select(g => g.First())
                    .ToList();

                _logService.LogInformation($"Combined search results: {allProducts.Count} unique products (Reference: {productDtosByReference.Count}, Description: {additionalProducts.Count})");

                // Cache for 30 minutes
                var cacheOptions = new MemoryCacheEntryOptions()
                    .SetSlidingExpiration(TimeSpan.FromMinutes(30))
                    .SetAbsoluteExpiration(TimeSpan.FromHours(1));

                _cache.Set(cacheKey, allProducts, cacheOptions);

                _logService.LogInformation($"Cached {allProducts.Count} products for reference: {reference}");
                return allProducts;
            }
            catch (Exception ex)
            {
                _logService.LogError($"Error in ProductService.GetProductsByReferenceAsync for reference: {reference}", ex);
                throw;
            }
        }

        private static ProductDto MapToDto(Product product)
        {
            return new ProductDto
            {
                StrIdProducto = product.StrIdProducto,
                StrDescripcion = product.StrDescripcion,
                StrCodAlterno = product.StrCodAlterno,
                StrLinea = product.StrLinea,
                StrGrupo = product.StrGrupo,
                StrClase = product.StrClase,
                StrTipo = product.StrTipo,
                StrUnidad = product.StrUnidad,
                StrMoneda = product.StrMoneda,
                StrProveedor = product.StrProveedor,
                IntPrecio1 = product.IntPrecio1,
                IntPrecio2 = product.IntPrecio2,
                IntPrecio3 = product.IntPrecio3,
                IntPrecio4 = product.IntPrecio4,
                IntPrecio5 = product.IntPrecio5,
                IntPrecio6 = product.IntPrecio6,
                IntPrecio7 = product.IntPrecio7,
                IntPrecio8 = product.IntPrecio8,
                IntPrecioSug = product.IntPrecioSug,
                IntPrecioCompra = product.IntPrecioCompra,
                IntVigente = product.IntVigente,
                IntHabilitar = product.IntHabilitar,
                IntKardex = product.IntKardex,
                IntIva = product.IntIva,
                IntIca = product.IntIca,
                StrDescripcionCorta = product.StrDescripcionCorta,
                IntPeso = product.IntPeso,
                DatFechaAct = product.DatFechaAct,
                IdSeguridad = product.IdSeguridad
            };
        }
    }
}
