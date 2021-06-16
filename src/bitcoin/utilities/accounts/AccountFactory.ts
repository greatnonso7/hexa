import { networks } from 'bitcoinjs-lib'
import { Account } from '../Interface'
import crypto from 'crypto'
import AccountUtilities from './AccountUtilities'

export function generateAccount(
  {
    walletId,
    accountName,
    accountDescription,
    xpub,
    network
  }: {
    accountName: string,
    accountDescription: string,
    walletId: string,
    xpub: string,
    network: networks.Network,
  }
): Account {

  const id = crypto.createHash( 'sha256' ).update( xpub ).digest( 'hex' )
  const initialRecevingAddress = AccountUtilities.getAddressByIndex( xpub, false, 0, network )

  const account: Account = {
    id,
    walletId,
    network,
    xpub,
    accountName,
    accountDescription,
    activeAddresses: [],
    receivingAddress: initialRecevingAddress,
    nextFreeAddressIndex: 0,
    nextFreeChangeAddressIndex: 0,
    confirmedUTXOs: [],
    unconfirmedUTXOs: [],
    balances: {
      balance: 0,
      unconfirmedBalance: 0,
    },
    transactions: [],
    lastSynched: 0,
    addressQueryList: {
      external: {
      },
      internal: {
      }
    }
  }

  return account
}


export function generateTwoFAAccount(
  {
    walletId,
    accountName,
    accountDescription,
    xpubs,
    network
  }: {
    accountName: string,
    accountDescription: string,
    walletId: string,
    xpubs: {
      primary: string,
      secondary: string,
      bithyve: string,
    },
    network: networks.Network,
  }
): Account {

  const id = crypto.createHash( 'sha256' ).update( xpubs.secondary ).digest( 'hex' )
  const initialRecevingAddress = AccountUtilities.createMultiSig( [ xpubs.primary, xpubs.secondary, xpubs.bithyve ], 2, network, 0, false ).address

  const account: Account = {
    id,
    walletId,
    network,
    is2FA: true,
    xpubs,
    accountName,
    accountDescription,
    activeAddresses: [],
    receivingAddress: initialRecevingAddress,
    nextFreeAddressIndex: 0,
    nextFreeChangeAddressIndex: 0,
    confirmedUTXOs: [],
    unconfirmedUTXOs: [],
    balances: {
      balance: 0,
      unconfirmedBalance: 0,
    },
    transactions: [],
    lastSynched: 0,
    addressQueryList: {
      external: {
      },
      internal: {
      }
    }
  }

  return account
}


