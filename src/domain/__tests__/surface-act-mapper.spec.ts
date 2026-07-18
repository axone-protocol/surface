import { describe, expect, it } from 'vitest'

import {
  dedupeSurfaceActs,
  mapTxToSurfaceActs,
  moduleAdministratorsFromInstallations,
  moduleContractAddresses,
  sortSurfaceActs,
} from '../surface-act-mapper'
import { surfaceActKindCategories } from '../surface-act'

const abstractAccountAddress =
  'axone1lfcc2yt3gmd3xspw5yxsl3r9qyuumuya6hur2gnejgmafyrapmkqhg7gd5'
const compactAbstractAccountDid = 'did:pkh:…cosmos1lfc…pk2un3'
const dendriteChainId = 'axone-dendrite-2'
const credentialIssuerDid =
  'did:pkh:cosmos:axone-dendrite-2:cosmos1s7uksna4686k27cg6gneqltxx4yjsscs3p7ztvvned6j2thjjthstexh8c'
const compactCredentialIssuerDid = 'did:pkh:…cosmos1s7u…texh8c'
const credentialSubjectDid =
  'did:pkh:cosmos:axone-dendrite-2:cosmos1lfcc2yt3gmd3xspw5yxsl3r9qyuumuya6hur2gnejgmafyrapmkqpk2un3'
const compactCredentialSubjectDid = 'did:pkh:…cosmos1lfc…pk2un3'

