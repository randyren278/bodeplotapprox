/**
 * Word-sized deviation graphic: |exact − approx| across the sweep.
 *
 * Tufte's sparkline — no axes, no labels, sized to sit inline next to the
 * number it summarises. Answers "where does the approximation break down?"
 * at a glance, which the two overlaid traces don't make obvious.
 */

const W = 200;
const H = 20;
const PAD = 2;

export function Sparkline({ values }: { values: number[] }) {
  const clean = values.map((v) => (Number.isFinite(v) ? v : 0));
  const max = clean.length ? Math.max(...clean) : 0;
  const n = clean.length - 1;

  const px = (i: number) => PAD + (n <= 0 ? 0 : (i / n) * (W - 2 * PAD));
  const py = (v: number) => H - PAD - (max === 0 ? 0 : (v / max) * (H - 2 * PAD));

  let line = '';
  let fill = `${px(0)},${H - PAD} `;
  clean.forEach((v, i) => {
    line += `${i === 0 ? 'M' : 'L'}${px(i).toFixed(1)} ${py(v).toFixed(1)} `;
    fill += `${px(i).toFixed(1)},${py(v).toFixed(1)} `;
  });
  fill += `${px(n)},${H - PAD}`;
  const maxIdx = clean.indexOf(max);

  return (
    <svg className="spark" viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
      <polygon className="spark-fill" points={fill} />
      <path className="spark-line" d={line.trim()} />
      {max > 0 && <circle className="spark-max" cx={px(maxIdx)} cy={py(max)} r={1.6} />}
    </svg>
  );
}
