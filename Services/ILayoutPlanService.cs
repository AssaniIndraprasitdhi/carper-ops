using Capet_OPS.Models.Dtos;
using Capet_OPS.Models.Entities;

namespace Capet_OPS.Services;

public interface ILayoutPlanService
{
    Task<List<LayoutPlan>> GetAllAsync(string? status = null);
    Task<LayoutPlan?> GetByIdAsync(int id);
    Task<LayoutPlan> SaveAsync(SavePlanRequestDto request);
    Task<LayoutPlan> UpdateAsync(int id, SavePlanRequestDto request);
    Task<bool> DeleteAsync(int id);
}
