using Dapper;
using Microsoft.Data.SqlClient;
using Capet_OPS.Models;

namespace Capet_OPS.Services
{
    public class CmtReportService
    {
        private readonly string _connectionString;

        public CmtReportService(CmtProductionSettings settings)
        {
            _connectionString = settings.ConnectionString;
        }

        public async Task EnsureTableExistsAsync()
        {
            using var connection = new SqlConnection(_connectionString);

            var sql = @"
                IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'tb_CMT_Report_Data')
                BEGIN
                    CREATE TABLE tb_CMT_Report_Data (
                        ID INT IDENTITY(1,1) PRIMARY KEY,
                        HT_BARCODE NVARCHAR(100) NOT NULL,
                        OrderNo NVARCHAR(50),
                        ListNo INT,
                        ItemNo INT,
                        Width DECIMAL(18,4),
                        [Length] DECIMAL(18,4),
                        AllowanceWidthPct DECIMAL(18,4),
                        AllowanceLengthPct DECIMAL(18,4),
                        AllowanceWidth DECIMAL(18,4),
                        AllowanceLength DECIMAL(18,4),
                        ActualWidth DECIMAL(18,4),
                        ActualLength DECIMAL(18,4),
                        ActualSqm DECIMAL(18,4),
                        Sqm DECIMAL(18,4),
                        Qty INT,
                        TotalSqm DECIMAL(18,4),
                        GlueID NVARCHAR(50),
                        GlueDesc NVARCHAR(200),
                        GlueUsage DECIMAL(18,4),
                        GluePerSqm DECIMAL(18,4),
                        CreatedDate DATETIME DEFAULT GETDATE(),
                        UpdatedDate DATETIME
                    )
                END
                ELSE
                BEGIN
                    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'tb_CMT_Report_Data' AND COLUMN_NAME = 'AllowanceWidthPct')
                    BEGIN
                        ALTER TABLE tb_CMT_Report_Data ADD AllowanceWidthPct DECIMAL(18,4)
                        ALTER TABLE tb_CMT_Report_Data ADD AllowanceLengthPct DECIMAL(18,4)
                    END
                END";

