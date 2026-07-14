import { type CosmosTxListResponse, type CosmosTxResponse } from './axone-event-extractor'

const AXONE_API_BASE = 'https://api.axone.aknodes.net'
const DEFAULT_LIMIT = 5
const MAX_BLOCK_CACHE_ENTRIES = 12
const MAX_MODULE_ADMIN_CACHE_ENTRIES = 24
const blockTransactionsByHeight = new Map<number, Promise<string[]>>()
const moduleAdministratorsByAddress = new Map<string, Promise<string | undefined>>()

export type FetchedTxBatch = {
  txResponses: CosmosTxResponse[]
}

type CosmosBlockResponse = {
  block?: {
    data?: {
      txs?: string[]
    }
  }
}

type CosmosContractInfoResponse = {
  contract_info?: {
    admin?: string
  }
}

function bytesFromBase64(value: string) {
  const binary = atob(value)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

async function transactionHash(transaction: string) {
  const digest = await crypto.subtle.digest('SHA-256', bytesFromBase64(transaction))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()
}

async function fetchBlockTransactionHashes(height: number, signal?: AbortSignal) {
  const url = new URL(`/cosmos/base/tendermint/v1beta1/blocks/${height}`, AXONE_API_BASE)

  const response = await fetch(url, {
    method: 'GET',
    signal,
    headers: { accept: 'application/json' },
  })

  if (!response.ok) {
    throw new Error(`Axone block request failed (${response.status})`)
  }

  const data = (await response.json()) as CosmosBlockResponse
  const transactions = data.block?.data?.txs
  if (!transactions) {
    throw new Error(`Axone block ${height} has no transaction data`)
  }

  return Promise.all(transactions.map(transactionHash))
}

function blockTransactionHashes(height: number, signal?: AbortSignal) {
  const cached = blockTransactionsByHeight.get(height)
  if (cached) {
    blockTransactionsByHeight.delete(height)
    blockTransactionsByHeight.set(height, cached)
    return cached
  }

  const request = fetchBlockTransactionHashes(height, signal).catch((error: unknown) => {
    blockTransactionsByHeight.delete(height)
    throw error
  })
  blockTransactionsByHeight.set(height, request)
  while (blockTransactionsByHeight.size > MAX_BLOCK_CACHE_ENTRIES) {
    const oldestHeight = blockTransactionsByHeight.keys().next().value
    if (oldestHeight === undefined) {
      break
    }

    blockTransactionsByHeight.delete(oldestHeight)
  }
  return request
}

async function fetchModuleAdministrator(address: string, signal?: AbortSignal) {
  const url = new URL(`/cosmwasm/wasm/v1/contract/${address}`, AXONE_API_BASE)
  const response = await fetch(url, {
    method: 'GET',
    signal,
    headers: { accept: 'application/json' },
  })
  if (!response.ok) {
    throw new Error(`Axone contract request failed (${response.status})`)
  }

  const data = (await response.json()) as CosmosContractInfoResponse
  return data.contract_info?.admin
}

function moduleAdministrator(address: string, signal?: AbortSignal) {
  const cached = moduleAdministratorsByAddress.get(address)
  if (cached) {
    moduleAdministratorsByAddress.delete(address)
    moduleAdministratorsByAddress.set(address, cached)
    return cached
  }

  const request = fetchModuleAdministrator(address, signal).catch((error: unknown) => {
    moduleAdministratorsByAddress.delete(address)
    throw error
  })
  moduleAdministratorsByAddress.set(address, request)
  while (moduleAdministratorsByAddress.size > MAX_MODULE_ADMIN_CACHE_ENTRIES) {
    const oldestAddress = moduleAdministratorsByAddress.keys().next().value
    if (oldestAddress === undefined) {
      break
    }
    moduleAdministratorsByAddress.delete(oldestAddress)
  }
  return request
}

export async function resolveModuleAdministrators(addresses: string[], signal?: AbortSignal) {
  const resolved = await Promise.allSettled(
    addresses.map(
      async (address) => [address, await moduleAdministrator(address, signal)] as const,
    ),
  )
  const administrators = new Map<string, string>()
  for (const result of resolved) {
    if (result.status === 'fulfilled' && result.value[1]) {
      administrators.set(result.value[0], result.value[1])
    }
  }
  return administrators
}

/**
 * Resolves only transaction references confirmed by their containing block.
 * Failed block requests deliberately stay out of the result so callers can
 * retain the previous register state and retry on the next polling cycle.
 */
export async function resolveTransactionEntries(
  txResponses: CosmosTxResponse[],
  signal?: AbortSignal,
) {
  const heights = [
    ...new Set(txResponses.map((tx) => Number.parseInt(tx.height ?? '', 10))),
  ].filter(Number.isFinite)
  const resolvedBlocks = await Promise.allSettled(
    heights.map(async (height) => [height, await blockTransactionHashes(height, signal)] as const),
  )
  const transactionIndexes = new Map<string, { height: number; txIndex: number }>()

  for (const result of resolvedBlocks) {
    if (result.status !== 'fulfilled') {
      continue
    }

    const [height, hashes] = result.value
    hashes.forEach((hash, txIndex) => transactionIndexes.set(hash, { height, txIndex }))
  }

  return new Map(
    txResponses.flatMap((tx) => {
      const txhash = tx.txhash?.toUpperCase()
      const position = txhash ? transactionIndexes.get(txhash) : undefined
      return position ? [[tx.txhash ?? '', `${position.height}.${position.txIndex}`] as const] : []
    }),
  )
}

async function fetchTxsByAction(
  action: string,
  signal?: AbortSignal,
  limit = DEFAULT_LIMIT,
): Promise<FetchedTxBatch> {
  const url = new URL('/cosmos/tx/v1beta1/txs', AXONE_API_BASE)
  url.searchParams.set('query', `message.action='${action}'`)
  url.searchParams.set('page', '1')
  url.searchParams.set('limit', String(limit))
  url.searchParams.set('order_by', 'ORDER_BY_DESC')

  const response = await fetch(url, {
    method: 'GET',
    signal,
    headers: {
      accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Axone API request failed (${response.status})`)
  }

  const data = (await response.json()) as CosmosTxListResponse
  return {
    txResponses: data.tx_responses ?? [],
  }
}

export function fetchInstantiateContract2Txs(signal?: AbortSignal, limit = DEFAULT_LIMIT) {
  return fetchTxsByAction('/cosmwasm.wasm.v1.MsgInstantiateContract2', signal, limit)
}

export function fetchExecuteContractTxs(signal?: AbortSignal, limit = DEFAULT_LIMIT) {
  return fetchTxsByAction('/cosmwasm.wasm.v1.MsgExecuteContract', signal, limit)
}
