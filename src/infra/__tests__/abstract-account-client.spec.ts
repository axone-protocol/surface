import { afterEach, describe, expect, it, vi } from 'vitest'

import { browserAbstractAccountClient } from '../abstract-account-client'
import type { Network } from '../../networks'

const network: Network = {
  key: 'testnet',
  name: 'axone-testnet',
  chainId: 'axone-dendrite-2',
  displayName: 'axone-testnet',
  bech32Prefix: 'axone',
  rest: 'https://api.axone.aknodes.net',
  abstractRegistry: 'axone1registry',
  status: 'active',
  selectable: true,
}
const wallet = 'axone1wallet'
const firstAccount = 'axone1lfcc2yt3gmd3xspw5yxsl3r9qyuumuya6hur2gnejgmafyrapmkqhg7gd5'
const secondAccount = 'axone1yncejk8nacz487nqet3j5s687nx3xh9y2kples2tmypzgxrwce8q33ya53'

function response(body: unknown, ok = true): Response {
  return { ok, status: ok ? 200 : 503, json: async () => body } as unknown as Response
}

function query(input: RequestInfo | URL) {
  const segments = String(input).split('/')
  return JSON.parse(atob(segments[segments.length - 1]!)) as Record<string, unknown>
}

describe('browserAbstractAccountClient', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('paginates the registry, retains direct monarchy owners, and encodes each query', async () => {
    const firstPage = Array.from({ length: 50 }, (_, index) => [
      { trace: 'local', seq: index },
      index === 0 ? firstAccount : index === 1 ? secondAccount : `axone1unowned${index}`,
    ])
    const fetchMock = vi.fn<(input: RequestInfo | URL) => Promise<Response>>(async (input) => {
      const url = String(input)
      const message = query(input)
      if (url.includes('axone1registry')) {
        const accountList = message.account_list as { start_after: unknown }
        return response({
          data: {
            accounts: accountList.start_after === null ? firstPage : [],
          },
        })
      }

      if (url.includes(firstAccount)) {
        return response({ data: { owner: { monarchy: { monarch: wallet } } } })
      }
      if (url.includes(secondAccount)) {
        return response({ data: { owner: { monarchy: { monarch: 'axone1other' } } } })
      }
      return response({ data: { owner: { nested: { owner: wallet } } } })
    })
    vi.stubGlobal('fetch', fetchMock)

    const identities = await browserAbstractAccountClient.discover(wallet, network)

    expect(identities).toEqual([
      {
        address: firstAccount,
        did: 'did:pkh:cosmos:axone-dendrite-2:cosmos1lfcc2yt3gmd3xspw5yxsl3r9qyuumuya6hur2gnejgmafyrapmkqpk2un3',
        label: 'Anonymous',
      },
    ])
    expect(query(fetchMock.mock.calls[0]![0])).toEqual({
      account_list: { start_after: null, limit: 50 },
    })
    expect(query(fetchMock.mock.calls[fetchMock.mock.calls.length - 1]![0])).toEqual({
      account_list: { start_after: { trace: 'local', seq: 49 }, limit: 50 },
    })
    expect(query(fetchMock.mock.calls[1]![0])).toEqual({ ownership: {} })
  })

  it('rejects page and ownership failures instead of reporting an empty identity list', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({}, false)))
    await expect(browserAbstractAccountClient.discover(wallet, network)).rejects.toThrow(
      'Axone contract request failed',
    )

    vi.stubGlobal(
      'fetch',
      vi
        .fn<(input: RequestInfo | URL) => Promise<Response>>()
        .mockResolvedValueOnce(
          response({ data: { accounts: [[{ trace: 'local', seq: 0 }, firstAccount]] } }),
        )
        .mockResolvedValueOnce(response({}, false)),
    )
    await expect(browserAbstractAccountClient.discover(wallet, network)).rejects.toThrow(
      'Axone contract request failed',
    )
  })
})
