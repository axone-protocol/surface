import { describe, expect, it } from 'vitest'

import {
  identityRequestLink,
  identityRequestMemo,
  isIdentityRequestComplete,
  normaliseIdentityRequest,
} from '../identity-request'

describe('identity request', () => {
  it('normalises required input while keeping stable public metadata separate', () => {
    expect(normaliseIdentityRequest({ name: ' Identity ', description: ' Description ' })).toEqual({
      name: 'Identity',
      description: 'Description',
    })
    expect(isIdentityRequestComplete({ name: '  ', description: 'Description' })).toBe(false)
    expect(isIdentityRequestComplete({ name: 'Identity', description: '  ' })).toBe(false)
    expect(isIdentityRequestComplete({ name: ' Identity ', description: ' Description ' })).toBe(
      true,
    )
    expect(identityRequestLink).toBe('https://surface.axone.xyz')
    expect(identityRequestMemo).toBe('Axone Surface — identity request')
  })
})
