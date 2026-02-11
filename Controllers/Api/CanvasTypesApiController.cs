using Microsoft.AspNetCore.Mvc;
using Capet_OPS.Services;

namespace Capet_OPS.Controllers.Api;

[ApiController]
[Route("api/canvas-types")]
public class CanvasTypesApiController : ControllerBase
{
    private readonly ICanvasTypeService _service;

    public CanvasTypesApiController(ICanvasTypeService service) => _service = service;

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
        var grouped = types
            .GroupBy(t => t.CnvId)
            .Select(g => new
            {
                CnvId = g.Key,
                CnvDesc = g.First().CnvDesc,
                RollWidths = g.Select(t => new { t.Id, t.RollWidth, t.CnvDesc }).OrderBy(x => x.RollWidth).ToList(),
                Count = g.Count()
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
