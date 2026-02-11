namespace Capet_OPS.Models.Dtos;

public class SqlServerOrderDto
{
    public string BarcodeNo { get; set; } = string.Empty;
    public string ORNO { get; set; } = string.Empty;
    public string? ListNo { get; set; }
    public string? ItemNo { get; set; }
    public string? CnvID { get; set; }
    public string? CnvDesc { get; set; }
    public string? ASPLAN { get; set; }
    public decimal Width { get; set; }
    public decimal Length { get; set; }
    public decimal? Sqm { get; set; }
    public int? Qty { get; set; }
    public string? OrderType { get; set; }
}
