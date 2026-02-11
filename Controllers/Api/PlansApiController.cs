using Microsoft.AspNetCore.Mvc;
using Capet_OPS.Models.Dtos;
using Capet_OPS.Services;

namespace Capet_OPS.Controllers.Api;

[ApiController]
[Route("api/plans")]
public class PlansApiController : ControllerBase
{
    private readonly ILayoutPlanService _service;

    public PlansApiController(ILayoutPlanService service) => _service = service;

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] string? status = null)
    {
        var plans = await _service.GetAllAsync(status);
        return Ok(plans.Select(p => new
        {
            p.Id,
            p.PlanCode,
            CanvasDesc = p.CanvasType?.CnvDesc,
            p.RollWidth,
            p.TotalLength,
            p.TotalArea,
            p.UsedArea,
            p.WasteArea,
            p.EfficiencyPct,
            p.PieceCount,
            p.Status,
            p.Notes,
            CreatedAt = p.CreatedAt.ToString("yyyy-MM-dd HH:mm")
        }));
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(int id)
    {
        var plan = await _service.GetByIdAsync(id);
        if (plan == null) return NotFound();

        return Ok(new
        {
            plan.Id,
            plan.PlanCode,
            CanvasDesc = plan.CanvasType?.CnvDesc,
            plan.RollWidth,
            plan.TotalLength,
            plan.TotalArea,
            plan.UsedArea,
            plan.WasteArea,
            plan.EfficiencyPct,
            plan.PieceCount,
            plan.Status,
            plan.LayoutJson,
            plan.Notes,
            CreatedAt = plan.CreatedAt.ToString("yyyy-MM-dd HH:mm"),
            Items = plan.Items.Select(i => new
            {
                i.BarcodeNo,
                i.Orno,
                i.ListNo,
                i.ItemNo,
                i.CnvId,
                i.CnvDesc,
                i.AsPlan,
                i.Width,
                i.Length,
                i.Area,
                i.Qty,
                i.OrderType,
                i.PackX,
                i.PackY,
                i.PackWidth,
                i.PackLength,
                i.IsRotated
            })
        });
    }

    [HttpPost]
    public async Task<IActionResult> Save([FromBody] SavePlanRequestDto request)
    {
        if (request.PackedItems == null || request.PackedItems.Count == 0)
            return BadRequest("No items to save");

        var plan = await _service.SaveAsync(request);
        return Ok(new { plan.Id, plan.PlanCode, Message = "Plan saved successfully" });
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var success = await _service.DeleteAsync(id);
        if (!success) return NotFound();
        return Ok(new { Message = "Plan deleted successfully" });
    }
}
