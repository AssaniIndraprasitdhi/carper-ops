using Capet_OPS.Models.Entities;

namespace Capet_OPS.Services;

public interface ICanvasTypeService
{
    Task<List<CanvasType>> GetAllAsync();
    Task<CanvasType?> GetByIdAsync(int id);
    Task<List<CanvasType>> GetByCnvIdAsync(string cnvId);
}
