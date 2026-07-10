export type CosmosEventAttribute = {
  key: string
  value: string
}

export type CosmosEvent = {
  type?: string
  attributes?: CosmosEventAttribute[]
}

export type CosmosMessage = {
  '@type'?: string
  typeUrl?: string
  type?: string
  [key: string]: unknown
}

export type CosmosTxResponse = {
  height?: string
  txhash?: string
  timestamp?: string
  tx?: {
    body?: {
      messages?: CosmosMessage[]
    }
  }
  events?: CosmosEvent[]
}

export type CosmosTxListResponse = {
  tx_responses?: CosmosTxResponse[]
  total?: string
}

export function messageType(message: CosmosMessage | undefined) {
  return message?.['@type'] ?? message?.typeUrl ?? message?.type ?? ''
}

export function eventAttribute(event: CosmosEvent | undefined, key: string) {
  return event?.attributes?.find((attribute) => attribute.key === key)?.value ?? ''
}

export function eventAttributes(event: CosmosEvent | undefined) {
  return Object.fromEntries(
    (event?.attributes ?? []).map((attribute) => [attribute.key, attribute.value]),
  )
}

export function extractWasmAbstractEvents(tx: CosmosTxResponse) {
  return (tx.events ?? []).filter((event) => event.type === 'wasm-abstract')
}

export function extractInstantiateEvents(tx: CosmosTxResponse) {
  return (tx.events ?? []).filter((event) => event.type === 'instantiate')
}
