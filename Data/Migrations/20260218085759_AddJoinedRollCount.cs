using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Capet_OPS.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddJoinedRollCount : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "joined_roll_count",
                table: "layout_plans",
                type: "integer",
                nullable: false,
                defaultValue: 1);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "joined_roll_count",
                table: "layout_plans");
        }
    }
}
