namespace Capet_OPS.Models.Dtos;

public class SavePlanRequestDto
{
    public int CanvasTypeId { get; set; }
    public decimal RollWidth { get; set; }
    public decimal TotalLength { get; set; }
    public decimal TotalArea { get; set; }
    public decimal UsedArea { get; set; }
    public decimal WasteArea { get; set; }
    public decimal EfficiencyPct { get; set; }
    public int PieceCount { get; set; }
    public string? Notes { get; set; }
    public List<PackedItemDto> PackedItems { get; set; } = new();
}
