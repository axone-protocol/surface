import {
  encodePubkey,
  isOfflineDirectSigner,
  makeAuthInfoBytes,
  makeSignDoc,
  Registry,
  type EncodeObject,
  type OfflineSigner,
} from '@cosmjs/proto-signing'
import { calculateFee, defaultRegistryTypes, GasPrice } from '@cosmjs/stargate'
import { TxRaw } from 'cosmjs-types/cosmos/tx/v1beta1/tx'
import { MsgInstantiateContract2 } from 'cosmjs-types/cosmwasm/wasm/v1/tx'

import {
  identityRequestLink,
  identityRequestMemo,
  normaliseIdentityRequest,
} from '../domain/identity-request'
import type {
  IdentityRequestClient,
  SubmitIdentityRequest,
} from '../domain/identity-request-client'
import type { WalletProviderId } from '../domain/wallet-connection'

type InjectedWalletProvider = {
  getOfflineSigner(chainId: string): OfflineSigner
  sendTx(chainId: string, transaction: Uint8Array, mode: 'sync'): Promise<Uint8Array>
}

type AccountResponse = {
  account?: unknown
}

const instantiateContract2TypeUrl = '/cosmwasm.wasm.v1.MsgInstantiateContract2'
const signingRegistry = new Registry([
  ...defaultRegistryTypes,
  [instantiateContract2TypeUrl, MsgInstantiateContract2],
])

type BrowserWalletWindow = Window &
  typeof globalThis & {
    keplr?: InjectedWalletProvider
    leap?: InjectedWalletProvider
  }

function walletWindow(): BrowserWalletWindow | undefined {
  return typeof window === 'undefined' ? undefined : (window as BrowserWalletWindow)
}

function providerFor(provider: WalletProviderId): InjectedWalletProvider | undefined {
  return walletWindow()?.[provider]
}

function randomSalt() {
  const salt = new Uint8Array(32)
  crypto.getRandomValues(salt)
  return salt
}

function bytesFromBase64(value: string | Uint8Array) {
  if (value instanceof Uint8Array) {
    return value
  }

  const binary = atob(value)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

function base64FromBytes(value: string | Uint8Array) {
  if (typeof value === 'string') {
    return value
  }

  let binary = ''
  for (const byte of value) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary)
}

function baseAccount(account: unknown): { account_number: string; sequence: string } | undefined {
  if (!account || typeof account !== 'object') {
    return undefined
  }

  const candidate = account as Record<string, unknown>
  const nested = candidate.base_account ?? candidate.base_vesting_account
  if (nested) {
    return baseAccount(nested)
  }

  if (typeof candidate.account_number === 'string' && typeof candidate.sequence === 'string') {
    return { account_number: candidate.account_number, sequence: candidate.sequence }
  }
}

async function fetchAccount(api: string, address: string) {
  const response = await fetch(`${api}/cosmos/auth/v1beta1/accounts/${address}`, {
    headers: { accept: 'application/json' },
  })
  if (response.status === 404) {
    throw new Error('No account exists for this wallet on the selected network.')
  }
  if (!response.ok) {
    throw new Error('Could not load the wallet account from the selected network.')
  }

  const account = baseAccount(((await response.json()) as AccountResponse).account)
  if (!account) {
    throw new Error('The selected network returned an unsupported wallet account.')
  }
  return account
}

function instantiateMessage(
  request: SubmitIdentityRequest,
  name: string,
  description: string,
): EncodeObject {
  return {
    typeUrl: instantiateContract2TypeUrl,
    value: MsgInstantiateContract2.fromPartial({
      sender: request.sender,
      admin: request.network.abstractAccountAdmin!,
      codeId: BigInt(request.network.abstractAccountCodeId!),
      label: 'Abstract Account',
      msg: new TextEncoder().encode(
        JSON.stringify({
          code_id: request.network.abstractAccountCodeId!,
          owner: { monarchy: { monarch: request.sender } },
          account_id: null,
          authenticator: null,
          namespace: null,
          install_modules: [],
          name,
          description,
          link: identityRequestLink,
        }),
      ),
      funds: [],
      salt: randomSalt(),
      fixMsg: false,
    }),
  }
}

async function signTransaction(
  signer: OfflineSigner,
  request: SubmitIdentityRequest,
  message: EncodeObject,
  accountNumber: string,
  sequence: string,
  gasLimit: number,
) {
  const account = (await signer.getAccounts()).find((entry) => entry.address === request.sender)
  if (!account || !isOfflineDirectSigner(signer)) {
    throw new Error('The connected wallet no longer controls the selected address.')
  }

  const fee = calculateFee(gasLimit, GasPrice.fromString(request.network.gasPrice!))
  const bodyBytes = signingRegistry.encodeTxBody({ messages: [message], memo: identityRequestMemo })
  const authInfoBytes = makeAuthInfoBytes(
    [
      {
        pubkey: encodePubkey({
          type: 'tendermint/PubKeySecp256k1',
          value: base64FromBytes(account.pubkey as Uint8Array | string),
        }),
        sequence: BigInt(sequence),
      },
    ],
    fee.amount,
    Number(fee.gas),
    undefined,
    undefined,
  )
  const signDoc = makeSignDoc(
    bodyBytes,
    authInfoBytes,
    request.network.chainId,
    Number(accountNumber),
  )
  const signed = await signer.signDirect(request.sender, signDoc)
  return TxRaw.encode({
    bodyBytes: bytesFromBase64(signed.signed.bodyBytes as Uint8Array | string),
    authInfoBytes: bytesFromBase64(signed.signed.authInfoBytes as Uint8Array | string),
    signatures: [bytesFromBase64(signed.signature.signature as Uint8Array | string)],
  }).finish()
}

function transactionHash(transaction: Uint8Array) {
  return Array.from(transaction, (byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()
}

function assertSubmissionNetwork(request: SubmitIdentityRequest) {
  const { network } = request
  if (
    !network.api ||
    !network.gasPrice ||
    network.identityRequestGasLimit === null ||
    network.abstractAccountCodeId === null ||
    !network.abstractAccountAdmin
  ) {
    throw new Error('Identity creation is not configured for the selected network.')
  }
}

export const browserIdentityRequestClient: IdentityRequestClient = {
  async submit(request) {
    assertSubmissionNetwork(request)
    const wallet = providerFor(request.provider)
    if (!wallet) {
      throw new Error('Wallet connection is no longer available. Connect again to continue.')
    }

    const { name, description } = normaliseIdentityRequest(request)
    const { network } = request
    const signer = wallet.getOfflineSigner(network.chainId)
    const account = await fetchAccount(network.api!, request.sender)
    const message = instantiateMessage(request, name, description)
    const transaction = await signTransaction(
      signer,
      request,
      message,
      account.account_number,
      account.sequence,
      network.identityRequestGasLimit!,
    )
    const transactionHashBytes = await wallet.sendTx(network.chainId, transaction, 'sync')
    return { transactionHash: transactionHash(transactionHashBytes) }
  },
}
