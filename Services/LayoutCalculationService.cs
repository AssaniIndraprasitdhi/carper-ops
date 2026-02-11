using Capet_OPS.Models.Dtos;

namespace Capet_OPS.Services;

public class LayoutCalculationService : ILayoutCalculationService
{
    private const int SCALE = 1000; // meters to mm for precision

    public CalculationResultDto Calculate(decimal rollWidth, List<SqlServerOrderDto> selectedOrders)
        => Calculate(rollWidth, selectedOrders, PackingAlgorithm.Standard);

    public CalculationResultDto Calculate(decimal rollWidth, List<SqlServerOrderDto> selectedOrders, PackingAlgorithm algorithm)
    {
        var rollWidthMm = (int)(rollWidth * SCALE);
        var items = selectedOrders.Select((order, index) => new PackItem
        {
            Index = index,
            WidthMm = (int)(order.Width * SCALE),
            LengthMm = (int)(order.Length * SCALE),
        }).ToList();

        // Validate: ensure each item can fit (at least one orientation)
        foreach (var item in items)
        {
            var minDim = Math.Min(item.WidthMm, item.LengthMm);
            if (minDim > rollWidthMm)
                throw new InvalidOperationException(
                    $"Order {selectedOrders[item.Index].BarcodeNo} is too large for this canvas roll.");
        }

        var packed = algorithm switch
        {
            PackingAlgorithm.Standard => ShelfPack(rollWidthMm, items),
            PackingAlgorithm.Rotated => ShelfPackRotated(rollWidthMm, items),
            PackingAlgorithm.SizeBased => ShelfPackSizeBased(rollWidthMm, items),
            PackingAlgorithm.CutCorner => ShelfPackCutCorner(rollWidthMm, items),
            _ => ShelfPack(rollWidthMm, items)
        };

        return BuildResult(rollWidth, selectedOrders, packed);
    }

    private CalculationResultDto BuildResult(decimal rollWidth, List<SqlServerOrderDto> selectedOrders, List<PlacedItem> packed)
    {
        int totalLengthMm = 0;
        foreach (var p in packed)
        {
            var bottom = p.Y + p.PlacedLength;
            if (bottom > totalLengthMm) totalLengthMm = bottom;
        }

        decimal totalLength = (decimal)totalLengthMm / SCALE;
        decimal totalArea = rollWidth * totalLength;
        decimal usedArea = selectedOrders.Sum(o => o.Width * o.Length);
        decimal wasteArea = totalArea - usedArea;
        decimal efficiencyPct = totalArea > 0
            ? Math.Round((usedArea / totalArea) * 100m, 2)
            : 0;

        var packedItems = packed.Select(p =>
        {
            var order = selectedOrders[p.Index];
            return new PackedItemDto
            {
                BarcodeNo = order.BarcodeNo,
                ORNO = order.ORNO,
                ListNo = order.ListNo,
                ItemNo = order.ItemNo,
                CnvID = order.CnvID,
                CnvDesc = order.CnvDesc,
                ASPLAN = order.ASPLAN,
                OriginalWidth = order.Width,
                OriginalLength = order.Length,
                Sqm = order.Sqm,
                Qty = order.Qty,
                OrderType = order.OrderType,
                PackX = (decimal)p.X / SCALE,
                PackY = (decimal)p.Y / SCALE,
                PackWidth = (decimal)p.PlacedWidth / SCALE,
                PackLength = (decimal)p.PlacedLength / SCALE,
                IsRotated = p.IsRotated,
            };
        }).ToList();

        return new CalculationResultDto
        {
            RollWidth = rollWidth,
            TotalLength = totalLength,
            TotalArea = totalArea,
            UsedArea = usedArea,
            WasteArea = wasteArea,
            EfficiencyPct = efficiencyPct,
            PieceCount = selectedOrders.Count,
            PackedItems = packedItems
        };
    }

    // ───────── Algorithm 1: Standard FFD (existing) ─────────

    private List<PlacedItem> ShelfPack(int rollWidthMm, List<PackItem> items)
    {
        var sorted = items.OrderByDescending(i => Math.Max(i.WidthMm, i.LengthMm)).ToList();
        var shelves = new List<Shelf>();
        var result = new List<PlacedItem>();

        foreach (var item in sorted)
        {
            bool placed = false;
            var orientations = GetOrientations(item, rollWidthMm);

            foreach (var shelf in shelves)
            {
                foreach (var (w, h, rotated) in orientations)
                {
                    if (shelf.RemainingWidth >= w && shelf.Height >= h)
                    {
                        result.Add(new PlacedItem
                        {
                            Index = item.Index, X = shelf.CurrentX, Y = shelf.Y,
                            PlacedWidth = w, PlacedLength = h, IsRotated = rotated
                        });
                        shelf.CurrentX += w;
                        shelf.RemainingWidth -= w;
                        placed = true;
                        break;
                    }
                }
                if (placed) break;
            }

            if (!placed)
            {
                var (bestW, bestH, bestRotated) = orientations.First();
                int shelfY = shelves.Count > 0 ? shelves.Last().Y + shelves.Last().Height : 0;
                var newShelf = new Shelf
                {
                    Y = shelfY, Height = bestH,
                    CurrentX = bestW, RemainingWidth = rollWidthMm - bestW
                };
                shelves.Add(newShelf);
                result.Add(new PlacedItem
                {
                    Index = item.Index, X = 0, Y = shelfY,
                    PlacedWidth = bestW, PlacedLength = bestH, IsRotated = bestRotated
                });
            }
        }

        return result;
    }

