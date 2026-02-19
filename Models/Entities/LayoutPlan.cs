namespace Capet_OPS.Models.Entities;

public class LayoutPlan
{
    public int Id { get; set; }
    public string PlanCode { get; set; } = string.Empty;
    public int CanvasTypeId { get; set; }
    public decimal RollWidth { get; set; }
    public decimal TotalLength { get; set; }
    public decimal TotalArea { get; set; }
    public decimal UsedArea { get; set; }
    public decimal WasteArea { get; set; }
    public decimal EfficiencyPct { get; set; }
    public int PieceCount { get; set; }
    public int JoinedRollCount { get; set; } = 1;
    public string Status { get; set; } = "planned";
    public string? LayoutJson { get; set; }
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public CanvasType CanvasType { get; set; } = null!;
    public ICollection<LayoutPlanItem> Items { get; set; } = new List<LayoutPlanItem>();
    public ICollection<PlannedBarcode> PlannedBarcodes { get; set; } = new List<PlannedBarcode>();
}
