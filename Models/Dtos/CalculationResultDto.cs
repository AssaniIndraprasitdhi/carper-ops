namespace Capet_OPS.Models.Dtos;

public class CalculationResultDto
{
    public decimal RollWidth { get; set; }
    public decimal TotalLength { get; set; }
    public decimal TotalArea { get; set; }
    public decimal UsedArea { get; set; }
    public decimal WasteArea { get; set; }
    public decimal EfficiencyPct { get; set; }
    public int PieceCount { get; set; }
    public int JoinedRollCount { get; set; } = 1;
    public decimal SingleRollWidth { get; set; }
    public List<PackedItemDto> PackedItems { get; set; } = new();
}

public class PackedItemDto
{
    public string BarcodeNo { get; set; } = string.Empty;
    public string ORNO { get; set; } = string.Empty;
    public string? ListNo { get; set; }
    public string? ItemNo { get; set; }
    public string? CnvID { get; set; }
    public string? CnvDesc { get; set; }
    public string? ASPLAN { get; set; }
    public decimal OriginalWidth { get; set; }
    public decimal OriginalLength { get; set; }
    public decimal? Sqm { get; set; }
    public int? Qty { get; set; }
    public string? OrderType { get; set; }
    public decimal PackX { get; set; }
    public decimal PackY { get; set; }
    public decimal PackWidth { get; set; }
    public decimal PackLength { get; set; }
    public bool IsRotated { get; set; }
    public decimal? TagWidth { get; set; }
    public decimal? TagLength { get; set; }
}
