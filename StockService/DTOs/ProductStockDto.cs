using System.ComponentModel.DataAnnotations;

namespace StockService.DTOs
{
    public class ProductStockDto
    {
        public int IntEmpresa { get; set; }
        public int IntAno { get; set; }
        public int IntPeriodo { get; set; }
        public string StrProducto { get; set; } = string.Empty;
        public string StrDescripcion { get; set; } = string.Empty;
        public int IntBodega { get; set; }
        public string StrLote { get; set; } = string.Empty;
        public string StrTalla { get; set; } = string.Empty;
        public string StrColor { get; set; } = string.Empty;
        public string StrUbicacion { get; set; } = string.Empty;
        public decimal IntSaldoI { get; set; }
        public decimal IntEntradas { get; set; }
        public decimal IntSalidas { get; set; }
        public decimal IntCantidadFinal { get; set; }
    }
}
