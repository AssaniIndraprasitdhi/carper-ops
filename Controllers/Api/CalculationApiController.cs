using Microsoft.AspNetCore.Mvc;
using Capet_OPS.Models.Dtos;
using Capet_OPS.Services;

namespace Capet_OPS.Controllers.Api;

[ApiController]
[Route("api/calculation")]
public class CalculationApiController : ControllerBase
{
    private readonly ILayoutCalculationService _service;

    public CalculationApiController(ILayoutCalculationService service) => _service = service;

    [HttpPost("calculate")]
    public IActionResult Calculate([FromBody] CalculationRequestDto request)
    {
        if (request.SelectedOrders == null || request.SelectedOrders.Count == 0)
            return BadRequest("No orders selected");

        if (request.RollWidth <= 0)
            return BadRequest("Invalid roll width");

        try
        {
            var result = _service.Calculate(request.RollWidth, request.SelectedOrders);
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpPost("compare")]
    public async Task<IActionResult> Compare(
        [FromBody] CompareRequestDto request,
        [FromServices] ICanvasTypeService canvasTypeService,
        [FromServices] IOrderService orderService)
    {
        if (string.IsNullOrWhiteSpace(request.CnvId))
            return BadRequest("cnvId is required");

        var canvasTypes = await canvasTypeService.GetByCnvIdAsync(request.CnvId);
        if (canvasTypes.Count == 0)
            return BadRequest("No canvas types found for this cnvId");

        var allOrders = await orderService.GetOrdersByCnvIdAsync(request.CnvId);

        var selectedOrders = request.SelectedBarcodes != null && request.SelectedBarcodes.Count > 0
            ? allOrders.Where(o => request.SelectedBarcodes.Contains(o.BarcodeNo)).ToList()
            : allOrders;

        if (selectedOrders.Count == 0)
            return BadRequest("No orders to calculate");

        // Apply tag dimension overrides (AsPlan items edited in UI)
        if (request.TagOverrides != null && request.TagOverrides.Count > 0)
        {
            foreach (var order in selectedOrders)
            {
                if (request.TagOverrides.TryGetValue(order.BarcodeNo, out var tag))
                {
                    order.Width = tag.Width;
                    order.Length = tag.Length;
                }
            }
        }

        var algorithms = new[]
        {
            (PackingAlgorithm.MaxRects, "MaxRects (BSSF)", "MaxRects"),
            (PackingAlgorithm.Standard, "Standard (FFD)", "มาตรฐาน"),
            (PackingAlgorithm.Rotated, "Rotated", "หมุนอัตโนมัติ"),
            (PackingAlgorithm.SizeBased, "Size-Based", "จัดตามขนาด"),
            (PackingAlgorithm.CutCorner, "Cut-Corner", "ตัดเหลี่ยม"),
        };

        var results = new List<AlgorithmResultDto>();

        foreach (var ct in canvasTypes)
        {
            var fittable = selectedOrders
                .Where(o => Math.Min(o.Width, o.Length) <= ct.RollWidth)
                .ToList();
            var skipped = selectedOrders
                .Where(o => Math.Min(o.Width, o.Length) > ct.RollWidth)
                .ToList();

            if (fittable.Count == 0 && skipped.Count == 0) continue;

            // Single roll: calculate with fittable items only
            if (fittable.Count > 0)
            {
                foreach (var (algo, nameEn, nameTh) in algorithms)
                {
                    try
                    {
                        var resultActual = _service.Calculate(ct.RollWidth, fittable, algo, 150);
                        resultActual.SingleRollWidth = ct.RollWidth;
                        var resultOptimized = _service.Calculate(ct.RollWidth, fittable, algo, 0);
                        resultOptimized.SingleRollWidth = ct.RollWidth;
                        results.Add(new AlgorithmResultDto
                        {
                            AlgorithmName = nameEn,
                            AlgorithmNameTh = nameTh,
                            RollWidth = ct.RollWidth,
                            CnvDesc = ct.CnvDesc,
                            CanvasTypeId = ct.Id,
                            FittableCount = fittable.Count,
                            SkippedCount = skipped.Count,
                            SkippedBarcodes = skipped.Select(o => o.BarcodeNo).ToList(),
                            Result = resultActual,
                            ResultOptimized = resultOptimized
                        });
                    }
                    catch { /* skip if algorithm fails */ }
                }
            }

            // Joined rolls: when oversized items exist, calculate with wider roll
            if (skipped.Count > 0)
            {
                var maxMinDim = selectedOrders.Max(o => Math.Min(o.Width, o.Length));
                var joinedCount = (int)Math.Ceiling(maxMinDim / ct.RollWidth);
                if (joinedCount < 2) joinedCount = 2;
                var joinedWidth = ct.RollWidth * joinedCount;

                // สร้างตำแหน่งรอยต่อ (mm) เช่น roll 9.6m x 2 → joinPositions = [9600]
                var singleWidthMm = (int)(ct.RollWidth * 1000);
                var joinPositions = Enumerable.Range(1, joinedCount - 1)
                    .Select(i => singleWidthMm * i).ToList();

                AlgorithmResultDto? bestJoined = null;
                foreach (var (algo, nameEn, nameTh) in algorithms)
                {
                    try
                    {
                        var resultActual = _service.Calculate(joinedWidth, selectedOrders, algo, 150, joinPositions);
                        resultActual.JoinedRollCount = joinedCount;
                        resultActual.SingleRollWidth = ct.RollWidth;
                        var resultOptimized = _service.Calculate(joinedWidth, selectedOrders, algo, 0, joinPositions);
                        resultOptimized.JoinedRollCount = joinedCount;
                        resultOptimized.SingleRollWidth = ct.RollWidth;

                        var candidate = new AlgorithmResultDto
                        {
                            AlgorithmName = nameEn,
                            AlgorithmNameTh = nameTh,
                            RollWidth = joinedWidth,
                            CnvDesc = ct.CnvDesc,
                            CanvasTypeId = ct.Id,
                            JoinedRollCount = joinedCount,
                            FittableCount = selectedOrders.Count,
                            SkippedCount = 0,
                            Result = resultActual,
                            ResultOptimized = resultOptimized
                        };

                        if (bestJoined == null || resultActual.EfficiencyPct > bestJoined.Result.EfficiencyPct)
                            bestJoined = candidate;
                    }
                    catch { /* skip if algorithm fails */ }
                }
                if (bestJoined != null) results.Add(bestJoined);
            }
        }

        if (results.Count > 0)
        {
            var best = results.Where(r => r.JoinedRollCount <= 1).OrderByDescending(r => r.Result.EfficiencyPct).FirstOrDefault()
                    ?? results.OrderByDescending(r => r.Result.EfficiencyPct).First();
            best.IsBest = true;
        }

        return Ok(new CompareResultDto
        {
            Results = results,
            TotalSelected = selectedOrders.Count
        });
    }
}
