using Capet_OPS.Models.Dtos;

namespace Capet_OPS.Services;

public interface IOrderService
{
    Task<List<SqlServerOrderDto>> GetOrdersByCnvIdAsync(string cnvId);
}
