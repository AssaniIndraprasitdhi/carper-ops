using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Capet_OPS.Migrations
{
    /// <inheritdoc />
    public partial class RenameFabricTypesAddCnvId : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_layout_plans_canvas_types_canvas_type_id",
                table: "layout_plans");

            migrationBuilder.DropPrimaryKey(
                name: "PK_canvas_types",
                table: "canvas_types");

            migrationBuilder.RenameTable(
                name: "canvas_types",
                newName: "fabric_types");

            migrationBuilder.RenameColumn(
                name: "canvas_type_id",
                table: "layout_plans",
                newName: "fabric_type_id");

            migrationBuilder.RenameIndex(
                name: "IX_layout_plans_canvas_type_id",
                table: "layout_plans",
                newName: "IX_layout_plans_fabric_type_id");

            migrationBuilder.RenameIndex(
                name: "IX_canvas_types_erp_code",
                table: "fabric_types",
                newName: "IX_fabric_types_erp_code");

            migrationBuilder.AddColumn<string>(
                name: "cnv_id",
                table: "fabric_types",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DateTime>(
                name: "updated_at",
                table: "fabric_types",
                type: "timestamp with time zone",
                nullable: false,
                defaultValueSql: "NOW()");

            migrationBuilder.AddPrimaryKey(
                name: "PK_fabric_types",
                table: "fabric_types",
                column: "id");

            migrationBuilder.AddForeignKey(
                name: "FK_layout_plans_fabric_types_fabric_type_id",
                table: "layout_plans",
                column: "fabric_type_id",
                principalTable: "fabric_types",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_layout_plans_fabric_types_fabric_type_id",
                table: "layout_plans");

            migrationBuilder.DropPrimaryKey(
                name: "PK_fabric_types",
                table: "fabric_types");

            migrationBuilder.DropColumn(
                name: "cnv_id",
                table: "fabric_types");

            migrationBuilder.DropColumn(
                name: "updated_at",
                table: "fabric_types");

            migrationBuilder.RenameTable(
                name: "fabric_types",
                newName: "canvas_types");

            migrationBuilder.RenameColumn(
                name: "fabric_type_id",
                table: "layout_plans",
                newName: "canvas_type_id");

            migrationBuilder.RenameIndex(
                name: "IX_layout_plans_fabric_type_id",
                table: "layout_plans",
                newName: "IX_layout_plans_canvas_type_id");

            migrationBuilder.RenameIndex(
                name: "IX_fabric_types_erp_code",
                table: "canvas_types",
                newName: "IX_canvas_types_erp_code");

            migrationBuilder.AddPrimaryKey(
                name: "PK_canvas_types",
                table: "canvas_types",
                column: "id");

            migrationBuilder.AddForeignKey(
                name: "FK_layout_plans_canvas_types_canvas_type_id",
                table: "layout_plans",
                column: "canvas_type_id",
                principalTable: "canvas_types",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
