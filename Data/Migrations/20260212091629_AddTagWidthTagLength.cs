using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Capet_OPS.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddTagWidthTagLength : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "tag_length",
                table: "layout_plan_items",
                type: "numeric(10,4)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "tag_width",
                table: "layout_plan_items",
                type: "numeric(10,4)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "tag_length",
                table: "layout_plan_items");

            migrationBuilder.DropColumn(
                name: "tag_width",
                table: "layout_plan_items");
        }
    }
}
