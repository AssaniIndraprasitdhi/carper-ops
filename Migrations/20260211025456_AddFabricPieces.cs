using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Capet_OPS.Migrations
{
    /// <inheritdoc />
    public partial class AddFabricPieces : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "fabric_pieces",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    barcode_no = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    orno = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    list_no = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    item_no = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    cnv_id = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    cnv_desc = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    as_plan = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    width = table.Column<decimal>(type: "numeric(10,4)", nullable: false),
                    length = table.Column<decimal>(type: "numeric(10,4)", nullable: false),
                    sqm = table.Column<decimal>(type: "numeric(12,4)", nullable: true),
                    qty = table.Column<int>(type: "integer", nullable: true),
                    order_type = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: true),
                    synced_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_fabric_pieces", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_fabric_pieces_barcode_no",
                table: "fabric_pieces",
                column: "barcode_no",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_fabric_pieces_cnv_id",
                table: "fabric_pieces",
                column: "cnv_id");

            migrationBuilder.CreateIndex(
                name: "IX_fabric_pieces_orno",
                table: "fabric_pieces",
                column: "orno");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "fabric_pieces");
        }
    }
}
