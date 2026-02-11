using Capet_OPS.Models.Dtos;

namespace Capet_OPS.Services;

public class LayoutCalculationService : ILayoutCalculationService
{
    private const int SCALE = 1000; // meters to mm for precision

    public CalculationResultDto Calculate(decimal rollWidth, List<SqlServerOrderDto> selectedOrders)
        => Calculate(rollWidth, selectedOrders, PackingAlgorithm.Standard, 150);

    public CalculationResultDto Calculate(decimal rollWidth, List<SqlServerOrderDto> selectedOrders, PackingAlgorithm algorithm, int gapMm = 150)
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
            PackingAlgorithm.Standard => ShelfPack(rollWidthMm, items, gapMm),
            PackingAlgorithm.Rotated => ShelfPackRotated(rollWidthMm, items, gapMm),
            PackingAlgorithm.SizeBased => ShelfPackSizeBased(rollWidthMm, items, gapMm),
            PackingAlgorithm.CutCorner => ShelfPackCutCorner(rollWidthMm, items, gapMm),
            _ => ShelfPack(rollWidthMm, items, gapMm)
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

    // ───────── Algorithm 1: Standard FFD ─────────

    private List<PlacedItem> ShelfPack(int rollWidthMm, List<PackItem> items, int gap)
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
                        shelf.CurrentX += w + gap;
                        shelf.RemainingWidth -= (w + gap);
                        placed = true;
                        break;
                    }
                }
                if (placed) break;
            }

            if (!placed)
            {
                var (bestW, bestH, bestRotated) = orientations.First();
                int shelfY = shelves.Count > 0 ? shelves.Last().Y + shelves.Last().Height + gap : 0;
                shelves.Add(new Shelf
                {
                    Y = shelfY, Height = bestH,
                    CurrentX = bestW + gap, RemainingWidth = rollWidthMm - bestW - gap
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

    // ───────── Algorithm 2: Rotated (minimize shelf height) ─────────

    private List<PlacedItem> ShelfPackRotated(int rollWidthMm, List<PackItem> items, int gap)
    {
        var sorted = items.OrderByDescending(i => Math.Max(i.WidthMm, i.LengthMm)).ToList();
        var shelves = new List<Shelf>();
        var result = new List<PlacedItem>();

        foreach (var item in sorted)
        {
            bool placed = false;
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
                        shelf.CurrentX += w + gap;
                        shelf.RemainingWidth -= (w + gap);
                        placed = true;
                        break;
                    }
                }
                if (placed) break;
            }

            if (!placed)
            {
                var (bestW, bestH, bestRotated) = orientations.First();
                int shelfY = shelves.Count > 0 ? shelves.Last().Y + shelves.Last().Height + gap : 0;
                shelves.Add(new Shelf
                {
                    Y = shelfY, Height = bestH,
                    CurrentX = bestW + gap, RemainingWidth = rollWidthMm - bestW - gap
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

    private List<PlacedItem> ShelfPackSizeBased(int rollWidthMm, List<PackItem> items, int gap)
    {
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
                            shelf.CurrentX += w + gap;
                            shelf.RemainingWidth -= (w + gap);
                            placed = true;
                            break;
                        }
                    }
                    if (placed) break;
                }

                if (!placed)
                {
                    var (bestW, bestH, bestRotated) = orientations.First();
                    int shelfY = shelves.Count > 0 ? shelves.Last().Y + shelves.Last().Height + gap : 0;
                    shelves.Add(new Shelf
                    {
                        Y = shelfY, Height = bestH,
                        CurrentX = bestW + gap, RemainingWidth = rollWidthMm - bestW - gap
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

    private List<PlacedItem> ShelfPackCutCorner(int rollWidthMm, List<PackItem> items, int gap)
    {
        var sorted = items.OrderByDescending(i => Math.Max(i.WidthMm, i.LengthMm)).ToList();
        var shelves = new List<Shelf>();
        var freeGaps = new List<GapRegion>();
        var result = new List<PlacedItem>();

        foreach (var item in sorted)
        {
            bool placed = false;
            var orientations = GetOrientations(item, rollWidthMm);

            // Try gaps first
            foreach (var fg in freeGaps)
            {
                if (fg.Used) continue;
                foreach (var (w, h, rotated) in orientations)
                {
                    if (w <= fg.Width && h <= fg.Height)
                    {
                        result.Add(new PlacedItem
                        {
                            Index = item.Index, X = fg.X, Y = fg.Y + gap,
                            PlacedWidth = w, PlacedLength = h, IsRotated = rotated
                        });
                        if (fg.Width - w - gap > 0)
                        {
                            freeGaps.Add(new GapRegion
                            {
                                X = fg.X + w + gap, Y = fg.Y,
                                Width = fg.Width - w - gap, Height = fg.Height
                            });
                        }
                        fg.Used = true;
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
                        if (h + gap < shelf.Height)
                        {
                            freeGaps.Add(new GapRegion
                            {
                                X = shelf.CurrentX, Y = shelf.Y + h,
                                Width = w, Height = shelf.Height - h
                            });
                        }
                        shelf.CurrentX += w + gap;
                        shelf.RemainingWidth -= (w + gap);
                        placed = true;
                        break;
                    }
                }
                if (placed) break;
            }

            if (!placed)
            {
                var (bestW, bestH, bestRotated) = orientations.First();
                int shelfY = shelves.Count > 0 ? shelves.Last().Y + shelves.Last().Height + gap : 0;
                shelves.Add(new Shelf
                {
                    Y = shelfY, Height = bestH,
                    CurrentX = bestW + gap, RemainingWidth = rollWidthMm - bestW - gap
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
        orientations.Sort((a, b) => a.H.CompareTo(b.H));
        return orientations;
    }

    // ───────── Private Types ─────────

    private class PackItem { public int Index; public int WidthMm; public int LengthMm; }
    private class PlacedItem { public int Index; public int X; public int Y; public int PlacedWidth; public int PlacedLength; public bool IsRotated; }
    private class Shelf { public int Y; public int Height; public int CurrentX; public int RemainingWidth; }
    private class GapRegion { public int X; public int Y; public int Width; public int Height; public bool Used; }
}
