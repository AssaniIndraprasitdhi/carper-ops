using Microsoft.AspNetCore.Mvc;
using Capet_OPS.Services;

namespace Capet_OPS.Controllers;

public class LayoutController : Controller
{
    private readonly ILayoutPlanService _planService;

    public LayoutController(ILayoutPlanService planService) => _planService = planService;

    public IActionResult Index() => View();

    public IActionResult Plans() => View();

    public async Task<IActionResult> PlanDetail(int id)
    {
        var plan = await _planService.GetByIdAsync(id);
        if (plan == null) return NotFound();
        return View(plan);
    }

    public async Task<IActionResult> Report(int id)
    {
        var plan = await _planService.GetByIdAsync(id);
        if (plan == null) return NotFound();
        return View(plan);
    }
}
