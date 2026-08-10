export const identityRequestMemo = 'Axone Surface — identity request'
export const identityRequestLink = 'https://surface.axone.xyz'

export type IdentityRequest = {
  name: string
  description: string
}

export function normaliseIdentityRequest(request: IdentityRequest): IdentityRequest {
  return {
    name: request.name.trim(),
    description: request.description.trim(),
  }
}

export function isIdentityRequestComplete(request: IdentityRequest): boolean {
  const normalised = normaliseIdentityRequest(request)
  return normalised.name.length > 0 && normalised.description.length > 0
}
