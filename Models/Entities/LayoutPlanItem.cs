namespace Capet_OPS.Models.Entities;

public class LayoutPlanItem
{
    public int Id { get; set; }
    public int LayoutPlanId { get; set; }
    public string BarcodeNo { get; set; } = string.Empty;
    public string Orno { get; set; } = string.Empty;
    public string? ListNo { get; set; }
    public string? ItemNo { get; set; }
    public string? CnvId { get; set; }
    public string? CnvDesc { get; set; }
    public string? AsPlan { get; set; }
    public decimal Width { get; set; }
    public decimal Length { get; set; }
    public decimal Area { get; set; }
    public int Qty { get; set; } = 1;
    public string? OrderType { get; set; }
    public decimal PackX { get; set; }
    public decimal PackY { get; set; }
    public decimal PackWidth { get; set; }
    public decimal PackLength { get; set; }
    public bool IsRotated { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public LayoutPlan LayoutPlan { get; set; } = null!;
}
