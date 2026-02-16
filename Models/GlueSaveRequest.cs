namespace Capet_OPS.Models
{
    public class GlueSaveRequest
    {
        public string HT_BARCODE { get; set; } = string.Empty;
        public string GlueID { get; set; } = string.Empty;
        public string GlueDesc { get; set; } = string.Empty;
        public decimal GlueUsage { get; set; }
        public decimal ActualSqm { get; set; }
    }
}
