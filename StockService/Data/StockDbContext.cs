using Microsoft.EntityFrameworkCore;
using StockService.Models;

namespace StockService.Data
{
    public class StockDbContext : DbContext
    {
        public StockDbContext(DbContextOptions<StockDbContext> options) : base(options)
        {
        }

        public DbSet<Client> Clients { get; set; }
        public DbSet<ProductStock> ProductStocks { get; set; }
        public DbSet<ClientBI> ClientBIs { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // Configure Client entity
            modelBuilder.Entity<Client>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Name).IsRequired().HasMaxLength(100);
                entity.Property(e => e.Email).HasMaxLength(200);
                entity.Property(e => e.Phone).HasMaxLength(50);
                entity.Property(e => e.Address).HasMaxLength(500);
                entity.Property(e => e.City).HasMaxLength(100);
                entity.Property(e => e.Country).HasMaxLength(100);
                entity.Property(e => e.DiscountRate).HasColumnType("decimal(5,4)");
                entity.Property(e => e.IsActive).HasDefaultValue(true);
                entity.Property(e => e.CreatedAt).HasDefaultValueSql("GETDATE()");
                entity.Property(e => e.UpdatedAt).HasDefaultValueSql("GETDATE()");
            });



            // Configure ProductStock entity
            modelBuilder.Entity<ProductStock>(entity =>
            {
                entity.HasKey(e => new { e.IntEmpresa, e.IntAno, e.IntPeriodo, e.StrProducto, e.IntBodega, e.StrLote, e.StrTalla, e.StrColor });
                entity.Property(e => e.StrProducto).IsRequired().HasMaxLength(50);
                entity.Property(e => e.StrLote).HasMaxLength(50);
                entity.Property(e => e.StrTalla).HasMaxLength(20);
                entity.Property(e => e.StrColor).HasMaxLength(50);
                entity.Property(e => e.StrUbicacion).HasMaxLength(100);
                entity.Property(e => e.IntSaldoI).HasColumnType("decimal(18,8)");
                entity.Property(e => e.IntEntradas).HasColumnType("decimal(18,8)");
                entity.Property(e => e.IntSalidas).HasColumnType("decimal(18,8)");
                entity.Property(e => e.IntCantidadFinal).HasColumnType("decimal(18,8)");
            });

            // Configure ClientBI entity
            modelBuilder.Entity<ClientBI>(entity =>
            {
                entity.HasKey(e => e.StrTercero);
                entity.Property(e => e.StrTercero).IsRequired().HasMaxLength(50);
                entity.Property(e => e.NombreTercero).IsRequired().HasMaxLength(200);
            });

            // Ensure EF Core does not try to map Product as an entity (it's used only for raw SQL projections)
            modelBuilder.Ignore<Product>();
        }
    }
}
