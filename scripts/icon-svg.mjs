// Four logarithmic-spiral arms on a teal tile. Palette sampled from the chosen mark.
const ARMS = ['#f0b758', '#73e8f3', '#f8f8f8', '#e87576']

const R0 = 0.15
const R1 = 0.36
const SWEEP = 160
const STEPS = 72

function arm(rotation) {
  const points = []
  for (let i = 0; i <= STEPS; i++) {
    const t = i / STEPS
    const r = R0 * (R1 / R0) ** t
    const theta = ((rotation + SWEEP * t) * Math.PI) / 180
    points.push([0.5 + r * Math.cos(theta), 0.5 + r * Math.sin(theta)])
  }
  return points.map(([x, y], i) => `${i ? 'L' : 'M'}${(x * 1024).toFixed(2)} ${(y * 1024).toFixed(2)}`).join('')
}

export function iconSvg({ rounded = true } = {}) {
  const arms = ARMS.map((color, i) =>
    `<path d="${arm(i * 90)}" stroke="${color}" stroke-width="66" stroke-linecap="round" fill="none"/>`
  ).join('\n    ')

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0.35" y2="1">
      <stop offset="0" stop-color="#1d494f"/>
      <stop offset="1" stop-color="#143740"/>
    </linearGradient>
  </defs>
  ${rounded ? '<rect width="1024" height="1024" rx="230" fill="url(#bg)"/>' : '<rect width="1024" height="1024" fill="url(#bg)"/>'}
  <g>
    ${arms}
  </g>
</svg>`
}
