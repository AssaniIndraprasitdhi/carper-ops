using Microsoft.EntityFrameworkCore;
using Capet_OPS.Models.Entities;

namespace Capet_OPS.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<CanvasType> CanvasTypes => Set<CanvasType>();
    public DbSet<FabricPiece> FabricPieces => Set<FabricPiece>();
    public DbSet<LayoutPlan> LayoutPlans => Set<LayoutPlan>();
    public DbSet<LayoutPlanItem> LayoutPlanItems => Set<LayoutPlanItem>();
    public DbSet<PlannedBarcode> PlannedBarcodes => Set<PlannedBarcode>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<CanvasType>(entity =>
        {
            entity.ToTable("fabric_types");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.ErpCode).HasColumnName("erp_code").HasMaxLength(20).IsRequired();
            entity.Property(e => e.CnvDesc).HasColumnName("cnv_desc").HasMaxLength(100).IsRequired();
            entity.Property(e => e.RollWidth).HasColumnName("roll_width").HasColumnType("decimal(10,2)");
            entity.Property(e => e.IsActive).HasColumnName("is_active").HasDefaultValue(true);
            entity.Property(e => e.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("NOW()");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at").HasDefaultValueSql("NOW()");
            entity.Property(e => e.CnvId).HasColumnName("cnv_id").HasMaxLength(20).IsRequired();
            entity.HasIndex(e => e.ErpCode).IsUnique();
        });

        modelBuilder.Entity<FabricPiece>(entity =>
        {
            entity.ToTable("fabric_pieces");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.BarcodeNo).HasColumnName("barcode_no").HasMaxLength(50).IsRequired();
            entity.Property(e => e.Orno).HasColumnName("orno").HasMaxLength(30).IsRequired();
            entity.Property(e => e.ListNo).HasColumnName("list_no").HasMaxLength(20);
            entity.Property(e => e.ItemNo).HasColumnName("item_no").HasMaxLength(50);
            entity.Property(e => e.CnvId).HasColumnName("cnv_id").HasMaxLength(20).IsRequired();
            entity.Property(e => e.CnvDesc).HasColumnName("cnv_desc").HasMaxLength(100);
            entity.Property(e => e.AsPlan).HasColumnName("as_plan").HasMaxLength(50);
            entity.Property(e => e.Width).HasColumnName("width").HasColumnType("decimal(10,4)");
            entity.Property(e => e.Length).HasColumnName("length").HasColumnType("decimal(10,4)");
            entity.Property(e => e.Sqm).HasColumnName("sqm").HasColumnType("decimal(12,4)");
            entity.Property(e => e.Qty).HasColumnName("qty");
            entity.Property(e => e.OrderType).HasColumnName("order_type").HasMaxLength(10);
            entity.Property(e => e.SyncedAt).HasColumnName("synced_at").HasDefaultValueSql("NOW()");
            entity.HasIndex(e => e.BarcodeNo).IsUnique();
            entity.HasIndex(e => e.CnvId);
            entity.HasIndex(e => e.Orno);
        });

        modelBuilder.Entity<LayoutPlan>(entity =>
        {
            entity.ToTable("layout_plans");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.PlanCode).HasColumnName("plan_code").HasMaxLength(30).IsRequired();
            entity.Property(e => e.CanvasTypeId).HasColumnName("fabric_type_id");
            entity.Property(e => e.RollWidth).HasColumnName("roll_width").HasColumnType("decimal(10,2)");
            entity.Property(e => e.TotalLength).HasColumnName("total_length").HasColumnType("decimal(10,2)");
            entity.Property(e => e.TotalArea).HasColumnName("total_area").HasColumnType("decimal(12,4)");
            entity.Property(e => e.UsedArea).HasColumnName("used_area").HasColumnType("decimal(12,4)");
            entity.Property(e => e.WasteArea).HasColumnName("waste_area").HasColumnType("decimal(12,4)");
            entity.Property(e => e.EfficiencyPct).HasColumnName("efficiency_pct").HasColumnType("decimal(5,2)");
            entity.Property(e => e.PieceCount).HasColumnName("piece_count");
            entity.Property(e => e.Status).HasColumnName("status").HasMaxLength(20).HasDefaultValue("planned");
            entity.Property(e => e.LayoutJson).HasColumnName("layout_json").HasColumnType("jsonb");
            entity.Property(e => e.Notes).HasColumnName("notes");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("NOW()");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at").HasDefaultValueSql("NOW()");
            entity.HasIndex(e => e.PlanCode).IsUnique();
            entity.HasIndex(e => e.Status);
            entity.HasIndex(e => e.CanvasTypeId);

            entity.HasOne(e => e.CanvasType).WithMany().HasForeignKey(e => e.CanvasTypeId);
            entity.HasMany(e => e.Items).WithOne(i => i.LayoutPlan).HasForeignKey(i => i.LayoutPlanId).OnDelete(DeleteBehavior.Cascade);
            entity.HasMany(e => e.PlannedBarcodes).WithOne(b => b.LayoutPlan).HasForeignKey(b => b.LayoutPlanId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<LayoutPlanItem>(entity =>
        {
            entity.ToTable("layout_plan_items");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.LayoutPlanId).HasColumnName("layout_plan_id");
            entity.Property(e => e.BarcodeNo).HasColumnName("barcode_no").HasMaxLength(50).IsRequired();
            entity.Property(e => e.Orno).HasColumnName("orno").HasMaxLength(30).IsRequired();
            entity.Property(e => e.ListNo).HasColumnName("list_no").HasMaxLength(20);
            entity.Property(e => e.ItemNo).HasColumnName("item_no").HasMaxLength(50);
            entity.Property(e => e.CnvId).HasColumnName("cnv_id").HasMaxLength(20);
            entity.Property(e => e.CnvDesc).HasColumnName("cnv_desc").HasMaxLength(100);
            entity.Property(e => e.AsPlan).HasColumnName("as_plan").HasMaxLength(50);
            entity.Property(e => e.Width).HasColumnName("width").HasColumnType("decimal(10,4)");
            entity.Property(e => e.Length).HasColumnName("length").HasColumnType("decimal(10,4)");
            entity.Property(e => e.Area).HasColumnName("area").HasColumnType("decimal(12,4)");
            entity.Property(e => e.Qty).HasColumnName("qty").HasDefaultValue(1);
            entity.Property(e => e.OrderType).HasColumnName("order_type").HasMaxLength(10);
            entity.Property(e => e.PackX).HasColumnName("pack_x").HasColumnType("decimal(10,4)").HasDefaultValue(0);
            entity.Property(e => e.PackY).HasColumnName("pack_y").HasColumnType("decimal(10,4)").HasDefaultValue(0);
            entity.Property(e => e.PackWidth).HasColumnName("pack_width").HasColumnType("decimal(10,4)");
            entity.Property(e => e.PackLength).HasColumnName("pack_length").HasColumnType("decimal(10,4)");
            entity.Property(e => e.IsRotated).HasColumnName("is_rotated").HasDefaultValue(false);
            entity.Property(e => e.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("NOW()");
            entity.HasIndex(e => e.LayoutPlanId);
            entity.HasIndex(e => e.BarcodeNo);
        });

        modelBuilder.Entity<PlannedBarcode>(entity =>
        {
            entity.ToTable("planned_barcodes");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.BarcodeNo).HasColumnName("barcode_no").HasMaxLength(50).IsRequired();
            entity.Property(e => e.LayoutPlanId).HasColumnName("layout_plan_id");
            entity.Property(e => e.PlannedAt).HasColumnName("planned_at").HasDefaultValueSql("NOW()");
            entity.HasIndex(e => e.BarcodeNo).IsUnique();
        });
    }
}
