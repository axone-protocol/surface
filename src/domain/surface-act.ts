export type SurfaceActKind =
  | 'identity.created'
  | 'capability.installed'
  | 'governance.instantiated'
  | 'governance.decision.recorded'
  | 'governance.constitution.revised'
  | 'credential.authority.instantiated'
  | 'credential.issued'
  | 'credential.revoked'

export type SurfaceAct = {
  id: string
  kind: SurfaceActKind
  txhash: string
  msgIndex: number
  actIndex: number
  height: number
  entry?: string
  timestamp: string
  signer?: string
  contract?: string
  contractAddress?: string
  action?: string
  title: string
  description: string
  assertion: string
  payload: Record<string, string>
}

export const surfaceActKindLabels: Record<SurfaceActKind, string> = {
  'identity.created': 'IDENTITY REGISTERED',
  'capability.installed': 'CAPABILITY INSTALLED',
  'governance.instantiated': 'GOVERNANCE INSTANTIATED',
  'governance.decision.recorded': 'DECISION RECORDED',
  'governance.constitution.revised': 'GOVERNANCE REVISED',
  'credential.authority.instantiated': 'CREDENTIAL AUTHORITY INSTANTIATED',
  'credential.issued': 'CREDENTIAL ISSUED',
  'credential.revoked': 'CREDENTIAL REVOKED',
}

export const surfaceActKindCategories: Record<SurfaceActKind, string> = {
  'identity.created': 'IDENTITY',
  'capability.installed': 'CAPABILITY',
  'governance.instantiated': 'GOVERNANCE',
  'governance.decision.recorded': 'VERDICT',
  'governance.constitution.revised': 'GOVERNANCE',
  'credential.authority.instantiated': 'CREDENTIAL',
  'credential.issued': 'CREDENTIAL',
  'credential.revoked': 'CREDENTIAL',
}

export const surfaceActKindDescriptions: Record<SurfaceActKind, string> = {
  'identity.created': 'Identity recorded.',
  'capability.installed': 'Capabilities recorded.',
  'governance.instantiated': 'Governance recorded.',
  'governance.decision.recorded': 'Decision recorded.',
  'governance.constitution.revised': 'Constitution revised.',
  'credential.authority.instantiated': 'Credential authority recorded.',
  'credential.issued': 'Credential issued.',
  'credential.revoked': 'Credential revoked.',
}
