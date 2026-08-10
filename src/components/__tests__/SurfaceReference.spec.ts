import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'

import SurfaceReference from '../SurfaceReference.vue'

const walletAddress = 'axone1lfcc2yt3gmd3xspw5yxsl3r9qyuumuya6hur2gnejgmafyrapmkqhg7gd5'
const mountedReferences: Array<{ unmount: () => void }> = []

function stubMatchMedia(matches: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn<() => MediaQueryList>().mockReturnValue({
      matches,
      addEventListener: vi.fn<() => void>(),
      removeEventListener: vi.fn<() => void>(),
    } as unknown as MediaQueryList),
  )
}

describe('SurfaceReference', () => {
  afterEach(() => {
    mountedReferences.splice(0).forEach((wrapper) => wrapper.unmount())
    vi.useRealTimers()
    vi.unstubAllGlobals()
    document.body.innerHTML = ''
  })

  it('inspects, copies, and safely opens an external reference', async () => {
    vi.useFakeTimers()
    const writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    const wrapper = mount(SurfaceReference, {
      attachTo: document.body,
      props: {
        reference: {
          designation: 'Transaction hash',
          value: '34BB1E16A4051234567890ABCDEF8A931F',
          display: '34BB1E16…EF8A931F',
          link: {
            href: 'https://explorer.example/tx/34BB1E16A4051234567890ABCDEF8A931F',
            label: 'Open transaction in explorer',
          },
        },
      },
    })
    mountedReferences.push(wrapper)

    const trigger = wrapper.get('.surface-reference-trigger')
    expect(trigger.attributes('aria-haspopup')).toBe('dialog')
    expect(trigger.attributes('aria-expanded')).toBe('false')
    expect(wrapper.text()).not.toContain('34BB1E16A4051234567890ABCDEF8A931F')

    await trigger.trigger('click')

    const dialog = document.body.querySelector<HTMLElement>('.surface-reference-panel')!
    expect(dialog.classList).toContain('surface-reference-panel--below')
    expect(trigger.attributes('aria-expanded')).toBe('true')
    expect(dialog.textContent).toContain('Transaction hash')
    expect(dialog.querySelector('.surface-reference-verification')).toBeNull()
    expect(dialog.textContent).toContain('34BB1E16A4051234567890ABCDEF8A931F')
    const link = dialog.querySelector<HTMLAnchorElement>('a')!
    expect(link.target).toBe('_blank')
    expect(link.rel).toBe('noopener noreferrer')

    const copyButton = dialog.querySelector<HTMLButtonElement>('button.surface-reference-action')!
    copyButton.click()
    await Promise.resolve()
    await nextTick()
    expect(writeText).toHaveBeenCalledWith('34BB1E16A4051234567890ABCDEF8A931F')
    expect(copyButton.textContent).toBe('Copied')
    vi.advanceTimersByTime(1000)
    await nextTick()
    expect(copyButton.textContent).toBe('Copy')
  })

  it('keeps same-origin navigation in context and omits missing destinations', async () => {
    const wrapper = mount(SurfaceReference, {
      attachTo: document.body,
      props: {
        reference: {
          designation: 'Constitution hash',
          value: '8C11A47D0123456789ABCDEF0123456789ABCDEF0123456789ABCDEFB2903E12',
          display: '8C11A47D…B2903E12',
          link: { href: '/constitution/1', label: 'Open constitution' },
        },
      },
    })
    mountedReferences.push(wrapper)

    await wrapper.get('.surface-reference-trigger').trigger('click')
    const dialog = document.body.querySelector<HTMLElement>('.surface-reference-panel')!
    const sameOriginLink = dialog.querySelector<HTMLAnchorElement>('a')!
    expect(sameOriginLink.getAttribute('target')).toBeNull()
    expect(sameOriginLink.getAttribute('rel')).toBeNull()

    await wrapper.setProps({
      reference: {
        designation: 'Credential identifier',
        value: 'CRED-12345678901234567890-ABCDEF',
        display: 'CRED-1234567…ABCDEF',
      },
    })
    expect(dialog.querySelector('a')).toBeNull()
    expect(dialog.querySelector('.surface-reference-actions')?.classList).toContain(
      'surface-reference-actions--single',
    )
  })

  it('keeps an open desktop popover anchored while the document scrolls', async () => {
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0)
      return 1
    })
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    let triggerTop = 100
    const wrapper = mount(SurfaceReference, {
      attachTo: document.body,
      props: {
        reference: {
          designation: 'Transaction hash',
          value: '34BB1E16A4051234567890ABCDEF8A931F',
          display: '34BB1E16…EF8A931F',
        },
      },
    })
    mountedReferences.push(wrapper)
    const trigger = wrapper.get('.surface-reference-trigger')
    vi.spyOn(trigger.element, 'getBoundingClientRect').mockImplementation(
      () =>
        ({
          top: triggerTop,
          bottom: triggerTop + 20,
          left: 40,
          right: 180,
          width: 140,
          height: 20,
        }) as DOMRect,
    )

    await trigger.trigger('click')
    const dialog = document.body.querySelector<HTMLElement>('.surface-reference-panel')!
    expect(dialog.style.top).toBe('132px')

    triggerTop = 300
    document.dispatchEvent(new Event('scroll'))
    await nextTick()

    expect(dialog.style.top).toBe('332px')
  })

  it('restores Copy after clipboard rejection and closes on Escape or outside click', async () => {
    const writeText = vi
      .fn<(text: string) => Promise<void>>()
      .mockRejectedValue(new Error('Denied'))
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    const wrapper = mount(SurfaceReference, {
      attachTo: document.body,
      props: {
        reference: { designation: 'Credential identifier', value: 'cred-1', display: 'cred-1' },
      },
    })
    mountedReferences.push(wrapper)

    const trigger = wrapper.get('.surface-reference-trigger')
    await trigger.trigger('click')
    const dialog = document.body.querySelector<HTMLElement>('.surface-reference-panel')!
    dialog.querySelector<HTMLButtonElement>('button.surface-reference-action')!.click()
    await Promise.resolve()
    await nextTick()
    expect(dialog.querySelector('button.surface-reference-action')?.textContent).toBe('Copy')

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await nextTick()
    expect(document.body.querySelector('.surface-reference-panel')).toBeNull()
    expect(document.activeElement).toBe(trigger.element)

    await trigger.trigger('click')
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()
    expect(document.body.querySelector('.surface-reference-panel')).toBeNull()
    expect(document.activeElement).toBe(trigger.element)
  })

  it('uses a focus-trapped sheet and restores focus from its backdrop', async () => {
    stubMatchMedia(true)
    const wrapper = mount(SurfaceReference, {
      attachTo: document.body,
      props: {
        reference: {
          designation: 'Wallet address',
          value: walletAddress,
          display: 'axone1lfc…qhg7gd5',
          link: {
            href: 'https://explorer.example/account/address',
            label: 'Open wallet address in explorer',
          },
        },
      },
    })
    mountedReferences.push(wrapper)

    const trigger = wrapper.get('.surface-reference-trigger')
    await trigger.trigger('click')
    await nextTick()

    const sheet = document.body.querySelector<HTMLElement>('.surface-reference-sheet')!
    const close = sheet.querySelector<HTMLButtonElement>('.surface-reference-close')!
    const link = sheet.querySelector<HTMLAnchorElement>('a')!
    expect(sheet.getAttribute('aria-modal')).toBe('true')
    expect(document.activeElement).toBe(close)

    link.focus()
    link.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }))
    expect(document.activeElement).toBe(close)

    document.body.querySelector<HTMLElement>('.surface-reference-backdrop')!.click()
    await nextTick()
    expect(document.body.querySelector('.surface-reference-sheet')).toBeNull()
    expect(document.activeElement).toBe(trigger.element)
  })
})
