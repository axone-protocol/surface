import { describe, expect, it } from 'vitest'

import { toCanonicalDid } from '../abstract-account'

const axoneAddress = 'axone1lfcc2yt3gmd3xspw5yxsl3r9qyuumuya6hur2gnejgmafyrapmkqhg7gd5'

describe('toCanonicalDid', () => {
  it('re-encodes an Axone address as its canonical Cosmos DID address', () => {
    expect(toCanonicalDid(axoneAddress, 'axone-dendrite-2')).toBe(
      'did:pkh:cosmos:axone-dendrite-2:cosmos1lfcc2yt3gmd3xspw5yxsl3r9qyuumuya6hur2gnejgmafyrapmkqpk2un3',
    )
  })

  it('rejects malformed bech32 addresses', () => {
    expect(() => toCanonicalDid('not-an-address', 'axone-dendrite-2')).toThrow(
      'No separator character for not-an-address',
    )
  })
})
