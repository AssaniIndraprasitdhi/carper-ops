namespace Capet_OPS.Models.Dtos;

public class CalculationRequestDto
{
    public int CanvasTypeId { get; set; }
    public decimal RollWidth { get; set; }
    public List<SqlServerOrderDto> SelectedOrders { get; set; } = new();
}
