import {
  eventAttribute,
  eventAttributes,
  extractInstantiateEvents,
  extractWasmAbstractEvents,
  messageType,
  type CosmosMessage,
  type CosmosTxResponse,
} from '../infra/axone-event-extractor'
import {
  surfaceActKindDescriptions,
  surfaceActKindLabels,
  type SurfaceAct,
  type SurfaceActKind,
} from './surface-act'
import { compactCanonicalDid, toCanonicalDid } from './abstract-account'

const instantiateAction = '/cosmwasm.wasm.v1.MsgInstantiateContract2'
const executeAction = '/cosmwasm.wasm.v1.MsgExecuteContract'

function toNumber(value: string | undefined, fallback = 0) {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

function txHeight(tx: CosmosTxResponse) {
  return toNumber(tx.height)
}

function txHash(tx: CosmosTxResponse) {
  return tx.txhash ?? ''
}

function txTimestamp(tx: CosmosTxResponse) {
  return tx.timestamp ?? ''
}

function txMessages(tx: CosmosTxResponse) {
  return tx.tx?.body?.messages ?? []
}

function messageIndexForEvent(eventIndex: number, tx: CosmosTxResponse) {
  const event = extractWasmAbstractEvents(tx)[eventIndex]
  const msgIndex = Number.parseInt(eventAttribute(event, 'msg_index'), 10)
  return Number.isFinite(msgIndex) ? msgIndex : -1
}

function instantiateEventForMessage(tx: CosmosTxResponse, messageIndex: number) {
  const instantiateEvents = extractInstantiateEvents(tx)
  return (
    instantiateEvents.find((event, eventIndex) => {
      const msgIndex = Number.parseInt(eventAttribute(event, 'msg_index'), 10)
      return Number.isFinite(msgIndex) ? msgIndex === messageIndex : eventIndex === messageIndex
    }) ?? instantiateEvents[messageIndex]
  )
}

function stringPayload(values: Record<string, string | undefined>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, value ?? '']),
  ) as Record<string, string>
}

function abstractAccountSubject(address: string, chainId: string) {
  try {
    return compactCanonicalDid(toCanonicalDid(address, chainId))
  } catch {
    return undefined
  }
}

function compactDidIdentifier(identifier: string) {
  return identifier.startsWith('did:pkh:') ? compactCanonicalDid(identifier) : identifier
}

function installedModuleIds(value: string | undefined) {
  if (!value) {
    return []
  }

  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed)) {
      return parsed.filter((moduleId): moduleId is string => typeof moduleId === 'string')
    }
  } catch {
    // Older event encodings may not be JSON. Their module IDs still remain
    // identifiable in the raw attribute below.
  }

  return value.split(',').map((moduleId) => moduleId.trim())
}

