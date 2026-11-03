export function curvePath(values: number[], max: number): string {
  if (!values.length) return ''
  const y = (value: number) => 90 - value / max * 75
  if (values.length === 1) return `M 0 ${y(values[0])} H 100`
  const step = 100 / (values.length - 1)
  return values.slice(1).reduce((path, value, index) => {
    const middleX = (index + 0.5) * step
    return `${path} C ${middleX} ${y(values[index])}, ${middleX} ${y(value)}, ${(index + 1) * step} ${y(value)}`
  }, `M 0 ${y(values[0])}`)
}
