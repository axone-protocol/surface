import { afterEach, describe, expect, it, vi } from 'vitest'

import { fetchIdentityTransactionResult } from '../identity-transaction-api'

function response(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response
}

describe('identity transaction observation', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('keeps an unobserved transaction pending', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({}, 404)))

    await expect(fetchIdentityTransactionResult('https://api.example', 'TX-HASH')).resolves.toEqual(
      {
        status: 'pending',
      },
    )
  })

  it('distinguishes successful and failed execution', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        response({ tx_response: { code: 0, height: '42', timestamp: '2026-08-12T12:00:00Z' } }),
      )
      .mockResolvedValueOnce(
        response({
          tx_response: {
            code: 5,
            height: '43',
            raw_log: 'description too short, must be at least 1 characters',
          },
        }),
      )
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchIdentityTransactionResult('https://api.example', 'SUCCESS')).resolves.toEqual(
      {
        status: 'succeeded',
        height: '42',
        timestamp: '2026-08-12T12:00:00Z',
      },
    )
    await expect(fetchIdentityTransactionResult('https://api.example', 'FAILED')).resolves.toEqual({
      status: 'failed',
      height: '43',
      timestamp: undefined,
      error: 'description too short, must be at least 1 characters',
    })
  })

  it('does not turn an observation outage into a transaction failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({}, 503)))

    await expect(fetchIdentityTransactionResult('https://api.example', 'UNKNOWN')).rejects.toThrow(
      'Transaction observation failed (503).',
    )
  })
})
