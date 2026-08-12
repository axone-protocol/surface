import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { SurfaceAct } from '../../domain/surface-act'
import { useSurfaceDocket } from '../useSurfaceDocket'

describe('useSurfaceDocket', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('keeps local activity in memory and appends the observed public record', async () => {
    const acts = ref<SurfaceAct[]>([])
    let docket!: ReturnType<typeof useSurfaceDocket>
    const host = defineComponent({
      setup() {
        docket = useSurfaceDocket(acts)
        return () => h('div')
      },
    })
    const wrapper = mount(host)
    const submitted = docket.appendIdentityEvent({
      name: 'forge-01',
      description: 'Operational identity for the forge.',
      controller: 'axone1controller',
      provider: 'keplr',
      networkKey: 'testnet',
      chainId: 'axone-dendrite-2',
      explorer: 'https://explorer.example',
      situation: 'transaction-submitted',
      transactionHash: 'RECORDED-TX',
    })
    await nextTick()

    acts.value = [
      {
        id: 'RECORDED-TX:0:0',
        kind: 'identity.created',
        txhash: 'RECORDED-TX',
        msgIndex: 0,
        actIndex: 0,
        height: 42,
        timestamp: '2026-08-12T12:01:00Z',
        title: 'IDENTITY REGISTERED',
        description: 'Identity recorded.',
        assertion: [],
        payload: {},
      },
    ]
    await nextTick()

    expect(docket.entries.value).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: submitted.id, situation: 'transaction-submitted' }),
        expect.objectContaining({
          situation: 'public-record-observed',
          transactionHash: 'RECORDED-TX',
        }),
      ]),
    )
    wrapper.unmount()

    let freshDocket!: ReturnType<typeof useSurfaceDocket>
    const freshHost = defineComponent({
      setup() {
        freshDocket = useSurfaceDocket(acts)
        return () => h('div')
      },
    })
    const freshWrapper = mount(freshHost)
    expect(freshDocket.entries.value).toEqual([])
    freshWrapper.unmount()
  })

  it('records controller transitions separately from identity requests', async () => {
    vi.useFakeTimers()
    vi.setSystemTime('2026-08-12T12:00:00.000Z')
    const acts = ref<SurfaceAct[]>([])
    let docket!: ReturnType<typeof useSurfaceDocket>
    const host = defineComponent({
      setup() {
        docket = useSurfaceDocket(acts)
        return () => h('div')
      },
    })
    const wrapper = mount(host)
    const first = {
      provider: 'keplr' as const,
      controller: 'axone1first',
      chainId: 'axone-dendrite-2',
    }
    const second = {
      provider: 'keplr' as const,
      controller: 'axone1second',
      chainId: 'axone-dendrite-2',
    }

    docket.recordSessionTransition(undefined, first)
    vi.setSystemTime('2026-08-12T12:00:01.000Z')
    docket.recordSessionTransition(first, second)
    vi.setSystemTime('2026-08-12T12:00:02.000Z')
    docket.recordSessionTransition(second, undefined)
    await nextTick()

    expect(
      docket.entries.value.map((entry) => (entry.type === 'session' ? entry.event : entry.type)),
    ).toEqual(['disconnected', 'controller-changed', 'connected'])
    expect(docket.entries.value[0]).toEqual(
      expect.objectContaining({ explorer: 'https://explorer.aknodes.com/AXONE-TESTNET' }),
    )
    wrapper.unmount()
  })
})
