using Microsoft.EntityFrameworkCore;
using StockService.Data;
using StockService.Models;
using StockService.DTOs;
using StockService.Services;
using System.Data;
using System.Data.Common;
using Microsoft.Data.SqlClient;

namespace StockService.Repositories
{
    public class ProductStockRepository : IProductStockRepository
    {
        private readonly StockDbContext _context;
        private readonly ILogService _logService;

        public ProductStockRepository(StockDbContext context, ILogService logService)
        {
            _context = context;
            _logService = logService;
        }

        public async Task<IEnumerable<ProductStock>> GetProductStockAsync(string strProducto)
        {
            return await GetProductStockByReferenceAsync(strProducto);
        }

        public async Task<IEnumerable<ProductStock>> GetProductStockByProductAsync(string strProducto)
        {
            return await GetProductStockByReferenceAsync(strProducto);
        }

        public async Task<IEnumerable<ProductStock>> GetProductStockByReferenceAsync(string reference)
        {
            var startTime = DateTime.UtcNow;
            var currentYear = DateTime.Now.Year;
            var currentMonth = DateTime.Now.Month;

            _logService.LogInformation($"Getting product stock: Reference={reference}, Year={currentYear}, Month={currentMonth}");

            var sql = @"
                SELECT TOP (1000) 
                    s.[IntEmpresa],
                    s.[intano],
                    s.[intperiodo],
                    s.[StrProducto],
                    p.[StrDescripcion],
                    s.[intBodega],
                    s.[StrLote],
                    s.[StrTalla],
                    s.[StrColor],
                    s.[StrUbicacion],
                    s.[IntSaldoI],
                    s.[IntEntradas],
                    s.[IntSalidas],
                    s.[IntCantidadFinal]
                FROM [CaterHginet].[dbo].[QrySaldosInvCant] s
                LEFT JOIN [CaterHginet].[dbo].[TblProductos] p ON s.[StrProducto] = p.[StrIdProducto]
                WHERE s.[StrProducto] = @Reference 
                  AND s.[intano] = @CurrentYear 
                  AND s.[intperiodo] = @CurrentMonth";

            var parameters = new List<SqlParameter>
            {
                new SqlParameter("@Reference", reference),
                new SqlParameter("@CurrentYear", currentYear),
                new SqlParameter("@CurrentMonth", currentMonth)
            };

            sql += " ORDER BY intBodega, StrProducto";

            var result = new List<ProductStock>();

            try
            {
                using (var command = _context.Database.GetDbConnection().CreateCommand())
                {
                    command.CommandText = sql;
                    command.CommandType = CommandType.Text;

                    foreach (var parameter in parameters)
                    {
                        command.Parameters.Add(parameter);
                    }

                    if (command.Connection?.State != ConnectionState.Open)
                        await command.Connection!.OpenAsync();

                    using (var reader = await command.ExecuteReaderAsync())
                    {
                        while (await reader.ReadAsync())
                        {
                            result.Add(new ProductStock
                            {
                                IntEmpresa = GetInt32Value(reader, "IntEmpresa"),
                                IntAno = GetInt32Value(reader, "intano"),
                                IntPeriodo = GetInt32Value(reader, "intperiodo"),
                                StrProducto = GetStringValue(reader, "StrProducto"),
                                StrDescripcion = GetStringValue(reader, "StrDescripcion"),
                                IntBodega = GetInt32Value(reader, "intBodega"),
                                StrLote = GetStringValue(reader, "StrLote"),
                                StrTalla = GetStringValue(reader, "StrTalla"),
                                StrColor = GetStringValue(reader, "StrColor"),
                                StrUbicacion = GetStringValue(reader, "StrUbicacion"),
                                IntSaldoI = GetDecimalValue(reader, "IntSaldoI"),
                                IntEntradas = GetDecimalValue(reader, "IntEntradas"),
                                IntSalidas = GetDecimalValue(reader, "IntSalidas"),
                                IntCantidadFinal = GetDecimalValue(reader, "IntCantidadFinal")
                            });
                        }
                    }
                }

                var duration = DateTime.UtcNow - startTime;
                _logService.LogDatabaseQuery(sql, duration);
                _logService.LogInformation($"Retrieved {result.Count} product stock records for reference {reference}");

                return result;
            }
            catch (Exception ex)
            {
                _logService.LogError($"Error retrieving product stock for {reference}", ex);
                throw;
            }
        }

