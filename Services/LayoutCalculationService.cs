using Capet_OPS.Models.Dtos;

namespace Capet_OPS.Services;

public class LayoutCalculationService : ILayoutCalculationService
{
    private const int SCALE = 1000; // meters to mm for precision
    // MaxRects uses same gap system as shelf algorithms (no extra outer margin)

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

        // MaxRects: rotation allowed, same gap as shelf, no outer margin
        if (algorithm == PackingAlgorithm.MaxRects)
        {
            var packed = MaxRectsPack(rollWidthMm, items, gapMm);
            return BuildResult(rollWidth, selectedOrders, packed);
        }

        // Shelf-based algorithms: validate all items can fit (with rotation)
        foreach (var item in items)
        {
            var minDim = Math.Min(item.WidthMm, item.LengthMm);
            if (minDim > rollWidthMm)
                throw new InvalidOperationException(
                    $"Order {selectedOrders[item.Index].BarcodeNo} is too large for this canvas roll.");
        }

        var packed2 = algorithm switch
        {
            PackingAlgorithm.Standard => ShelfPack(rollWidthMm, items, gapMm),
            PackingAlgorithm.Rotated => ShelfPackRotated(rollWidthMm, items, gapMm),
            PackingAlgorithm.SizeBased => ShelfPackSizeBased(rollWidthMm, items, gapMm),
            PackingAlgorithm.CutCorner => ShelfPackCutCorner(rollWidthMm, items, gapMm),
            _ => ShelfPack(rollWidthMm, items, gapMm)
        };

