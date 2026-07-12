import { afterEach, describe, expect, it, vi } from 'vitest'

import { resolveTransactionEntries } from '../axone-tx-api'

function response(body: unknown, ok = true): Response {
  return { ok, status: ok ? 200 : 503, json: async () => body } as unknown as Response
}

describe('resolveTransactionEntries', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('uses the transaction order in the block and caches each height', async () => {
    const fetchMock = vi
      .fn<(input: RequestInfo | URL) => Promise<Response>>()
      .mockResolvedValue(response({ block: { data: { txs: ['ZGVm', 'YWJj'] } } }))
    vi.stubGlobal('fetch', fetchMock)
    const txs = [
      { height: '101', txhash: 'BA7816BF8F01CFEA414140DE5DAE2223B00361A396177A9CB410FF61F20015AD' },
      { height: '101', txhash: 'CB8379AC2098AA165029E3938A51DA0BCECFC008FD6795F401178647F96C5B34' },
    ]

    const entries = await resolveTransactionEntries(txs)
    const repeatedEntries = await resolveTransactionEntries(txs)

    expect(entries.get(txs[0]!.txhash!)).toBe('101.1')
    expect(entries.get(txs[1]!.txhash!)).toBe('101.0')
    expect(repeatedEntries).toEqual(entries)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does not invent an entry when a block cannot be resolved', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn<(input: RequestInfo | URL) => Promise<Response>>()
        .mockResolvedValue(response({}, false)),
    )

    const entries = await resolveTransactionEntries([
      { height: '102', txhash: 'BA7816BF8F01CFEA414140DE5DAE2223B00361A396177A9CB410FF61F20015AD' },
    ])

    expect(entries.size).toBe(0)
  })

  it('bounds the block cache and evicts the least recently used height', async () => {
    const fetchMock = vi
      .fn<(input: RequestInfo | URL) => Promise<Response>>()
      .mockResolvedValue(response({ block: { data: { txs: [] } } }))
    vi.stubGlobal('fetch', fetchMock)

    await resolveTransactionEntries(
      Array.from({ length: 13 }, (_, index) => ({ height: String(200 + index) })),
    )
    await resolveTransactionEntries([{ height: '200' }])

    expect(fetchMock).toHaveBeenCalledTimes(14)
  })
})
