using Microsoft.EntityFrameworkCore;
using Capet_OPS.Data;
using Capet_OPS.Models.Dtos;

namespace Capet_OPS.Services;

public class OrderService : IOrderService
{
    private readonly AppDbContext _db;

    public OrderService(AppDbContext db)
    {
        _db = db;
    }

    public Task<List<SqlServerOrderDto>> GetOrdersByCnvIdAsync(string cnvId)
        => GetOrdersByCnvIdAsync(cnvId, null);

    public async Task<List<SqlServerOrderDto>> GetOrdersByCnvIdAsync(string cnvId, int? excludePlanId)
    {
        // Get already-planned barcodes
        var query = _db.PlannedBarcodes.AsQueryable();
        if (excludePlanId.HasValue)
            query = query.Where(b => b.LayoutPlanId != excludePlanId.Value);

        var plannedBarcodes = (await query
            .Select(b => b.BarcodeNo)
            .ToListAsync()).ToHashSet();

        // Read from fabric_pieces in PostgreSQL (synced data)
        var pieces = await _db.FabricPieces
            .Where(f => f.CnvId == cnvId)
            .ToListAsync();

        // Exclude already-planned and map to DTO
        return pieces
            .Where(f => !plannedBarcodes.Contains(f.BarcodeNo))
            .Select(f => new SqlServerOrderDto
            {
                BarcodeNo = f.BarcodeNo,
                ORNO = f.Orno,
                ListNo = f.ListNo,
                ItemNo = f.ItemNo,
                CnvID = f.CnvId,
                CnvDesc = f.CnvDesc,
                ASPLAN = f.AsPlan,
                Width = f.Width,
                Length = f.Length,
                Sqm = f.Sqm,
                Qty = f.Qty,
                OrderType = f.OrderType,
            })
            .ToList();
    }
}
