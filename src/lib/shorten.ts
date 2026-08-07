function shortenMiddle(value: string, leading: number, trailing: number): string {
  if (value.length <= leading + 1 + trailing) {
    return value
  }

  return `${value.slice(0, leading)}…${value.slice(-trailing)}`
}

export function shortenDid(value: string): string {
  if (!value.startsWith('did:')) {
    return shortenIdentifier(value)
  }

  const methodEnd = value.indexOf(':', 'did:'.length)
  if (methodEnd === 'did:'.length || methodEnd === -1) {
    return shortenIdentifier(value)
  }

  const identifier = value.slice(value.lastIndexOf(':') + 1)
  if (identifier.length <= 17) {
    return value
  }

  return `did:${value.slice('did:'.length, methodEnd)}:…${identifier.slice(0, 10)}…${identifier.slice(-6)}`
}

export function shortenUri(value: string): string {
  return shortenMiddle(value, 12, 6)
}

export function shortenWalletAddress(value: string): string {
  return shortenMiddle(value, 10, 6)
}

export function shortenHash(value: string): string {
  return shortenMiddle(value, 8, 8)
}

export function shortenIdentifier(value: string): string {
  return shortenMiddle(value, 12, 6)
}
