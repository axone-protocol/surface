import { defineComponent, nextTick } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useSurfaceActs } from '../useSurfaceActs'

function createResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as unknown as Response
}

describe('useSurfaceActs', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('polls and merges acts over time', async () => {
    const fetchMock = vi
      .fn<(input: RequestInfo | URL) => Promise<Response>>()
      .mockImplementation(async (input) => {
        const url = String(input)

        if (url.includes('MsgInstantiateContract2')) {
          return createResponse({
            tx_responses: [
              {
                height: '10',
                txhash: 'TX-INST',
                timestamp: '2026-07-09 12:00 UTC',
                tx: {
                  body: { messages: [{ '@type': '/cosmwasm.wasm.v1.MsgInstantiateContract2' }] },
                },
                events: [
                  {
                    type: 'instantiate',
                    attributes: [
                      { key: '_contract_address', value: 'axone1contract' },
                      { key: 'msg_index', value: '0' },
                    ],
                  },
                ],
              },
            ],
          })
        }

        return createResponse({
          tx_responses: [
            {
              height: '11',
              txhash: 'TX-EXEC',
              timestamp: '2026-07-09 12:01 UTC',
              tx: { body: { messages: [{ '@type': '/cosmwasm.wasm.v1.MsgExecuteContract' }] } },
              events: [
                {
                  type: 'wasm-abstract',
                  attributes: [
                    { key: 'contract', value: 'axone:axone-gov' },
                    { key: 'action', value: 'record_decision' },
                    { key: 'verdict', value: 'gov:permitted' },
                    { key: 'msg_index', value: '0' },
                    { key: '_contract_address', value: 'axone1gov' },
                  ],
                },
              ],
            },
          ],
        })
      })

    vi.stubGlobal('fetch', fetchMock)

    const Harness = defineComponent({
      setup() {
        return useSurfaceActs()
      },
      template: '<div />',
    })

    mount(Harness)

    await flushPromises()
    await nextTick()

    expect(fetchMock).toHaveBeenCalledTimes(2)

    await vi.advanceTimersByTimeAsync(15000)
    await flushPromises()
    await nextTick()

    expect(fetchMock).toHaveBeenCalledTimes(4)
  })

  it('exposes an error when the chain request fails', async () => {
    vi.stubGlobal('fetch', vi.fn<() => Promise<Response>>().mockRejectedValue(new Error('offline')))

    const Harness = defineComponent({
      setup() {
        return useSurfaceActs()
      },
      template: '<div />',
    })

    const wrapper = mount(Harness)
    await flushPromises()
    await nextTick()

    expect((wrapper.vm as { error: string | undefined }).error).toBe('offline')
    expect((wrapper.vm as { loading: boolean }).loading).toBe(false)
  })
})
