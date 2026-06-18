using Microsoft.EntityFrameworkCore;
using StockService.Data;
using StockService.Models;
using StockService.Services;
using System.Data;
using System.Data.Common;
using Microsoft.Data.SqlClient;

namespace StockService.Repositories
{
    public class ProductRepository : IProductRepository
    {
        private readonly StockDbContext _context;
        private readonly ILogService _logService;

        public ProductRepository(StockDbContext context, ILogService logService)
        {
            _context = context;
            _logService = logService;
        }

        public async Task<IEnumerable<Product>> GetProductsByReferenceAsync(string reference)
        {
            var startTime = DateTime.UtcNow;

            _logService.LogInformation($"Getting products by reference: Reference={reference}");

            var sql = @"
                SELECT TOP (100) 
                    [StrIdProducto],
                    [StrDescripcion],
                    [Strauxiliar],
                    [StrCodAlterno],
                    [StrProductoPpal],
                    [StrLinea],
                    [StrGrupo],
                    [StrClase],
                    [StrTipo],
                    [StrUnidad],
                    [StrUndCompra],
                    [StrMoneda],
                    [StrProveedor],
                    [IntPrecio1],
                    [IntPrecio2],
                    [IntPrecio3],
                    [IntPrecio4],
                    [IntPrecio5],
                    [IntPrecio6],
                    [IntPrecio7],
                    [IntPrecio8],
                    [IntPorDesc1],
                    [IntPorDesc2],
                    [IntPorDesc3],
                    [IntPorDesc4],
                    [IntPorDesc5],
                    [IntPorDesc6],
                    [IntPorDesc7],
                    [IntPorDesc8],
                    [IntImpConsumo],
                    [IntPrecioSug],
                    [IntPrecioCompra],
                    [IntKardex],
                    [IntMovil],
                    [IntListaChequeo],
                    [IntManLote],
                    [IntIva],
                    [IntIvaMonofasico],
                    [IntRetencion],
                    [IntImpuesto1],
                    [IntIca],
                    [IntVigente],
                    [IntMarcado],
                    [IntAIU],
                    [IntPorcentaje],
                    [IntPFactor],
                    [IntActualizaDescripcion],
                    [IntActualizaPrecio],
                    [IntCapturaCantidad],
                    [StrDescripcion1],
                    [StrOrden],
                    [StrParam1],
                    [StrParam2],
                    [StrParam3],
                    [StrPParametro1],
                    [StrPParametro2],
                    [StrPParametro3],
                    [StrPParametro4],
                    [StrPParametro5],
                    [StrPParametro6],
                    [IntPuntos],
                    [IntPresupuesto],
                    [IntTotalCoef],
                    [IntDescuento],
                    [IntDescuentoMax],
                    [IntDescPromocion],
                    [DatFechaIPromocion],
                    [DatFechaFPromocion],
                    [IntControl],
                    [IntPeso],
                    [StrDescripcionCorta],
                    [DatFechaIProdHab],
                    [DatFechaFProdHab],
                    [DatFechaIProdNuevo],
                    [DatFechaFProdNuevo],
                    [IntHabilitar],
                    [IntBajoPedido],
                    [IntMostrarPedido],
                    [IntVisibilidad],
                    [IntMaximos],
                    [IntMinimos],
                    [IntHabilitarProd],
                    [DatFechaAct],
                    [DatFechaActMovil],
                    [DatFechaSmart],
                    [IdSeguridad],
                    [IntIncentivo],
                    [StrConceptoPago],
                    [StrParam4],
                    [StrParam5],
                    [StrParam6],
                    [StrParam7],
                    [StrParam8],
                    [StrParam9],
                    [StrDescripcionUrlEcomerce],
                    [IntAncho],
                    [IntAlto],
                    [IntLargo],
                    [IntFormaEmpaque],
                    [IntEmbalajeIndividual],
                    [IntPorcentajeProduccion],
                    [IntImpPlastico],
                    [IntProductoExcluido],
                    [IntImpuesto2],
                    [IntImpSaludable]
                FROM [CaterHginet].[dbo].[TblProductos] 
                WHERE StrIdProducto LIKE @Reference 
                   OR StrCodAlterno LIKE @Reference
                ORDER BY StrIdProducto";

            var parameter = new SqlParameter("@Reference", $"%{reference}%");

            var result = new List<Product>();

            try
            {
                using (var command = _context.Database.GetDbConnection().CreateCommand())
                {
                    command.CommandText = sql;
                    command.CommandType = CommandType.Text;
                    command.Parameters.Add(parameter);

                    if (command.Connection?.State != ConnectionState.Open)
                        await command.Connection!.OpenAsync();

                    using (var reader = await command.ExecuteReaderAsync())
                    {
                        while (await reader.ReadAsync())
                        {
                            result.Add(new Product
                            {
                                StrIdProducto = GetStringValue(reader, "StrIdProducto"),
                                StrDescripcion = GetStringValue(reader, "StrDescripcion"),
                                Strauxiliar = GetStringValue(reader, "Strauxiliar"),
                                StrCodAlterno = GetStringValue(reader, "StrCodAlterno"),
                                StrProductoPpal = GetStringValue(reader, "StrProductoPpal"),
                                StrLinea = GetStringValue(reader, "StrLinea"),
                                StrGrupo = GetStringValue(reader, "StrGrupo"),
                                StrClase = GetStringValue(reader, "StrClase"),
                                StrTipo = GetStringValue(reader, "StrTipo"),
                                StrUnidad = GetStringValue(reader, "StrUnidad"),
                                StrUndCompra = GetStringValue(reader, "StrUndCompra"),
                                StrMoneda = GetStringValue(reader, "StrMoneda"),
                                StrProveedor = GetStringValue(reader, "StrProveedor"),
                                IntPrecio1 = GetDecimalValue(reader, "IntPrecio1"),
                                IntPrecio2 = GetDecimalValue(reader, "IntPrecio2"),
                                IntPrecio3 = GetDecimalValue(reader, "IntPrecio3"),
                                IntPrecio4 = GetDecimalValue(reader, "IntPrecio4"),
                                IntPrecio5 = GetDecimalValue(reader, "IntPrecio5"),
                                IntPrecio6 = GetDecimalValue(reader, "IntPrecio6"),
                                IntPrecio7 = GetDecimalValue(reader, "IntPrecio7"),
                                IntPrecio8 = GetDecimalValue(reader, "IntPrecio8"),
                                IntPorDesc1 = GetDecimalValue(reader, "IntPorDesc1"),
                                IntPorDesc2 = GetDecimalValue(reader, "IntPorDesc2"),
                                IntPorDesc3 = GetDecimalValue(reader, "IntPorDesc3"),
                                IntPorDesc4 = GetDecimalValue(reader, "IntPorDesc4"),
                                IntPorDesc5 = GetDecimalValue(reader, "IntPorDesc5"),
                                IntPorDesc6 = GetDecimalValue(reader, "IntPorDesc6"),
                                IntPorDesc7 = GetDecimalValue(reader, "IntPorDesc7"),
                                IntPorDesc8 = GetDecimalValue(reader, "IntPorDesc8"),
                                IntPrecioSug = GetDecimalValue(reader, "IntPrecioSug"),
                                IntPrecioCompra = GetDecimalValue(reader, "IntPrecioCompra"),
                                IntKardex = GetInt32Value(reader, "IntKardex"),
                                IntMovil = GetInt32Value(reader, "IntMovil"),
                                IntListaChequeo = GetInt32Value(reader, "IntListaChequeo"),
                                IntManLote = GetInt32Value(reader, "IntManLote"),
                                IntIva = GetInt32Value(reader, "IntIva"),
                                IntIvaMonofasico = GetInt32Value(reader, "IntIvaMonofasico"),
                                IntRetencion = GetInt32Value(reader, "IntRetencion"),
                                IntImpuesto1 = GetInt32Value(reader, "IntImpuesto1"),
                                IntIca = GetInt32Value(reader, "IntIca"),
                                IntVigente = GetInt32Value(reader, "IntVigente"),
                                IntMarcado = GetInt32Value(reader, "IntMarcado"),
                                IntAIU = GetInt32Value(reader, "IntAIU"),
                                IntPorcentaje = GetDecimalValue(reader, "IntPorcentaje"),
                                IntPFactor = GetDecimalValue(reader, "IntPFactor"),
                                StrDescripcion1 = GetStringValue(reader, "StrDescripcion1"),
                                StrOrden = GetStringValue(reader, "StrOrden"),
                                StrParam1 = GetStringValue(reader, "StrParam1"),
                                StrParam2 = GetStringValue(reader, "StrParam2"),
                                StrParam3 = GetStringValue(reader, "StrParam3"),
                                IntPuntos = GetDecimalValue(reader, "IntPuntos"),
                                IntPresupuesto = GetDecimalValue(reader, "IntPresupuesto"),
                                IntTotalCoef = GetDecimalValue(reader, "IntTotalCoef"),
                                IntDescuento = GetDecimalValue(reader, "IntDescuento"),
                                IntDescuentoMax = GetDecimalValue(reader, "IntDescuentoMax"),
                                IntDescPromocion = GetDecimalValue(reader, "IntDescPromocion"),
                                DatFechaIPromocion = GetDateTimeValue(reader, "DatFechaIPromocion"),
                                DatFechaFPromocion = GetDateTimeValue(reader, "DatFechaFPromocion"),
                                IntControl = GetDecimalValue(reader, "IntControl"),
                                IntPeso = GetDecimalValue(reader, "IntPeso"),
                                StrDescripcionCorta = GetStringValue(reader, "StrDescripcionCorta"),
                                DatFechaIProdHab = GetDateTimeValue(reader, "DatFechaIProdHab"),
                                DatFechaFProdHab = GetDateTimeValue(reader, "DatFechaFProdHab"),
                                DatFechaIProdNuevo = GetDateTimeValue(reader, "DatFechaIProdNuevo"),
                                DatFechaFProdNuevo = GetDateTimeValue(reader, "DatFechaFProdNuevo"),
                                IntHabilitar = GetInt32Value(reader, "IntHabilitar"),
                                IntBajoPedido = GetInt32Value(reader, "IntBajoPedido"),
                                IntMostrarPedido = GetInt32Value(reader, "IntMostrarPedido"),
                                IntVisibilidad = GetInt32Value(reader, "IntVisibilidad"),
                                IntMaximos = GetDecimalValue(reader, "IntMaximos"),
                                IntMinimos = GetDecimalValue(reader, "IntMinimos"),
                                IntHabilitarProd = GetInt32Value(reader, "IntHabilitarProd"),
                                DatFechaAct = GetDateTimeValue(reader, "DatFechaAct"),
                                DatFechaActMovil = GetDateTimeValue(reader, "DatFechaActMovil"),
                                DatFechaSmart = GetDateTimeValue(reader, "DatFechaSmart"),
                                IdSeguridad = GetStringValue(reader, "IdSeguridad"),
                                IntIncentivo = GetDecimalValue(reader, "IntIncentivo"),
                                StrConceptoPago = GetStringValue(reader, "StrConceptoPago"),
                                StrParam4 = GetStringValue(reader, "StrParam4"),
                                StrParam5 = GetStringValue(reader, "StrParam5"),
                                StrParam6 = GetStringValue(reader, "StrParam6"),
                                StrParam7 = GetStringValue(reader, "StrParam7"),
                                StrParam8 = GetStringValue(reader, "StrParam8"),
                                StrParam9 = GetStringValue(reader, "StrParam9"),
                                StrDescripcionUrlEcomerce = GetStringValue(reader, "StrDescripcionUrlEcomerce"),
                                IntAncho = GetDecimalValue(reader, "IntAncho"),
                                IntAlto = GetDecimalValue(reader, "IntAlto"),
                                IntLargo = GetDecimalValue(reader, "IntLargo"),
                                IntFormaEmpaque = GetInt32Value(reader, "IntFormaEmpaque"),
                                IntEmbalajeIndividual = GetInt32Value(reader, "IntEmbalajeIndividual"),
                                IntPorcentajeProduccion = GetDecimalValue(reader, "IntPorcentajeProduccion"),
                                IntImpPlastico = GetInt32Value(reader, "IntImpPlastico"),
                                IntProductoExcluido = GetInt32Value(reader, "IntProductoExcluido"),
                                IntImpuesto2 = GetInt32Value(reader, "IntImpuesto2"),
                                IntImpSaludable = GetInt32Value(reader, "IntImpSaludable")
                            });
                        }
                    }
                }

                var duration = DateTime.UtcNow - startTime;
                _logService.LogDatabaseQuery(sql, duration);
                _logService.LogInformation($"Retrieved {result.Count} products for reference {reference}");

                return result;
            }
            catch (Exception ex)
            {
                _logService.LogError($"Error retrieving products for reference {reference}", ex);
                throw;
            }
        }

