import { useMemo } from "react";

// Drafting-sheet floor plans: BOTH stories stacked in one viewer, shared
// scale, full measurement set — per-wall lengths, arrowed overall dimensions,
// title block with area/perimeter, meter grid.
const SHEET_W = 132;
const FLOOR_NAMES = ["GROUND FLOOR", "UPPER FLOOR", "THIRD FLOOR"];

function sheetGeometry(floor, sheet, scale) {
  const poly = floor.polygon_m;
  const xs = poly.map((p) => p[0]);
  const ys = poly.map((p) => p[1]);
  const minx = Math.min(...xs), maxx = Math.max(...xs);
  const miny = Math.min(...ys), maxy = Math.max(...ys);
  const w = maxx - minx, h = maxy - miny;

  // plan area sits left/top inside the sheet; right + bottom margins hold dims
  const planW = SHEET_W - 34;
  const cx = (minx + maxx) / 2, cy = (miny + maxy) / 2;
  const ox = sheet.x + 10 + planW / 2 - (w * scale) / 2 + (planW - w * scale) * 0;
  const px = (x) => sheet.x + 10 + ((x - minx) * scale) + (planW - w * scale) / 2;
  const py = (y) => sheet.y + sheet.h - 16 - ((y - miny) * scale) - (sheet.h - 28 - h * scale) / 2;

  const pts = poly.map((p) => [px(p[0]), py(p[1])]);
  // signed area for outward-normal direction (screen coords, y down)
  let sa = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    sa += a[0] * b[1] - b[0] * a[1];
  }
  const ccw = sa < 0;

  // per-edge measurements
  const edges = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const lenM = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const A = pts[i], B = pts[(i + 1) % pts.length];
    const dx = B[0] - A[0], dy = B[1] - A[1];
    const L = Math.hypot(dx, dy);
    if (L < 8 || lenM < 0.8) continue;          // skip tiny segments
    let nx = dy / L, ny = -dx / L;              // edge normal
    if (!ccw) { nx = -nx; ny = -ny; }           // point outward
    let ang = (Math.atan2(dy, dx) * 180) / Math.PI;
    if (ang > 90 || ang < -90) ang += 180;      // keep text upright
    edges.push({
      x: (A[0] + B[0]) / 2 + nx * 3.2,
      y: (A[1] + B[1]) / 2 + ny * 3.2,
      ang, label: lenM.toFixed(2),
    });
  }

  // centroid for the area figure
  let cxp = 0, cyp = 0;
  pts.forEach((p) => { cxp += p[0]; cyp += p[1]; });
  cxp /= pts.length; cyp /= pts.length;

  const bx0 = Math.min(...pts.map((p) => p[0]));
  const bx1 = Math.max(...pts.map((p) => p[0]));
  const by0 = Math.min(...pts.map((p) => p[1]));
  const by1 = Math.max(...pts.map((p) => p[1]));

  return {
    pts, edges, widthM: w, depthM: h,
    bx0, bx1, by0, by1, cxp, cyp,
    minx, miny, scale,
  };
}

