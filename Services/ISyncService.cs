namespace Capet_OPS.Services;

public interface ISyncService
{
    Task<int> SyncFromSqlServerAsync();
}