        public async Task<IEnumerable<string>> GetProductReferencesByDescriptionAsync(string description)
        {
            var startTime = DateTime.UtcNow;
            _logService.LogInformation($"Getting product references by description: Description={description}");

            var sql = @"
                SELECT DISTINCT [StrIdProducto]
                FROM [CaterHginet].[dbo].[TblProductos] 
                WHERE [StrDescripcion] LIKE @Description
                ORDER BY [StrIdProducto]";

            var parameter = new SqlParameter("@Description", $"%{description}%");
            var result = new List<string>();

            try
            {
                using (var command = _context.Database.GetDbConnection().CreateCommand())
                {
                    command.CommandText = sql;
                    command.CommandType = CommandType.Text;
                    command.Parameters.Add(parameter);

                    if (command.Connection?.State != ConnectionState.Open)
                        await command.Connection!.OpenAsync();

                    using (var reader = await command.ExecuteReaderAsync())
                    {
                        while (await reader.ReadAsync())
                        {
                            result.Add(GetStringValue(reader, "StrIdProducto"));
                        }
                    }
                }

                var duration = DateTime.UtcNow - startTime;
                _logService.LogDatabaseQuery(sql, duration);
                _logService.LogInformation($"Retrieved {result.Count} product references for description {description}");
                return result;
            }
            catch (Exception ex)
            {
                _logService.LogError($"Error retrieving product references for description {description}", ex);
                throw;
            }
        }

        // Helper methods to safely handle data type conversions
        private static string GetStringValue(DbDataReader reader, string columnName)
        {
            try
            {
                return reader.IsDBNull(columnName) ? string.Empty : reader.GetString(columnName);
            }
            catch
            {
                return string.Empty;
            }
        }

        private static int GetInt32Value(DbDataReader reader, string columnName)
        {
            try
            {
                if (reader.IsDBNull(columnName))
                    return 0;

                var value = reader.GetValue(columnName);
                return Convert.ToInt32(value);
            }
            catch
            {
                return 0;
            }
        }

        private static decimal GetDecimalValue(DbDataReader reader, string columnName)
        {
            try
            {
                if (reader.IsDBNull(columnName))
                    return 0;

                var value = reader.GetValue(columnName);
                return Convert.ToDecimal(value);
            }
            catch
            {
                return 0;
            }
        }

        private static DateTime? GetDateTimeValue(DbDataReader reader, string columnName)
        {
            try
            {
                if (reader.IsDBNull(columnName))
                    return null;

                return reader.GetDateTime(columnName);
            }
            catch
            {
                return null;
            }
        }
    }
}
