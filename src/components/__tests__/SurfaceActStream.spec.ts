import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'

import SurfaceActLine from '../SurfaceActLine.vue'
import SurfaceActStream from '../SurfaceActStream.vue'

const testExplorer = 'https://explorer.aknodes.com/AXONE-TESTNET'

function makeAct(id: string, height: number, signer: string) {
  return {
    id: `${id}:0:0`,
    kind: 'identity.created' as const,
    txhash: id,
    msgIndex: 0,
    actIndex: 0,
    height,
    entry: `${height}.0.0`,
    timestamp: `2026-07-09T12:0${height}:00Z`,
    signer,
    contractAddress: 'axone1contract',
    action: 'instantiate',
    title: 'IDENTITY REGISTERED',
    description: 'Identity recorded.',
    assertion: `Identity established as ${signer}.`,
    payload: {},
  }
}

describe('SurfaceActStream', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('renders the oldest-to-newest desktop window with assertions and limited proof', async () => {
    const oldest = makeAct('TX-1', 1, 'axone1oldest')
    const newest = makeAct('TX-2', 2, 'axone1newest')
    const wrapper = mount(SurfaceActStream, {
      props: {
        acts: [newest, oldest],
        loading: false,
        reducedMotion: true,
        polling: false,
        explorer: testExplorer,
      },
    })

    await nextTick()

    const records = wrapper.findAll('.surface-act-record')
    expect(records).toHaveLength(2)
    expect(records[0]!.text()).toContain('Identity established as axone1oldest.')
    expect(records[1]!.text()).toContain('Identity established as axone1newest.')
    expect(records[0]!.find('.surface-act-category').text()).toBe('IDENTITY')
    expect(records[0]!.find('.surface-act-inscription').attributes('aria-label')).toBe(
      'Identity established as axone1oldest.',
    )
    expect(records[0]!.find('.surface-act-entry').text()).toContain('1.0.0')
    expect(records[0]!.find('.surface-act-proof').text()).toContain('txTX-1')
    expect(records[0]!.find('.surface-act-proof').text()).toContain('time2026-07-09 12:01 UTC')
    expect(wrapper.text()).not.toContain('HEIGHT')
    expect(wrapper.text()).not.toContain('MSG')
    expect(wrapper.find('.surface-act-column-head').text()).toBe('ENTRYSTATEMENTEVIDENCE')
    expect(wrapper.find('.surface-act-cursor').exists()).toBe(false)
  })

  it('renders embedded DID and URN identifiers in monospace spans', async () => {
    const assertion =
      'Credential issued by did:pkh:…cosmos1s7u…texh8c for subject urn:axone:testnet:subject:gh29632273325a1-1.'
    const wrapper = mount(SurfaceActLine, {
      props: {
        act: { ...makeAct('TX-DID', 1, 'axone1issuer'), assertion },
        explorer: testExplorer,
        reducedMotion: true,
        typingActive: false,
        cursorVisible: false,
      },
    })

    await nextTick()

    const identifiers = wrapper.findAll('.surface-act-identifier')
    expect(identifiers.map((identifier) => identifier.text())).toEqual([
      'did:pkh:…cosmos1s7u…texh8c',
      'urn:axone:testnet:subject:gh29632273325a1-1',
    ])
    expect(wrapper.get('.surface-act-inscription').text()).toBe(assertion)
  })

  it('keeps the transaction text noninteractive, links through the explorer button, and restores copy', async () => {
    vi.useFakeTimers()
    const writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    const txhash = '34BB1E16A4051234567890ABCDEF8A931F'
    const wrapper = mount(SurfaceActLine, {
      props: {
        act: makeAct(txhash, 1, 'axone1issuer'),
        explorer: testExplorer,
        reducedMotion: true,
        typingActive: false,
        cursorVisible: false,
      },
    })

    const transactionValue = wrapper.get('.surface-act-tx-value')
    expect(transactionValue.text()).toBe('34BB1E16A405...8A931F')
    expect(transactionValue.element.tagName).toBe('SPAN')
    expect(transactionValue.attributes('href')).toBeUndefined()
    const explorerButton = wrapper.get('.surface-act-explorer')
    expect(explorerButton.attributes('href')).toBe(`${testExplorer}/tx/${txhash}`)
    expect(explorerButton.attributes('aria-label')).toBe(`View transaction ${txhash} in explorer`)
    expect(explorerButton.attributes('target')).toBe('_blank')
    expect(explorerButton.attributes('rel')).toBe('noopener noreferrer')
    expect(wrapper.get('.surface-act-tx-copy').attributes('aria-label')).toBe(
      `Copy transaction hash ${txhash}`,
    )
    expect(wrapper.get('.surface-act-tx-copy').find('svg').exists()).toBe(true)
    expect(wrapper.get('.surface-act-tx-action').find('.surface-act-tx-copy').exists()).toBe(true)

    await wrapper.get('.surface-act-tx-copy').trigger('click')
    await Promise.resolve()
    await nextTick()

    expect(writeText).toHaveBeenCalledWith(txhash)
    expect(wrapper.find('.surface-act-tx-copy').exists()).toBe(false)
    expect(wrapper.get('.surface-act-tx-copied').attributes('role')).toBe('status')
    expect(wrapper.get('.surface-act-tx-copied').text()).toContain('✓')
    expect(wrapper.get('.surface-act-tx-copied').text()).toContain('Copied')
    expect(wrapper.get('.surface-act-tx-action').find('.surface-act-tx-copy').exists()).toBe(false)
    expect(wrapper.get('.surface-act-tx-copied-icon').text()).toBe('✓')
    expect(wrapper.get('.surface-act-tx-copied-label').text()).toBe('Copied')

    vi.advanceTimersByTime(999)
    await nextTick()
    expect(wrapper.find('.surface-act-tx-copied').exists()).toBe(true)

    vi.advanceTimersByTime(1)
    await nextTick()
    expect(wrapper.find('.surface-act-tx-copied').exists()).toBe(false)
    expect(wrapper.find('.surface-act-tx-copy').exists()).toBe(true)
  })

  it('keeps the transaction copy control available when clipboard writing fails', async () => {
    const writeText = vi
      .fn<(text: string) => Promise<void>>()
      .mockRejectedValue(new Error('Clipboard unavailable'))
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    const wrapper = mount(SurfaceActLine, {
      props: {
        act: makeAct('34BB1E16A4051234567890ABCDEF8A931F', 1, 'axone1issuer'),
        explorer: testExplorer,
        reducedMotion: true,
        typingActive: false,
        cursorVisible: false,
      },
    })

    await wrapper.get('.surface-act-tx-copy').trigger('click')
    await Promise.resolve()
    await nextTick()

    expect(writeText).toHaveBeenCalledOnce()
    expect(wrapper.find('.surface-act-tx-copied').exists()).toBe(false)
    expect(wrapper.get('.surface-act-tx-copy').attributes('disabled')).toBeUndefined()
  })

  it('reveals exactly one record assertion at a time', async () => {
    const oldest = makeAct('TX-1', 1, 'axone1oldest')
    const newest = makeAct('TX-2', 2, 'axone1newest')
    const wrapper = mount(SurfaceActStream, {
      props: {
        acts: [newest, oldest],
        loading: false,
        reducedMotion: false,
        polling: false,
        explorer: testExplorer,
      },
    })

    expect(wrapper.findAllComponents(SurfaceActLine)).toHaveLength(1)
    expect(wrapper.findComponent(SurfaceActLine).props('typingActive')).toBe(true)

    wrapper.findComponent(SurfaceActLine).vm.$emit('typing-complete')
    await nextTick()
    await nextTick()

    const records = wrapper.findAllComponents(SurfaceActLine)
    expect(records).toHaveLength(2)
    expect(records[0]!.props('typingActive')).toBe(false)
    expect(records[1]!.props('typingActive')).toBe(true)
    expect(wrapper.findAll('.surface-act-cursor')).toHaveLength(1)
  })

  it('retains only the eight latest desktop records', async () => {
    const acts = [
      makeAct('TX-9', 9, 'axone1newest'),
      makeAct('TX-8', 8, 'axone1eight'),
      makeAct('TX-7', 7, 'axone1seven'),
      makeAct('TX-6', 6, 'axone1six'),
      makeAct('TX-5', 5, 'axone1five'),
      makeAct('TX-4', 4, 'axone1four'),
      makeAct('TX-3', 3, 'axone1three'),
      makeAct('TX-2', 2, 'axone1two'),
      makeAct('TX-1', 1, 'axone1oldest'),
    ]
    const wrapper = mount(SurfaceActStream, {
      props: { acts, loading: false, reducedMotion: true, polling: false, explorer: testExplorer },
    })

    await nextTick()

    expect(wrapper.findAll('.surface-act-record')).toHaveLength(8)
    expect(wrapper.text()).not.toContain('axone1oldest')
    expect(wrapper.text()).toContain('axone1two')
    expect(wrapper.text()).toContain('axone1newest')
  })

  it('shows only the five latest records on compact viewports', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({
        matches: true,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }),
    )
    const acts = Array.from({ length: 8 }, (_, index) => {
      const height = 8 - index
      return makeAct(`TX-${height}`, height, `axone1${height}`)
    })
    const wrapper = mount(SurfaceActStream, {
      props: { acts, loading: false, reducedMotion: true, polling: false, explorer: testExplorer },
    })

    await nextTick()
    await nextTick()

    expect(wrapper.findAll('.surface-act-record')).toHaveLength(5)
    expect(wrapper.text()).not.toContain('axone11')
    expect(wrapper.text()).toContain('axone14')
    expect(wrapper.text()).toContain('axone18')
  })
})
