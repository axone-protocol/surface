import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SurfaceAct } from '../../domain/surface-act'

import SurfaceActLine from '../SurfaceActLine.vue'
import SurfaceActStream from '../SurfaceActStream.vue'

const testExplorer = 'https://explorer.aknodes.com/AXONE-TESTNET'

function makeAct(id: string, height: number, signer: string): SurfaceAct {
  return {
    id: `${id}:0:0`,
    kind: 'identity.created',
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
    assertion: [{ type: 'text', value: `Identity established as ${signer}.` }],
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
    expect(records[0]!.find('.surface-act-inscription').text()).toBe(
      'Identity established as axone1oldest.',
    )
    expect(records[0]!.find('.surface-act-entry').text()).toContain('1.0.0')
    expect(records[0]!.find('.surface-act-proof').text()).toContain('txTX-1')
    expect(records[0]!.find('.surface-act-proof').text()).toContain('recorded2026-07-09 12:01 UTC')
    expect(wrapper.text()).not.toContain('HEIGHT')
    expect(wrapper.text()).not.toContain('MSG')
    expect(wrapper.find('.surface-act-column-head').text()).toBe('ENTRYSTATEMENTEVIDENCE')
    expect(wrapper.find('.surface-act-cursor').exists()).toBe(false)
  })

  it('renders complete assertion references as inspectable triggers', async () => {
    const issuer =
      'did:pkh:cosmos:axone-dendrite-2:cosmos1s7uksna4686k27cg6gneqltxx4yjsscs3p7ztvvned6j2thjjthstexh8c'
    const subject = 'urn:axone:testnet:subject:gh31175346323a1-1'
    const wrapper = mount(SurfaceActLine, {
      props: {
        act: {
          ...makeAct('TX-DID', 1, 'axone1issuer'),
          assertion: [
            { type: 'text', value: 'Credential issued by ' },
            {
              type: 'reference',
              reference: {
                designation: 'Credential issuer',
                value: issuer,
                display: 'did:pkh:…cosmos1s7u…texh8c',
              },
            },
            { type: 'text', value: ' for subject ' },
            {
              type: 'reference',
              reference: {
                designation: 'Credential subject',
                value: subject,
                display: 'urn:axone:te…23a1-1',
              },
            },
            { type: 'text', value: '.' },
          ],
        },
        explorer: testExplorer,
        reducedMotion: true,
        typingActive: false,
        cursorVisible: false,
      },
    })

    await nextTick()

    const assertion = wrapper.get('.surface-act-inscription')
    const identifiers = assertion.findAll('.surface-reference-trigger')
    expect(identifiers.map((identifier) => identifier.text())).toEqual([
      'did:pkh:…cosmos1s7u…texh8c',
      'urn:axone:te…23a1-1',
    ])
    expect(assertion.text()).toBe(
      'Credential issued by did:pkh:…cosmos1s7u…texh8c for subject urn:axone:te…23a1-1.',
    )
    expect(wrapper.text()).not.toContain(issuer)
    await identifiers[0]!.trigger('click')
    expect(wrapper.get('[role="dialog"]').text()).toContain(issuer)
  })

  it('keeps an incompletely typed reference noninteractive', async () => {
    vi.useFakeTimers()
    const display = 'did:pkh:…cosmos1s7u…texh8c'
    const wrapper = mount(SurfaceActLine, {
      props: {
        act: {
          ...makeAct('TX-PARTIAL', 1, 'axone1issuer'),
          assertion: [
            {
              type: 'reference',
              reference: {
                designation: 'Credential issuer',
                value:
                  'did:pkh:cosmos:axone-dendrite-2:cosmos1s7uksna4686k27cg6gneqltxx4yjsscs3p7ztvvned6j2thjjthstexh8c',
                display,
              },
            },
          ],
        },
        explorer: testExplorer,
        reducedMotion: false,
        typingActive: true,
        cursorVisible: true,
      },
    })

    vi.advanceTimersByTime(16 * 5)
    await nextTick()
    expect(wrapper.get('.surface-act-identifier').text().length).toBeLessThan(display.length)
    expect(wrapper.find('.surface-act-inscription .surface-reference-trigger').exists()).toBe(false)
  })

  it('renders governance, verdict, and credential evidence', () => {
    const constitutionHash = '8C11A47D0123456789ABCDEF0123456789ABCDEF0123456789ABCDEFB2903E12'
    const credentialId = 'CRED-12345678901234567890-ABCDEF'
    const evidenceActs: Array<{ act: SurfaceAct; expected: string[] }> = [
      {
        act: {
          ...makeAct('TX-GOV-INST', 1, 'axone1authority'),
          kind: 'governance.instantiated',
          payload: { constitution_revision: '1', constitution_hash: constitutionHash },
        },
        expected: ['constitution r. 1 · 8C11A47D…B2903E12'],
      },
      {
        act: {
          ...makeAct('TX-GOV-REV', 1, 'axone1authority'),
          kind: 'governance.constitution.revised',
          payload: { constitution_revision: '2', constitution_hash: constitutionHash },
        },
        expected: ['constitution r. 2 · 8C11A47D…B2903E12'],
      },
      {
        act: {
          ...makeAct('TX-VERDICT', 1, 'axone1authority'),
          kind: 'governance.decision.recorded',
          payload: {
            decision_id: '1',
            constitution_revision: '3',
            constitution_hash: constitutionHash,
            verdict: 'gov:permitted',
          },
        },
        expected: ['decisionn° 1', 'constitution r. 3 · 8C11A47D…B2903E12', 'verdictgov:permitted'],
      },
      {
        act: {
          ...makeAct('TX-CRED-ISS', 1, 'axone1authority'),
          kind: 'credential.issued',
          payload: { identifier: credentialId },
        },
        expected: ['credentialCRED-1234567…ABCDEF'],
      },
      {
        act: {
          ...makeAct('TX-CRED-REVK', 1, 'axone1authority'),
          kind: 'credential.revoked',
          payload: { identifier: credentialId },
        },
        expected: ['credentialCRED-1234567…ABCDEF'],
      },
    ]

    for (const { act, expected } of evidenceActs) {
      const wrapper = mount(SurfaceActLine, {
        props: {
          act,
          explorer: testExplorer,
          reducedMotion: true,
          typingActive: false,
          cursorVisible: false,
        },
      })
      const evidence = wrapper.get('.surface-act-proof').text()

      for (const value of expected) {
        expect(evidence).toContain(value)
      }
    }
  })

  it('opens transaction evidence with a safe explorer action and copies its canonical hash', async () => {
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

    const transactionTrigger = wrapper.get('.surface-act-tx .surface-reference-trigger')
    expect(transactionTrigger.text()).toBe('34BB1E16…EF8A931F')
    await transactionTrigger.trigger('click')

    const dialog = wrapper.get('[role="dialog"]')
    expect(dialog.text()).toContain('Exhibit · TX HASH')
    expect(dialog.get('.surface-reference-verification').text()).toBe('Verified')
    expect(dialog.text()).toContain(txhash)
    const explorerLink = dialog.get('a')
    expect(explorerLink.text()).toBe('OPEN IN EXPLORER')
    expect(explorerLink.attributes('href')).toBe(`${testExplorer}/tx/${txhash}`)
    expect(explorerLink.attributes('target')).toBe('_blank')
    expect(explorerLink.attributes('rel')).toBe('noopener noreferrer')

    await dialog.get('button.surface-reference-action').trigger('click')
    await Promise.resolve()
    expect(writeText).toHaveBeenCalledWith(txhash)
    expect(dialog.get('button.surface-reference-action').text()).toBe('Copied')
    vi.advanceTimersByTime(1000)
    await nextTick()
    expect(dialog.get('button.surface-reference-action').text()).toBe('Copy')
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