function credentialSubjects(message: CosmosMessage) {
  const input = message.msg
  if (!input || typeof input !== 'object') {
    return {}
  }

  const module = (input as Record<string, unknown>).module
  if (!module || typeof module !== 'object') {
    return {}
  }

  const issueCredential = (module as Record<string, unknown>).issue_credential
  if (!issueCredential || typeof issueCredential !== 'object') {
    return {}
  }

  const credential = (issueCredential as Record<string, unknown>).credential
  if (typeof credential !== 'string') {
    return {}
  }

  try {
    const source = new TextDecoder().decode(
      Uint8Array.from(atob(credential), (character) => character.charCodeAt(0)),
    )
    const json = JSON.parse(source) as {
      issuer?: string | { id?: string }
      credentialSubject?: string | { id?: string }
    }
    const issuer = typeof json.issuer === 'string' ? json.issuer : json.issuer?.id
    const subject =
      typeof json.credentialSubject === 'string'
        ? json.credentialSubject
        : json.credentialSubject?.id
    return { issuer, subject }
  } catch {
    // The Axone stimulation payload is N-Quads rather than JSON-LD.
  }

  try {
    const source = new TextDecoder().decode(
      Uint8Array.from(atob(credential), (character) => character.charCodeAt(0)),
    )
    return {
      issuer: source.match(/credentials#issuer>\s+<([^>]+)>/)?.[1],
      subject: source.match(/credentials#credentialSubject>\s+<([^>]+)>/)?.[1],
    }
  } catch {
    return {}
  }
}

function makeActBase(
  tx: CosmosTxResponse,
  messageIndex: number,
  actIndex: number,
  kind: SurfaceActKind,
) {
  const txhash = txHash(tx)
  return {
    id: `${txhash}:${messageIndex}:${actIndex}`,
    kind,
    txhash,
    msgIndex: messageIndex,
    actIndex,
    height: txHeight(tx),
    timestamp: txTimestamp(tx),
    title: surfaceActKindLabels[kind],
    description: surfaceActKindDescriptions[kind],
    assertion: surfaceActKindDescriptions[kind],
    payload: {},
  } satisfies SurfaceAct
}

function fromInstantiate(
  tx: CosmosTxResponse,
  message: CosmosMessage,
  messageIndex: number,
  chainId: string,
): SurfaceAct[] {
  const instantiateEvent = instantiateEventForMessage(tx, messageIndex)
  const abstractAccountEvent = extractWasmAbstractEvents(tx).find(
    (event, eventIndex) =>
      messageIndexForEvent(eventIndex, tx) === messageIndex &&
      eventAttribute(event, 'contract') === 'abstract:account' &&
      eventAttribute(event, 'action') === 'instantiate',
  )
  const contractAddress = eventAttribute(abstractAccountEvent, '_contract_address')
  const subject = abstractAccountSubject(contractAddress, chainId)

  if (
    messageType(message) !== instantiateAction ||
    !instantiateEvent ||
    !contractAddress ||
    !subject
  ) {
    return []
  }

  return [
    {
      ...makeActBase(tx, messageIndex, 0, 'identity.created'),
      signer: String(message.sender ?? ''),
      contractAddress,
      action: 'instantiate',
      description: surfaceActKindDescriptions['identity.created'],
      assertion: `Identity created for ${subject}.`,
      payload: stringPayload({
        _contract_address: contractAddress,
        code_id: String(message.code_id ?? message['codeId'] ?? ''),
        msg_index: String(messageIndex),
      }),
    },
  ]
}

function mapWasmAbstractEvent(
  tx: CosmosTxResponse,
  message: CosmosMessage,
  messageIndex: number,
  actIndex: number,
  eventIndex: number,
  chainId: string,
  moduleAdministrators: ReadonlyMap<string, string>,
): SurfaceAct[] {
  const event = extractWasmAbstractEvents(tx)[eventIndex]
  if (!event) {
    return []
  }

  const contract = eventAttribute(event, 'contract')
  const action = eventAttribute(event, 'action')
  const contractAddress = eventAttribute(event, '_contract_address')
  const attributes = eventAttributes(event)
  const base = makeActBase(tx, messageIndex, actIndex, 'identity.created')
  const signer = eventAttribute(event, 'signer') || eventAttribute(event, 'sender')

  if (contract === 'abstract:account' && action === 'install_modules') {
    const subject = abstractAccountSubject(contractAddress, chainId)
    if (!subject) {
      return []
    }

    const installedModules = installedModuleIds(attributes.installed_modules)
    const moduleKinds = [
      ['axone:axone-gov:', 'governance.instantiated'],
      ['axone:axone-vc:', 'credential.authority.instantiated'],
    ] as const

    return moduleKinds.flatMap(([modulePrefix, kind], moduleIndex) => {
      if (!installedModules.some((moduleId) => moduleId.startsWith(modulePrefix))) {
        return []
      }

      const assertion =
        kind === 'governance.instantiated'
          ? `Governance established on ${subject}.`
          : `Credential authority established on ${subject}.`
      return [
        {
          ...makeActBase(tx, messageIndex, actIndex + moduleIndex, kind),
          signer,
          contract,
          contractAddress,
          action,
          assertion,
          payload: stringPayload({
            installed_modules: attributes.installed_modules ?? '',
            _contract_address: contractAddress,
            msg_index: String(messageIndex),
          }),
        },
      ]
    })
  }

  const abstractAccount = moduleAdministrators.get(contractAddress)

  if (contract === 'axone:axone-gov' && action === 'record_decision') {
    if (!abstractAccount) {
      return []
    }
    const subject = abstractAccountSubject(abstractAccount, chainId)
    if (!subject) {
      return []
    }

    const verdict = attributes.verdict ?? ''
    return [
      {
        ...base,
        kind: 'governance.decision.recorded' as const,
        signer,
        contract,
        contractAddress,
        action,
        title: surfaceActKindLabels['governance.decision.recorded'],
        description: surfaceActKindDescriptions['governance.decision.recorded'],
        assertion: `Decision recorded by ${subject}.`,
        payload: stringPayload({
          decision_id: attributes.decision_id ?? '',
          constitution_revision: attributes.constitution_revision ?? '',
          constitution_hash: attributes.constitution_hash ?? '',
          case_hash: attributes.case_hash ?? '',
          verdict,
          verdict_hash: attributes.verdict_hash ?? '',
          motivation_hash: attributes.motivation_hash ?? '',
          _contract_address: contractAddress,
          abstract_account: abstractAccount,
          msg_index: String(messageIndex),
        }),
      },
    ]
  }

  if (contract === 'axone:axone-gov' && action === 'revise_constitution') {
    if (!abstractAccount) {
      return []
    }
    const subject = abstractAccountSubject(abstractAccount, chainId)
    if (!subject) {
      return []
    }

    return [
      {
        ...base,
        kind: 'governance.constitution.revised' as const,
        signer,
        contract,
        contractAddress,
        action,
        title: surfaceActKindLabels['governance.constitution.revised'],
        description: surfaceActKindDescriptions['governance.constitution.revised'],
        assertion: `Governance amended on ${subject}.`,
        payload: stringPayload({
          constitution_revision: attributes.constitution_revision ?? '',
          constitution_hash: attributes.constitution_hash ?? '',
          _contract_address: contractAddress,
          abstract_account: abstractAccount,
          msg_index: String(messageIndex),
        }),
      },
    ]
  }

  if (contract === 'axone:axone-vc' && action === 'issue_credential') {
    const parsedSubjects = credentialSubjects(message)
    const issuer = attributes.issuer || parsedSubjects.issuer
    const subject = attributes.subject || parsedSubjects.subject
    if (!issuer || !subject) {
      return []
    }

    return [
      {
        ...base,
        kind: 'credential.issued' as const,
        signer,
        contract,
        contractAddress,
        action,
        title: surfaceActKindLabels['credential.issued'],
        description: surfaceActKindDescriptions['credential.issued'],
        assertion: `Credential issued by ${compactDidIdentifier(issuer)} to ${compactDidIdentifier(subject)}.`,
        payload: stringPayload({
          identifier: attributes.identifier ?? '',
          issuer,
          subject,
          credential_type: attributes.credential_type ?? '',
          valid_from: attributes.valid_from ?? '',
          valid_until: attributes.valid_until ?? '',
          _contract_address: contractAddress,
          msg_index: String(messageIndex),
        }),
      },
    ]
  }

  if (contract === 'axone:axone-vc' && action === 'revoke_credential') {
    if (!abstractAccount) {
      return []
    }
    const subject = abstractAccountSubject(abstractAccount, chainId)
    if (!subject) {
      return []
    }

    return [
      {
        ...base,
        kind: 'credential.revoked' as const,
        signer,
        contract,
        contractAddress,
        action,
        title: surfaceActKindLabels['credential.revoked'],
        description: surfaceActKindDescriptions['credential.revoked'],
        assertion: `Credential revoked by ${subject}.`,
        payload: stringPayload({
          identifier: attributes.identifier ?? '',
          issuer: attributes.issuer ?? '',
          revoked_at: attributes.revoked_at ?? '',
          _contract_address: contractAddress,
          abstract_account: abstractAccount,
          msg_index: String(messageIndex),
        }),
      },
    ]
  }

  return []
}

export function moduleContractAddresses(txs: CosmosTxResponse[]) {
  return [
    ...new Set(
      txs.flatMap((tx) =>
        extractWasmAbstractEvents(tx)
          .filter((event) => {
            const contract = eventAttribute(event, 'contract')
            const action = eventAttribute(event, 'action')
            return (
              (contract === 'axone:axone-gov' &&
                ['record_decision', 'revise_constitution'].includes(action)) ||
              (contract === 'axone:axone-vc' && action === 'revoke_credential')
            )
          })
          .map((event) => eventAttribute(event, '_contract_address'))
          .filter(Boolean),
      ),
    ),
  ]
}

export function moduleAdministratorsFromInstallations(txs: CosmosTxResponse[]) {
  const administrators = new Map<string, string>()

  for (const tx of txs) {
    const events = extractWasmAbstractEvents(tx)
    for (const [eventIndex, event] of events.entries()) {
      if (
        eventAttribute(event, 'contract') !== 'abstract:account' ||
        eventAttribute(event, 'action') !== 'install_modules'
      ) {
        continue
      }

      const abstractAccount = eventAttribute(event, '_contract_address')
      const messageIndex = messageIndexForEvent(eventIndex, tx)
      if (!abstractAccount || messageIndex < 0) {
        continue
      }

      for (const moduleEvent of events) {
        if (Number.parseInt(eventAttribute(moduleEvent, 'msg_index'), 10) !== messageIndex) {
          continue
        }

        const moduleAddress = eventAttribute(moduleEvent, '_contract_address')
        const moduleContract = eventAttribute(moduleEvent, 'contract')
        const moduleAction = eventAttribute(moduleEvent, 'action')
        if (
          moduleAddress &&
          ['axone:axone-gov', 'axone:axone-vc'].includes(moduleContract) &&
          moduleAction === 'instantiate'
        ) {
          administrators.set(moduleAddress, abstractAccount)
        }
      }
    }
  }

  return administrators
}

export function mapTxToSurfaceActs(
  tx: CosmosTxResponse,
  chainId: string,
  moduleAdministrators: ReadonlyMap<string, string> = new Map(),
): SurfaceAct[] {
  const acts: SurfaceAct[] = []
  const abstractEvents = extractWasmAbstractEvents(tx)

  txMessages(tx).forEach((message, messageIndex) => {
    const type = messageType(message)

    if (type === instantiateAction) {
      acts.push(...fromInstantiate(tx, message, messageIndex, chainId))
      return
    }

    if (type !== executeAction) {
      return
    }

    let actIndex = 0
    abstractEvents.forEach((_, eventIndex) => {
      const msgIndex = messageIndexForEvent(eventIndex, tx)
      if (msgIndex !== messageIndex) {
        return
      }

      const mappedActs = mapWasmAbstractEvent(
        tx,
        message,
        messageIndex,
        actIndex,
        eventIndex,
        chainId,
        moduleAdministrators,
      )
      acts.push(...mappedActs)
      actIndex += mappedActs.length
    })
  })

  return acts
}

export function sortSurfaceActs(acts: SurfaceAct[]) {
  return [...acts].sort(
    (left, right) =>
      right.height - left.height ||
      right.timestamp.localeCompare(left.timestamp) ||
      left.msgIndex - right.msgIndex ||
      left.actIndex - right.actIndex,
  )
}

export function dedupeSurfaceActs(acts: SurfaceAct[]) {
  const deduped = new Map<string, SurfaceAct>()

  for (const act of acts) {
    deduped.set(act.id, act)
  }

  return [...deduped.values()]
}
