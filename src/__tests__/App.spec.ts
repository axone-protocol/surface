import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'

import App from '../App.vue'

function createCanvasContextMock() {
  return {
    setTransform: vi.fn<() => void>(),
    fillRect: vi.fn<() => void>(),
    save: vi.fn<() => void>(),
    restore: vi.fn<() => void>(),
    beginPath: vi.fn<() => void>(),
    moveTo: vi.fn<() => void>(),
    lineTo: vi.fn<() => void>(),
    stroke: vi.fn<() => void>(),
    arc: vi.fn<() => void>(),
    fill: vi.fn<() => void>(),
  } as unknown as CanvasRenderingContext2D
}

function createMatchMediaMock(matches: boolean) {
  return vi.fn<() => MediaQueryList>().mockImplementation(() => ({
    matches,
    media: '(prefers-reduced-motion: reduce)',
    onchange: null,
    addEventListener: vi.fn<() => void>(),
    removeEventListener: vi.fn<() => void>(),
    dispatchEvent: vi.fn<() => boolean>(),
    addListener: vi.fn<() => void>(),
    removeListener: vi.fn<() => void>(),
  }))
}

function createEmptyTxList() {
  return { tx_responses: [] }
}

function createResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as unknown as Response
}

describe('App', () => {
  it('renders the live act homepage shell', async () => {
    const matchMedia = createMatchMediaMock(true)

    const fetchMock = vi
      .fn<() => Promise<Response>>()
      .mockImplementation(async () => createResponse(createEmptyTxList()))

    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: matchMedia,
    })
    Object.defineProperty(window, 'fetch', {
      writable: true,
      value: fetchMock,
    })
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      writable: true,
      value: vi
        .fn<() => CanvasRenderingContext2D | null>()
        .mockReturnValue(createCanvasContextMock()),
    })

    const wrapper = mount(App)
    await flushPromises()
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('AXONE / SURFACE')
    expect(wrapper.text()).toContain('GOVERN ACT')
    expect(wrapper.text()).toContain('Connect identity')
    expect(wrapper.text()).toContain('axone-testnet')
    expect(wrapper.text()).toContain('CHAIN REGISTER')
    expect(wrapper.text()).toContain('Enter the surface')
    expect(wrapper.text()).not.toContain('RECORDS')
    expect(wrapper.text()).not.toContain('LAST SYNC')
    expect(wrapper.text()).not.toContain('Awaiting')

    await wrapper.get('.network-trigger').trigger('click')
    expect(wrapper.text()).toContain('AXONE-1')
    expect(wrapper.text()).toContain('soon')
  })

  it('does not show register metadata when the chain request fails', async () => {
    const matchMedia = createMatchMediaMock(true)

    const fetchMock = vi.fn<() => Promise<Response>>().mockRejectedValue(new Error('offline'))

    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: matchMedia,
    })
    Object.defineProperty(window, 'fetch', {
      writable: true,
      value: fetchMock,
    })
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      writable: true,
      value: vi
        .fn<() => CanvasRenderingContext2D | null>()
        .mockReturnValue(createCanvasContextMock()),
    })

    const wrapper = mount(App)
    await flushPromises()
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).not.toContain('RECORDS')
    expect(wrapper.text()).not.toContain('LAST SYNC')
  })
})
