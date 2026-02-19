using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Dapper;
using Capet_OPS.Data;
using Capet_OPS.Models.Dtos;
using Capet_OPS.Models.Entities;

namespace Capet_OPS.Services;

public class SyncService : ISyncService
{
    private readonly SqlServerSettings _sqlSettings;
    private readonly AppDbContext _db;
    private readonly ILogger<SyncService> _logger;

    public SyncService(SqlServerSettings sqlSettings, AppDbContext db, ILogger<SyncService> logger)
    {
        _sqlSettings = sqlSettings;
        _db = db;
        _logger = logger;
    }

    public async Task<int> SyncFromSqlServerAsync()
    {
        // 1. Query all orders from SQL Server
        const string sql = @"
            SELECT
                C.HT_BARCODE AS BarcodeNo,
                A.ORNO,
                B.PD_ITEM AS ListNo,
                C.ITEM_NO AS ItemNo,
                B.CnvID,
                B.CnvDesc,
                B.AsPlan AS ASPLAN,
                B.PD_WIDTH AS Width,
                B.PD_LEN AS [Length],
                C.SQM AS Sqm,
                C.Qty AS Qty,
                CASE WHEN A.ORTP = '0' THEN 'Order' ELSE 'Sample' END AS OrderType
            FROM CARPET.DBO.ORHMAIN A
            LEFT JOIN CARPET.DBO.ORDMAIN B ON A.AUTO = B.AUTO
            LEFT JOIN CARPET.DBO.HT_SCANBARCODE C ON C.OF_NO = A.ORNO
            WHERE A.ORDT >= '2026-01-01'
              AND C.HT_BARCODE IS NOT NULL
              AND ISNULL(B.CnvID,'') <> ''
              AND A.ORTP = '0'
              AND A.ORNO NOT LIKE '%A%'
              AND A.ORNO NOT LIKE '%M%'";

        using var connection = new SqlConnection(_sqlSettings.ConnectionString);
        var rawOrders = (await connection.QueryAsync<SqlServerOrderDto>(sql)).ToList();
        _logger.LogInformation("Fetched {Count} raw rows from SQL Server", rawOrders.Count);

        // 2. Deduplicate by BarcodeNo (LEFT JOIN may produce duplicates)
        var sqlOrders = rawOrders
            .Where(o => !string.IsNullOrEmpty(o.BarcodeNo) && !string.IsNullOrEmpty(o.ORNO))
            .GroupBy(o => o.BarcodeNo)
            .Select(g => g.First())
            .ToList();
        _logger.LogInformation("After dedup: {Count} unique barcodes", sqlOrders.Count);

        // 3. ลบข้อมูลเก่าทั้งหมด
        var deleted = await _db.FabricPieces.ExecuteDeleteAsync();
        _logger.LogInformation("Deleted {Count} existing fabric pieces", deleted);

        // 4. Insert ข้อมูลใหม่ทั้งหมด
        var now = DateTime.UtcNow;
        foreach (var order in sqlOrders)
        {
            _db.FabricPieces.Add(new FabricPiece
            {
                BarcodeNo = order.BarcodeNo,
                Orno = order.ORNO ?? "",
                ListNo = order.ListNo,
                ItemNo = order.ItemNo,
                CnvId = order.CnvID ?? "",
                CnvDesc = order.CnvDesc,
                AsPlan = order.ASPLAN,
                Width = order.Width,
                Length = order.Length,
                Sqm = order.Sqm,
                Qty = order.Qty,
                OrderType = order.OrderType,
                SyncedAt = now,
            });
        }

        await _db.SaveChangesAsync();
        _logger.LogInformation("Sync complete: {Inserted} inserted (old {Deleted} deleted)", sqlOrders.Count, deleted);
        return sqlOrders.Count;
    }
}
