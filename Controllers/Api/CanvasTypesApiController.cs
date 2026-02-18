using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Capet_OPS.Data;
using Capet_OPS.Services;

namespace Capet_OPS.Controllers.Api;

[ApiController]
[Route("api/canvas-types")]
public class CanvasTypesApiController : ControllerBase
{
    private readonly ICanvasTypeService _service;
    private readonly AppDbContext _db;

    public CanvasTypesApiController(ICanvasTypeService service, AppDbContext db)
    {
        _service = service;
        _db = db;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var types = await _service.GetAllAsync();
        return Ok(types.Select(t => new
        {
            t.Id,
            t.ErpCode,
            t.CnvId,
            t.CnvDesc,
            t.RollWidth
        }));
    }

    [HttpGet("cnv-ids")]
    public async Task<IActionResult> GetDistinctCnvIds()
    {
        var types = await _service.GetAllAsync();

        // Count available orders per CnvId (exclude already-planned)
        var plannedBarcodes = await _db.PlannedBarcodes
            .Select(b => b.BarcodeNo)
            .ToListAsync();
        var plannedSet = plannedBarcodes.ToHashSet();

        var orderCounts = (await _db.FabricPieces.ToListAsync())
            .Where(f => !plannedSet.Contains(f.BarcodeNo))
            .GroupBy(f => f.CnvId)
            .ToDictionary(g => g.Key, g => g.Count());

        var grouped = types
            .GroupBy(t => t.CnvId)
            .Select(g => new
            {
                CnvId = g.Key,
                CnvDesc = g.First().CnvDesc,
                RollWidths = g.Select(t => new { t.Id, t.RollWidth, t.CnvDesc }).OrderBy(x => x.RollWidth).ToList(),
                Count = g.Count(),
                OrderCount = orderCounts.GetValueOrDefault(g.Key, 0)
            })
            .OrderBy(x => x.CnvId);
        return Ok(grouped);
    }

    [HttpGet("by-cnv/{cnvId}")]
    public async Task<IActionResult> GetByCnvId(string cnvId)
    {
        var types = await _service.GetByCnvIdAsync(cnvId);
        return Ok(types.Select(t => new
        {
            t.Id,
            t.ErpCode,
            t.CnvId,
            t.CnvDesc,
            t.RollWidth
        }));
    }
}
