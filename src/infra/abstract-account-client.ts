import type { AbstractAccountClient, AbstractAccountIdentity } from '../domain/abstract-account'
import { toCanonicalDid } from '../domain/abstract-account'
import type { Network } from '../networks'

const AXONE_API_BASE = 'https://api.axone.aknodes.net'
const PAGE_LIMIT = 50

type AccountId = Record<string, unknown>
type AccountListResponse = {
  data?: {
    accounts?: unknown
  }
}
type OwnershipResponse = {
  data?: {
    owner?: {
      monarchy?: {
        monarch?: unknown
      }
    }
  }
}

async function queryContract<T>(
  registry: string,
  message: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const encodedMessage = btoa(JSON.stringify(message))
  const url = new URL(
    `/cosmwasm/wasm/v1/contract/${registry}/smart/${encodedMessage}`,
    AXONE_API_BASE,
  )
  const response = await fetch(url, {
    method: 'GET',
    signal,
    headers: { accept: 'application/json' },
  })

  if (!response.ok) {
    throw new Error(`Axone contract request failed (${response.status})`)
  }

  return (await response.json()) as T
}

function accountPage(response: AccountListResponse): [AccountId, string][] {
  const accounts = response.data?.accounts
  if (!Array.isArray(accounts)) {
    throw new Error('Abstract registry returned an invalid account list')
  }

  return accounts.map((entry) => {
    if (
      !Array.isArray(entry) ||
      entry.length !== 2 ||
      entry[0] === null ||
      typeof entry[0] !== 'object' ||
      typeof entry[1] !== 'string'
    ) {
      throw new Error('Abstract registry returned an invalid account entry')
    }

    return [entry[0] as AccountId, entry[1]]
  })
}

function isDirectMonarchyOwner(response: OwnershipResponse, walletAddress: string) {
  return response.data?.owner?.monarchy?.monarch === walletAddress
}

async function discover(
  walletAddress: string,
  network: Network,
  signal?: AbortSignal,
): Promise<AbstractAccountIdentity[]> {
  if (network.abstractRegistry === null) {
    if (!network.selectable) {
      return []
    }
    throw new Error('The selected network has no Abstract registry')
  }

  const identities: AbstractAccountIdentity[] = []
  let startAfter: AccountId | null = null

  while (true) {
    const page = accountPage(
      await queryContract<AccountListResponse>(
        network.abstractRegistry,
        { account_list: { start_after: startAfter, limit: PAGE_LIMIT } },
        signal,
      ),
    )

    for (const [, address] of page) {
      const ownership = await queryContract<OwnershipResponse>(address, { ownership: {} }, signal)
      if (isDirectMonarchyOwner(ownership, walletAddress)) {
        identities.push({
          address,
          did: toCanonicalDid(address, network.chainId),
          label: 'Anonymous',
        })
      }
    }

    if (page.length < PAGE_LIMIT) {
      return identities
    }

    startAfter = page[page.length - 1]![0]
  }
}

export const browserAbstractAccountClient: AbstractAccountClient = { discover }
