using Microsoft.AspNetCore.Mvc;
using Capet_OPS.Services;

namespace Capet_OPS.Controllers.Api;

[ApiController]
[Route("api/orders")]
public class OrdersApiController : ControllerBase
{
    private readonly IOrderService _service;

    public OrdersApiController(IOrderService service) => _service = service;

    [HttpGet]
    public async Task<IActionResult> GetByCanvasType([FromQuery] string cnvId)
    {
        if (string.IsNullOrWhiteSpace(cnvId))
            return BadRequest("cnvId is required");

        var orders = await _service.GetOrdersByCnvIdAsync(cnvId);
        return Ok(orders);
    }
}
