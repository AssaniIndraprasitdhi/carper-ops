namespace Capet_OPS.Models.Entities;

public class CanvasType
{
    public int Id { get; set; }
    public string ErpCode { get; set; } = string.Empty;
    public string CnvDesc { get; set; } = string.Empty;
    public decimal RollWidth { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public string CnvId { get; set; } = string.Empty;
}