describe('surface-act-mapper', () => {
  it('maps on-chain sources to the specified assertions', () => {
    const instantiateTx = {
      height: '10',
      txhash: 'TX-INST',
      timestamp: '2026-07-09T12:00:00Z',
      tx: {
        body: {
          messages: [
            {
              '@type': '/cosmwasm.wasm.v1.MsgInstantiateContract2',
              sender: 'axone1sender',
              code_id: '7',
            },
          ],
        },
      },
      events: [
        {
          type: 'instantiate',
          attributes: [
            { key: '_contract_address', value: abstractAccountAddress },
            { key: 'msg_index', value: '0' },
          ],
        },
        {
          type: 'wasm-abstract',
          attributes: [
            { key: 'contract', value: 'abstract:account' },
            { key: 'action', value: 'instantiate' },
            { key: '_contract_address', value: abstractAccountAddress },
            { key: 'msg_index', value: '0' },
          ],
        },
      ],
    }

    const makeExecuteTx = (
      txhash: string,
      attributes: Array<{ key: string; value: string }>,
      message: Record<string, unknown> = {},
    ) => ({
      height: '11',
      txhash,
      timestamp: '2026-07-09 12:01 UTC',
      tx: {
        body: {
          messages: [
            {
              '@type': '/cosmwasm.wasm.v1.MsgExecuteContract',
              sender: 'axone1sender',
              ...message,
            },
          ],
        },
      },
      events: [
        {
          type: 'wasm-abstract',
          attributes,
        },
      ],
    })

    const administrators = new Map([
      ['axone1govmodule', abstractAccountAddress],
      ['axone1vcmodule', abstractAccountAddress],
    ])
    const cases = [
      {
        tx: instantiateTx,
        kind: 'identity.created',
        assertion: `Identity created for ${compactAbstractAccountDid}.`,
      },
      {
        tx: {
          ...makeExecuteTx('TX-GOV-INSTALL', [
            { key: 'contract', value: 'abstract:account' },
            { key: 'action', value: 'install_modules' },
            { key: 'installed_modules', value: '["axone:axone-gov:1.0.0"]' },
            { key: 'msg_index', value: '0' },
            { key: '_contract_address', value: abstractAccountAddress },
          ]),
          events: [
            {
              type: 'wasm-abstract',
              attributes: [
                { key: 'contract', value: 'abstract:account' },
                { key: 'action', value: 'install_modules' },
                { key: 'installed_modules', value: '["axone:axone-gov:1.0.0"]' },
                { key: 'msg_index', value: '0' },
                { key: '_contract_address', value: abstractAccountAddress },
              ],
            },
            {
              type: 'wasm-abstract',
              attributes: [
                { key: 'contract', value: 'axone:axone-gov' },
                { key: 'action', value: 'instantiate' },
                { key: 'msg_index', value: '0' },
                { key: '_contract_address', value: 'axone1govmodule' },
              ],
            },
          ],
        },
        kind: 'governance.instantiated',
        assertion: `Governance established on ${compactAbstractAccountDid}.`,
      },
      {
        tx: makeExecuteTx('TX-VC-INSTALL', [
          { key: 'contract', value: 'abstract:account' },
          { key: 'action', value: 'install_modules' },
          { key: 'installed_modules', value: '["axone:axone-vc:0.1.0"]' },
          { key: 'msg_index', value: '0' },
          { key: '_contract_address', value: abstractAccountAddress },
        ]),
        kind: 'credential.authority.instantiated',
        assertion: `Credential authority established on ${compactAbstractAccountDid}.`,
      },
      {
        tx: makeExecuteTx('TX-REC', [
          { key: 'contract', value: 'axone:axone-gov' },
          { key: 'action', value: 'record_decision' },
          { key: 'decision_id', value: '1' },
          { key: 'verdict', value: 'gov:permitted' },
          { key: 'msg_index', value: '0' },
          { key: '_contract_address', value: 'axone1govmodule' },
        ]),
        kind: 'governance.decision.recorded',
        assertion: `Decision recorded by ${compactAbstractAccountDid}.`,
      },
      {
        tx: makeExecuteTx('TX-REV', [
          { key: 'contract', value: 'axone:axone-gov' },
          { key: 'action', value: 'revise_constitution' },
          { key: 'constitution_hash', value: 'hash-2' },
          { key: 'constitution_revision', value: '8' },
          { key: 'msg_index', value: '0' },
          { key: '_contract_address', value: 'axone1govmodule' },
        ]),
        kind: 'governance.constitution.revised',
        assertion: `Governance amended on ${compactAbstractAccountDid}.`,
      },
      {
        tx: makeExecuteTx(
          'TX-ISS',
          [
            { key: 'contract', value: 'axone:axone-vc' },
            { key: 'action', value: 'issue_credential' },
            { key: 'identifier', value: 'cred-1' },
            { key: 'credential_type', value: 'membership' },
            { key: 'valid_from', value: '2026-07-09T12:00:00Z' },
            { key: 'valid_until', value: '2026-12-31T23:59:59Z' },
            { key: 'msg_index', value: '0' },
            { key: '_contract_address', value: 'axone1vcmodule' },
          ],
          {
            msg: {
              module: {
                issue_credential: {
                  credential: btoa(
                    `<urn:credential> <https://www.w3.org/2018/credentials#issuer> <${credentialIssuerDid}> .\n<urn:credential> <https://www.w3.org/2018/credentials#credentialSubject> <urn:axone:testnet:subject:gh29632273325a1-1> .`,
                  ),
                },
              },
            },
          },
        ),
        kind: 'credential.issued',
        assertion: `Credential issued by ${compactCredentialIssuerDid} to urn:axone:testnet:subject:gh29632273325a1-1.`,
      },
      {
        tx: makeExecuteTx('TX-ISS-DID', [
          { key: 'contract', value: 'axone:axone-vc' },
          { key: 'action', value: 'issue_credential' },
          { key: 'issuer', value: credentialIssuerDid },
          { key: 'subject', value: credentialSubjectDid },
          { key: 'msg_index', value: '0' },
          { key: '_contract_address', value: 'axone1vcmodule' },
        ]),
        kind: 'credential.issued',
        assertion: `Credential issued by ${compactCredentialIssuerDid} to ${compactCredentialSubjectDid}.`,
      },
      {
        tx: makeExecuteTx('TX-REVK', [
          { key: 'contract', value: 'axone:axone-vc' },
          { key: 'action', value: 'revoke_credential' },
          { key: 'identifier', value: 'cred-1' },
          { key: 'revoked_at', value: '2026-07-09T13:00:00Z' },
          { key: 'msg_index', value: '0' },
          { key: '_contract_address', value: 'axone1vcmodule' },
        ]),
        kind: 'credential.revoked',
        assertion: `Credential revoked by ${compactAbstractAccountDid}.`,
      },
    ] as const

    for (const testCase of cases) {
      const acts = mapTxToSurfaceActs(testCase.tx as never, dendriteChainId, administrators)

      expect(acts).toHaveLength(1)
      expect(acts[0]?.kind).toBe(testCase.kind)
      expect(acts[0]?.assertion).toBe(testCase.assertion)
    }

    const verdict = mapTxToSurfaceActs(cases[3].tx as never, dendriteChainId, administrators)[0]!
    expect(surfaceActKindCategories[verdict.kind]).toBe('VERDICT')
    expect(verdict.payload.verdict).toBe('gov:permitted')
    expect(verdict.assertion).not.toContain('record_decision')
    expect(verdict.assertion).not.toContain('gov:permitted')
  })

  it('rejects unrelated contract instantiation and module events without an AA owner', () => {
    expect(
      mapTxToSurfaceActs({
        tx: { body: { messages: [{ '@type': '/cosmwasm.wasm.v1.MsgInstantiateContract2' }] } },
        events: [
          {
            type: 'instantiate',
            attributes: [{ key: '_contract_address', value: 'axone1unrelated' }],
          },
        ],
      }, dendriteChainId),
    ).toEqual([])

    expect(
      mapTxToSurfaceActs({
        tx: {
          body: {
            messages: [{ '@type': '/cosmwasm.wasm.v1.MsgExecuteContract' }],
          },
        },
        events: [
          {
            type: 'wasm-abstract',
            attributes: [
              { key: 'contract', value: 'axone:axone-gov' },
              { key: 'action', value: 'record_decision' },
              { key: '_contract_address', value: 'axone1govmodule' },
              { key: 'msg_index', value: '0' },
            ],
          },
        ],
      }, dendriteChainId),
    ).toEqual([])

    expect(
      mapTxToSurfaceActs(
        {
          tx: {
            body: {
              messages: [{ '@type': '/cosmwasm.wasm.v1.MsgInstantiateContract2' }],
            },
          },
          events: [
            {
              type: 'instantiate',
              attributes: [{ key: '_contract_address', value: 'not-an-address' }],
            },
            {
              type: 'wasm-abstract',
              attributes: [
                { key: 'contract', value: 'abstract:account' },
                { key: 'action', value: 'instantiate' },
                { key: '_contract_address', value: 'not-an-address' },
                { key: 'msg_index', value: '0' },
              ],
            },
          ],
        },
        dendriteChainId,
      ),
    ).toEqual([])
  })


  it('derives module owners from installation transactions before querying contracts', () => {
    const installation = {
      events: [
        {
          type: 'wasm-abstract',
          attributes: [
            { key: 'contract', value: 'abstract:account' },
            { key: 'action', value: 'install_modules' },
            { key: '_contract_address', value: 'axone1account' },
            { key: 'msg_index', value: '0' },
          ],
        },
        {
          type: 'wasm-abstract',
          attributes: [
            { key: 'contract', value: 'axone:axone-gov' },
            { key: 'action', value: 'instantiate' },
            { key: '_contract_address', value: 'axone1govmodule' },
            { key: 'msg_index', value: '0' },
          ],
        },
        {
          type: 'wasm-abstract',
          attributes: [
            { key: 'contract', value: 'axone:axone-vc' },
            { key: 'action', value: 'instantiate' },
            { key: '_contract_address', value: 'axone1vcmodule' },
            { key: 'msg_index', value: '0' },
          ],
        },
      ],
    }

    expect(moduleAdministratorsFromInstallations([installation])).toEqual(
      new Map([
        ['axone1govmodule', 'axone1account'],
        ['axone1vcmodule', 'axone1account'],
      ]),
    )
    expect(moduleContractAddresses([installation])).toEqual([])
    expect(
      moduleContractAddresses([
        {
          events: [
            {
              type: 'wasm-abstract',
              attributes: [
                { key: 'contract', value: 'axone:axone-gov' },
                { key: 'action', value: 'record_decision' },
                { key: '_contract_address', value: 'axone1govmodule' },
              ],
            },
          ],
        },
      ]),
    ).toEqual(['axone1govmodule'])
  })

  it('dedupes and sorts acts by chain order', () => {
    const deduped = dedupeSurfaceActs([
      {
        id: 'b',
        kind: 'identity.created',
        txhash: 'b',
        msgIndex: 0,
        actIndex: 0,
        height: 3,
        timestamp: '2026-07-09T12:00:00Z',
        title: 'IDENTITY CREATED',
        description: '',
        assertion: '',
        payload: {},
      },
      {
        id: 'a',
        kind: 'identity.created',
        txhash: 'a',
        msgIndex: 0,
        actIndex: 0,
        height: 5,
        timestamp: '2026-07-09T12:00:00Z',
        title: 'IDENTITY CREATED',
        description: '',
        assertion: '',
        payload: {},
      },
      {
        id: 'a',
        kind: 'identity.created',
        txhash: 'a',
        msgIndex: 0,
        actIndex: 0,
        height: 5,
        timestamp: '2026-07-09T12:00:00Z',
        title: 'IDENTITY CREATED',
        description: '',
        assertion: '',
        payload: {},
      },
    ])

    const sorted = sortSurfaceActs(deduped)

    expect(sorted.map((act) => act.id)).toEqual(['a', 'b'])
  })
})
