using System.ComponentModel.DataAnnotations;

namespace StockService.Models
{
    public class Product
    {
        // Core Identification
        public string StrIdProducto { get; set; } = string.Empty;
        public string StrDescripcion { get; set; } = string.Empty;
        public string Strauxiliar { get; set; } = string.Empty;
        public string StrCodAlterno { get; set; } = string.Empty;
        public string StrProductoPpal { get; set; } = string.Empty;
        
        // Classification
        public string StrLinea { get; set; } = string.Empty;
        public string StrGrupo { get; set; } = string.Empty;
        public string StrClase { get; set; } = string.Empty;
        public string StrTipo { get; set; } = string.Empty;
        
        // Units and Currency
        public string StrUnidad { get; set; } = string.Empty;
        public string StrUndCompra { get; set; } = string.Empty;
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
        
        // Discounts
        public decimal IntPorDesc1 { get; set; }
        public decimal IntPorDesc2 { get; set; }
        public decimal IntPorDesc3 { get; set; }
        public decimal IntPorDesc4 { get; set; }
        public decimal IntPorDesc5 { get; set; }
        public decimal IntPorDesc6 { get; set; }
        public decimal IntPorDesc7 { get; set; }
        public decimal IntPorDesc8 { get; set; }
        
        // Status & Control
        public int IntVigente { get; set; }
        public int IntHabilitar { get; set; }
        public int IntKardex { get; set; }
        public int IntMovil { get; set; }
        public int IntListaChequeo { get; set; }
        public int IntManLote { get; set; }
        public int IntIva { get; set; }
        public int IntIvaMonofasico { get; set; }
        public int IntRetencion { get; set; }
        public int IntImpuesto1 { get; set; }
        public int IntIca { get; set; }
        public int IntMarcado { get; set; }
        public int IntAIU { get; set; }
        public decimal IntPorcentaje { get; set; }
        public decimal IntPFactor { get; set; }
        
        // Additional Information
        public string StrDescripcion1 { get; set; } = string.Empty;
        public string StrOrden { get; set; } = string.Empty;
        public string StrParam1 { get; set; } = string.Empty;
        public string StrParam2 { get; set; } = string.Empty;
        public string StrParam3 { get; set; } = string.Empty;
        public decimal IntPuntos { get; set; }
        public decimal IntPresupuesto { get; set; }
        public decimal IntTotalCoef { get; set; }
        public decimal IntDescuento { get; set; }
        public decimal IntDescuentoMax { get; set; }
        public decimal IntDescPromocion { get; set; }
        public DateTime? DatFechaIPromocion { get; set; }
        public DateTime? DatFechaFPromocion { get; set; }
        public decimal IntControl { get; set; }
        public decimal IntPeso { get; set; }
        public string StrDescripcionCorta { get; set; } = string.Empty;
        public DateTime? DatFechaIProdHab { get; set; }
        public DateTime? DatFechaFProdHab { get; set; }
        public DateTime? DatFechaIProdNuevo { get; set; }
        public DateTime? DatFechaFProdNuevo { get; set; }
        public int IntBajoPedido { get; set; }
        public int IntMostrarPedido { get; set; }
        public int IntVisibilidad { get; set; }
        public decimal IntMaximos { get; set; }
        public decimal IntMinimos { get; set; }
        public int IntHabilitarProd { get; set; }
        public DateTime? DatFechaAct { get; set; }
        public DateTime? DatFechaActMovil { get; set; }
        public DateTime? DatFechaSmart { get; set; }
        public string IdSeguridad { get; set; } = string.Empty;
        public decimal IntIncentivo { get; set; }
        public string StrConceptoPago { get; set; } = string.Empty;
        public string StrParam4 { get; set; } = string.Empty;
        public string StrParam5 { get; set; } = string.Empty;
        public string StrParam6 { get; set; } = string.Empty;
        public string StrParam7 { get; set; } = string.Empty;
        public string StrParam8 { get; set; } = string.Empty;
        public string StrParam9 { get; set; } = string.Empty;
        public string StrDescripcionUrlEcomerce { get; set; } = string.Empty;
        public decimal IntAncho { get; set; }
        public decimal IntAlto { get; set; }
        public decimal IntLargo { get; set; }
        public int IntFormaEmpaque { get; set; }
        public int IntEmbalajeIndividual { get; set; }
        public decimal IntPorcentajeProduccion { get; set; }
        public int IntImpPlastico { get; set; }
        public int IntProductoExcluido { get; set; }
        public int IntImpuesto2 { get; set; }
        public int IntImpSaludable { get; set; }
    }
}