        public async Task<IEnumerable<ProductStock>> GetProductStockByReferencesAsync(IEnumerable<string> references)
        {
            var startTime = DateTime.UtcNow;
            var currentYear = DateTime.Now.Year;
            var currentMonth = DateTime.Now.Month;
            var referencesList = references.ToList();

            _logService.LogInformation($"Getting product stock for multiple references: Count={referencesList.Count}, Year={currentYear}, Month={currentMonth}");

            if (!referencesList.Any())
            {
                _logService.LogInformation("No references provided, returning empty result");
                return new List<ProductStock>();
            }

            // Build IN clause for multiple references
            var inClause = string.Join(",", referencesList.Select((_, index) => $"@Reference{index}"));
            
            var sql = $@"
                SELECT TOP (1000) 
                    s.[IntEmpresa],
                    s.[intano],
                    s.[intperiodo],
                    s.[StrProducto],
                    p.[StrDescripcion],
                    s.[intBodega],
                    s.[StrLote],
                    s.[StrTalla],
                    s.[StrColor],
                    s.[StrUbicacion],
                    s.[IntSaldoI],
                    s.[IntEntradas],
                    s.[IntSalidas],
                    s.[IntCantidadFinal]
                FROM [CaterHginet].[dbo].[QrySaldosInvCant] s
                LEFT JOIN [CaterHginet].[dbo].[TblProductos] p ON s.[StrProducto] = p.[StrIdProducto]
                WHERE s.[StrProducto] IN ({inClause})
                  AND s.[intano] = @CurrentYear 
                  AND s.[intperiodo] = @CurrentMonth
                ORDER BY s.[intBodega], s.[StrProducto]";

            var parameters = new List<SqlParameter>
            {
                new SqlParameter("@CurrentYear", currentYear),
                new SqlParameter("@CurrentMonth", currentMonth)
            };

            // Add parameters for each reference
            for (int i = 0; i < referencesList.Count; i++)
            {
                parameters.Add(new SqlParameter($"@Reference{i}", referencesList[i]));
            }

            var result = new List<ProductStock>();

            try
            {
                using (var command = _context.Database.GetDbConnection().CreateCommand())
                {
                    command.CommandText = sql;
                    command.CommandType = CommandType.Text;

                    foreach (var parameter in parameters)
                    {
                        command.Parameters.Add(parameter);
                    }

                    if (command.Connection?.State != ConnectionState.Open)
                        await command.Connection!.OpenAsync();

                    using (var reader = await command.ExecuteReaderAsync())
                    {
                        while (await reader.ReadAsync())
                        {
                            result.Add(new ProductStock
                            {
                                IntEmpresa = GetInt32Value(reader, "IntEmpresa"),
                                IntAno = GetInt32Value(reader, "intano"),
                                IntPeriodo = GetInt32Value(reader, "intperiodo"),
                                StrProducto = GetStringValue(reader, "StrProducto"),
                                StrDescripcion = GetStringValue(reader, "StrDescripcion"),
                                IntBodega = GetInt32Value(reader, "intBodega"),
                                StrLote = GetStringValue(reader, "StrLote"),
                                StrTalla = GetStringValue(reader, "StrTalla"),
                                StrColor = GetStringValue(reader, "StrColor"),
                                StrUbicacion = GetStringValue(reader, "StrUbicacion"),
                                IntSaldoI = GetDecimalValue(reader, "IntSaldoI"),
                                IntEntradas = GetDecimalValue(reader, "IntEntradas"),
                                IntSalidas = GetDecimalValue(reader, "IntSalidas"),
                                IntCantidadFinal = GetDecimalValue(reader, "IntCantidadFinal")
                            });
                        }
                    }
                }

                var duration = DateTime.UtcNow - startTime;
                _logService.LogDatabaseQuery(sql, duration);
                _logService.LogInformation($"Retrieved {result.Count} product stock records for {referencesList.Count} references");

                return result;
            }
            catch (Exception ex)
            {
                _logService.LogError($"Error retrieving product stock for references: {string.Join(", ", referencesList)}", ex);
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

                // Handle different integer types safely
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

                // Handle different numeric types safely
                var value = reader.GetValue(columnName);
                return Convert.ToDecimal(value);
            }
            catch
            {
                return 0;
            }
        }
    }
}
