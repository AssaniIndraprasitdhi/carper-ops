namespace Capet_OPS.Models
{
    public class ReportData
    {
        public int ID { get; set; }
        public string HT_BARCODE { get; set; } = string.Empty;
        public string OrderNo { get; set; } = string.Empty;
        public int ListNo { get; set; }
        public int ItemNo { get; set; }
        public decimal Width { get; set; }
        public decimal Length { get; set; }
        public decimal AllowanceWidthPct { get; set; }
        public decimal AllowanceLengthPct { get; set; }
        public decimal AllowanceWidth { get; set; }
        public decimal AllowanceLength { get; set; }
        public decimal ActualWidth { get; set; }
        public decimal ActualLength { get; set; }
        public decimal ActualSqm { get; set; }
        public decimal Sqm { get; set; }
        public int Qty { get; set; }
        public decimal TotalSqm { get; set; }
        public string GlueID { get; set; } = string.Empty;
        public string GlueDesc { get; set; } = string.Empty;
        public decimal GlueUsage { get; set; }
        public decimal GluePerSqm { get; set; }
        public DateTime CreatedDate { get; set; }
        public DateTime? UpdatedDate { get; set; }
    }
}
