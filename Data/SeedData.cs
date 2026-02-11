using Microsoft.EntityFrameworkCore;
using Capet_OPS.Models.Entities;

namespace Capet_OPS.Data;

public static class SeedData
{
    public static async Task Initialize(AppDbContext context)
    {
        if (await context.CanvasTypes.AnyAsync())
            return;

        var canvasTypes = new List<CanvasType>
        {
            new() { ErpCode = "RMPB1011132", CnvDesc = "ผ้าใบทอจอ 12s 13.2m", RollWidth = 13.2m, CnvId = "1" },
            new() { ErpCode = "RMPB1011096", CnvDesc = "ผ้าใบทอจอ 12s 9.6m", RollWidth = 9.6m, CnvId = "1" },
            new() { ErpCode = "RMPB1011040", CnvDesc = "ผ้าใบทอจอ 12s 4.0m", RollWidth = 4.0m, CnvId = "1" },
            new() { ErpCode = "RMPB1021068", CnvDesc = "ผ้าโพลีเอสเตอร์(ต่างประเทศ) 6.8m-AT", RollWidth = 6.8m, CnvId = "9" },
            new() { ErpCode = "RMPB1021096", CnvDesc = "ผ้าใบทอจอ โพลีเอสเตอร์ เส้นเหลือง 9.6m", RollWidth = 9.6m, CnvId = "3" },
            new() { ErpCode = "RMPB1014096", CnvDesc = "ผ้าใบทอจอ 12s/3 100% Biodegradable 9.6m", RollWidth = 9.6m, CnvId = "5" },
            new() { ErpCode = "RMPB1021042", CnvDesc = "ผ้าโพลีต่างประเทศ 4.12m - ทอเครื่องจักรใหญ่", RollWidth = 4.12m, CnvId = "6" },
            new() { ErpCode = "RMPB1021041", CnvDesc = "ผ้าโพลีต่างประเทศ 4.16m (ตรม.)", RollWidth = 4.16m, CnvId = "6" },
            new() { ErpCode = "RMPB1031051", CnvDesc = "ผ้าเยอรมันสีเทา 5.15 m. - Outdoor", RollWidth = 5.15m, CnvId = "4" },
            new() { ErpCode = "RMPB1042030", CnvDesc = "ผ้าจังโก้ดำ 3m. - ทอเครื่องจักรเล็ก", RollWidth = 3.0m, CnvId = "8" },
            new() { ErpCode = "RMPB1041030", CnvDesc = "ผ้าจังโก้ขาว 3m. - ทอเครื่องจักรเล็ก", RollWidth = 3.0m, CnvId = "7" },
            new() { ErpCode = "RMPB1041015", CnvDesc = "ผ้าจังโก้ขาว 1.5m - ทอเครื่องจักรเล็ก", RollWidth = 1.5m, CnvId = "7" },
        };

        context.CanvasTypes.AddRange(canvasTypes);
        await context.SaveChangesAsync();
    }
}
