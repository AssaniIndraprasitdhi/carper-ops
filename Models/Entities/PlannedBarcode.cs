namespace Capet_OPS.Models.Entities;

public class PlannedBarcode
{
    public int Id { get; set; }
    public string BarcodeNo { get; set; } = string.Empty;
    public int LayoutPlanId { get; set; }
    public DateTime PlannedAt { get; set; } = DateTime.UtcNow;

    public LayoutPlan LayoutPlan { get; set; } = null!;
}
