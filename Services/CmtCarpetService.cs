using Dapper;
using Microsoft.Data.SqlClient;
using Capet_OPS.Models;

namespace Capet_OPS.Services
{
    public class CmtCarpetService
    {
        private readonly string _connectionString;

        public CmtCarpetService(CmtProductionSettings settings)
        {
            _connectionString = settings.ConnectionString;
        }

        public async Task<IEnumerable<CarpetOrder>> SearchOrdersAsync(string? orderNo, int? listNo, int? itemNo)
        {
            using var connection = new SqlConnection(_connectionString);

            var sql = @"
                SELECT A.ORNO AS OrderNo
                    ,B.PD_ITEM AS ListNo
                    ,C.ITEM_NO AS ItemNo
                    ,B.PD_WIDTH AS Width
                    ,B.PD_LEN AS [Length]
                    ,B.PD_SQM AS Sqm
                    ,B.PD_QTY AS Qty
                    ,B.PD_TSQM AS TotalSqm
                    ,B.GlueID AS GlueID
                    ,B.GlueDesc AS GlueDesc
                    ,C.HT_BARCODE
                FROM CARPET.DBO.ORHMAIN A
                LEFT JOIN CARPET.DBO.ORDMAIN B ON A.AUTO = B.AUTO
                LEFT JOIN CARPET.DBO.HT_SCANBARCODE C ON C.OF_NO = A.ORNO AND B.PDID = C.DESIGN_NO
                WHERE A.ORDT >= '2025-01-01'
                    AND C.HT_BARCODE IS NOT NULL
                    AND C.HT_BARCODE <> ''";

            var parameters = new DynamicParameters();

            if (!string.IsNullOrWhiteSpace(orderNo))
            {
                sql += " AND A.ORNO LIKE @OrderNo";
                parameters.Add("OrderNo", $"%{orderNo}%");
            }

            if (listNo.HasValue)
            {
                sql += " AND B.PD_ITEM = @ListNo";
                parameters.Add("ListNo", listNo.Value);
            }

            if (itemNo.HasValue)
            {
                sql += " AND C.ITEM_NO = @ItemNo";
                parameters.Add("ItemNo", itemNo.Value);
            }

            sql += " ORDER BY A.ORNO, B.PD_ITEM, C.ITEM_NO";

            return await connection.QueryAsync<CarpetOrder>(sql, parameters);
        }

        public async Task<CarpetOrder?> GetOrderByBarcodeAsync(string htBarcode)
        {
            using var connection = new SqlConnection(_connectionString);

            var sql = @"
                SELECT A.ORNO AS OrderNo
                    ,B.PD_ITEM AS ListNo
                    ,C.ITEM_NO AS ItemNo
                    ,B.PD_WIDTH AS Width
                    ,B.PD_LEN AS [Length]
                    ,B.PD_SQM AS Sqm
                    ,B.PD_QTY AS Qty
                    ,B.PD_TSQM AS TotalSqm
                    ,B.GlueID AS GlueID
                    ,B.GlueDesc AS GlueDesc
                    ,C.HT_BARCODE
                FROM CARPET.DBO.ORHMAIN A
                LEFT JOIN CARPET.DBO.ORDMAIN B ON A.AUTO = B.AUTO
                LEFT JOIN CARPET.DBO.HT_SCANBARCODE C ON C.OF_NO = A.ORNO AND B.PDID = C.DESIGN_NO
                WHERE C.HT_BARCODE = @HtBarcode
                    AND A.ORDT >= '2025-01-01'";

            return await connection.QueryFirstOrDefaultAsync<CarpetOrder>(sql, new { HtBarcode = htBarcode });
        }

        public async Task<IEnumerable<GlueInfo>> GetGlueListAsync()
        {
            using var connection = new SqlConnection(_connectionString);

            var sql = @"
                SELECT GRID AS GlueID
                    ,GRDS AS GlueDesc
                FROM CARPET.DBO.PD_GLUE
                WHERE Show = 'Y'";

            return await connection.QueryAsync<GlueInfo>(sql);
        }
    }
}
