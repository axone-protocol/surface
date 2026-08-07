import { describe, expect, it } from 'vitest'

import {
  shortenDid,
  shortenHash,
  shortenIdentifier,
  shortenUri,
  shortenWalletAddress,
} from '../shorten'

describe('identifier shortening', () => {
  it('shortens identifiers according to their semantic display policies', () => {
    expect(
      shortenDid(
        'did:pkh:cosmos:axone-dendrite-2:cosmos1lfcc2yt3gmd3xspw5yxsl3r9qyuumuya6hur2gnejgmafyrapmkqpk2un3',
      ),
    ).toBe('did:pkh:…cosmos1lfc…pk2un3')
    expect(shortenUri('https://example.org/path/to/resource')).toBe('https://exam…source')
    expect(shortenUri('urn:axone:testnet:subject:gh29632273325a1-1')).toBe('urn:axone:te…25a1-1')
    expect(shortenWalletAddress('axone1walletprivateaddress')).toBe('axone1wall…ddress')
    expect(shortenHash('0123456789ABCDEF'.repeat(4))).toBe('01234567…89ABCDEF')
    expect(shortenIdentifier('CRED-12345678901234567890-ABCDEF')).toBe('CRED-1234567…ABCDEF')
  })

  it.each([
    ['DID', shortenDid],
    ['URI', shortenUri],
    ['wallet address', shortenWalletAddress],
    ['hash', shortenHash],
    ['identifier', shortenIdentifier],
  ])('preserves empty %s input', (_kind, shorten) => {
    expect(shorten('')).toBe('')
  })

  it.each([
    ['URI', shortenUri, 12, 6],
    ['wallet address', shortenWalletAddress, 10, 6],
    ['hash', shortenHash, 8, 8],
    ['identifier', shortenIdentifier, 12, 6],
  ])('preserves and then compacts %s threshold values', (_kind, shorten, leading, trailing) => {
    const thresholdValue = 'a'.repeat(leading + 1 + trailing)
    const overThresholdValue = `${thresholdValue}x`

    expect(shorten(thresholdValue)).toBe(thresholdValue)
    expect(shorten(overThresholdValue)).toBe(`${'a'.repeat(leading)}…${'a'.repeat(trailing - 1)}x`)
    expect(shorten(overThresholdValue).length).toBeLessThanOrEqual(overThresholdValue.length)
  })

  it('preserves and then compacts DID final identifier segment thresholds', () => {
    const prefix = 'did:pkh:cosmos:axone-dendrite-2:'
    const thresholdDid = `${prefix}${'a'.repeat(17)}`
    const overThresholdDid = `${thresholdDid}x`

    expect(shortenDid(thresholdDid)).toBe(thresholdDid)
    expect(shortenDid(overThresholdDid)).toBe('did:pkh:…aaaaaaaaaa…aaaaax')
    expect(shortenDid(overThresholdDid).length).toBeLessThanOrEqual(overThresholdDid.length)
  })

  it('delegates malformed DIDs to identifier shortening without throwing', () => {
    const malformedDid = 'did:missing-separator-with-a-long-identifier'

    expect(() => shortenDid(malformedDid)).not.toThrow()
    expect(shortenDid(malformedDid)).toBe(shortenIdentifier(malformedDid))
  })
})
