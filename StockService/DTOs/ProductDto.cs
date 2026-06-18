using System.ComponentModel.DataAnnotations;

namespace StockService.DTOs
{
    public class ProductDto
    {
        public string StrIdProducto { get; set; } = string.Empty;
        public string StrDescripcion { get; set; } = string.Empty;
        public string StrCodAlterno { get; set; } = string.Empty;
        public string StrLinea { get; set; } = string.Empty;
        public string StrGrupo { get; set; } = string.Empty;
        public string StrClase { get; set; } = string.Empty;
        public string StrTipo { get; set; } = string.Empty;
        public string StrUnidad { get; set; } = string.Empty;
        public string StrMoneda { get; set; } = string.Empty;
        public string StrProveedor { get; set; } = string.Empty;
        
        // Pricing
        public decimal IntPrecio1 { get; set; }
        public decimal IntPrecio2 { get; set; }
        public decimal IntPrecio3 { get; set; }
        public decimal IntPrecio4 { get; set; }
        public decimal IntPrecio5 { get; set; }
        public decimal IntPrecio6 { get; set; }
        public decimal IntPrecio7 { get; set; }
        public decimal IntPrecio8 { get; set; }
        public decimal IntPrecioSug { get; set; }
        public decimal IntPrecioCompra { get; set; }
        
        // Status
        public int IntVigente { get; set; }
        public int IntHabilitar { get; set; }
        public int IntKardex { get; set; }
        public int IntIva { get; set; }
        public int IntIca { get; set; }
        
        // Additional Info
        public string StrDescripcionCorta { get; set; } = string.Empty;
        public decimal IntPeso { get; set; }
        public DateTime? DatFechaAct { get; set; }
        public string IdSeguridad { get; set; } = string.Empty;
    }

    public class ProductSearchDto
    {
        [Required]
        [MaxLength(50)]
        public string Reference { get; set; } = string.Empty;

        public int? ClientId { get; set; }
    }

    public class ProductCreateDto
    {
        [Required]
        [MaxLength(50)]
        public string Reference { get; set; } = string.Empty;

        [MaxLength(500)]
        public string? Description { get; set; }

        [MaxLength(100)]
        public string? Brand { get; set; }

        [MaxLength(100)]
        public string? Model { get; set; }

        [MaxLength(100)]
        public string? Category { get; set; }

        [MaxLength(100)]
        public string? Location { get; set; }

        public decimal BasePriceUSD { get; set; }

        public int StockQty { get; set; } = 0;

        public int MinimumStock { get; set; } = 0;
    }

    public class ProductUpdateDto
    {
        [MaxLength(500)]
        public string? Description { get; set; }

        [MaxLength(100)]
        public string? Brand { get; set; }

        [MaxLength(100)]
        public string? Model { get; set; }

        [MaxLength(100)]
        public string? Category { get; set; }

        [MaxLength(100)]
        public string? Location { get; set; }

        public decimal? BasePriceUSD { get; set; }

        public int? StockQty { get; set; }

        public int? MinimumStock { get; set; }

        public bool? IsActive { get; set; }
    }
}
