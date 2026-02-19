namespace Capet_OPS.Models.Dtos;

public class CompareRequestDto
{
    public string CnvId { get; set; } = string.Empty;
    public List<string>? SelectedBarcodes { get; set; }
    public Dictionary<string, TagOverrideDto>? TagOverrides { get; set; }
}

public class TagOverrideDto
{
    public decimal Width { get; set; }
    public decimal Length { get; set; }
}
