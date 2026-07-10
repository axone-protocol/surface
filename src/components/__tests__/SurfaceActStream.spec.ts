import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import SurfaceActStream from '../SurfaceActStream.vue'

describe('SurfaceActStream', () => {
  it('renders loading and loaded states', async () => {
    const wrapper = mount(SurfaceActStream, {
      props: {
        acts: [],
        loading: true,
        error: undefined,
        reducedMotion: true,
        polling: true,
        lastSyncLabel: '17:11:19',
        registerSummary: undefined,
      },
    })

    expect(wrapper.find('.chain-polling-dots').exists()).toBe(true)

    await wrapper.setProps({
      loading: false,
      reducedMotion: true,
      polling: false,
      lastSyncLabel: '17:11:19',
      registerSummary: '233 RECORDS',
      acts: [
        {
          id: '0xdef:0:0',
          kind: 'governance.decision.recorded',
          txhash: '0xdef',
          msgIndex: 0,
          actIndex: 0,
          height: 44,
          timestamp: '2026-07-09T12:02:00Z',
          signer: 'axone1third',
          contractAddress: 'axone1contract',
          action: 'record_decision',
          title: 'ACT RECORDED',
          description: 'A governance act was recorded for the case. Verdict: gov:permitted.',
          payload: {},
        },
        {
          id: '0xghi:0:0',
          kind: 'identity.created',
          txhash: '0xghi',
          msgIndex: 0,
          actIndex: 0,
          height: 43,
          timestamp: '2026-07-09T12:01:00Z',
          signer: 'axone1second',
          contractAddress: 'axone1contract',
          action: 'instantiate',
          title: 'IDENTITY REGISTERED',
          description: 'Abstract account was registered as an Axone identity.',
          payload: {},
        },
        {
          id: '0xabc:0:0',
          kind: 'identity.created',
          txhash: '0xabc',
          msgIndex: 0,
          actIndex: 0,
          height: 42,
          timestamp: '2026-07-09T12:00:00Z',
          signer: 'axone1test',
          contractAddress: 'axone1contract',
          action: 'instantiate',
          title: 'IDENTITY REGISTERED',
          description: 'Abstract account was registered as an Axone identity.',
          payload: {},
        },
        {
          id: '0xzzz:0:0',
          kind: 'identity.created',
          txhash: '0xzzz',
          msgIndex: 0,
          actIndex: 0,
          height: 41,
          timestamp: '2026-07-09T11:59:00Z',
          signer: 'axone1older',
          contractAddress: 'axone1contract',
          action: 'instantiate',
          title: 'IDENTITY REGISTERED',
          description: 'Ignored because the window is capped.',
          payload: {},
        },
      ],
    })

    expect(wrapper.text()).toContain('233 RECORDS')
    expect(wrapper.text()).toContain('·')
    expect(wrapper.text()).toContain('ACT RECORDED')
    expect(wrapper.text()).toContain('IDENTITY REGISTERED')
    expect(wrapper.find('.surface-act-badge').text()).toBe('IDENTITY')
    expect(wrapper.text()).toContain('axone1test')
    expect(wrapper.text()).toContain('0xghi')
    expect(wrapper.text()).toContain('LAST SYNC 17:11:19')
    expect(wrapper.findAll('.surface-act-item')).toHaveLength(3)
    expect(wrapper.text()).not.toContain('QUALIFIED EVENTS')
    expect(wrapper.text()).not.toMatch(/\d+ ACTS/)
    expect(wrapper.text()).not.toContain('next act')
    expect(wrapper.text()).not.toContain('Awaiting')
  })
})
