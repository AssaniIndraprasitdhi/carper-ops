using Microsoft.EntityFrameworkCore;
using Capet_OPS.Data;
using Capet_OPS.Models.Entities;

namespace Capet_OPS.Services;

public class CanvasTypeService : ICanvasTypeService
{
    private readonly AppDbContext _db;

    public CanvasTypeService(AppDbContext db) => _db = db;

    public async Task<List<CanvasType>> GetAllAsync()
        => await _db.CanvasTypes.Where(c => c.IsActive).OrderBy(c => c.CnvDesc).ToListAsync();

    public async Task<CanvasType?> GetByIdAsync(int id)
        => await _db.CanvasTypes.FindAsync(id);

    public async Task<List<CanvasType>> GetByCnvIdAsync(string cnvId)
        => await _db.CanvasTypes.Where(c => c.IsActive && c.CnvId == cnvId).OrderBy(c => c.RollWidth).ToListAsync();
}
