using Capet_OPS.Models.Dtos;

namespace Capet_OPS.Services;

public enum PackingAlgorithm
{
    Standard,
    Rotated,
    SizeBased,
    CutCorner
}

public interface ILayoutCalculationService
{
    CalculationResultDto Calculate(decimal rollWidth, List<SqlServerOrderDto> selectedOrders);
    CalculationResultDto Calculate(decimal rollWidth, List<SqlServerOrderDto> selectedOrders, PackingAlgorithm algorithm);
}
