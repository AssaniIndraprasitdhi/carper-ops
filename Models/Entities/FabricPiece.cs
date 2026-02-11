namespace Capet_OPS.Models.Entities;

public class FabricPiece
{
    public int Id { get; set; }
    public string BarcodeNo { get; set; } = string.Empty;
    public string Orno { get; set; } = string.Empty;
    public string? ListNo { get; set; }
    public string? ItemNo { get; set; }
    public string CnvId { get; set; } = string.Empty;
    public string? CnvDesc { get; set; }
    public string? AsPlan { get; set; }
    public decimal Width { get; set; }
    public decimal Length { get; set; }
    public decimal? Sqm { get; set; }
    public int? Qty { get; set; }
    public string? OrderType { get; set; }
    public DateTime SyncedAt { get; set; } = DateTime.UtcNow;
}