export default function FootprintViewer({ floors, animate = true }) {
  const view = useMemo(() => {
    if (!floors || !floors.length) return null;
    const fls = floors.slice(0, 3);
    const n = fls.length;
    const SHEET_H = n === 1 ? 124 : 86;
    const H = 8 + n * SHEET_H + (n - 1) * 6 + 6;

    // shared scale so the stories are visually comparable
    let scale = Infinity;
    for (const f of fls) {
      const xs = f.polygon_m.map((p) => p[0]);
      const ys = f.polygon_m.map((p) => p[1]);
      const w = Math.max(...xs) - Math.min(...xs);
      const h = Math.max(...ys) - Math.min(...ys);
      scale = Math.min(scale, (SHEET_W - 38) / w, (SHEET_H - 34) / h);
    }

    const sheets = fls.map((f, i) => {
      const sheet = { x: 4, y: 8 + i * (SHEET_H + 6), w: SHEET_W - 8, h: SHEET_H };
      const g = sheetGeometry(f, sheet, scale);
      const stepM = g.widthM <= 9 ? 1 : g.widthM <= 22 ? 2 : 5;
      const grid = [];
      for (let gx = 0; gx * stepM * scale < sheet.w - 2; gx++) {
        const x = g.bx0 + gx * stepM * scale - ((g.bx0 - sheet.x) % (stepM * scale));
        if (x > sheet.x + 1 && x < sheet.x + sheet.w - 1)
          grid.push({ x1: x, y1: sheet.y + 1, x2: x, y2: sheet.y + sheet.h - 1 });
      }
      for (let gy = 0; gy * stepM * scale < sheet.h - 2; gy++) {
        const y = sheet.y + 1 + gy * stepM * scale;
        if (y < sheet.y + sheet.h - 1)
          grid.push({ x1: sheet.x + 1, y1: y, x2: sheet.x + sheet.w - 1, y2: y });
      }
      return { f, sheet, g, grid, stepM, name: FLOOR_NAMES[f.floor] || `FLOOR ${f.floor + 1}` };
    });

    return { H, sheets };
  }, [floors]);

  if (!view) return null;
  const fade = (delay) =>
    animate ? { opacity: 0, animation: `fadein .5s ${delay}s forwards` } : undefined;

  return (
    <div className="fpwrap">
      <svg viewBox={`0 0 ${SHEET_W} ${view.H}`} preserveAspectRatio="xMidYMid meet">
        <defs>
          <marker id="arr-s" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0.6 L5,3 L0,5.4" fill="none" stroke="var(--ink-dim)" strokeWidth="0.7" />
          </marker>
          <marker id="arr-e" markerWidth="6" markerHeight="6" refX="1" refY="3" orient="auto">
            <path d="M5,0.6 L0,3 L5,5.4" fill="none" stroke="var(--ink-dim)" strokeWidth="0.7" />
          </marker>
        </defs>

        {view.sheets.map(({ f, sheet, g, grid, stepM, name }, si) => {
          const d = g.pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(" ") + " Z";
          const dimY = g.by1 + 7;
          const dimX = g.bx1 + 7;
          return (
            <g key={si}>
              {/* sheet frame + grid */}
              <rect className="fp-sheet" x={sheet.x} y={sheet.y} width={sheet.w} height={sheet.h} rx="1" />
              <g className="fp-grid">
                {grid.map((l, i) => <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} />)}
              </g>

              {/* title block */}
              <g style={fade(0.2 + si * 0.35)}>
                <text className="fp-title" x={sheet.x + 4} y={sheet.y + 6.4} fontSize="3.4">{name}</text>
                <text className="fp-sub" x={sheet.x + 4} y={sheet.y + 10.6} fontSize="2.4">
                  area {f.area_m2} m² · perimeter {f.perimeter_m} m · {f.n_corners} corners · grid {stepM} m
                </text>
              </g>

              {/* the plan — pathLength-normalized draw-on (deterministic) */}
              <path className="fp-poly" d={d} pathLength="1"
                    style={animate ? {
                      strokeDasharray: 1,
                      strokeDashoffset: 1,
                      fillOpacity: 0,
                      animation:
                        `draw 1.2s ${0.15 + si * 0.35}s cubic-bezier(.4,0,.2,1) forwards, ` +
                        `fillin .6s ${1.0 + si * 0.35}s forwards`,
                    } : undefined} />
              {g.pts.map((p, i) => (
                <circle key={i} className="fp-corner" cx={p[0]} cy={p[1]} r="0.8"
                        style={animate ? { opacity: 0, animation: `fadein .3s ${0.3 + si * 0.35 + (i / g.pts.length)}s forwards` } : undefined} />
              ))}

              {/* per-wall lengths */}
              <g style={fade(1.4 + si * 0.35)}>
                {g.edges.map((e, i) => (
                  <text key={i} className="fp-edge" fontSize="2.2" textAnchor="middle"
                        transform={`translate(${e.x} ${e.y}) rotate(${e.ang})`}>
                    {e.label}
                  </text>
                ))}
              </g>

              {/* area figure at centroid */}
              <text className="fp-area" x={g.cxp} y={g.cyp + 2} fontSize="6" textAnchor="middle"
                    style={fade(1.6 + si * 0.35)}>
                {f.area_m2}
                <tspan className="fp-areaunit" fontSize="2.6" dx="0.7" dy="-2">m²</tspan>
              </text>

              {/* overall width dim (bottom, arrowed) */}
              <g style={fade(1.8 + si * 0.35)}>
                <line className="fp-dimline" x1={g.bx0} y1={g.by1 + 2} x2={g.bx0} y2={dimY + 1.4} />
                <line className="fp-dimline" x1={g.bx1} y1={g.by1 + 2} x2={g.bx1} y2={dimY + 1.4} />
                <line className="fp-dimline" x1={g.bx0 + 0.3} y1={dimY} x2={g.bx1 - 0.3} y2={dimY}
                      markerStart="url(#arr-e)" markerEnd="url(#arr-s)" />
                <text className="fp-dim" x={(g.bx0 + g.bx1) / 2} y={dimY + 3.2} fontSize="2.7" textAnchor="middle">
                  {g.widthM.toFixed(2)} m
                </text>
              </g>

              {/* overall depth dim (right, arrowed) */}
              <g style={fade(1.9 + si * 0.35)}>
                <line className="fp-dimline" x1={g.bx1 + 2} y1={g.by0} x2={dimX + 1.4} y2={g.by0} />
                <line className="fp-dimline" x1={g.bx1 + 2} y1={g.by1} x2={dimX + 1.4} y2={g.by1} />
                <line className="fp-dimline" x1={dimX} y1={g.by0 + 0.3} x2={dimX} y2={g.by1 - 0.3}
                      markerStart="url(#arr-e)" markerEnd="url(#arr-s)" />
                <text className="fp-dim" fontSize="2.7" textAnchor="middle"
                      transform={`translate(${dimX + 3} ${(g.by0 + g.by1) / 2}) rotate(90)`}>
                  {g.depthM.toFixed(2)} m
                </text>
              </g>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