        return BuildResult(rollWidth, selectedOrders, packed2);
    }

    private CalculationResultDto BuildResult(decimal rollWidth, List<SqlServerOrderDto> selectedOrders, List<PlacedItem> packed, int extraLengthMm = 0)
    {
        int totalLengthMm = 0;
        foreach (var p in packed)
        {
            var bottom = p.Y + p.PlacedLength;
            if (bottom > totalLengthMm) totalLengthMm = bottom;
        }
        totalLengthMm += extraLengthMm; // bottom margin (MaxRects only)

        decimal totalLength = (decimal)totalLengthMm / SCALE;
        decimal totalArea = rollWidth * totalLength;
        // Compute usedArea from placed items only (backward-compatible: shelf algorithms place all items)
        decimal usedArea = packed.Sum(p =>
        {
            var order = selectedOrders[p.Index];
            return order.Width * order.Length;
        });
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
            PieceCount = packed.Count,
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

    // ───────── Algorithm 2: Rotated (narrow-width packing) ─────────
    // Sort by min dimension ascending → prefer narrow orientation → more items per shelf row

    private List<PlacedItem> ShelfPackRotated(int rollWidthMm, List<PackItem> items, int gap)
    {
        var sorted = items.OrderByDescending(i => Math.Min(i.WidthMm, i.LengthMm)).ToList();
        var shelves = new List<Shelf>();
        var result = new List<PlacedItem>();

        foreach (var item in sorted)
        {
            bool placed = false;
            var orientations = GetOrientationsNarrow(item, rollWidthMm);

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

    // ───────── Algorithm 3: Size-based (group similar heights + best-fit shelf) ─────────
    // Group items with similar heights together, then use best-fit shelf selection

    private List<PlacedItem> ShelfPackSizeBased(int rollWidthMm, List<PackItem> items, int gap)
    {
        // Group by similar height (min dimension as potential shelf height)
        var sortedByHeight = items.OrderByDescending(i => Math.Min(i.WidthMm, i.LengthMm)).ToList();
        var groups = new List<List<PackItem>>();
        var used = new HashSet<int>();

        foreach (var item in sortedByHeight)
        {
            if (used.Contains(item.Index)) continue;
            var group = new List<PackItem> { item };
            used.Add(item.Index);
            int itemH = Math.Min(item.WidthMm, item.LengthMm);

            foreach (var other in sortedByHeight)
            {
                if (used.Contains(other.Index)) continue;
                int otherH = Math.Min(other.WidthMm, other.LengthMm);
                if (itemH > 0 && Math.Abs(otherH - itemH) <= itemH * 0.25)
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

                // Best-fit: pick shelf with LEAST remaining width that still fits
                Shelf? bestShelf = null;
                int bestW = 0, bestH = 0;
                bool bestRotated = false;
                int bestRemaining = int.MaxValue;

                foreach (var shelf in shelves)
                {
                    foreach (var (w, h, rotated) in orientations)
                    {
                        if (shelf.RemainingWidth >= w && shelf.Height >= h)
                        {
                            int remaining = shelf.RemainingWidth - w;
                            if (remaining < bestRemaining)
                            {
                                bestShelf = shelf;
                                bestW = w; bestH = h; bestRotated = rotated;
                                bestRemaining = remaining;
                            }
                            break;
                        }
                    }
                }

                if (bestShelf != null)
                {
                    result.Add(new PlacedItem
                    {
                        Index = item.Index, X = bestShelf.CurrentX, Y = bestShelf.Y,
                        PlacedWidth = bestW, PlacedLength = bestH, IsRotated = bestRotated
                    });
                    bestShelf.CurrentX += bestW + gap;
                    bestShelf.RemainingWidth -= (bestW + gap);
                    placed = true;
                }

                if (!placed)
                {
                    var (bw, bh, br) = orientations.First();
                    int shelfY = shelves.Count > 0 ? shelves.Last().Y + shelves.Last().Height + gap : 0;
                    shelves.Add(new Shelf
                    {
                        Y = shelfY, Height = bh,
                        CurrentX = bw + gap, RemainingWidth = rollWidthMm - bw - gap
                    });
                    result.Add(new PlacedItem
                    {
                        Index = item.Index, X = 0, Y = shelfY,
                        PlacedWidth = bw, PlacedLength = bh, IsRotated = br
                    });
                }
            }
        }

        return result;
    }

    // ───────── Algorithm 4: Cut-corner (best-fit shelf + gap-fill + narrow orientation) ─────────
    // Sort by area descending, use narrow orientation, best-fit shelf, fill vertical gaps

    private List<PlacedItem> ShelfPackCutCorner(int rollWidthMm, List<PackItem> items, int gap)
    {
        var sorted = items.OrderByDescending(i => (long)i.WidthMm * i.LengthMm).ToList();
        var shelves = new List<Shelf>();
        var freeGaps = new List<GapRegion>();
        var result = new List<PlacedItem>();

        foreach (var item in sorted)
        {
            bool placed = false;
            var orientations = GetOrientationsNarrow(item, rollWidthMm);

            // Try gaps first — find smallest gap that fits
            GapRegion? bestGap = null;
            int gapW = 0, gapH = 0;
            bool gapRotated = false;
            long bestGapArea = long.MaxValue;

            foreach (var fg in freeGaps)
            {
                if (fg.Used) continue;
                foreach (var (w, h, rotated) in orientations)
                {
                    if (w <= fg.Width && h <= fg.Height)
                    {
                        long gapArea = (long)fg.Width * fg.Height;
                        if (gapArea < bestGapArea)
                        {
                            bestGap = fg;
                            gapW = w; gapH = h; gapRotated = rotated;
                            bestGapArea = gapArea;
                        }
                        break;
                    }
                }
            }

            if (bestGap != null)
            {
                result.Add(new PlacedItem
                {
                    Index = item.Index, X = bestGap.X, Y = bestGap.Y + gap,
                    PlacedWidth = gapW, PlacedLength = gapH, IsRotated = gapRotated
                });
                if (bestGap.Width - gapW - gap > 0)
                {
                    freeGaps.Add(new GapRegion
                    {
                        X = bestGap.X + gapW + gap, Y = bestGap.Y,
                        Width = bestGap.Width - gapW - gap, Height = bestGap.Height
                    });
                }
                bestGap.Used = true;
                placed = true;
            }

            if (placed) continue;

            // Best-fit shelf selection
            Shelf? bestShelf = null;
            int shelfW = 0, shelfH = 0;
            bool shelfRotated = false;
            int bestRemaining = int.MaxValue;

            foreach (var shelf in shelves)
            {
                foreach (var (w, h, rotated) in orientations)
                {
                    if (shelf.RemainingWidth >= w && shelf.Height >= h)
                    {
                        int remaining = shelf.RemainingWidth - w;
                        if (remaining < bestRemaining)
                        {
                            bestShelf = shelf;
                            shelfW = w; shelfH = h; shelfRotated = rotated;
                            bestRemaining = remaining;
                        }
                        break;
                    }
                }
            }

            if (bestShelf != null)
            {
                result.Add(new PlacedItem
                {
                    Index = item.Index, X = bestShelf.CurrentX, Y = bestShelf.Y,
                    PlacedWidth = shelfW, PlacedLength = shelfH, IsRotated = shelfRotated
                });
                if (shelfH + gap < bestShelf.Height)
                {
                    freeGaps.Add(new GapRegion
                    {
                        X = bestShelf.CurrentX, Y = bestShelf.Y + shelfH,
                        Width = shelfW, Height = bestShelf.Height - shelfH
                    });
                }
                bestShelf.CurrentX += shelfW + gap;
                bestShelf.RemainingWidth -= (shelfW + gap);
                placed = true;
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

    // ───────── Algorithm 5: MaxRects Best Short Side Fit ─────────
    // Rotation allowed, same gap as shelf, strip packing (fixed width, unlimited length)
    // BSSF heuristic: minimize the shorter leftover side — ideal for strip packing

    private List<PlacedItem> MaxRectsPack(int rollWidthMm, List<PackItem> items, int innerGap)
    {
        // Sort by area descending, then max dimension descending for determinism
        var sorted = items
            .OrderByDescending(i => (long)i.WidthMm * i.LengthMm)
            .ThenByDescending(i => Math.Max(i.WidthMm, i.LengthMm))
            .ToList();

        // Initialize: one free rect covering the full roll width, unlimited length
        const int MAX_LENGTH = 100_000_000;
        var freeRects = new List<FreeRect>
        {
            new FreeRect { X = 0, Y = 0, Width = rollWidthMm, Height = MAX_LENGTH }
        };

        var result = new List<PlacedItem>();

        foreach (var item in sorted)
        {
            // Skip if even the smaller dimension doesn't fit
            if (Math.Min(item.WidthMm, item.LengthMm) > rollWidthMm)
                continue;

            // Try both orientations, find Best Short Side Fit
            FreeRect? bestRect = null;
            int bestW = 0, bestH = 0;
            bool bestRotated = false;
            int bestShortSide = int.MaxValue;
            int bestLongSide = int.MaxValue;

            for (int i = 0; i < freeRects.Count; i++)
            {
                var rect = freeRects[i];

                // Original orientation
                if (item.WidthMm <= rect.Width && item.LengthMm <= rect.Height)
                {
                    int shortSide = Math.Min(rect.Width - item.WidthMm, rect.Height - item.LengthMm);
                    int longSide = Math.Max(rect.Width - item.WidthMm, rect.Height - item.LengthMm);
                    if (shortSide < bestShortSide ||
                        (shortSide == bestShortSide && longSide < bestLongSide))
                    {
                        bestRect = rect;
                        bestW = item.WidthMm; bestH = item.LengthMm;
                        bestRotated = false;
                        bestShortSide = shortSide;
                        bestLongSide = longSide;
                    }
                }

                // Rotated orientation (only if dimensions differ)
                if (item.WidthMm != item.LengthMm &&
                    item.LengthMm <= rect.Width && item.WidthMm <= rect.Height)
                {
                    int shortSide = Math.Min(rect.Width - item.LengthMm, rect.Height - item.WidthMm);
                    int longSide = Math.Max(rect.Width - item.LengthMm, rect.Height - item.WidthMm);
                    if (shortSide < bestShortSide ||
                        (shortSide == bestShortSide && longSide < bestLongSide))
                    {
                        bestRect = rect;
                        bestW = item.LengthMm; bestH = item.WidthMm;
                        bestRotated = true;
                        bestShortSide = shortSide;
                        bestLongSide = longSide;
                    }
                }
            }

            if (bestRect == null)
                continue;

            result.Add(new PlacedItem
            {
                Index = item.Index,
                X = bestRect.X,
                Y = bestRect.Y,
                PlacedWidth = bestW,
                PlacedLength = bestH,
                IsRotated = bestRotated
            });

            // Consume: item + gap, capped at free rect boundary
            int consumeW = Math.Min(bestW + innerGap, bestRect.Width);
            int consumeH = Math.Min(bestH + innerGap, bestRect.Height);

            SplitAndPruneFreeRects(freeRects, bestRect.X, bestRect.Y, consumeW, consumeH);
        }

        return result;
    }

    private static void SplitAndPruneFreeRects(List<FreeRect> freeRects, int px, int py, int pw, int ph)
    {
        int pRight = px + pw;
        int pBottom = py + ph;
        var newRects = new List<FreeRect>();

        for (int i = freeRects.Count - 1; i >= 0; i--)
        {
            var r = freeRects[i];

            // Check overlap
            if (r.X >= pRight || r.X + r.Width <= px ||
                r.Y >= pBottom || r.Y + r.Height <= py)
                continue; // no overlap, keep as-is

            // Remove this overlapping free rect
            freeRects.RemoveAt(i);

            // Left remainder
            if (px > r.X)
                newRects.Add(new FreeRect { X = r.X, Y = r.Y, Width = px - r.X, Height = r.Height });

            // Right remainder
            if (pRight < r.X + r.Width)
                newRects.Add(new FreeRect { X = pRight, Y = r.Y, Width = (r.X + r.Width) - pRight, Height = r.Height });

            // Top remainder
            if (py > r.Y)
                newRects.Add(new FreeRect { X = r.X, Y = r.Y, Width = r.Width, Height = py - r.Y });

            // Bottom remainder
            if (pBottom < r.Y + r.Height)
                newRects.Add(new FreeRect { X = r.X, Y = pBottom, Width = r.Width, Height = (r.Y + r.Height) - pBottom });
        }

        freeRects.AddRange(newRects);

        // Prune: remove free rects fully contained within another
        for (int i = freeRects.Count - 1; i >= 0; i--)
        {
            if (i >= freeRects.Count) continue;
            for (int j = 0; j < freeRects.Count; j++)
            {
                if (i == j || i >= freeRects.Count) continue;
                if (FreeRectContains(freeRects[j], freeRects[i]))
                {
                    freeRects.RemoveAt(i);
                    break;
                }
            }
        }
    }

    private static bool FreeRectContains(FreeRect outer, FreeRect inner)
    {
        return inner.X >= outer.X
            && inner.Y >= outer.Y
            && inner.X + inner.Width <= outer.X + outer.Width
            && inner.Y + inner.Height <= outer.Y + outer.Height;
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

    private List<(int W, int H, bool Rotated)> GetOrientationsNarrow(PackItem item, int rollWidthMm)
    {
        var orientations = new List<(int W, int H, bool Rotated)>();
        if (item.WidthMm <= rollWidthMm)
            orientations.Add((item.WidthMm, item.LengthMm, false));
        if (item.LengthMm <= rollWidthMm && item.LengthMm != item.WidthMm)
            orientations.Add((item.LengthMm, item.WidthMm, true));
        // Prefer narrowest width → item takes less horizontal space → more items per shelf
        orientations.Sort((a, b) => a.W.CompareTo(b.W));
        return orientations;
    }

    // ───────── Private Types ─────────

    private class PackItem { public int Index; public int WidthMm; public int LengthMm; }
    private class PlacedItem { public int Index; public int X; public int Y; public int PlacedWidth; public int PlacedLength; public bool IsRotated; }
    private class Shelf { public int Y; public int Height; public int CurrentX; public int RemainingWidth; }
    private class GapRegion { public int X; public int Y; public int Width; public int Height; public bool Used; }
    private class FreeRect { public int X; public int Y; public int Width; public int Height; }
}
