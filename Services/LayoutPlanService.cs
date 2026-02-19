using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Capet_OPS.Data;
using Capet_OPS.Models.Dtos;
using Capet_OPS.Models.Entities;

namespace Capet_OPS.Services;

public class LayoutPlanService : ILayoutPlanService
{
    private readonly AppDbContext _db;

    public LayoutPlanService(AppDbContext db) => _db = db;

    public async Task<List<LayoutPlan>> GetAllAsync(string? status = null)
    {
        var query = _db.LayoutPlans.Include(p => p.CanvasType).AsQueryable();
        if (!string.IsNullOrEmpty(status))
            query = query.Where(p => p.Status == status);
        return await query.OrderByDescending(p => p.CreatedAt).ToListAsync();
    }

    public async Task<LayoutPlan?> GetByIdAsync(int id)
    {
        return await _db.LayoutPlans
            .Include(p => p.CanvasType)
            .Include(p => p.Items)
            .FirstOrDefaultAsync(p => p.Id == id);
    }

    public async Task<LayoutPlan> SaveAsync(SavePlanRequestDto request)
    {
        using var transaction = await _db.Database.BeginTransactionAsync();
        try
        {
            var today = DateTime.UtcNow.ToString("yyyyMMdd");
            var prefix = "PL-" + today + "-";
            var maxSeq = await _db.LayoutPlans
                .Where(p => p.PlanCode.StartsWith(prefix))
                .Select(p => p.PlanCode.Substring(prefix.Length))
                .ToListAsync();
            var nextSeq = maxSeq
                .Select(s => int.TryParse(s, out var n) ? n : 0)
                .DefaultIfEmpty(0)
                .Max() + 1;
            var planCode = $"{prefix}{nextSeq:D4}";

            var plan = new LayoutPlan
            {
                PlanCode = planCode,
                CanvasTypeId = request.CanvasTypeId,
                RollWidth = request.RollWidth,
                TotalLength = request.TotalLength,
                TotalArea = request.TotalArea,
                UsedArea = request.UsedArea,
                WasteArea = request.WasteArea,
                EfficiencyPct = request.EfficiencyPct,
                PieceCount = request.PieceCount,
                JoinedRollCount = request.JoinedRollCount,
                LayoutJson = JsonSerializer.Serialize(request.PackedItems),
                Notes = request.Notes,
                Status = "planned",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            _db.LayoutPlans.Add(plan);
            await _db.SaveChangesAsync();

            foreach (var item in request.PackedItems)
            {
                _db.LayoutPlanItems.Add(new LayoutPlanItem
                {
                    LayoutPlanId = plan.Id,
                    BarcodeNo = item.BarcodeNo,
                    Orno = item.ORNO,
                    ListNo = item.ListNo,
                    ItemNo = item.ItemNo,
                    CnvId = item.CnvID,
                    CnvDesc = item.CnvDesc,
                    AsPlan = item.ASPLAN,
                    Width = item.OriginalWidth,
                    Length = item.OriginalLength,
                    Area = item.OriginalWidth * item.OriginalLength,
                    Qty = item.Qty ?? 1,
                    OrderType = item.OrderType,
                    PackX = item.PackX,
                    PackY = item.PackY,
                    PackWidth = item.PackWidth,
                    PackLength = item.PackLength,
                    IsRotated = item.IsRotated,
                    TagWidth = item.TagWidth,
                    TagLength = item.TagLength,
                });

                _db.PlannedBarcodes.Add(new PlannedBarcode
                {
                    BarcodeNo = item.BarcodeNo,
                    LayoutPlanId = plan.Id,
                    PlannedAt = DateTime.UtcNow
                });
            }

            await _db.SaveChangesAsync();
            await transaction.CommitAsync();
            return plan;
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    public async Task<LayoutPlan> UpdateAsync(int id, SavePlanRequestDto request)
    {
        using var transaction = await _db.Database.BeginTransactionAsync();
        try
        {
            var plan = await _db.LayoutPlans.FindAsync(id)
                ?? throw new KeyNotFoundException($"Plan {id} not found");

            // Delete old items and planned barcodes
            var oldItems = _db.LayoutPlanItems.Where(i => i.LayoutPlanId == id);
            _db.LayoutPlanItems.RemoveRange(oldItems);

            var oldBarcodes = _db.PlannedBarcodes.Where(b => b.LayoutPlanId == id);
            _db.PlannedBarcodes.RemoveRange(oldBarcodes);

            // Update plan fields (keep PlanCode)
            plan.CanvasTypeId = request.CanvasTypeId;
            plan.RollWidth = request.RollWidth;
            plan.TotalLength = request.TotalLength;
            plan.TotalArea = request.TotalArea;
            plan.UsedArea = request.UsedArea;
            plan.WasteArea = request.WasteArea;
            plan.EfficiencyPct = request.EfficiencyPct;
            plan.PieceCount = request.PieceCount;
            plan.JoinedRollCount = request.JoinedRollCount;
            plan.LayoutJson = JsonSerializer.Serialize(request.PackedItems);
            plan.Notes = request.Notes;
            plan.UpdatedAt = DateTime.UtcNow;

            await _db.SaveChangesAsync();

            // Insert new items and planned barcodes
            foreach (var item in request.PackedItems)
            {
                _db.LayoutPlanItems.Add(new LayoutPlanItem
                {
                    LayoutPlanId = plan.Id,
                    BarcodeNo = item.BarcodeNo,
                    Orno = item.ORNO,
                    ListNo = item.ListNo,
                    ItemNo = item.ItemNo,
                    CnvId = item.CnvID,
                    CnvDesc = item.CnvDesc,
                    AsPlan = item.ASPLAN,
                    Width = item.OriginalWidth,
                    Length = item.OriginalLength,
                    Area = item.OriginalWidth * item.OriginalLength,
                    Qty = item.Qty ?? 1,
                    OrderType = item.OrderType,
                    PackX = item.PackX,
                    PackY = item.PackY,
                    PackWidth = item.PackWidth,
                    PackLength = item.PackLength,
                    IsRotated = item.IsRotated,
                    TagWidth = item.TagWidth,
                    TagLength = item.TagLength,
                });

                _db.PlannedBarcodes.Add(new PlannedBarcode
                {
                    BarcodeNo = item.BarcodeNo,
                    LayoutPlanId = plan.Id,
                    PlannedAt = DateTime.UtcNow
                });
            }

            await _db.SaveChangesAsync();
            await transaction.CommitAsync();
            return plan;
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    public async Task<bool> DeleteAsync(int id)
    {
        var plan = await _db.LayoutPlans.FindAsync(id);
        if (plan == null) return false;

        _db.LayoutPlans.Remove(plan); // CASCADE deletes items + planned_barcodes
        await _db.SaveChangesAsync();
        return true;
    }
}