            await connection.ExecuteAsync(sql);
        }

        public async Task<IEnumerable<ReportData>> GetAllReportsAsync()
        {
            using var connection = new SqlConnection(_connectionString);

            var sql = @"SELECT * FROM tb_CMT_Report_Data ORDER BY CreatedDate DESC";

            return await connection.QueryAsync<ReportData>(sql);
        }

        public async Task<ReportData?> GetReportByBarcodeAsync(string htBarcode)
        {
            using var connection = new SqlConnection(_connectionString);

            var sql = @"SELECT * FROM tb_CMT_Report_Data WHERE HT_BARCODE = @HtBarcode";

            return await connection.QueryFirstOrDefaultAsync<ReportData>(sql, new { HtBarcode = htBarcode });
        }

        public async Task<IEnumerable<ReportData>> GetReportsByBarcodesAsync(IEnumerable<string> barcodes)
        {
            using var connection = new SqlConnection(_connectionString);

            var sql = @"SELECT HT_BARCODE, ActualWidth, ActualLength, ActualSqm, AllowanceWidthPct, AllowanceLengthPct
                        FROM tb_CMT_Report_Data WHERE HT_BARCODE IN @Barcodes";

            return await connection.QueryAsync<ReportData>(sql, new { Barcodes = barcodes });
        }

        public async Task<ReportData?> GetReportByIdAsync(int id)
        {
            using var connection = new SqlConnection(_connectionString);

            var sql = @"SELECT * FROM tb_CMT_Report_Data WHERE ID = @Id";

            return await connection.QueryFirstOrDefaultAsync<ReportData>(sql, new { Id = id });
        }

        public async Task<int> SaveReportAsync(ReportData report)
        {
            using var connection = new SqlConnection(_connectionString);

            var existing = await GetReportByBarcodeAsync(report.HT_BARCODE);

            if (existing != null)
            {
                var sql = @"
                    UPDATE tb_CMT_Report_Data SET
                        OrderNo = @OrderNo,
                        ListNo = @ListNo,
                        ItemNo = @ItemNo,
                        Width = @Width,
                        [Length] = @Length,
                        AllowanceWidthPct = @AllowanceWidthPct,
                        AllowanceLengthPct = @AllowanceLengthPct,
                        AllowanceWidth = @AllowanceWidth,
                        AllowanceLength = @AllowanceLength,
                        ActualWidth = @ActualWidth,
                        ActualLength = @ActualLength,
                        ActualSqm = @ActualSqm,
                        Sqm = @Sqm,
                        Qty = @Qty,
                        TotalSqm = @TotalSqm,
                        GlueID = @GlueID,
                        GlueDesc = @GlueDesc,
                        GlueUsage = @GlueUsage,
                        GluePerSqm = @GluePerSqm,
                        UpdatedDate = GETDATE()
                    WHERE HT_BARCODE = @HT_BARCODE";

                await connection.ExecuteAsync(sql, report);
                return existing.ID;
            }
            else
            {
                var sql = @"
                    INSERT INTO tb_CMT_Report_Data
                        (HT_BARCODE, OrderNo, ListNo, ItemNo, Width, [Length],
                         AllowanceWidthPct, AllowanceLengthPct,
                         AllowanceWidth, AllowanceLength, ActualWidth, ActualLength, ActualSqm,
                         Sqm, Qty, TotalSqm, GlueID, GlueDesc, GlueUsage, GluePerSqm)
                    VALUES
                        (@HT_BARCODE, @OrderNo, @ListNo, @ItemNo, @Width, @Length,
                         @AllowanceWidthPct, @AllowanceLengthPct,
                         @AllowanceWidth, @AllowanceLength, @ActualWidth, @ActualLength, @ActualSqm,
                         @Sqm, @Qty, @TotalSqm, @GlueID, @GlueDesc, @GlueUsage, @GluePerSqm);
                    SELECT CAST(SCOPE_IDENTITY() as int)";

                return await connection.QuerySingleAsync<int>(sql, report);
            }
        }

        public async Task DeleteReportAsync(int id)
        {
            using var connection = new SqlConnection(_connectionString);

            var sql = @"DELETE FROM tb_CMT_Report_Data WHERE ID = @Id";

            await connection.ExecuteAsync(sql, new { Id = id });
        }

        public async Task<IEnumerable<ReportData>> GetReportsByOrderAsync(string orderNo)
        {
            using var connection = new SqlConnection(_connectionString);

            var sql = @"SELECT * FROM tb_CMT_Report_Data WHERE OrderNo = @OrderNo ORDER BY ListNo, ItemNo";

            return await connection.QueryAsync<ReportData>(sql, new { OrderNo = orderNo });
        }

        public async Task<int> SaveAllowanceAsync(ReportData report)
        {
            using var connection = new SqlConnection(_connectionString);

            var existing = await GetReportByBarcodeAsync(report.HT_BARCODE);

            if (existing != null)
            {
                var sql = @"
                    UPDATE tb_CMT_Report_Data SET
                        OrderNo = @OrderNo,
                        ListNo = @ListNo,
                        ItemNo = @ItemNo,
                        Width = @Width,
                        [Length] = @Length,
                        AllowanceWidthPct = @AllowanceWidthPct,
                        AllowanceLengthPct = @AllowanceLengthPct,
                        AllowanceWidth = @AllowanceWidth,
                        AllowanceLength = @AllowanceLength,
                        ActualWidth = @ActualWidth,
                        ActualLength = @ActualLength,
                        ActualSqm = @ActualSqm,
                        Sqm = @Sqm,
                        Qty = @Qty,
                        TotalSqm = @TotalSqm,
                        UpdatedDate = GETDATE()
                    WHERE HT_BARCODE = @HT_BARCODE";

                await connection.ExecuteAsync(sql, report);
                return existing.ID;
            }
            else
            {
                var sql = @"
                    INSERT INTO tb_CMT_Report_Data
                        (HT_BARCODE, OrderNo, ListNo, ItemNo, Width, [Length],
                         AllowanceWidthPct, AllowanceLengthPct,
                         AllowanceWidth, AllowanceLength, ActualWidth, ActualLength, ActualSqm,
                         Sqm, Qty, TotalSqm)
                    VALUES
                        (@HT_BARCODE, @OrderNo, @ListNo, @ItemNo, @Width, @Length,
                         @AllowanceWidthPct, @AllowanceLengthPct,
                         @AllowanceWidth, @AllowanceLength, @ActualWidth, @ActualLength, @ActualSqm,
                         @Sqm, @Qty, @TotalSqm);
                    SELECT CAST(SCOPE_IDENTITY() as int)";

                return await connection.QuerySingleAsync<int>(sql, report);
            }
        }

        public async Task<bool> SaveGlueAsync(string htBarcode, string glueId, string glueDesc, decimal glueUsage, decimal gluePerSqm)
        {
            using var connection = new SqlConnection(_connectionString);

            var sql = @"
                UPDATE tb_CMT_Report_Data SET
                    GlueID = @GlueId,
                    GlueDesc = @GlueDesc,
                    GlueUsage = @GlueUsage,
                    GluePerSqm = @GluePerSqm,
                    UpdatedDate = GETDATE()
                WHERE HT_BARCODE = @HtBarcode";

            var rows = await connection.ExecuteAsync(sql, new { HtBarcode = htBarcode, GlueId = glueId, GlueDesc = glueDesc, GlueUsage = glueUsage, GluePerSqm = gluePerSqm });
            return rows > 0;
        }
    }
}
