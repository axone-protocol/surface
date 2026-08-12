import { describe, expect, it } from 'vitest'

import { formatSurfaceTimestamp } from '../surface-time'

describe('Surface timestamps', () => {
  it.each([
    ['2026-08-12T13:13:42.000Z', '2026-08-12 13:13 UTC'],
    ['2026-08-12 13:13 UTC', '2026-08-12 13:13 UTC'],
    ['2026-08-12T13:13:42Z', '2026-08-12 13:13 UTC'],
  ])('uses the register UTC convention for %s', (value, expected) => {
    expect(formatSurfaceTimestamp(value)).toBe(expected)
  })
})
