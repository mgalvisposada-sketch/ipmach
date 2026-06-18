using System.ComponentModel.DataAnnotations;

namespace StockService.DTOs
{
    public class ClientBIDto
    {
        public string StrTercero { get; set; } = string.Empty; // StrIdTercero
        public string NombreTercero { get; set; } = string.Empty; // StrNombre
        public string StrTipoId { get; set; } = string.Empty;
        public long IntIdentificacion { get; set; }
        public string StrApellido1 { get; set; } = string.Empty;
        public string StrDireccion { get; set; } = string.Empty;
        public string StrCodPostal { get; set; } = string.Empty;
        public string StrTelefono { get; set; } = string.Empty;
        public string StrCelular { get; set; } = string.Empty;
        public int IntTipoTercero { get; set; }
    }
}

