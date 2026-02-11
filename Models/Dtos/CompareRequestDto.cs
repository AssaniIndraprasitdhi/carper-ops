namespace Capet_OPS.Models.Dtos;

public class CompareRequestDto
{
    public string CnvId { get; set; } = string.Empty;
    public List<string>? SelectedBarcodes { get; set; }
}