    // ───────── Algorithm 2: Rotated (minimize shelf height) ─────────

    private List<PlacedItem> ShelfPackRotated(int rollWidthMm, List<PackItem> items)
    {
        var sorted = items.OrderByDescending(i => Math.Max(i.WidthMm, i.LengthMm)).ToList();
        var shelves = new List<Shelf>();
        var result = new List<PlacedItem>();

        foreach (var item in sorted)
        {
            bool placed = false;
            // Prefer orientation with smallest height (H) to minimize shelf height
            var orientations = GetOrientationsMinHeight(item, rollWidthMm);

            foreach (var shelf in shelves)
            {
                foreach (var (w, h, rotated) in orientations)
                {
                    if (shelf.RemainingWidth >= w && shelf.Height >= h)
                    {
                        result.Add(new PlacedItem
                        {
                            Index = item.Index, X = shelf.CurrentX, Y = shelf.Y,
                            PlacedWidth = w, PlacedLength = h, IsRotated = rotated
                        });
                        shelf.CurrentX += w;
                        shelf.RemainingWidth -= w;
                        placed = true;
                        break;
                    }
                }
                if (placed) break;
            }

            if (!placed)
            {
                var (bestW, bestH, bestRotated) = orientations.First();
                int shelfY = shelves.Count > 0 ? shelves.Last().Y + shelves.Last().Height : 0;
                shelves.Add(new Shelf
                {
                    Y = shelfY, Height = bestH,
                    CurrentX = bestW, RemainingWidth = rollWidthMm - bestW
                });
                result.Add(new PlacedItem
                {
                    Index = item.Index, X = 0, Y = shelfY,
                    PlacedWidth = bestW, PlacedLength = bestH, IsRotated = bestRotated
                });
            }
        }

        return result;
    }

    // ───────── Algorithm 3: Size-based (group similar sizes) ─────────

    private List<PlacedItem> ShelfPackSizeBased(int rollWidthMm, List<PackItem> items)
    {
        // Group items by similar area (within 30% of each other)
        var sortedByArea = items.OrderByDescending(i => i.WidthMm * i.LengthMm).ToList();
        var groups = new List<List<PackItem>>();
        var used = new HashSet<int>();

        foreach (var item in sortedByArea)
        {
            if (used.Contains(item.Index)) continue;

            var group = new List<PackItem> { item };
            used.Add(item.Index);
            long itemArea = (long)item.WidthMm * item.LengthMm;

            foreach (var other in sortedByArea)
            {
                if (used.Contains(other.Index)) continue;
                long otherArea = (long)other.WidthMm * other.LengthMm;
                if (itemArea > 0 && Math.Abs(otherArea - itemArea) <= itemArea * 0.3)
                {
                    group.Add(other);
                    used.Add(other.Index);
                }
            }
            groups.Add(group);
        }

        // Pack each group using shelf packing, stacking group shelves vertically
        var shelves = new List<Shelf>();
        var result = new List<PlacedItem>();

        foreach (var group in groups)
        {
            var sorted = group.OrderByDescending(i => Math.Max(i.WidthMm, i.LengthMm)).ToList();
            foreach (var item in sorted)
            {
                bool placed = false;
                var orientations = GetOrientations(item, rollWidthMm);

                foreach (var shelf in shelves)
                {
                    foreach (var (w, h, rotated) in orientations)
                    {
                        if (shelf.RemainingWidth >= w && shelf.Height >= h)
                        {
                            result.Add(new PlacedItem
                            {
                                Index = item.Index, X = shelf.CurrentX, Y = shelf.Y,
                                PlacedWidth = w, PlacedLength = h, IsRotated = rotated
                            });
                            shelf.CurrentX += w;
                            shelf.RemainingWidth -= w;
                            placed = true;
                            break;
                        }
                    }
                    if (placed) break;
                }

                if (!placed)
                {
                    var (bestW, bestH, bestRotated) = orientations.First();
                    int shelfY = shelves.Count > 0 ? shelves.Last().Y + shelves.Last().Height : 0;
                    shelves.Add(new Shelf
                    {
                        Y = shelfY, Height = bestH,
                        CurrentX = bestW, RemainingWidth = rollWidthMm - bestW
                    });
                    result.Add(new PlacedItem
                    {
                        Index = item.Index, X = 0, Y = shelfY,
                        PlacedWidth = bestW, PlacedLength = bestH, IsRotated = bestRotated
                    });
                }
            }
        }

        return result;
    }

