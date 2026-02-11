using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Capet_OPS.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "canvas_types",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    erp_code = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    cnv_desc = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    roll_width = table.Column<decimal>(type: "numeric(10,2)", nullable: false),
                    is_active = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_canvas_types", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "layout_plans",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    plan_code = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    canvas_type_id = table.Column<int>(type: "integer", nullable: false),
                    roll_width = table.Column<decimal>(type: "numeric(10,2)", nullable: false),
                    total_length = table.Column<decimal>(type: "numeric(10,2)", nullable: false),
                    total_area = table.Column<decimal>(type: "numeric(12,4)", nullable: false),
                    used_area = table.Column<decimal>(type: "numeric(12,4)", nullable: false),
                    waste_area = table.Column<decimal>(type: "numeric(12,4)", nullable: false),
                    efficiency_pct = table.Column<decimal>(type: "numeric(5,2)", nullable: false),
                    piece_count = table.Column<int>(type: "integer", nullable: false),
                    status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false, defaultValue: "planned"),
                    layout_json = table.Column<string>(type: "jsonb", nullable: true),
                    notes = table.Column<string>(type: "text", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()"),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_layout_plans", x => x.id);
                    table.ForeignKey(
                        name: "FK_layout_plans_canvas_types_canvas_type_id",
                        column: x => x.canvas_type_id,
                        principalTable: "canvas_types",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "layout_plan_items",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    layout_plan_id = table.Column<int>(type: "integer", nullable: false),
                    barcode_no = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    orno = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    list_no = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    item_no = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    cnv_id = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    cnv_desc = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    as_plan = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    width = table.Column<decimal>(type: "numeric(10,4)", nullable: false),
                    length = table.Column<decimal>(type: "numeric(10,4)", nullable: false),
                    area = table.Column<decimal>(type: "numeric(12,4)", nullable: false),
                    qty = table.Column<int>(type: "integer", nullable: false, defaultValue: 1),
                    order_type = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: true),
                    pack_x = table.Column<decimal>(type: "numeric(10,4)", nullable: false, defaultValue: 0m),
                    pack_y = table.Column<decimal>(type: "numeric(10,4)", nullable: false, defaultValue: 0m),
                    pack_width = table.Column<decimal>(type: "numeric(10,4)", nullable: false),
                    pack_length = table.Column<decimal>(type: "numeric(10,4)", nullable: false),
                    is_rotated = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_layout_plan_items", x => x.id);
                    table.ForeignKey(
                        name: "FK_layout_plan_items_layout_plans_layout_plan_id",
                        column: x => x.layout_plan_id,
                        principalTable: "layout_plans",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "planned_barcodes",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    barcode_no = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    layout_plan_id = table.Column<int>(type: "integer", nullable: false),
                    planned_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_planned_barcodes", x => x.id);
                    table.ForeignKey(
                        name: "FK_planned_barcodes_layout_plans_layout_plan_id",
                        column: x => x.layout_plan_id,
                        principalTable: "layout_plans",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_canvas_types_erp_code",
                table: "canvas_types",
                column: "erp_code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_layout_plan_items_barcode_no",
                table: "layout_plan_items",
                column: "barcode_no");

            migrationBuilder.CreateIndex(
                name: "IX_layout_plan_items_layout_plan_id",
                table: "layout_plan_items",
                column: "layout_plan_id");

            migrationBuilder.CreateIndex(
                name: "IX_layout_plans_canvas_type_id",
                table: "layout_plans",
                column: "canvas_type_id");

            migrationBuilder.CreateIndex(
                name: "IX_layout_plans_plan_code",
                table: "layout_plans",
                column: "plan_code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_layout_plans_status",
                table: "layout_plans",
                column: "status");

            migrationBuilder.CreateIndex(
                name: "IX_planned_barcodes_barcode_no",
                table: "planned_barcodes",
                column: "barcode_no",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_planned_barcodes_layout_plan_id",
                table: "planned_barcodes",
                column: "layout_plan_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "layout_plan_items");

            migrationBuilder.DropTable(
                name: "planned_barcodes");

            migrationBuilder.DropTable(
                name: "layout_plans");

            migrationBuilder.DropTable(
                name: "canvas_types");
        }
    }
}
