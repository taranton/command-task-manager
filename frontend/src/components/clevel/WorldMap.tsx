import { useMemo, useState } from 'react';
import { geoEquirectangular, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import worldTopo from 'world-atlas/countries-110m.json';
import type { Topology } from 'topojson-specification';
import type { FeatureCollection, Geometry } from 'geojson';
import { theme } from '../../styles/theme';

interface OfficePoint {
  office: string;
  rate: number;
  total: number;
  overdue: number;
  byStatus: { backlog: number; to_do: number; in_progress: number; in_review: number; done: number };
  people: string[];
  lat?: number;
  lng?: number;
  region?: string;
}

const W = 820;
const H = 420;

// Decode the Natural Earth 110m topology into GeoJSON feature collection once.
// Cast through unknown because topojson's generic typing doesn't narrow well here.
const worldGeo = feature(
  worldTopo as unknown as Topology,
  (worldTopo as unknown as Topology).objects.countries as Parameters<typeof feature>[1],
) as unknown as FeatureCollection<Geometry>;

// Equirectangular projection, fit to our canvas. Computed once.
const projection = geoEquirectangular().fitSize([W, H], worldGeo);
const pathGen = geoPath(projection);

export function WorldMap({
  offices,
  onSelectOffice,
}: {
  offices: OfficePoint[];
  onSelectOffice?: (office: string) => void;
}) {
  const [hovered, setHovered] = useState<string | null>(null);

  const countryPaths = useMemo(() => {
    return worldGeo.features
      .map((f, i) => {
        const d = pathGen(f);
        return d ? { id: i, d } : null;
      })
      .filter((x): x is { id: number; d: string } => x !== null);
  }, []);

  const points = useMemo(() => {
    return offices
      .filter((o) => typeof o.lat === 'number' && typeof o.lng === 'number')
      .map((o) => {
        const p = projection([o.lng!, o.lat!]);
        return { ...o, px: p ? p[0] : 0, py: p ? p[1] : 0 };
      });
  }, [offices]);

  // Greedy label placement around each marker to avoid overlap
  const LABEL_W = 70;
  const LABEL_H = 26;
  const placed: Array<OfficePoint & { px: number; py: number; dx: number; dy: number; anchor: string; bx: number; by: number }> = [];
  points.forEach((p) => {
    const candidates = [
      { dx: 0, dy: 22, anchor: 'middle' },
      { dx: 0, dy: -20, anchor: 'middle' },
      { dx: 18, dy: 4, anchor: 'start' },
      { dx: -18, dy: 4, anchor: 'end' },
    ];
    let chosen = candidates[0];
    for (const c of candidates) {
      const bx = p.px + c.dx - LABEL_W / 2;
      const by = p.py + c.dy - LABEL_H / 2;
      const clash = placed.some(
        (o) => Math.abs(bx - o.bx) < LABEL_W * 0.9 && Math.abs(by - o.by) < LABEL_H * 1.2,
      );
      if (!clash) {
        chosen = c;
        break;
      }
    }
    const bx = p.px + chosen.dx - LABEL_W / 2;
    const by = p.py + chosen.dy - LABEL_H / 2;
    placed.push({ ...p, ...chosen, bx, by });
  });

  const maxTotal = Math.max(...points.map((p) => p.total || 1), 1);

  const rateColor = (r: number) => {
    if (r >= 70) return theme.colors.success;
    if (r >= 40) return theme.colors.warning;
    return theme.colors.error;
  };

  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        <rect x={0} y={0} width={W} height={H} fill={theme.colors.background} opacity={0.3} />

        {/* Graticule — 12 longitude × 6 latitude lines */}
        <g stroke={theme.colors.border} strokeWidth={0.4} opacity={0.5}>
          {Array.from({ length: 13 }, (_, i) => (
            <line key={`v${i}`} x1={(i / 12) * W} y1={0} x2={(i / 12) * W} y2={H} />
          ))}
          {Array.from({ length: 7 }, (_, i) => (
            <line key={`h${i}`} x1={0} y1={(i / 6) * H} x2={W} y2={(i / 6) * H} />
          ))}
          <line x1={0} y1={H / 2} x2={W} y2={H / 2} strokeWidth={0.8} opacity={0.8} />
        </g>

        {/* Real-world countries from Natural Earth */}
        <g>
          {countryPaths.map((p) => (
            <path
              key={p.id}
              d={p.d}
              fill={theme.colors.silver}
              stroke={theme.colors.cadetGray}
              strokeWidth={0.3}
              opacity={0.55}
            />
          ))}
        </g>

        {/* Connecting arcs between offices */}
        {points.length > 1 &&
          points.map((p1, i) =>
            points.slice(i + 1).map((p2, j) => {
              const mx = (p1.px + p2.px) / 2;
              const my = (p1.py + p2.py) / 2 - Math.abs(p2.px - p1.px) * 0.15;
              return (
                <path
                  key={`${i}-${j}`}
                  d={`M ${p1.px} ${p1.py} Q ${mx} ${my} ${p2.px} ${p2.py}`}
                  stroke={theme.colors.vividOrange}
                  strokeWidth={1}
                  fill="none"
                  strokeDasharray="2,3"
                  opacity={0.3}
                />
              );
            }),
          )}

        {/* Office labels (placed first so markers sit on top) */}
        {placed.map((p) => {
          const color = rateColor(p.rate || 0);
          return (
            <g key={`label-${p.office}`}>
              <text
                x={p.px + p.dx}
                y={p.py + p.dy}
                textAnchor={p.anchor as 'middle' | 'start' | 'end'}
                fontSize={11}
                fontWeight={700}
                fill={theme.colors.charcoal}
                fontFamily={theme.typography.fontFamily.primary}
              >
                {p.office}
              </text>
              <text
                x={p.px + p.dx}
                y={p.py + p.dy + 12}
                textAnchor={p.anchor as 'middle' | 'start' | 'end'}
                fontSize={10}
                fontWeight={700}
                fill={color}
              >
                {p.rate}%
              </text>
            </g>
          );
        })}

        {/* Office markers */}
        {points.map((p) => {
          const size = 8 + 10 * Math.sqrt((p.total || 1) / maxTotal);
          const color = rateColor(p.rate || 0);
          const isHovered = hovered === p.office;
          return (
            <g
              key={p.office}
              transform={`translate(${p.px}, ${p.py})`}
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => setHovered(p.office)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => onSelectOffice && onSelectOffice(p.office)}
            >
              {isHovered && (
                <circle r={size + 10} fill={color} opacity={0.15}>
                  <animate attributeName="r" from={size} to={size + 16} dur="1.2s" repeatCount="indefinite" />
                  <animate attributeName="opacity" from="0.35" to="0" dur="1.2s" repeatCount="indefinite" />
                </circle>
              )}
              <circle r={size} fill={color} opacity={0.2} />
              <circle r={size * 0.6} fill={color} opacity={0.4} />
              <circle r={5} fill="white" stroke={color} strokeWidth={2.5} />
            </g>
          );
        })}
      </svg>

      {hovered &&
        (() => {
          const p = points.find((o) => o.office === hovered);
          if (!p) return null;
          const tipX = (p.px / W) * 100;
          const tipY = (p.py / H) * 100;
          return (
            <div
              style={{
                position: 'absolute',
                left: `${tipX}%`,
                top: `${tipY}%`,
                transform: 'translate(-50%, calc(-100% - 14px))',
                background: theme.colors.charcoal,
                color: 'white',
                padding: '10px 12px',
                borderRadius: 6,
                fontSize: 11,
                pointerEvents: 'none',
                minWidth: 180,
                boxShadow: theme.shadows.md,
                zIndex: 5,
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{p.office}</div>
              <div style={{ color: 'rgba(255,255,255,0.7)', marginBottom: 6 }}>
                {p.people.length} people · {p.total} tasks
              </div>
              <div style={{ display: 'flex', gap: 10, fontSize: 10 }}>
                <span>
                  <b style={{ color: theme.colors.status.done }}>{p.byStatus.done}</b> done
                </span>
                <span>
                  <b style={{ color: theme.colors.status.in_progress }}>{p.byStatus.in_progress}</b> progress
                </span>
                <span>
                  <b style={{ color: theme.colors.status.in_review }}>{p.byStatus.in_review}</b> review
                </span>
              </div>
              <div style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: 18, fontWeight: 800, color: rateColor(p.rate) }}>{p.rate}%</span>
                {p.overdue > 0 && <span style={{ color: theme.colors.error, fontWeight: 700 }}>{p.overdue} overdue</span>}
              </div>
            </div>
          );
        })()}

      <div
        style={{
          display: 'flex',
          gap: 18,
          marginTop: 10,
          fontSize: 10,
          color: theme.colors.cadetGray,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <span style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>Completion</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: theme.colors.error }} /> &lt;40%
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: theme.colors.warning }} /> 40–70%
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: theme.colors.success }} /> 70%+
        </span>
        <span style={{ marginLeft: 14, fontStyle: 'italic' }}>Marker size = total tasks</span>
      </div>
    </div>
  );
}
