export function formatSurfaceTimestamp(value: string): string {
  const normalized = value.match(
    /^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})(?::\d{2}(?:\.\d{3})?)?(?:Z| UTC)?$/,
  )
  if (normalized) {
    const [, date, hour, minute] = normalized
    return `${date} ${hour}:${minute} UTC`
  }

  return value.replace('.000Z', ' UTC').replace('T', ' ').replace(/Z$/, ' UTC')
}
