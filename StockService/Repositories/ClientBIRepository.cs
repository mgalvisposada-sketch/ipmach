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
    public class ClientBIRepository : IClientBIRepository
    {
        private readonly StockDbContext _context;
        private readonly ILogService _logService;

        public ClientBIRepository(StockDbContext context, ILogService logService)
        {
            _context = context;
            _logService = logService;
        }

        public async Task<IEnumerable<ClientBI>> GetAllClientsAsync()
        {
            var startTime = DateTime.UtcNow;
            _logService.LogInformation("Getting all clients from TblTerceros");

            var sql = @"
                SELECT TOP (1000)
                    [StrIdTercero] AS StrTercero,
                    [StrNombre]     AS NombreTercero,
                    [StrTipoId],
                    [IntIdentificacion],
                    [StrApellido1],
                    [StrDireccion],
                    [StrCodPostal],
                    [StrTelefono],
                    [StrCelular],
                    [IntTipoTercero]
                FROM [CaterHginet].[dbo].[TblTerceros]
                ORDER BY [StrNombre]";

            var result = new List<ClientBI>();

            try
            {
                using (var command = _context.Database.GetDbConnection().CreateCommand())
                {
                    command.CommandText = sql;
                    command.CommandType = CommandType.Text;

                    if (command.Connection?.State != ConnectionState.Open)
                        await command.Connection!.OpenAsync();

                    using (var reader = await command.ExecuteReaderAsync())
                    {
                        while (await reader.ReadAsync())
                        {
                            result.Add(new ClientBI
                            {
                                StrTercero = reader.GetString("StrTercero"),
                                NombreTercero = reader.IsDBNull("NombreTercero") ? string.Empty : reader.GetString("NombreTercero"),
                                StrTipoId = reader.IsDBNull("StrTipoId") ? string.Empty : reader.GetString("StrTipoId"),
                                IntIdentificacion = GetInt64Value(reader, "IntIdentificacion"),
                                StrApellido1 = reader.IsDBNull("StrApellido1") ? string.Empty : reader.GetString("StrApellido1"),
                                StrDireccion = reader.IsDBNull("StrDireccion") ? string.Empty : reader.GetString("StrDireccion"),
                                StrCodPostal = reader.IsDBNull("StrCodPostal") ? string.Empty : reader.GetString("StrCodPostal"),
                                StrTelefono = reader.IsDBNull("StrTelefono") ? string.Empty : reader.GetString("StrTelefono"),
                                StrCelular = reader.IsDBNull("StrCelular") ? string.Empty : reader.GetString("StrCelular"),
                                IntTipoTercero = GetInt32Value(reader, "IntTipoTercero")
                            });
                        }
                    }
                }

                var duration = DateTime.UtcNow - startTime;
                _logService.LogDatabaseQuery(sql, duration);
                _logService.LogInformation($"Retrieved {result.Count} clients from TblTerceros");

                return result;
            }
            catch (Exception ex)
            {
                _logService.LogError("Error retrieving all clients from TblTerceros", ex);
                throw;
            }
        }

        public async Task<IEnumerable<ClientBI>> SearchClientsAsync(string searchTerm)
        {
            var startTime = DateTime.UtcNow;
            _logService.LogInformation($"Searching clients in TblTerceros with term: {searchTerm}");

            var sql = @"
                SELECT TOP (1000)
                    [StrIdTercero] AS StrTercero,
                    [StrNombre]     AS NombreTercero,
                    [StrTipoId],
                    [IntIdentificacion],
                    [StrApellido1],
                    [StrDireccion],
                    [StrCodPostal],
                    [StrTelefono],
                    [StrCelular],
                    [IntTipoTercero]
                FROM [CaterHginet].[dbo].[TblTerceros]
                WHERE [StrNombre] LIKE @SearchTerm
                   OR [StrIdTercero] LIKE @SearchTerm
                ORDER BY [StrNombre]";

            var result = new List<ClientBI>();

            try
            {
                using (var command = _context.Database.GetDbConnection().CreateCommand())
                {
                    command.CommandText = sql;
                    command.CommandType = CommandType.Text;
                    command.Parameters.Add(new SqlParameter("@SearchTerm", $"%{searchTerm}%"));

                    if (command.Connection?.State != ConnectionState.Open)
                        await command.Connection!.OpenAsync();

                    using (var reader = await command.ExecuteReaderAsync())
                    {
                        while (await reader.ReadAsync())
                        {
                            result.Add(new ClientBI
                            {
                                StrTercero = reader.GetString("StrTercero"),
                                NombreTercero = reader.IsDBNull("NombreTercero") ? string.Empty : reader.GetString("NombreTercero"),
                                StrTipoId = reader.IsDBNull("StrTipoId") ? string.Empty : reader.GetString("StrTipoId"),
                                IntIdentificacion = GetInt64Value(reader, "IntIdentificacion"),
                                StrApellido1 = reader.IsDBNull("StrApellido1") ? string.Empty : reader.GetString("StrApellido1"),
                                StrDireccion = reader.IsDBNull("StrDireccion") ? string.Empty : reader.GetString("StrDireccion"),
                                StrCodPostal = reader.IsDBNull("StrCodPostal") ? string.Empty : reader.GetString("StrCodPostal"),
                                StrTelefono = reader.IsDBNull("StrTelefono") ? string.Empty : reader.GetString("StrTelefono"),
                                StrCelular = reader.IsDBNull("StrCelular") ? string.Empty : reader.GetString("StrCelular"),
                                IntTipoTercero = GetInt32Value(reader, "IntTipoTercero")
                            });
                        }
                    }
                }

                var duration = DateTime.UtcNow - startTime;
                _logService.LogDatabaseQuery(sql, duration);
                _logService.LogInformation($"Found {result.Count} clients in TblTerceros matching '{searchTerm}'");

                return result;
            }
            catch (Exception ex)
            {
                _logService.LogError($"Error searching clients in TblTerceros with term '{searchTerm}'", ex);
                throw;
            }
        }

        private static long GetInt64Value(DbDataReader reader, string columnName)
        {
            try
            {
                if (reader.IsDBNull(columnName)) return 0;
                var obj = reader.GetValue(columnName);
                if (obj is long l) return l;
                if (obj is int i) return i;
                if (obj is decimal dec) return (long)dec;
                var s = Convert.ToString(obj) ?? string.Empty;
                if (long.TryParse(s, out var parsed)) return parsed;
                if (decimal.TryParse(s, out var parsedDec)) return (long)parsedDec;
                return 0;
            }
            catch
            {
                return 0;
            }
        }

        private static int GetInt32Value(DbDataReader reader, string columnName)
        {
            try
            {
                if (reader.IsDBNull(columnName)) return 0;
                var obj = reader.GetValue(columnName);
                if (obj is int i) return i;
                if (obj is long l) return (int)l;
                if (obj is decimal dec) return (int)dec;
                var s = Convert.ToString(obj) ?? string.Empty;
                if (int.TryParse(s, out var parsed)) return parsed;
                if (decimal.TryParse(s, out var parsedDec)) return (int)parsedDec;
                return 0;
            }
            catch
            {
                return 0;
            }
        }
    }
}
