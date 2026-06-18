using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using StockService.DTOs;
using StockService.Services;

namespace StockService.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class ProductStockController : ControllerBase
    {
        private readonly IProductStockService _productStockService;
        private readonly ILogService _logService;

        public ProductStockController(IProductStockService productStockService, ILogService logService)
        {
            _productStockService = productStockService;
            _logService = logService;
        }

        /// <summary>
        /// Search stock by product reference using LIKE pattern matching
        /// </summary>
        /// <param name="reference">Product reference to search for (supports partial matches)</param>
        /// <returns>List of stock records matching the reference pattern</returns>
        [HttpGet("search")]
        public async Task<ActionResult<IEnumerable<ProductStockDto>>> GetStockByReference([FromQuery] string reference)
        {
            if (string.IsNullOrWhiteSpace(reference))
            {
                return BadRequest("Reference parameter is required");
            }

            try
            {
                _logService.LogInformation($"API: Searching stock by reference: {reference}");

                var stock = await _productStockService.GetProductStockByReferenceAsync(reference);

                _logService.LogInformation($"API: Found {stock.Count()} stock records for reference: {reference}");

                return Ok(stock);
            }
            catch (Exception ex)
            {
                _logService.LogError($"API: Error searching stock by reference: {reference}", ex);
                return StatusCode(500, "An error occurred while searching stock");
            }
        }
    }
}
