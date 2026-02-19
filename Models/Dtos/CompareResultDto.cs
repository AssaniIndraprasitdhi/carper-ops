namespace Capet_OPS.Models.Dtos;

public class CompareResultDto
{
    public List<AlgorithmResultDto> Results { get; set; } = new();
    public int TotalSelected { get; set; }
}

public class AlgorithmResultDto
{
    public string AlgorithmName { get; set; } = string.Empty;
    public string AlgorithmNameTh { get; set; } = string.Empty;
    public decimal RollWidth { get; set; }
    public string CnvDesc { get; set; } = string.Empty;
    public int CanvasTypeId { get; set; }
    public bool IsBest { get; set; }
    public int FittableCount { get; set; }
    public int SkippedCount { get; set; }
    public List<string> SkippedBarcodes { get; set; } = new();
    public int JoinedRollCount { get; set; } = 1;
    public CalculationResultDto Result { get; set; } = new();
    public CalculationResultDto ResultOptimized { get; set; } = new();
}
