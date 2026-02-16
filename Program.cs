using Microsoft.EntityFrameworkCore;
using Capet_OPS.Data;
using Capet_OPS.Services;

DotNetEnv.Env.Load();

var builder = WebApplication.CreateBuilder(args);

// Build connection strings from .env
var pgHost = Environment.GetEnvironmentVariable("POSTGRES_HOST");
var pgPort = Environment.GetEnvironmentVariable("POSTGRES_PORT");
var pgDb = Environment.GetEnvironmentVariable("POSTGRES_DATABASE");
var pgUser = Environment.GetEnvironmentVariable("POSTGRES_USER");
var pgPass = Environment.GetEnvironmentVariable("POSTGRES_PASSWORD");
var pgConnStr = $"Host={pgHost};Port={pgPort};Database={pgDb};Username={pgUser};Password={pgPass}";

var sqlHost = Environment.GetEnvironmentVariable("SQLSERVER_HOST");
var sqlPort = Environment.GetEnvironmentVariable("SQLSERVER_PORT");
var sqlDb = Environment.GetEnvironmentVariable("SQLSERVER_DATABASE");
var sqlUser = Environment.GetEnvironmentVariable("SQLSERVER_USER");
var sqlPass = Environment.GetEnvironmentVariable("SQLSERVER_PASSWORD");
var sqlConnStr = $"Server={sqlHost},{sqlPort};Database={sqlDb};User Id={sqlUser};Password={sqlPass};TrustServerCertificate=True;Encrypt=False;";

// CMTProduction connection string from .env
var cmtHost = Environment.GetEnvironmentVariable("CMTPRODUCTION_HOST");
var cmtPort = Environment.GetEnvironmentVariable("CMTPRODUCTION_PORT");
var cmtDb = Environment.GetEnvironmentVariable("CMTPRODUCTION_DATABASE");
var cmtUser = Environment.GetEnvironmentVariable("CMTPRODUCTION_USER");
var cmtPass = Environment.GetEnvironmentVariable("CMTPRODUCTION_PASSWORD");
var cmtConnStr = $"Server={cmtHost},{cmtPort};Database={cmtDb};User Id={cmtUser};Password={cmtPass};TrustServerCertificate=True;Encrypt=False;";

// PostgreSQL via EF Core
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(pgConnStr));

// SQL Server connection string for Dapper
builder.Services.AddSingleton(new SqlServerSettings { ConnectionString = sqlConnStr });

// CMTProduction connection string for Dapper
builder.Services.AddSingleton(new CmtProductionSettings { ConnectionString = cmtConnStr });

// Register services
builder.Services.AddScoped<ICanvasTypeService, CanvasTypeService>();
builder.Services.AddScoped<IOrderService, OrderService>();
builder.Services.AddScoped<ILayoutCalculationService, LayoutCalculationService>();
builder.Services.AddScoped<ILayoutPlanService, LayoutPlanService>();
builder.Services.AddScoped<ISyncService, SyncService>();

// CMT Report Data services
builder.Services.AddScoped<CmtCarpetService>();
builder.Services.AddScoped<CmtReportService>();

builder.Services.AddControllersWithViews();

// Swagger
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new Microsoft.OpenApi.Models.OpenApiInfo
    {
        Title = "CAPET-OPS API",
        Version = "v1",
        Description = "Carpet Layout Planning System API"
    });
});

var app = builder.Build();

// Auto-migrate and seed on startup
using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await context.Database.MigrateAsync();
    await SeedData.Initialize(context);

    // Ensure CMT Report Data table exists
    var cmtReportService = scope.ServiceProvider.GetRequiredService<CmtReportService>();
    await cmtReportService.EnsureTableExistsAsync();
}

if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");
    app.UseHsts();
}

// Swagger UI
app.UseSwagger();
app.UseSwaggerUI(c =>
{
    c.SwaggerEndpoint("/swagger/v1/swagger.json", "CAPET-OPS API v1");
    c.RoutePrefix = "swagger";
});

app.UseStaticFiles();
app.UseRouting();
app.UseAuthorization();

app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Layout}/{action=Index}/{id?}");

app.Run();
