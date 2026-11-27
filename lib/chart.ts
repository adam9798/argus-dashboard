// Shared by the small charts on the overview.

export type Point = [x: number, y: number];

/**
 * A smooth path through the points that never overshoots them: control points
 * stay at the same height as their end, so a curve cannot invent a peak.
 */
export function smoothPath(points: Point[]): string {
  if (points.length === 0) return "";
  let path = `M${points[0][0].toFixed(1)},${points[0][1].toFixed(1)}`;
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1];
    const [x1, y1] = points[i];
    const mid = ((x0 + x1) / 2).toFixed(1);
    path += `C${mid},${y0.toFixed(1)} ${mid},${y1.toFixed(1)} ${x1.toFixed(1)},${y1.toFixed(1)}`;
  }
  return path;
}

export interface Sample {
  t: number;
  v: number;
}

/** At most `size` points, each the average of an equal slice of the input. */
export function downsample(samples: Sample[], size: number): Sample[] {
  if (samples.length <= size) return samples;
  const out: Sample[] = [];
  const step = samples.length / size;
  for (let i = 0; i < size; i++) {
    const slice = samples.slice(Math.floor(i * step), Math.floor((i + 1) * step));
    if (slice.length === 0) continue;
    out.push({
      t: slice[Math.floor(slice.length / 2)].t,
      v: slice.reduce((sum, sample) => sum + sample.v, 0) / slice.length,
    });
  }
  // The newest reading is shown as it is, not averaged with older ones.
  out[out.length - 1] = samples[samples.length - 1];
  return out;
}