    // ───────── Algorithm 4: Cut-corner (fill gaps between shelves) ─────────

    private List<PlacedItem> ShelfPackCutCorner(int rollWidthMm, List<PackItem> items)
    {
        var sorted = items.OrderByDescending(i => Math.Max(i.WidthMm, i.LengthMm)).ToList();
        var shelves = new List<Shelf>();
        var gaps = new List<GapRegion>(); // track gaps above items shorter than shelf height
        var result = new List<PlacedItem>();

        foreach (var item in sorted)
        {
            bool placed = false;
            var orientations = GetOrientations(item, rollWidthMm);

            // Try gaps first (fill spaces above shorter items)
            foreach (var gap in gaps)
            {
                if (gap.Used) continue;
                foreach (var (w, h, rotated) in orientations)
                {
                    if (w <= gap.Width && h <= gap.Height)
                    {
                        result.Add(new PlacedItem
                        {
                            Index = item.Index, X = gap.X, Y = gap.Y,
                            PlacedWidth = w, PlacedLength = h, IsRotated = rotated
                        });
                        // Split remaining gap
                        if (gap.Width - w > 0)
                        {
                            gaps.Add(new GapRegion
                            {
                                X = gap.X + w, Y = gap.Y,
                                Width = gap.Width - w, Height = gap.Height
                            });
                        }
                        gap.Used = true;
                        placed = true;
                        break;
                    }
                }
                if (placed) break;
            }

            if (placed) continue;

            // Try existing shelves
            foreach (var shelf in shelves)
            {
                foreach (var (w, h, rotated) in orientations)
                {
                    if (shelf.RemainingWidth >= w && shelf.Height >= h)
                    {
                        result.Add(new PlacedItem
                        {
                            Index = item.Index, X = shelf.CurrentX, Y = shelf.Y,
                            PlacedWidth = w, PlacedLength = h, IsRotated = rotated
                        });
                        // Track gap above this item if shorter than shelf
                        if (h < shelf.Height)
                        {
                            gaps.Add(new GapRegion
                            {
                                X = shelf.CurrentX, Y = shelf.Y + h,
                                Width = w, Height = shelf.Height - h
                            });
                        }
                        shelf.CurrentX += w;
                        shelf.RemainingWidth -= w;
                        placed = true;
                        break;
                    }
                }
                if (placed) break;
            }

            if (!placed)
            {
                var (bestW, bestH, bestRotated) = orientations.First();
                int shelfY = shelves.Count > 0 ? shelves.Last().Y + shelves.Last().Height : 0;
                shelves.Add(new Shelf
                {
                    Y = shelfY, Height = bestH,
                    CurrentX = bestW, RemainingWidth = rollWidthMm - bestW
                });
                result.Add(new PlacedItem
                {
                    Index = item.Index, X = 0, Y = shelfY,
                    PlacedWidth = bestW, PlacedLength = bestH, IsRotated = bestRotated
                });
            }
        }

        return result;
    }

    // ───────── Orientation Helpers ─────────

    private List<(int W, int H, bool Rotated)> GetOrientations(PackItem item, int rollWidthMm)
    {
        var orientations = new List<(int W, int H, bool Rotated)>();
        if (item.WidthMm <= rollWidthMm)
            orientations.Add((item.WidthMm, item.LengthMm, false));
        if (item.LengthMm <= rollWidthMm && item.LengthMm != item.WidthMm)
            orientations.Add((item.LengthMm, item.WidthMm, true));
        // Prefer wider across roll
        orientations.Sort((a, b) => b.W.CompareTo(a.W));
        return orientations;
    }

    private List<(int W, int H, bool Rotated)> GetOrientationsMinHeight(PackItem item, int rollWidthMm)
    {
        var orientations = new List<(int W, int H, bool Rotated)>();
        if (item.WidthMm <= rollWidthMm)
            orientations.Add((item.WidthMm, item.LengthMm, false));
        if (item.LengthMm <= rollWidthMm && item.LengthMm != item.WidthMm)
            orientations.Add((item.LengthMm, item.WidthMm, true));
        // Prefer smallest height to minimize shelf height
        orientations.Sort((a, b) => a.H.CompareTo(b.H));
        return orientations;
    }

    // ───────── Private Types ─────────

    private class PackItem
    {
        public int Index { get; set; }
        public int WidthMm { get; set; }
        public int LengthMm { get; set; }
    }

    private class PlacedItem
    {
        public int Index { get; set; }
        public int X { get; set; }
        public int Y { get; set; }
        public int PlacedWidth { get; set; }
        public int PlacedLength { get; set; }
        public bool IsRotated { get; set; }
    }

    private class Shelf
    {
        public int Y { get; set; }
        public int Height { get; set; }
        public int CurrentX { get; set; }
        public int RemainingWidth { get; set; }
    }

    private class GapRegion
    {
        public int X { get; set; }
        public int Y { get; set; }
        public int Width { get; set; }
        public int Height { get; set; }
        public bool Used { get; set; }
    }
}
