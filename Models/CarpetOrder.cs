namespace Capet_OPS.Models
{
    public class CarpetOrder
    {
        public string OrderNo { get; set; } = string.Empty;
        public int ListNo { get; set; }
        public int ItemNo { get; set; }
        public decimal Width { get; set; }
        public decimal Length { get; set; }
        public decimal Sqm { get; set; }
        public int Qty { get; set; }
        public decimal TotalSqm { get; set; }
        public string GlueID { get; set; } = string.Empty;
        public string GlueDesc { get; set; } = string.Empty;
        public string HT_BARCODE { get; set; } = string.Empty;
    }
}
