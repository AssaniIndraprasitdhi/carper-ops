using Microsoft.AspNetCore.Mvc;
using Capet_OPS.Models;
using Capet_OPS.Services;

namespace Capet_OPS.Controllers;

public class ReportController : Controller
{
    private readonly CmtCarpetService _carpetService;
    private readonly CmtReportService _reportService;

    public ReportController(CmtCarpetService carpetService, CmtReportService reportService)
    {
        _carpetService = carpetService;
        _reportService = reportService;
    }

    // ===== หน้าเผื่อ =====
    public async Task<IActionResult> Index()
    {
        var reports = await _reportService.GetAllReportsAsync();
        return View(reports);
    }

    [HttpPost]
    public async Task<IActionResult> SaveAllowance([FromBody] ReportData report)
    {
        report.AllowanceWidth = report.Width * report.AllowanceWidthPct / 100;
        report.AllowanceLength = report.Length * report.AllowanceLengthPct / 100;
        report.ActualWidth = report.Width + report.AllowanceWidth;
        report.ActualLength = report.Length + report.AllowanceLength;
        report.ActualSqm = report.ActualWidth * report.ActualLength;

        var id = await _reportService.SaveAllowanceAsync(report);
        return Json(new { success = true, id });
    }

    // ===== หน้ากาว =====
    public async Task<IActionResult> Glue()
    {
        var reports = await _reportService.GetAllReportsAsync();
        return View(reports);
    }

    [HttpPost]
    public async Task<IActionResult> SaveGlue([FromBody] GlueSaveRequest request)
    {
        decimal gluePerSqm = 0;
        if (request.ActualSqm > 0)
        {
            gluePerSqm = request.GlueUsage / request.ActualSqm;
        }

        var result = await _reportService.SaveGlueAsync(
            request.HT_BARCODE, request.GlueID, request.GlueDesc, request.GlueUsage, gluePerSqm);
        return Json(new { success = result });
    }

    // ===== Shared =====
    [HttpPost]
    public async Task<IActionResult> SearchOrders([FromBody] SearchRequest request)
    {
        var orders = await _carpetService.SearchOrdersAsync(request.OrderNo, request.ListNo, request.ItemNo);
        return Json(orders);
    }

    [HttpGet]
    public async Task<IActionResult> GetGlueList()
    {
        var glueList = await _carpetService.GetGlueListAsync();
        return Json(glueList);
    }

    [HttpPost]
    public async Task<IActionResult> Delete([FromBody] int id)
    {
        await _reportService.DeleteReportAsync(id);
        return Json(new { success = true });
    }

    [HttpGet]
    public async Task<IActionResult> GetReport(string htBarcode)
    {
        var report = await _reportService.GetReportByBarcodeAsync(htBarcode);
        return Json(report);
    }

    [HttpPost]
    public async Task<IActionResult> GetTagsByBarcodes([FromBody] string[] barcodes)
    {
        if (barcodes == null || barcodes.Length == 0)
            return Json(new { });

        var reports = await _reportService.GetReportsByBarcodesAsync(barcodes);
        var result = reports.ToDictionary(
            r => r.HT_BARCODE,
            r => new { tagWidth = r.ActualWidth, tagLength = r.ActualLength }
        );
        return Json(result);
    }

    [HttpGet]
    public async Task<IActionResult> GetAllReportsJson()
    {
        var reports = await _reportService.GetAllReportsAsync();
        return Json(reports);
    }

    public async Task<IActionResult> Print(string htBarcode)
    {
        var report = await _reportService.GetReportByBarcodeAsync(htBarcode);
        if (report == null)
        {
            return NotFound();
        }
        return View(report);
    }

    public async Task<IActionResult> PrintByOrder(string orderNo)
    {
        var reports = await _reportService.GetReportsByOrderAsync(orderNo);
        return View(reports);
    }
}
