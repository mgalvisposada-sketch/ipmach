using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using StockService.DTOs;
using StockService.Services;

namespace StockService.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class ProductController : ControllerBase
    {
        private readonly IProductService _productService;
        private readonly ILogService _logService;

        public ProductController(IProductService productService, ILogService logService)
        {
            _productService = productService;
            _logService = logService;
        }

        /// <summary>
        /// Search products by reference using LIKE pattern matching
        /// </summary>
        /// <param name="reference">Product reference to search for (supports partial matches)</param>
        /// <returns>List of products matching the reference pattern</returns>
        [HttpGet("search")]
        public async Task<ActionResult<IEnumerable<ProductDto>>> GetProductsByReference([FromQuery] string reference)
        {
            if (string.IsNullOrWhiteSpace(reference))
            {
                return BadRequest("Reference parameter is required");
            }

            try
            {
                _logService.LogInformation($"API: Searching products by reference: {reference}");

                var products = await _productService.GetProductsByReferenceAsync(reference);

                _logService.LogInformation($"API: Found {products.Count()} products for reference: {reference}");

                return Ok(products);
            }
            catch (Exception ex)
            {
                _logService.LogError($"API: Error searching products by reference: {reference}", ex);
                return StatusCode(500, "An error occurred while searching products");
            }
        }
    }
}
