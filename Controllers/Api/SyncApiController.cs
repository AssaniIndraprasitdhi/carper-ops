using Microsoft.AspNetCore.Mvc;
using Capet_OPS.Services;

namespace Capet_OPS.Controllers.Api;

[ApiController]
[Route("api/sync")]
public class SyncApiController : ControllerBase
{
    private readonly ISyncService _syncService;

    public SyncApiController(ISyncService syncService) => _syncService = syncService;

    [HttpPost]
    public async Task<IActionResult> Sync()
    {
        try
        {
            var count = await _syncService.SyncFromSqlServerAsync();
            return Ok(new { Message = $"Synced {count} records", Count = count });
        }
        catch (Exception ex)
        {
            var innerMsg = ex.InnerException?.Message ?? "";
            return StatusCode(500, new { Message = "Sync failed: " + ex.Message, Inner = innerMsg });
        }
    }
}
