import { call, put, select } from 'redux-saga/effects'
import {
  createWatcher,
} from '../utils/utilities'
import * as bip39 from 'bip39'
import {
  INIT_HEALTH_SETUP,
  UPDATE_SHARES_HEALTH,
  updateLevelTwoMetaShareStatus,
  updateLevelThreeMetaShareStatus,
  INIT_LEVEL_TWO,
  initLevelTwo,
  isLevel2InitializedStatus,
  updateMSharesHealth,
  updatedKeeperInfo,
  walletRecoveryFailed,
  RECOVER_WALLET_USING_ICLOUD,
  RECOVER_WALLET_HEALTH,
  CLOUD_MSHARE,
  switchS3LoaderKeeper,
  isLevel3InitializedStatus,
  RECOVER_MNEMONIC_HEALTH,
  mnemonicRecoveredHealth,
  GET_PDF_DATA,
  setPDFInfo,
  SHARE_PDF,
  CONFIRM_PDF_SHARED,
  KEEPER_INFO,
  putKeeperInfo,
  UPDATE_WALLET_IMAGE_HEALTH,
  EMPTY_SHARE_TRANSFER_DETAILS,
  DELETE_SM_AND_SMSHARES,
  AUTO_SHARE_LEVEL2_KEEPER,
  pdfSuccessfullyCreated,
  SET_LEVEL_TO_NOT_SETUP,
  setIsLevelToNotSetupStatus,
  SET_HEALTH_STATUS,
  MODIFY_LEVELDATA,
  updateLevelData,
  setChannelAssets,
  CREATE_CHANNEL_ASSETS,
  setApprovalStatus,
  DOWNLOAD_SM_SHARE,
  secondaryShareDownloaded,
  CREATE_OR_CHANGE_GUARDIAN,
  setDownloadedBackupData,
  DOWNLOAD_BACKUP_DATA,
  SETUP_HEALTH_FOR_RESTORE,
  UPDATE_KEEPER_INFO_TO_CHANNEL,
  setIsKeeperInfoUpdated,
  ACCEPT_EC_REQUEST,
  SETUP_PASSWORD,
  initializeHealthSetup,
  SETUP_LEVEL_HEALTH,
  GENERATE_LEVEL1_SHARES,
  GENERATE_LEVEL2_SHARES,
  RETRIEVE_METASHRES,
  setLevelCompletionError,
  navigateToHistoryPage,
  generateMetaShare,
  setIsKeeperTypeBottomSheetOpen,
  ON_PRESS_KEEPER
} from '../actions/BHR'
import { updateHealth } from '../actions/BHR'
import {
  switchS3LoadingStatus,
  healthCheckInitialized,
  GENERATE_META_SHARE,
} from '../actions/BHR'
import { NativeModules, Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import DeviceInfo from 'react-native-device-info'
import config from '../../bitcoin/HexaConfig'
import {
  BackupStreamData,
  INotification,
  KeeperInfoInterface,
  LevelData,
  LevelHealthInterface,
  LevelInfo,
  MetaShare,
  notificationTag,
  notificationType,
  PrimaryStreamData,
  QRCodeTypes,
  SecondaryStreamData,
  StreamData,
  TrustedContact,
  TrustedContactRelationTypes,
  Trusted_Contacts,
  UnecryptedStreamData,
  Wallet,
  NewWalletImage,
  cloudDataInterface
} from '../../bitcoin/utilities/Interface'
import moment from 'moment'
import crypto from 'crypto'
import generatePDFKeeper from '../utils/generatePDFKeeper'
import { generateRandomString } from '../../common/CommonFunctions'
import Mailer from 'react-native-mail'
import Share from 'react-native-share'
import RNPrint from 'react-native-print'
import idx from 'idx'
import { restoreAccountShells } from '../actions/accounts'
import { getVersions } from '../../common/utilities'
import { checkLevelHealth, getLevelInfoStatus, getModifiedData } from '../../common/utilities'
import { ChannelAssets } from '../../bitcoin/utilities/Interface'
import useStreamFromContact from '../../utils/hooks/trusted-contacts/UseStreamFromContact'
import { initializeTrustedContact, InitTrustedContactFlowKind, PermanentChannelsSyncKind, restoreTrustedContacts, syncPermanentChannels } from '../actions/trustedContacts'
import { syncPermanentChannelsWorker } from './trustedContacts'
import TrustedContactsOperations from '../../bitcoin/utilities/TrustedContactsOperations'
import Relay from '../../bitcoin/utilities/Relay'
import { updateWallet } from '../actions/storage'
import dbManager from '../../storage/realm/dbManager'
import { setWalletId } from '../actions/preferences'
import BHROperations from '../../bitcoin/utilities/BHROperations'
import LevelStatus from '../../common/data/enums/LevelStatus'

function* initHealthWorker() {
  const levelHealth: LevelHealthInterface[] = yield select( ( state ) => state.bhr.levelHealth )
  const wallet: Wallet = yield select(
    ( state ) => state.storage.wallet
  )
  const { security } = wallet
  if ( levelHealth && levelHealth.length ) return
  yield put( switchS3LoaderKeeper( 'initLoader' ) )
  const randomIdForSecurityQ = generateRandomString( 8 )
  const randomIdForCloud = generateRandomString( 8 )
  const levelInfo = [
    {
      shareType: 'securityQuestion',
      updatedAt: security && security.answer ? moment( new Date() ).valueOf() : 0,
      status: security && security.answer ? 'accessible' : 'notSetup',
      shareId: randomIdForSecurityQ,
      reshareVersion: 0,
      name: security && security.answer ? 'Encryption Password' : 'Set Password',
    },
    {
      shareType: 'cloud',
      updatedAt: 0,
      status: 'notSetup',
      shareId: randomIdForCloud,
      reshareVersion: 0,
    },
  ]
  const obj: KeeperInfoInterface = {
    shareId: randomIdForSecurityQ,
    name: security && security.answer ? 'Encryption Password' : 'Set Password',
    type: 'securityQuestion',
    scheme: '1of1',
    currentLevel: 0,
    createdAt: moment( new Date() ).valueOf(),
    sharePosition: null,
    data: {
    }
  }
  yield put( updatedKeeperInfo( obj ) )
  // Update status
  yield put( healthCheckInitialized() )
  // Update Initial Health to reducer
  yield put( updateHealth( [ {
    level: 1,
    levelInfo: levelInfo,
  } ], 0, '' ) )
  yield put( switchS3LoaderKeeper( 'initLoader' ) )
  yield call( modifyLevelDataWorker )
}

export const initHealthWatcher = createWatcher(
  initHealthWorker,
  INIT_HEALTH_SETUP
)

function* generateMetaSharesWorker( { payload } ) {
  yield put( switchS3LoaderKeeper( 'generateMetaShareStatus' ) )
  const version = DeviceInfo.getVersion()
  const { level, SM, isUpgrade } = payload
  const wallet: Wallet = yield select( ( state ) => state.storage.wallet )
  const secondaryMnemonic = SM && SM ? SM : wallet.secondaryMnemonic ? wallet.secondaryMnemonic : ''

  const secureAssets = {
    secondaryMnemonic: secondaryMnemonic,
    twoFASecret: '',
    secondaryXpub: '',
    bhXpub: wallet.details2FA && wallet.details2FA.bithyveXpub ? wallet.details2FA.bithyveXpub : '',
  }

  const res = yield call(
    level == 2 ? generateLevel1SharesWorker : generateLevel2SharesWorker,
    {
      payload: {
        level, secureAssets, version
      }
    }
  )
  yield put( switchS3LoaderKeeper( 'generateMetaShareStatus' ) )
}

export const generateMetaSharesWatcher = createWatcher(
  generateMetaSharesWorker,
  GENERATE_META_SHARE
)

function* generateLevel1SharesWorker( { payload } ){
  const { level, secureAssets, version } = payload
  const wallet: Wallet = yield select( ( state ) => state.storage.wallet )
  const existingMetaShares: MetaShare[] = yield select( ( state ) => state.storage.wallet )
  const { shares, smShares } = BHROperations.generateLevel1Shares( wallet.primaryMnemonic, wallet.secondaryMnemonic )
  const { encryptedPrimarySecrets, keeperShareIDs, encryptedSecondarySecrets } = BHROperations.encryptShares( shares, wallet.security.answer, smShares )
  const { metaShares, oldMetaShares } = BHROperations.createMetaSharesKeeper( wallet.walletId, encryptedPrimarySecrets, encryptedSecondarySecrets, existingMetaShares, wallet.security.answer, secureAssets.bhXpub, wallet.walletName, wallet.security.questionId, version, wallet.security.question, level )
  console.log( 'generateLevel1SharesWorker metaShares', metaShares )
  if ( metaShares ) {
    console.log( 'generateLevel1SharesWorker encryptedSecondarySecrets', encryptedSecondarySecrets )
    dbManager.updateWallet( {
      smShare: encryptedSecondarySecrets[ 0 ] ? encryptedSecondarySecrets[ 0 ] : ''
    } )
    dbManager.updateS3Services( {
      encryptedSecretsKeeper: encryptedPrimarySecrets,
      metaSharesKeeper: metaShares,
      encryptedSMSecretsKeeper: encryptedSecondarySecrets,
      oldMetaSharesKeeper: []
    } )
    if ( level == 2 ) {
      const isLevel2Initialized = yield select( ( state ) => state.bhr.isLevel2Initialized )
      if ( !isLevel2Initialized ) {
        yield put( updateLevelTwoMetaShareStatus( true ) )
        // if( isUpgrade ) yield put( initLevels( level ) ) else
        yield put( initLevelTwo( level ) )
      }
    }
  } else {
    throw new Error( 'Error' )
  }

}

export const generateLevel1SharesWatcher = createWatcher(
  generateLevel1SharesWorker,
  GENERATE_LEVEL1_SHARES
)

function* generateLevel2SharesWorker( { payload } ){
  const { level, secureAssets, version } = payload
  const wallet: Wallet = yield select( ( state ) => state.storage.wallet )
  // const walletDB = yield call( dbManager.getWallet )
  const s3 = yield call( dbManager.getS3Services )
  console.log( 's3', Array.from( s3 ) )
  const existingMetaShares: MetaShare[] = [ ...s3.metaSharesKeeper ]
  const existingEncryptedSecondarySecrets: string[] = [ ...s3.encryptedSMSecretsKeeper ]
  const { shares } = BHROperations.generateLevel2Shares( existingMetaShares, wallet.security.answer )
  const { encryptedPrimarySecrets, encryptedSecondarySecrets } = BHROperations.encryptShares( shares, wallet.security.answer )
  const { metaShares } = BHROperations.createMetaSharesKeeper( wallet.walletId, encryptedPrimarySecrets, encryptedSecondarySecrets, existingMetaShares, wallet.security.answer,  secureAssets.bhXpub, wallet.walletName, wallet.security.questionId, version, wallet.security.question, level )
  if ( metaShares ) {
    dbManager.updateS3Services( {
      encryptedSecretsKeeper: encryptedPrimarySecrets,
      metaSharesKeeper: metaShares,
      encryptedSMSecretsKeeper: existingEncryptedSecondarySecrets,
      oldMetaSharesKeeper: existingMetaShares
    } )
    if ( level == 3 ) {
      const isLevel3Initialized = yield select( ( state ) => state.bhr.isLevel3Initialized )
      if ( !isLevel3Initialized ) {
        yield put( updateLevelThreeMetaShareStatus( true ) )
        // if( isUpgrade ) yield put( initLevels( level ) ) else
        yield put( initLevelTwo( level ) )
      }
    }

    // TODO: => Save metaShares, smMetaShares, oldMetaShares, encryptedSecondarySecrets
  } else {
    throw new Error( 'ERROR' )
  }
}

export const generateLevel2SharesWatcher = createWatcher(
  generateLevel2SharesWorker,
  GENERATE_LEVEL2_SHARES
)

function* updateSharesHealthWorker( { payload } ) {
  console.log( 'UPDATE SHARE started', payload )
  // // set a timelapse for auto update and enable instantaneous manual update
  try {
    yield put( switchS3LoaderKeeper( 'updateMSharesHealth' ) )
    payload.shares
    let currentLevel = yield select( ( state ) => state.bhr.currentLevel )
    const levelHealth: LevelHealthInterface[] = yield select( ( state ) => state.bhr.levelHealth )
    for ( let i = 0; i < levelHealth.length; i++ ) {
      const levelInfo = levelHealth[ i ].levelInfo
      for ( let j = 0; j < levelInfo.length; j++ ) {
        const element = levelInfo[ j ]
        if( element.shareId === payload.shares.shareId ){
          levelHealth[ i ].levelInfo[ j ].updatedAt = payload.shares.updatedAt ? moment( new Date() ).valueOf() : levelHealth[ i ].levelInfo[ j ].updatedAt
          levelHealth[ i ].levelInfo[ j ].name = payload.shares.name ? payload.shares.name : levelHealth[ i ].levelInfo[ j ].name ? levelHealth[ i ].levelInfo[ j ].name : ''
          levelHealth[ i ].levelInfo[ j ].reshareVersion = payload.shares.reshareVersion ? payload.shares.reshareVersion : levelHealth[ i ].levelInfo[ j ].reshareVersion ? levelHealth[ i ].levelInfo[ j ].reshareVersion : 0
          levelHealth[ i ].levelInfo[ j ].shareType = payload.shares.shareType ? payload.shares.shareType : levelHealth[ i ].levelInfo[ j ].shareType ? levelHealth[ i ].levelInfo[ j ].shareType : ''
          if( payload.shares.status ){
            levelHealth[ i ].levelInfo[ j ].status = payload.shares.status
          }
          break
        }
      }
    }
    const tempLevelHealth = []
    const levelHealthForCurrentLevel = []
    levelHealthForCurrentLevel[ 0 ] = levelHealth[ 0 ]
    if( levelHealth[ 0 ] && levelHealth[ 1 ] ) {
      if( levelHealth[ 1 ].levelInfo.findIndex( value=>value.updatedAt == 0 ) == -1 ) {
        tempLevelHealth[ 0 ] = levelHealth[ 1 ]
        levelHealthForCurrentLevel[ 0 ] = levelHealth[ 1 ]
      }
    }
    if( levelHealthForCurrentLevel[ 0 ].levelInfo.findIndex( value=>value.updatedAt == 0 ) == -1 ) {
      if( levelHealthForCurrentLevel[ 0 ].levelInfo.length == 6 ) currentLevel = 3
      else if( levelHealthForCurrentLevel[ 0 ].levelInfo.length == 4 ) currentLevel = 2
      else currentLevel = 1
    }

    yield put(
      updateHealth(
        tempLevelHealth.length ? tempLevelHealth : levelHealth,
        currentLevel,
        'updateSharesHealthWatcher'
      )
    )
    yield put( switchS3LoaderKeeper( 'updateMSharesHealth' ) )
  } catch ( error ) {
    yield put( switchS3LoaderKeeper( 'updateMSharesHealth' ) )
    console.log( 'inside UPDATE_SHARES_HEALTH', error )
  }
}

export const updateSharesHealthWatcher = createWatcher(
  updateSharesHealthWorker,
  UPDATE_SHARES_HEALTH
)

function* updateHealthLevel2Worker( { payload } ) {
  const { level } = payload
  let isLevelInitialized = yield select(
    ( state ) => state.bhr.isLevel3Initialized
  )
  if ( level == 2 ) {
    isLevelInitialized = yield select(
      ( state ) => state.bhr.isLevel2Initialized
    )
  }
  if ( !isLevelInitialized ) {
    yield put( switchS3LoaderKeeper( 'initLoader' ) )
    const s3 = yield call( dbManager.getS3Services )
    const metaShares: MetaShare[] = [ ...s3.metaSharesKeeper ]
    const Health: LevelHealthInterface[] = yield select( ( state ) => state.bhr.levelHealth )
    const currentLevel = yield select( ( state ) => state.bhr.currentLevel )
    const wallet: Wallet = yield select(
      ( state ) => state.storage.wallet
    )
    const { security } = wallet
    const levelHealth: LevelHealthInterface[] = [ ...Health ]
    console.log( 'INIT_LEVEL_TWO levelHealth', levelHealth )
    let SecurityQuestionHealth
    const randomIdForSecurityQ = generateRandomString( 8 )
    if( Health[ 0 ] && Health[ 0 ].levelInfo && Health[ 0 ].levelInfo[ 0 ] ){
      SecurityQuestionHealth = {
        ...Health[ 0 ].levelInfo[ 0 ], shareId: randomIdForSecurityQ,
      }
    }
    else {
      SecurityQuestionHealth = {
        shareType: 'securityQuestion',
        updatedAt: security && security.answer ? moment( new Date() ).valueOf() : 0,
        status: security && security.answer ? 'accessible' : 'notSetup',
        shareId: randomIdForSecurityQ,
        reshareVersion: 0,
        name: security && security.answer ? 'Encryption Password' : 'Set Password',
      }
    }
    const levelInfo = []
    levelInfo[ 1 ] = {
      shareType: 'cloud',
      updatedAt: 0,
      status: 'notSetup',
      shareId: metaShares[ 0 ].shareId,
      reshareVersion: 0,
    }
    levelInfo[ 0 ] = SecurityQuestionHealth
    for ( let i = 1; i < metaShares.length; i++ ) {
      const element = metaShares[ i ]
      let shareType = ''
      if ( i == 1 ) shareType = 'cloud'
      const obj = {
        shareType: shareType,
        updatedAt: 0,
        status: 'notSetup',
        shareId: element.shareId,
        reshareVersion: 0,
      }
      levelInfo.push( obj )
    }
    levelHealth.push( {
      levelInfo, level
    } )
    console.log( 'INIT_LEVEL_TWO levelHealth', levelHealth )
    yield put( updateHealth( levelHealth, currentLevel, 'updateHealthLevel2Watcher' ) )
    if ( level == 2 ) yield put( isLevel2InitializedStatus() )
    if ( level == 3 ) yield put( isLevel3InitializedStatus() )
    yield put( switchS3LoaderKeeper( 'initLoader' ) )
  }
}

export const updateHealthLevel2Watcher = createWatcher(
  updateHealthLevel2Worker,
  INIT_LEVEL_TWO
)

const sha256 = crypto.createHash( 'sha256' )
const hash = ( element ) => {
  return sha256.update( JSON.stringify( element ) ).digest( 'hex' )
}

function* recoverWalletFromIcloudWorker( { payload } ) {
  try {
    yield put( switchS3LoadingStatus( 'restoreWallet' ) )
    const { icloudData, selectedBackup, answer }: { icloudData: NewWalletImage, selectedBackup: cloudDataInterface, answer: string } = payload
    console.log( 'payload.icloudData', payload.icloudData )
    console.log( 'payload.selectedBackup', payload.selectedBackup )
    console.log( 'payload.answer', payload.answer )
    const primaryMnemonic = BHROperations.decryptWithAnswer ( selectedBackup.seed, answer ).decryptedData
    const secondaryMnemonics = BHROperations.decryptWithAnswer ( selectedBackup.secondaryShare, answer ).decryptedData
    const image: NewWalletImage = icloudData
    yield call( recoverWalletWorker, {
      payload: {
        level: selectedBackup.levelStatus, answer, selectedBackup, image, primaryMnemonic, secondaryMnemonics
      }
    } )
    yield put( switchS3LoadingStatus( 'restoreWallet' ) )
  } catch ( err ) {
    yield put( switchS3LoadingStatus( 'restoreWallet' ) )
    console.log( {
      err: err.message
    } )
    yield put( walletRecoveryFailed( true ) )
    // Alert.alert('Wallet recovery failed!', err.message);
  }
  yield put( switchS3LoadingStatus( 'restoreWallet' ) )
}

export const recoverWalletFromIcloudWatcher = createWatcher(
  recoverWalletFromIcloudWorker,
  RECOVER_WALLET_USING_ICLOUD
)

function* recoverWalletWorker( { payload } ) {
  yield put( switchS3LoadingStatus( 'restoreWallet' ) )
  let { level, answer, selectedBackup, image, primaryMnemonic, secondaryMnemonics, shares }: { level: number, answer: string, selectedBackup: cloudDataInterface, image: NewWalletImage, primaryMnemonic?: string, secondaryMnemonics?: string, shares?: {
    primaryData?: PrimaryStreamData;
    backupData?: BackupStreamData;
    secondaryData?: SecondaryStreamData;
  }[] } = payload
  try {
    if( shares ){
      const pmShares = []
      const smShares = []
      for ( let i = 0; i < shares.length; i++ ) {
        const element = shares[ i ]
        pmShares.push( element.backupData.primaryMnemonicShard.encryptedShare.pmShare )
        smShares.push( element.secondaryData.secondaryMnemonicShard )
      }
      secondaryMnemonics = BHROperations.getMnemonics( smShares, answer ).mnemonic
      primaryMnemonic = BHROperations.getMnemonics( pmShares, answer, true ).mnemonic
    }

    const getWI = yield call( BHROperations.fetchWalletImage, image.walletId )
    if( getWI.status == 200 ) {
      image = getWI.data.walletImage
    }
    const contactsChannelKeys = image.contacts
    const accounts = image.accounts
    const acc = []
    const accountData = {
    }
    const decKey = BHROperations.getDerivedKey(
      bip39.mnemonicToSeedSync( primaryMnemonic ).toString( 'hex' ),
    )
    Object.keys( accounts ).forEach( ( key ) => {
      const decipher = crypto.createDecipheriv(
        BHROperations.cipherSpec.algorithm,
        decKey,
        BHROperations.cipherSpec.iv,
      )
      const account = accounts[ key ]
      let decryptedAccData = decipher.update( account.encryptedData, 'hex', 'utf8' )
      decryptedAccData += decipher.final( 'utf8' )
      accountData[ JSON.parse( decryptedAccData ).type ] = JSON.parse( decryptedAccData ).id
      acc.push( JSON.parse( decryptedAccData ) )
    } )
    // Update Wallet
    const wallet: Wallet = {
      walletId: image.walletId,
      walletName: image.name,
      security: {
        question: selectedBackup.question,
        questionId: selectedBackup.questionId,
        answer: answer
      },
      primaryMnemonic: primaryMnemonic,
      accounts: accountData,
      version: DeviceInfo.getVersion(),
      secondaryMnemonic: secondaryMnemonics,
    }
    yield put( updateWallet( wallet ) )
    yield put( setWalletId( wallet.walletId ) )
    yield call( dbManager.createWallet, wallet )
    // restore Accounts
    yield put( restoreAccountShells( acc ) )
    // restore health
    yield call( setupLevelHealthWorker, {
      payload: {
        level: level, keeperInfo: JSON.parse( selectedBackup.keeperData )
      }
    } )
    // restore Contacts
    yield put( restoreTrustedContacts( {
      walletId: wallet.walletId, channelKeys: contactsChannelKeys
    } ) )

    yield put( switchS3LoadingStatus( 'restoreWallet' ) )
  } catch ( err ) {
    console.log( err )
    yield put( switchS3LoadingStatus( 'restoreWallet' ) )
    yield put( walletRecoveryFailed( true ) )
  }
}

export const recoverWalletHealthWatcher = createWatcher(
  recoverWalletWorker,
  RECOVER_WALLET_HEALTH
)

export function* cloudMetaShareWorker( { payload } ) {
  yield put( switchS3LoadingStatus( 'downloadMetaShare' ) )

  const { metaShare } = payload

  const { DECENTRALIZED_BACKUP } = yield select(
    ( state ) => state.storage.database
  )

  let updatedBackup
  console.log( 'PAYLOAD', payload )
  let updatedRecoveryShares = {
  }
  const updated = false

  if ( payload.replaceIndex === 0 || payload.replaceIndex ) {
    // replacing stored key w/ scanned from Guardian's help-restore
    updatedRecoveryShares = {
      ...DECENTRALIZED_BACKUP.RECOVERY_SHARES,
      [ payload.replaceIndex ]: {
        //REQUEST_DETAILS: { KEY: encryptedKey },
        META_SHARE: metaShare,
        //ENC_DYNAMIC_NONPMDD: encryptedDynamicNonPMDD,
      },
    }
  }

  updatedBackup = {
    ...DECENTRALIZED_BACKUP,
    RECOVERY_SHARES: updatedRecoveryShares,
  }

  let InsertDBData
  // if(payload.walletImage.SERVICES){
  //   InsertDBData = { DECENTRALIZED_BACKUP: updatedBackup, SERVICES: payload.walletImage.SERVICES}
  // }
  // else{
  InsertDBData = {
    DECENTRALIZED_BACKUP: updatedBackup
  }
  // }

  // yield call( insertDBWorker, {
  //   payload: InsertDBData,
  // } )

  yield put( switchS3LoadingStatus( 'downloadMetaShare' ) )
}

export const cloudMetaShareHealthWatcher = createWatcher(
  cloudMetaShareWorker,
  CLOUD_MSHARE
)


function* stateDataToBackup() {
  // state data to backup
  const accountShells = yield select( ( state ) => state.accounts.accountShells )
  // const trustedContactsInfo = yield select( ( state ) => state.trustedContacts.trustedContactsInfo )
  const activePersonalNode = yield select( ( state ) => state.nodeSettings.activePersonalNode )

  const versionHistory = yield select(
    ( ( state ) => idx( state, ( _ ) => _.versionHistory.versions ) )
  )
  const restoreVersions = yield select(
    ( ( state ) => idx( state, ( _ ) => _.versionHistory.restoreVersions ) ) )

  const versions = getVersions( versionHistory, restoreVersions )

  const STATE_DATA = {
  }

  if ( accountShells && accountShells.length )
    STATE_DATA[ 'accountShells' ] = JSON.stringify( accountShells )

  // if ( trustedContactsInfo && trustedContactsInfo.length )
  //   STATE_DATA[ 'trustedContactsInfo' ] = JSON.stringify( trustedContactsInfo )

  if ( activePersonalNode )
    STATE_DATA[ 'activePersonalNode' ] = JSON.stringify( activePersonalNode )

  if ( versions && versions.length )
    STATE_DATA[ 'versionHistory' ] = JSON.stringify( versions )

  return STATE_DATA
}

const asyncDataToBackup = async () => {
  const [
    [ , personalCopyDetails ],
    [ , FBTCAccount ],
    [ , PersonalNode ]
  ] = await AsyncStorage.multiGet( [
    'personalCopyDetails',
    'FBTCAccount',
    'PersonalNode'
  ] )
  const ASYNC_DATA = {
  }

  if ( personalCopyDetails )
    ASYNC_DATA[ 'personalCopyDetails' ] = personalCopyDetails
  if ( FBTCAccount ) ASYNC_DATA[ 'FBTCAccount' ] = FBTCAccount
  if ( PersonalNode ) ASYNC_DATA[ 'PersonalNode' ] = PersonalNode

  return ASYNC_DATA
}

function* updateWalletImageWorker() {
  //console.log( 'Update Wallet Image' )
  yield put( switchS3LoadingStatus( 'updateWIStatus' ) )
  const wallet = yield call( dbManager.getWallet )
  const contacts = yield call( dbManager.getTrustedContacts )
  const accounts = yield call( dbManager.getAccounts )
  const encKey = BHROperations.getDerivedKey(
    bip39.mnemonicToSeedSync( wallet.primaryMnemonic ).toString( 'hex' ),
  )
  const acc = {
  }
  accounts.forEach( account => {
    const cipher = crypto.createCipheriv(
      BHROperations.cipherSpec.algorithm,
      encKey,
      BHROperations.cipherSpec.iv,
    )
    let encrypted = cipher.update(
      JSON.stringify( account ),
      'utf8',
      'hex',
    )
    encrypted += cipher.final( 'hex' )
    acc[ account.id ] = {
      encryptedData: encrypted
    }
  } )
  const channelIds = []
  contacts.forEach( contact => {
    channelIds.push( contact.channelKey )
  } )
  const STATE_DATA = yield call( stateDataToBackup )
  const image : NewWalletImage = {
    name: wallet.walletName,
    walletId : wallet.walletId,
    contacts : channelIds,
    accounts : acc,
    versionHistory: STATE_DATA.versionHistory,
    SM_share: wallet.smShare,
    details2FA: wallet.details2FA
  }

  const res = yield call( Relay.updateWalletImage, image )
  // const getWI = yield call( BHROperations.fetchWalletImage, wallet.walletId )
  if ( res.status === 200 ) {
    if ( res.data ) console.log( 'Wallet Image updated' )
    yield put( switchS3LoadingStatus( 'updateWIStatus' ) )
    //yield call( AsyncStorage.setItem, 'WI_HASHES', JSON.stringify( hashesWI ) )
  } else {
    console.log( {
      err: res.err
    } )
    yield put( switchS3LoadingStatus( 'updateWIStatus' ) )
    throw new Error( 'Failed to update Wallet Image' )
  }
}

export const updateWalletImageHealthWatcher = createWatcher(
  updateWalletImageWorker,
  UPDATE_WALLET_IMAGE_HEALTH,
)

function* recoverMnemonicHealthWorker( { payload } ) {
  const { securityAns, metaShares, isPrimary } = payload
  // if (metaShares.length !== 3) return;

  const encryptedSecrets: string[] = metaShares.map(
    ( metaShare ) => metaShare.encryptedSecret
  )

  const { mnemonic } = yield call(
    BHROperations.getMnemonics,
    encryptedSecrets,
    securityAns,
    isPrimary
  )
  console.log( 'RECOVER_MNEMONIC_HEALTH mnemonic', mnemonic )
  if ( mnemonic ) {
    // TODO: recreate accounts and write to database
    yield put( mnemonicRecoveredHealth( mnemonic ) ) // storing in redux state (for demo)
  } else {
    console.log( 'ERROR' )
  }
}

export const recoverMnemonicHealthWatcher = createWatcher(
  recoverMnemonicHealthWorker,
  RECOVER_MNEMONIC_HEALTH
)

function* getPDFDataWorker( { payload } ) {
  try {
    const { shareId, Contact, channelKey } = payload
    yield put( switchS3LoaderKeeper( 'pdfDataProcess' ) )
    const contacts: Trusted_Contacts = yield select(
      ( state ) => state.trustedContacts.contacts
    )
    const appVersion = DeviceInfo.getVersion()
    const pdfInfo: {
      filePath: string;
      shareId: string;
      updatedAt: number;
    } = yield select( ( state ) => state.bhr.pdfInfo )
    const wallet: Wallet = yield select( ( state ) => state.storage.wallet )
    const walletId = wallet.walletId
    let pdfPath = pdfInfo.filePath
    let currentContact: TrustedContact
    let channelKeyFromCH: string

    if( contacts )
      for( const ck of Object.keys( contacts ) ){
        if ( contacts[ ck ].contactDetails.id === Contact.id ){
          currentContact = contacts[ ck ]
          channelKeyFromCH = ck
          break
        }
      }
    if( channelKeyFromCH && channelKeyFromCH == channelKey && currentContact ) {
      const recoveryData = {
        type: QRCodeTypes.RECOVERY_REQUEST,
        walletName: wallet.walletName,
        channelId: currentContact.permanentChannelAddress,
        streamId: TrustedContactsOperations.getStreamId( walletId ),
        channelKey: channelKey,
        secondaryChannelKey: currentContact.secondaryChannelKey,
        version: appVersion,
        walletId,
        encryptedKey: BHROperations.encryptWithAnswer(
          shareId,
          wallet.security.answer
        ).encryptedData,
      }
      const secondaryData = {
        type: QRCodeTypes.RECOVERY_REQUEST,
        walletName: wallet.walletName,
        channelId: currentContact.permanentChannelAddress,
        streamId: TrustedContactsOperations.getStreamId( walletId ),
        secondaryChannelKey: currentContact.secondaryChannelKey,
        version: appVersion,
        walletId
      }

      const qrData = [
        JSON.stringify( recoveryData ),
        JSON.stringify( secondaryData ),
      ]
      console.log( 'PDF recoveryData', JSON.stringify( recoveryData ) )
      const pdfData = {
        qrData: qrData,
      }
      pdfPath = yield call(
        generatePDFKeeper,
        pdfData,
        `Hexa_Recovery_Key_${wallet.walletName}.pdf`,
        `Hexa Recovery Key for ${wallet.walletName}'s Wallet`
      )
      yield put( setPDFInfo( {
        filePath: pdfPath, updatedAt: moment( new Date() ).valueOf(), shareId
      } ) )
    }

    yield put( pdfSuccessfullyCreated( true ) )
    yield put( switchS3LoaderKeeper( 'pdfDataProcess' ) )
  } catch ( error ) {
    yield put( switchS3LoaderKeeper( 'pdfDataProcess' ) )
    yield put( pdfSuccessfullyCreated( false ) )
    console.log( 'Error EF channel', error )
  }
}

export const getPDFDataWatcher = createWatcher( getPDFDataWorker, GET_PDF_DATA )

function* sharePDFWorker( { payload } ) {
  yield put( switchS3LoaderKeeper( 'pdfShare' ) )
  const { shareVia, isEmailOtherOptions } = payload
  const pdfInfo: {
    filePath: string;
    publicKey: string;
    privateKey: string;
  } = yield select( ( state ) => state.bhr.pdfInfo )
  try {
    console.log( 'pdfInfo', pdfInfo )
    if ( !pdfInfo.filePath ) throw new Error( 'Personal copy not found/generated' )

    const { security, walletName } = yield select(
      ( state ) => state.storage.wallet
    )

    switch ( shareVia ) {
        case 'Email':
          if ( !isEmailOtherOptions ) {
            yield call(
              Mailer.mail,
              {
                subject: 'Recovery Key  '+walletName,
                body: `<b>A Personal Copy of one of your Recovery Keys is attached as a pdf. The answer to your security question (${security.question}) is used to password protect the PDF.</b>`,
                isHTML: true,
                attachments: [ {
                  path:
                  Platform.OS == 'android'
                    ? pdfInfo.filePath
                    : pdfInfo.filePath, // The absolute path of the file from which to read data.
                  type: 'pdf', // Mime Type: jpg, png, doc, ppt, html, pdf, csv
                  name: 'Recovery Key  '+walletName, // Optional: Custom filename for attachment
                } ],
              },
              ( err, event ) => {
                console.log( {
                  event, err
                } )
              // on delayed error (rollback the changes that happened post switch case)
              }
            )
          } else {
            const shareOptions = {
              title: 'Recovery Key  '+walletName,
              message: `A Personal Copy of one of your Recovery Keys is attached as a pdf. The answer to your security question (${security.question}) is used to password protect the PDF.`,
              url:
              Platform.OS == 'android'
                ? 'file://' + pdfInfo.filePath
                : pdfInfo.filePath,
              type: 'application/pdf',
              showAppsToView: true,
              subject: 'Recovery Key  '+walletName,
            }

            try {
              yield call( Share.open, shareOptions )
            } catch ( err ) {
              const errorMessage = idx( err, ( _ ) => _.message )
              if ( errorMessage !== 'User did not share' ) {
                throw new Error( `Share failed: ${err}` )
              }
            }
          }
          break

        case 'Print':
          const pdfDecr = {
            path: pdfInfo.filePath,
            filename: 'PersonalCopy2.pdf',
            password: security.answer,
          }
          if ( Platform.OS == 'android' ) {
            const PdfPassword = yield NativeModules.PdfPassword
            yield call(
              PdfPassword.print,
              JSON.stringify( pdfDecr ),
              ( err: any ) => {
                console.log( {
                  err
                } )
              // on delayed error (rollback the changes that happened post switch case)
              },
              async ( res: any ) => {
                await RNPrint.print( {
                  filePath: 'file://' + res,
                } )
                console.log( {
                  res
                } )
              }
            )
          } else {
            try {
              yield call( RNPrint.print, {
                filePath: pdfInfo.filePath,
              } )
            } catch ( err ) {
              console.log( err )
              throw new Error( `Print failed: ${err}` )
            }
          }
          break

        case 'Other':
          const shareOptions = {
            title: 'Recovery Key  '+walletName,
            message: `A Personal Copy of one of your Recovery Keys is attached as a pdf. The answer to your security question (${security.question}) is used to password protect the PDF.`,
            url:
            Platform.OS == 'android'
              ? 'file://' + pdfInfo.filePath
              : pdfInfo.filePath,
            type: 'application/pdf',
            showAppsToView: true,
            subject: 'Recovery Key  '+walletName,
          }

          try {
            yield call( Share.open, shareOptions )
          } catch ( err ) {
            const errorMessage = idx( err, ( _ ) => _.message )
            if ( errorMessage !== 'User did not share' ) {
              throw new Error( `Share failed: ${err}` )
            }
          }
          break

        default:
          throw new Error( 'Invalid sharing option' )
    }

    yield put( switchS3LoaderKeeper( 'pdfShare' ) )
  } catch ( err ) {
    console.log( {
      err
    } )
    yield put( switchS3LoaderKeeper( 'pdfShare' ) )
  }
}

export const sharePDFWatcher = createWatcher( sharePDFWorker, SHARE_PDF )

function* confirmPDFSharedWorker( { payload } ) {
  try {
    yield put( switchS3LoaderKeeper( 'pdfDataConfirm' ) )
    const { shareId, scannedData } = payload
    const wallet: Wallet = yield select( ( state ) => state.storage.wallet )
    const s3 = yield call( dbManager.getS3Services )
    const metaShare: MetaShare[] = [ ...s3.metaSharesKeeper ]
    const walletId = wallet.walletId
    const answer = yield select( ( state ) => state.storage.wallet.security.answer )
    let shareIndex = 3
    if ( shareId && metaShare.length &&  metaShare.findIndex( ( value ) => value.shareId == shareId ) > -1 ) {
      shareIndex = metaShare.findIndex( ( value ) => value.shareId == shareId )
    }

    const scannedObj:  {
      type: string,
      walletName: string,
      channelId: string,
      streamId: string,
      channelKey: string,
      channelKey2: string,
      version: string,
      encryptedKey: string,
    } = JSON.parse( scannedData )
    const decryptedData = BHROperations.decryptWithAnswer( scannedObj.encryptedKey, answer ).decryptedData
    if( decryptedData == shareId ){
      const shareObj = {
        walletId: walletId,
        shareId: shareId,
        reshareVersion: metaShare[ shareIndex ].meta.reshareVersion,
        updatedAt: moment( new Date() ).valueOf(),
        name: 'Personal Copy',
        shareType: 'pdf',
        status: 'accessible',
      }
      yield put( updateMSharesHealth( shareObj, false ) )
    }
    yield put( switchS3LoaderKeeper( 'pdfDataConfirm' ) )
  } catch ( error ) {
    yield put( switchS3LoaderKeeper( 'pdfDataConfirm' ) )
    console.log( 'Error EF channel', error )
  }
}

export const confirmPDFSharedWatcher = createWatcher(
  confirmPDFSharedWorker,
  CONFIRM_PDF_SHARED
)

function* updatedKeeperInfoWorker( { payload } ) {
  try {
    const { keeperData } = payload
    const keeperInfo: KeeperInfoInterface[] = [ ...yield select( ( state ) => state.bhr.keeperInfo ) ]
    if( keeperInfo && keeperInfo.length > 0 ) {
      if( keeperInfo.find( value=>value && value.shareId == keeperData.shareId ) && keeperInfo.find( value=>value && value.shareId == keeperData.shareId ).type == 'pdf' && keeperData.type != 'pdf' ) yield put( setPDFInfo( {
        filePath: '', updatedAt: 0, shareId: ''
      } ) )
    }
    let flag = false
    if ( keeperInfo.length > 0 ) {
      for ( let i = 0; i < keeperInfo.length; i++ ) {
        const element = keeperInfo[ i ]
        if ( element.shareId == keeperData.shareId ) {
          flag = false
          keeperInfo[ i ].name = keeperData.name
          keeperInfo[ i ].scheme = keeperData.scheme
          keeperInfo[ i ].currentLevel = keeperData.currentLevel
          keeperInfo[ i ].createdAt = keeperData.createdAt
          keeperInfo[ i ].type = keeperData.type
          keeperInfo[ i ].data = keeperData.data
          keeperInfo[ i ].sharePosition = keeperData.sharePosition
          keeperInfo[ i ].channelKey = keeperData.channelKey
          break
        } else flag = true
      }
    } else flag = true
    if ( flag ) {
      keeperInfo.push( keeperData )
    }
    yield put( putKeeperInfo( keeperInfo ) )
  } catch ( error ) {
    console.log( 'Error updatedKeeperInfoWorker', error )
  }
}

export const updatedKeeperInfoWatcher = createWatcher(
  updatedKeeperInfoWorker,
  KEEPER_INFO
)

function* emptyShareTransferDetailsForContactChangeWorker( { payload } ) {
  // const { index } = payload
  // const { DECENTRALIZED_BACKUP } = yield select( ( state ) => state.storage.database )
  // const shareTransferDetails = {
  //   ...DECENTRALIZED_BACKUP.SHARES_TRANSFER_DETAILS,
  // }
  // delete shareTransferDetails[ index ]
  // const updatedBackup = {
  //   ...DECENTRALIZED_BACKUP,
  //   SHARES_TRANSFER_DETAILS: shareTransferDetails,
  // }
  // yield call( insertDBWorker, {
  //   payload: {
  //     DECENTRALIZED_BACKUP: updatedBackup,
  //   },
  // } )
}

export const emptyShareTransferDetailsForContactChangeWatcher = createWatcher(
  emptyShareTransferDetailsForContactChangeWorker,
  EMPTY_SHARE_TRANSFER_DETAILS
)

function* deletePrivateDataWorker() {
  // try {
  //   // Transfer: Guardian >>> User
  //   // const s3Service: S3Service = yield select( ( state ) => state.bhr.service )
  //   // const s3ServiceSecure: SecureAccount = yield select(
  //   //   ( state ) => state.accounts[ SECURE_ACCOUNT ].service
  //   // )
  //   // // Delete Sm shares and Primary Mnemonics
  //   // s3Service.deletePrivateData()

  //   // // Delete Sm
  //   // s3ServiceSecure.deleteSecondaryMnemonics()

  //   // const { SERVICES } = yield select( ( state ) => state.storage.database )
  //   // const updatedSERVICES = {
  //   //   ...SERVICES,
  //   //   SECURE_ACCOUNT: JSON.stringify( s3ServiceSecure ),
  //   //   S3_SERVICE: JSON.stringify( s3Service ),
  //   // }
  //   // yield call( insertDBWorker, {
  //   //   payload: {
  //   //     SERVICES: updatedSERVICES
  //   //   }
  //   // } )
  // } catch ( error ) {
  //   console.log( 'RECOVERY error', error )
  // }
}

export const deletePrivateDataWatcher = createWatcher(
  deletePrivateDataWorker,
  DELETE_SM_AND_SMSHARES,
)

function* autoShareLevel2KeepersWorker( ) {
  try {
    console.log( 'AUTO SHARE LEVEL 2 STARTED' )
    const currentLevel = yield select( ( state ) => state.bhr.currentLevel )
    const keeperInfo: KeeperInfoInterface[] = yield select( ( state ) => state.bhr.keeperInfo )
    const levelHealth: LevelHealthInterface[] = yield select( ( state ) => state.bhr.levelHealth )
    const Contacts: Trusted_Contacts = yield select( ( state ) => state.trustedContacts.contacts )
    const s3 = yield call( dbManager.getS3Services )
    const MetaShares: MetaShare[] = [ ...s3.metaSharesKeeper ]
    const { walletName, walletId }: Wallet = yield select( ( state ) => state.storage.wallet )
    const shareIds = []
    if( levelHealth[ 1 ] && levelHealth[ 1 ].levelInfo.length == 6 ) {
      for ( let i = 2; i < levelHealth[ 1 ].levelInfo.length - 2; i++ ) {
        const channelKey = keeperInfo.find( value=>value.shareId == levelHealth[ 0 ].levelInfo[ i ].shareId ).channelKey
        const obj: KeeperInfoInterface = {
          shareId: levelHealth[ 1 ].levelInfo[ i ].shareId,
          name: levelHealth[ 0 ].levelInfo[ i ].name,
          type: levelHealth[ 0 ].levelInfo[ i ].shareType,
          scheme: MetaShares.find( value=>value.shareId == levelHealth[ 1 ].levelInfo[ i ].shareId ).meta.scheme,
          currentLevel: currentLevel,
          createdAt: moment( new Date() ).valueOf(),
          sharePosition: MetaShares.findIndex( value=>value.shareId == levelHealth[ 1 ].levelInfo[ i ].shareId ),
          data: keeperInfo.find( value=>value.shareId == levelHealth[ 0 ].levelInfo[ i ].shareId ).data,
          channelKey
        }
        yield put( updatedKeeperInfo( obj ) )

        const contactInfo = {
          channelKey: keeperInfo.find( value=>value.shareId == levelHealth[ 0 ].levelInfo[ i ].shareId ).channelKey,
        }

        const primaryData: PrimaryStreamData = {
          contactDetails: Contacts[ channelKey ].contactDetails,
          walletID: walletId,
          walletName,
          relationType: TrustedContactRelationTypes.KEEPER,
        }
        const backupData: BackupStreamData = {
          primaryMnemonicShard: {
            ...MetaShares.find( value=>value.shareId == levelHealth[ 1 ].levelInfo[ i ].shareId ),
            encryptedShare: {
              pmShare: MetaShares.find( value=>value.shareId == levelHealth[ 1 ].levelInfo[ i ].shareId ).encryptedShare.pmShare,
              smShare: '',
              bhXpub: '',
            }
          },
          keeperInfo
        }
        const streamUpdates: UnecryptedStreamData = {
          streamId: TrustedContactsOperations.getStreamId( walletId ),
          primaryData,
          backupData,
          metaData: {
            flags:{
              active: true,
              newData: true,
              lastSeen: Date.now(),
            },
            version: DeviceInfo.getVersion()
          }
        }
        // initiate permanent channel
        const channelUpdate =  {
          contactInfo, streamUpdates
        }
        shareIds.push( obj )
        const { updated, updatedContacts }: {
          updated: boolean;
          updatedContacts: Trusted_Contacts
        } = yield call(
          TrustedContactsOperations.syncPermanentChannels,
          [ {
            channelKey: contactInfo.channelKey,
            streamId: streamUpdates.streamId,
            contactDetails: Contacts[ channelKey ].contactDetails,
            unEncryptedOutstreamUpdates: streamUpdates,
          } ]
        )
        if ( updated ) {
          const shareObj = {
            walletId: walletId,
            shareId: obj.shareId,
            reshareVersion: MetaShares.find( value=>value.shareId == obj.shareId ).meta.reshareVersion,
            updatedAt: moment( new Date() ).valueOf(),
            status: 'accessible',
            name: obj.name,
            shareType: obj.type
          }
          yield put( updateMSharesHealth( shareObj, false ) )
        }
      }
    }
    yield put( switchS3LoaderKeeper( 'autoShareKeepersData' ) )
  } catch ( error ) {
    yield put( switchS3LoaderKeeper( 'autoShareKeepersData' ) )
    console.log( 'Error autoShareLevel2KeepersWorker', error )
  }
}

export const autoShareLevel2KeepersWatcher = createWatcher(
  autoShareLevel2KeepersWorker,
  AUTO_SHARE_LEVEL2_KEEPER
)

function* setLevelToNotSetupStatusWorker( ) {
  try {
    yield put( switchS3LoaderKeeper( 'setToBaseStatus' ) )
    const currentLevel = yield select( ( state ) => state.bhr.currentLevel )
    const levelHealth: LevelHealthInterface[] = yield select( ( state ) => state.bhr.levelHealth )
    const s3 = yield call( dbManager.getS3Services )
    const wallet = yield call( dbManager.getWallet )
    const metaShares: MetaShare[] = [ ...s3.metaSharesKeeper ]
    let toDelete:LevelInfo[]
    const shareArray = []
    if( currentLevel > 0 ) {
      if( currentLevel == 1 && metaShares.length == 3 && levelHealth[ 1 ] ) {
        toDelete = levelHealth[ 1 ].levelInfo
      }
      if( currentLevel == 2 && metaShares.length == 5 && levelHealth[ 2 ] ) {
        toDelete = levelHealth[ 2 ].levelInfo
      }
    }
    if( toDelete ){
      for ( let i = 0; i < toDelete.length; i++ ) {
        const element = toDelete[ i ]
        if( i != 1 ){
          shareArray.push( {
            walletId: wallet.walletId,
            shareId: element.shareId,
            reshareVersion: element.reshareVersion,
            updatedAt: 0,
            status: 'notAccessible',
            shareType: '',
            name: ''
          } )
        }
      }
    }
    if( shareArray.length ) {
      yield put( updateMSharesHealth( shareArray, false ) )
      yield put( setIsLevelToNotSetupStatus( true ) )
      if ( shareArray.length == 3 ){
        yield put( updateLevelTwoMetaShareStatus( true ) )
        yield put( isLevel2InitializedStatus() )
      }
      if ( shareArray.length == 5 ) {
        yield put( updateLevelThreeMetaShareStatus( true ) )
        yield put( isLevel3InitializedStatus() )
        yield put( updateLevelTwoMetaShareStatus( true ) )
        yield put( isLevel2InitializedStatus() )
      }
    }
    yield put( switchS3LoaderKeeper( 'setToBaseStatus' ) )
  } catch ( error ) {
    yield put( switchS3LoaderKeeper( 'setToBaseStatus' ) )
    console.log( 'Error EF channel', error )
  }
}

export const setLevelToNotSetupStatusWatcher = createWatcher(
  setLevelToNotSetupStatusWorker,
  SET_LEVEL_TO_NOT_SETUP
)

function* setHealthStatusWorker( ) {
  try {
    yield put( switchS3LoaderKeeper( 'healthExpiryStatus' ) )
    const currentLevel = yield select( ( state ) => state.bhr.currentLevel )
    const levelHealth: LevelHealthInterface[] = yield select( ( state ) => state.bhr.levelHealth )
    const wallet: Wallet = yield select( ( state ) => state.storage.wallet )
    const TIME_SLOTS = config.HEALTH_STATUS.TIME_SLOTS
    const shareArray = []
    if( currentLevel && levelHealth[ 0 ] && levelHealth[ 0 ].levelInfo ){
      const element = levelHealth[ 0 ]
      for ( let i = 0; i < element.levelInfo.length; i++ ) {
        const element2 = element.levelInfo[ i ]
        if( element2.updatedAt > 0 && element2.status == 'accessible' ) {
          const delta = Math.abs( Date.now() - element2.updatedAt )
          const minutes = Math.round( delta / ( 60 * 1000 ) )
          if ( minutes > TIME_SLOTS.SHARE_SLOT2 && element2.shareType != 'cloud' ) {
            levelHealth[ 0 ].levelInfo[ i ].status = 'notAccessible'
            shareArray.push( {
              walletId: wallet.walletId,
              shareId: element2.shareId,
              reshareVersion: element2.reshareVersion,
              status: 'notAccessible',
            } )
          }
        }
      }
    }

    if( shareArray.length ){
      yield put( updateMSharesHealth( shareArray, true ) )
    }
    yield put( switchS3LoaderKeeper( 'healthExpiryStatus' ) )
  } catch ( error ) {
    yield put( switchS3LoaderKeeper( 'healthExpiryStatus' ) )
    console.log( 'Error EF channel', error )
  }
}

export const setHealthStatusWatcher = createWatcher(
  setHealthStatusWorker,
  SET_HEALTH_STATUS
)

function* createChannelAssetsWorker( { payload } ) {
  try {
    const { shareId } = payload
    const s3 = yield call( dbManager.getS3Services )
    const MetaShares: MetaShare[] = [ ...s3.metaSharesKeeper ]
    const encryptedSecondaryShares: string[] = s3.encryptedSMSecretsKeeper
    if( MetaShares && MetaShares.length ){
      yield put( switchS3LoaderKeeper( 'createChannelAssetsStatus' ) )
      const keeperInfo: KeeperInfoInterface[] = yield select( ( state ) => state.bhr.keeperInfo )
      const secondaryShareDownloadedVar = yield select( ( state ) => state.bhr.secondaryShareDownloaded )
      const wallet: Wallet = yield select(
        ( state ) => state.storage.wallet
      )
      let secondaryShare: string = encryptedSecondaryShares && encryptedSecondaryShares.length &&  encryptedSecondaryShares[ 1 ] ? encryptedSecondaryShares[ 1 ] : ''
      if( secondaryShareDownloadedVar ) {
        secondaryShare = secondaryShareDownloadedVar
      }
      const channelAssets: ChannelAssets = {
        primaryMnemonicShard: {
          ...MetaShares.find( value=>value.shareId==shareId ),
          encryptedShare: {
            pmShare: MetaShares.find( value=>value.shareId==shareId ).encryptedShare.pmShare,
            smShare: '',
            bhXpub: '',
          }
        },
        secondaryMnemonicShard: secondaryShare,
        keeperInfo: keeperInfo,
        bhXpub: wallet.details2FA && wallet.details2FA.bithyveXpub ? wallet.details2FA.bithyveXpub : '',
        shareId
      }
      yield put( setChannelAssets( channelAssets ) )
      yield put( setApprovalStatus( false ) )
      yield put( secondaryShareDownloaded( null ) )
      yield put( switchS3LoaderKeeper( 'createChannelAssetsStatus' ) )
    }
  } catch ( error ) {
    yield put( switchS3LoaderKeeper( 'createChannelAssetsStatus' ) )
    console.log( 'Error EF channel', error )
  }
}

export const createChannelAssetsWatcher = createWatcher(
  createChannelAssetsWorker,
  CREATE_CHANNEL_ASSETS
)

function* downloadSMShareWorker( { payload } ) {
  try {
    yield put( switchS3LoaderKeeper( 'downloadSMShareLoader' ) )
    const { scannedData } = payload
    if( scannedData ) {
      const wallet: Wallet = yield select( ( state ) => state.storage.wallet )
      const walletId = wallet.walletId
      const contacts: Trusted_Contacts = yield select( ( state ) => state.trustedContacts.contacts )
      const qrDataObj = JSON.parse( scannedData )
      let currentContact: TrustedContact
      let channelKey: string
      if( contacts ){
        for( const ck of Object.keys( contacts ) ){
          channelKey=ck
          currentContact = contacts[ ck ]
          if( currentContact.permanentChannelAddress == qrDataObj.channelId ){
            break
          }
        }
      }
      const res = yield call( TrustedContactsOperations.retrieveFromStream, {
        walletId, channelKey, options: {
          retrieveSecondaryData: true,
        }, secondaryChannelKey: qrDataObj.secondaryChannelKey
      } )
      if( res.secondaryData.secondaryMnemonicShard ) {
        console.log( 'res.secondaryData.secondaryMnemonicShard', res.secondaryData.secondaryMnemonicShard )
        yield put( secondaryShareDownloaded( res.secondaryData.secondaryMnemonicShard ) )
        yield put( setApprovalStatus( true ) )
      }
    }

    yield put( switchS3LoaderKeeper( 'downloadSMShareLoader' ) )
  } catch ( error ) {
    yield put( switchS3LoaderKeeper( 'downloadSMShareLoader' ) )
    console.log( 'Error EF channel', error )
  }
}

export const downloadSMShareWatcher = createWatcher(
  downloadSMShareWorker,
  DOWNLOAD_SM_SHARE
)

function* createOrChangeGuardianWorker( { payload: data } ) {
  try {
    const { channelKey, shareId, contact, index, isChange, oldChannelKey, existingContact } = data
    const s3 = yield call( dbManager.getS3Services )
    const MetaShares: MetaShare[] = [ ...s3.metaSharesKeeper ]
    const contactInfo = {
      channelKey,
    }
    const channelUpdate =  {
      contactInfo
    }
    const payload = {
      permanentChannelsSyncKind: PermanentChannelsSyncKind.SUPPLIED_CONTACTS,
      channelUpdates: [ channelUpdate ],
    }
    yield call( syncPermanentChannelsWorker, {
      payload
    } )
    const channelAssets: ChannelAssets = yield select( ( state ) => state.bhr.channelAssets )
    const wallet: Wallet = yield select( ( state ) => state.storage.wallet )
    const keeperInfo: KeeperInfoInterface[] = yield select( ( state ) => state.bhr.keeperInfo )
    const contacts: Trusted_Contacts = yield select( ( state ) => state.trustedContacts.contacts )
    const walletId = wallet.walletId
    const { walletName } = yield select( ( state ) => state.storage.wallet )
    if( MetaShares && MetaShares.length ) {
      yield put( switchS3LoaderKeeper( 'createChannelAssetsStatus' ) )
      if( existingContact ){
        const contactInfo = {
          channelKey: channelKey,
          secondaryChannelKey: BHROperations.generateKey( config.CIPHER_SPEC.keyLength )
        }
        const primaryData: PrimaryStreamData = {
          contactDetails: contacts[ channelKey ].contactDetails,
          walletID: walletId,
          walletName,
          relationType: TrustedContactRelationTypes.KEEPER,
        }
        const secondaryData: SecondaryStreamData = {
          secondaryMnemonicShard: channelAssets.secondaryMnemonicShard,
          bhXpub: channelAssets.bhXpub
        }
        const backupData: BackupStreamData = {
          primaryMnemonicShard: channelAssets.primaryMnemonicShard,
          keeperInfo
        }
        const streamUpdates: UnecryptedStreamData = {
          streamId: TrustedContactsOperations.getStreamId( walletId ),
          primaryData,
          secondaryData,
          backupData,
          metaData: {
            flags:{
              active: true,
              newData: true,
              lastSeen: Date.now(),
            },
            version: DeviceInfo.getVersion()
          }
        }
        // initiate permanent channel
        const channelUpdate =  {
          contactInfo, streamUpdates
        }
        yield put( syncPermanentChannels( {
          permanentChannelsSyncKind: PermanentChannelsSyncKind.SUPPLIED_CONTACTS,
          channelUpdates: [ channelUpdate ],
        } ) )
        const temporaryContact: TrustedContact = contacts[ channelKey ] // temporary trusted contact object
        const instream = useStreamFromContact( temporaryContact, walletId, true )
        const fcmToken: string = idx( instream, ( _ ) => _.primaryData.FCM )
        const notification: INotification = {
          notificationType: notificationType.FNF_KEEPER_REQUEST,
          title: 'Friends and Family Request',
          body: `You have new keeper request ${temporaryContact.contactDetails.contactName}`,
          data: {
            walletName: walletName,
            channelKey: channelKey,
            contactsSecondaryChannelKey: temporaryContact.secondaryChannelKey,
          },
          tag: notificationTag.IMP,
        }
        const notifReceivers = []
        notifReceivers.push( {
          walletId: instream.primaryData.walletID,
          FCMs: [ fcmToken ],
        } )
        if( notifReceivers.length )
          yield call(
            Relay.sendNotifications,
            notifReceivers,
            notification,
          )
      } else {
        yield put( initializeTrustedContact( {
          contact: contact,
          flowKind: InitTrustedContactFlowKind.SETUP_TRUSTED_CONTACT,
          isKeeper: true,
          channelKey: keeperInfo.find( value=>value.shareId == shareId ).channelKey,
          shareId: shareId
        } ) )
      }
      if( isChange ) {
        const contactInfo = {
          channelKey: oldChannelKey,
        }
        const primaryData: PrimaryStreamData = {
          contactDetails: contacts[ oldChannelKey ].contactDetails,
          walletID: walletId,
          walletName,
          relationType: TrustedContactRelationTypes.CONTACT,
        }
        const streamUpdates: UnecryptedStreamData = {
          streamId: TrustedContactsOperations.getStreamId( walletId ),
          primaryData,
          secondaryData: null,
          backupData: null,
          metaData: {
            flags:{
              active: true,
              newData: true,
              lastSeen: Date.now(),
            },
            version: DeviceInfo.getVersion()
          }
        }
        // initiate permanent channel
        const channelUpdate =  {
          contactInfo, streamUpdates
        }
        yield put( syncPermanentChannels( {
          permanentChannelsSyncKind: PermanentChannelsSyncKind.SUPPLIED_CONTACTS,
          channelUpdates: [ channelUpdate ],
        } ) )
      }
      yield put( switchS3LoaderKeeper( 'createChannelAssetsStatus' ) )
    }
  } catch ( error ) {
    yield put( switchS3LoaderKeeper( 'createChannelAssetsStatus' ) )
    console.log( 'Error EF channel', error )
  }
}

export const createOrChangeGuardianWatcher = createWatcher(
  createOrChangeGuardianWorker,
  CREATE_OR_CHANGE_GUARDIAN
)

function* modifyLevelDataWorker( ) {
  try {
    yield put( switchS3LoaderKeeper( 'modifyLevelDataStatus' ) )
    const levelHealth: LevelHealthInterface[] = yield select( ( state ) => state.bhr.levelHealth )
    const currentLevel: number = yield select( ( state ) => state.bhr.currentLevel )
    const keeperInfo: KeeperInfoInterface[] = yield select( ( state ) => state.bhr.keeperInfo )
    let levelData: LevelData[] = yield select( ( state ) => state.bhr.levelData )
    const contacts: Trusted_Contacts = yield select( ( state ) => state.trustedContacts.contacts )
    const wallet: Wallet = yield select( ( state ) => state.storage.wallet )
    let isError = false
    const abc = JSON.stringify( levelHealth )
    const levelHealthVar: LevelHealthInterface[] = [ ...getModifiedData( keeperInfo, JSON.parse( abc ), contacts ) ]
    console.log( 'levelHealthVar', levelHealthVar )
    for ( let i = 0; i < levelHealthVar.length; i++ ) {
      const levelInfo = levelHealthVar[ i ].levelInfo
      for ( let j = 0; j < levelInfo.length; j++ ) {
        const element = levelInfo[ j ]
        const currentContact: TrustedContact = contacts[ element.channelKey ]
        if ( currentContact ) {
          const instream: StreamData = useStreamFromContact( currentContact, wallet.walletId, true )
          console.log( 'instream', instream )
          if( instream ){
            levelInfo[ j ].status = levelInfo[ j ].updatedAt == 0 ? 'notAccessible' : Math.round( Math.abs( Date.now() - instream.metaData.flags.lastSeen ) / ( 60 * 1000 ) ) > config.HEALTH_STATUS.TIME_SLOTS.SHARE_SLOT2 ? 'notAccessible' : 'accessible'
            levelInfo[ j ].updatedAt = instream.metaData.flags.lastSeen
          }
        }
      }
    }
    levelData = checkLevelHealth( levelData, levelHealthVar )
    if ( levelData.findIndex( ( value ) => value.status == 'bad' ) > -1 ) {
      isError = true
    }
    yield put( updateHealth( levelHealthVar, currentLevel, 'modifyLevelDataWatcher' ) )
    const levelDataUpdated = getLevelInfoStatus( levelData, currentLevel )
    yield put ( updateLevelData( levelDataUpdated, isError ) )
    yield put( switchS3LoaderKeeper( 'modifyLevelDataStatus' ) )
  } catch ( error ) {
    yield put( switchS3LoaderKeeper( 'modifyLevelDataStatus' ) )
    console.log( 'Error EF channel', error )
  }
}

export const modifyLevelDataWatcher = createWatcher(
  modifyLevelDataWorker,
  MODIFY_LEVELDATA
)

function* downloadBackupDataWorker( { payload } ) {
  try {
    yield put( switchS3LoaderKeeper( 'downloadBackupDataStatus' ) )
    const { scannedData, backupData } = payload
    const downloadedBackupData: {
      primaryData?: PrimaryStreamData;
      backupData?: BackupStreamData;
      secondaryData?: SecondaryStreamData;
    }[] = [ ...yield select( ( state ) => state.bhr.downloadedBackupData ) ]
    if( backupData ) {
      downloadedBackupData.push( backupData )
    } else {
      const qrDataObj = scannedData
      const res = yield call( TrustedContactsOperations.retrieveFromStream, {
        walletId: qrDataObj.walletId,
        channelKey: qrDataObj.channelKey,
        options: {
          retrievePrimaryData: true,
          retrieveBackupData: true,
          retrieveSecondaryData: true,
        },
        secondaryChannelKey: qrDataObj.secondaryChannelKey
      } )
      console.log( 'res', res )
      downloadedBackupData.push( res )
    }
    yield put( setDownloadedBackupData( downloadedBackupData ) )
    yield put( switchS3LoaderKeeper( 'downloadBackupDataStatus' ) )
  } catch ( error ) {
    yield put( switchS3LoaderKeeper( 'downloadBackupDataStatus' ) )
    console.log( 'Error EF channel', error )
  }
}

export const downloadBackupDataWatcher = createWatcher(
  downloadBackupDataWorker,
  DOWNLOAD_BACKUP_DATA
)

function* setupHealthWorker( { payload } ) {
  const levelHealth: LevelHealthInterface[] = yield select( ( state ) => state.bhr.levelHealth )
  if ( levelHealth && levelHealth.length ) return
  const downloadedBackupData: {
    primaryData?: PrimaryStreamData;
    backupData?: BackupStreamData;
    secondaryData?: SecondaryStreamData;
  }[] = yield select( ( state ) => state.bhr.downloadedBackupData )
  const keeperInfo: KeeperInfoInterface[] = yield select( ( state ) => state.bhr.keeperInfo )
  const initLoader = yield select( ( state ) => state.bhr.loading.initLoader )
  const wallet: Wallet = yield select(
    ( state ) => state.storage.database
  )
  const { security } = wallet
  if( initLoader ) return
  const { level }: { level: number } = payload
  yield put( switchS3LoaderKeeper( 'initLoader' ) )

  const randomIdForSecurityQ = generateRandomString( 8 )
  const randomIdForCloud = generateRandomString( 8 )
  if( level == 1 ){
    const levelInfo = [
      {
        shareType: 'securityQuestion',
        updatedAt: security && security.answer ? moment( new Date() ).valueOf() : 0,
        status: security && security.answer ? 'accessible' : 'notSetup',
        shareId: keeperInfo.find( value=>value.type == 'securityQuestion' ) ? keeperInfo.find( value=>value.type == 'securityQuestion' ).shareId : randomIdForSecurityQ,
        reshareVersion: 0,
        name: security && security.answer ? 'Encryption Password' : 'Set Password',
      },
      {
        shareType: 'cloud',
        updatedAt: moment( new Date() ).valueOf(),
        status: 'accessible',
        shareId: keeperInfo.find( value=>value.type == 'cloud' ) ? keeperInfo.find( value=>value.type == 'cloud' ).shareId : randomIdForCloud,
        reshareVersion: 0,
        name: Platform.OS == 'ios' ? 'iCloud' : 'Google Drive',
      },
    ]
    yield put( updateHealth( [ {
      level: 1,
      levelInfo: levelInfo,
    } ], level, 'setupHealthWatcher' ) )
  } else {
    const s3 = yield call( dbManager.getS3Services )
    const metaShares: MetaShare[] = [ ...s3.metaSharesKeeper ]
    let isLevelInitialized = yield select(
      ( state ) => state.bhr.isLevel3Initialized
    )
    if ( level == 2 ) {
      isLevelInitialized = yield select(
        ( state ) => state.bhr.isLevel2Initialized
      )
    }
    if ( !isLevelInitialized ) {
      const contacts: Trusted_Contacts = yield select( ( state ) => state.trustedContacts.contacts )
      const wallet: Wallet = yield select( ( state ) => state.storage.wallet )
      console.log( 'INIT_LEVEL_TWO levelHealth', levelHealth )

      const levelInfo: LevelInfo[] = [
        {
          shareType: 'securityQuestion',
          updatedAt: security && security.answer ? moment( new Date() ).valueOf() : 0,
          status: security && security.answer ? 'accessible' : 'notSetup',
          shareId: keeperInfo.find( value=>value.type == 'securityQuestion' ) ? keeperInfo.find( value=>value.type == 'securityQuestion' ).shareId : randomIdForSecurityQ,
          reshareVersion: 0,
          name: security && security.answer ? 'Encryption Password' : 'Set Password',
        },
        {
          shareType: 'cloud',
          updatedAt: moment( new Date() ).valueOf(),
          status: downloadedBackupData.find( value=>value.backupData.primaryMnemonicShard.shareId == metaShares[ 0 ].shareId ) ? 'accessible': 'notAccessible',
          shareId: metaShares[ 0 ].shareId,
          reshareVersion: 0,
          name: Platform.OS == 'ios' ? 'iCloud' : 'Google Drive'
        },
      ]

      for ( let i = 1; i < metaShares.length; i++ ) {
        const element = metaShares[ i ]
        const status = 'notAccessible'
        let updatedAt = moment( new Date() ).valueOf()
        const channelKey = keeperInfo.find( value => value.shareId == element.shareId ) ? keeperInfo.find( value => value.shareId == element.shareId ).channelKey : ''
        const currentContact: TrustedContact = contacts[ channelKey ]
        if ( currentContact ) {
          const instream: StreamData = useStreamFromContact( currentContact, wallet.walletId, true )
          if( instream ){
            updatedAt = instream.metaData.flags.lastSeen
          }
        }
        const obj = {
          shareType: keeperInfo.find( value => value.shareId == element.shareId ) ? keeperInfo.find( value => value.shareId == element.shareId ).type : '',
          updatedAt,
          status,
          shareId: element.shareId,
          reshareVersion: 0,
        }
        levelInfo.push( obj )
      }
      levelHealth.push( {
        levelInfo, level
      } )

      console.log( 'INIT_LEVEL_TWO levelHealth', levelHealth )
      yield put( updateHealth( levelHealth, level, 'setupHealthWatcher' ) )
      if ( level == 2 ) yield put( isLevel2InitializedStatus() )
      if ( level == 3 ) {
        yield put( isLevel3InitializedStatus() ); yield put( isLevel2InitializedStatus() )
      }
    }
  }


  // Update status
  yield put( healthCheckInitialized() )
  // Update Initial Health to reduce
  yield put( switchS3LoaderKeeper( 'initLoader' ) )
}

export const setupHealthWatcher = createWatcher(
  setupHealthWorker,
  SETUP_HEALTH_FOR_RESTORE
)

function* updateKeeperInfoToChannelWorker( ) {
  try {
    console.log( 'UPDATE KEEPER INFO' )
    yield put( switchS3LoaderKeeper( 'updateKIToChStatus' ) )
    const currentLevel = yield select( ( state ) => state.bhr.currentLevel )
    const keeperInfo: KeeperInfoInterface[] = yield select( ( state ) => state.bhr.keeperInfo )
    if ( keeperInfo.length > 0 ) {
      for ( let i = 0; i < keeperInfo.length; i++ ) {
        if( currentLevel == 1 && keeperInfo[ i ].scheme == '1of1' ) keeperInfo[ i ].currentLevel = currentLevel
        else if( currentLevel == 2 && keeperInfo[ i ].scheme == '2of3' ) keeperInfo[ i ].currentLevel = currentLevel
        else if( currentLevel == 3 && keeperInfo[ i ].scheme == '3of5' ) keeperInfo[ i ].currentLevel = currentLevel
      }
    }
    yield put( putKeeperInfo( keeperInfo ) )
    const levelHealth: LevelHealthInterface[] = yield select( ( state ) => state.bhr.levelHealth )
    const contacts: Trusted_Contacts = yield select( ( state ) => state.trustedContacts.contacts )
    const s3 = yield call( dbManager.getS3Services )
    const MetaShares: MetaShare[] = [ ...s3.metaSharesKeeper ]
    const wallet = yield call( dbManager.getWallet )
    const { walletName } = yield select( ( state ) => state.storage.wallet )
    const channelSyncUpdates: {
      channelKey: string,
      streamId: string,
      unEncryptedOutstreamUpdates?: UnecryptedStreamData,
    }[] = []
    if( levelHealth[ 0 ] ) {
      for ( let i = 2; i < levelHealth[ 0 ].levelInfo.length; i++ ) {
        const element = levelHealth[ 0 ].levelInfo[ i ]
        const channelKey = keeperInfo.find( value=>value.shareId == element.shareId ).channelKey
        const primaryData: PrimaryStreamData = {
          contactDetails: contacts[ channelKey ].contactDetails,
          walletID: wallet.walletId,
          walletName,
          relationType: TrustedContactRelationTypes.KEEPER,
        }

        const backupData: BackupStreamData = {
          primaryMnemonicShard: {
            ...MetaShares.find( value=>value.shareId == element.shareId ),
            encryptedShare: {
              pmShare: MetaShares.find( value=>value.shareId == element.shareId ).encryptedShare.pmShare,
              smShare: '',
              bhXpub: '',
            }
          },
          keeperInfo
        }

        const streamUpdates: UnecryptedStreamData = {
          streamId: TrustedContactsOperations.getStreamId( wallet.walletId ),
          primaryData,
          backupData,
          metaData: {
            flags:{
              active: true,
              newData: true,
              lastSeen: Date.now(),
            },
            version: DeviceInfo.getVersion()
          }
        }

        channelSyncUpdates.push( {
          channelKey,
          streamId: streamUpdates.streamId,
          unEncryptedOutstreamUpdates: streamUpdates,
        } )
      }
    }
    const res = yield call(
      TrustedContactsOperations.syncPermanentChannels,
      channelSyncUpdates
    )
    if ( res.status === 200 ) {
      let temp = {
        isKeeperInfoUpdated2: true,
        isKeeperInfoUpdated3: false
      }
      if( currentLevel == 3 ){
        temp = {
          isKeeperInfoUpdated2: true,
          isKeeperInfoUpdated3: true
        }
      }
      yield put( setIsKeeperInfoUpdated( temp ) )
    }
    yield put( switchS3LoaderKeeper( 'updateKIToChStatus' ) )
  } catch ( error ) {
    yield put( switchS3LoaderKeeper( 'updateKIToChStatus' ) )
    console.log( 'Error autoShareLevel2KeepersWorker', error )
  }
}

export const updateKeeperInfoToChannelWatcher = createWatcher(
  updateKeeperInfoToChannelWorker,
  UPDATE_KEEPER_INFO_TO_CHANNEL
)

function* acceptExistingContactRequestWorker( { payload } ) {
  try {
    yield put( switchS3LoaderKeeper( 'updateKIToChStatus' ) )
    const { channelKey, contactsSecondaryChannelKey } = payload
    const currentLevel = yield select( ( state ) => state.bhr.currentLevel )
    const keeperInfo: KeeperInfoInterface[] = yield select( ( state ) => state.bhr.keeperInfo )
    if ( keeperInfo.length > 0 ) {
      for ( let i = 0; i < keeperInfo.length; i++ ) {
        if( currentLevel == 1 && keeperInfo[ i ].scheme == '1of1' ) keeperInfo[ i ].currentLevel = currentLevel
        else if( currentLevel == 2 && keeperInfo[ i ].scheme == '2of3' ) keeperInfo[ i ].currentLevel = currentLevel
        else if( currentLevel == 3 && keeperInfo[ i ].scheme == '3of5' ) keeperInfo[ i ].currentLevel = currentLevel
      }
    }
    yield put( putKeeperInfo( keeperInfo ) )
    const contacts: Trusted_Contacts = yield select( ( state ) => state.trustedContacts.contacts )
    const { walletName, walletId } = yield select( ( state ) => state.storage.wallet )
    const contactInfo = {
      channelKey,
      contactsSecondaryChannelKey
    }
    const primaryData: PrimaryStreamData = {
      contactDetails: contacts[ channelKey ].contactDetails,
      walletID: walletId,
      walletName,
      relationType: TrustedContactRelationTypes.KEEPER,
    }
    const streamUpdates: UnecryptedStreamData = {
      streamId: TrustedContactsOperations.getStreamId( walletId ),
      primaryData,
      metaData: {
        flags:{
          active: true,
          newData: true,
          lastSeen: Date.now(),
        },
        version: DeviceInfo.getVersion()
      }
    }
    // initiate permanent channel
    const channelUpdate =  {
      contactInfo, streamUpdates
    }
    yield put( syncPermanentChannels( {
      permanentChannelsSyncKind: PermanentChannelsSyncKind.SUPPLIED_CONTACTS,
      channelUpdates: [ channelUpdate ],
    } ) )
    yield put( switchS3LoaderKeeper( 'updateKIToChStatus' ) )
  } catch ( error ) {
    yield put( switchS3LoaderKeeper( 'updateKIToChStatus' ) )
    console.log( 'Error autoShareLevel2KeepersWorker', error )
  }
}

export const acceptExistingContactRequestWatcher = createWatcher(
  acceptExistingContactRequestWorker,
  ACCEPT_EC_REQUEST
)

function* setupPasswordWorker( { payload } ) {
  try {
    yield put( switchS3LoaderKeeper( 'setupPasswordStatus' ) )
    const { security } = payload
    const levelHealth: LevelHealthInterface[] = yield select( ( state ) => state.bhr.levelHealth )
    const wallet: Wallet = yield select( ( state ) => state.storage.wallet )
    const updatedWallet: Wallet = {
      ...wallet,
      security: security ? security : {
        question: '', answer: ''
      },
    }
    yield put( updateWallet( updatedWallet ) )
    if( security ) {
      // initialize health-check schema on relay
      yield put( initializeHealthSetup() )
    }

    const shareObj =
        {
          walletId: wallet.walletId,
          shareId: levelHealth[ 0 ].levelInfo[ 0 ].shareId,
          reshareVersion: levelHealth[ 0 ].levelInfo[ 0 ].reshareVersion,
          updatedAt: moment( new Date() ).valueOf(),
          status: 'accessible',
          shareType: 'securityQuestion',
          name: 'Encryption Password'
        }
    yield put( updateMSharesHealth( shareObj, true ) )
    yield put( switchS3LoaderKeeper( 'setupPasswordStatus' ) )
  } catch ( error ) {
    yield put( switchS3LoaderKeeper( 'setupPasswordStatus' ) )
    console.log( 'Error setupPasswordStatus', error )
  }
}

export const setupPasswordWatcher = createWatcher(
  setupPasswordWorker,
  SETUP_PASSWORD
)

function* setupLevelHealthWorker( { payload } ) {
  try {
    yield put( switchS3LoaderKeeper( 'initLoader' ) )
    const { level, keeperInfo }: { level: number, keeperInfo: KeeperInfoInterface[] } = payload
    const randomIdForSecurityQ = generateRandomString( 8 )
    const randomIdForCloud = generateRandomString( 8 )
    const scheme = level == 2 ? '2of3': level == 3 ? '3of5' : '1of1'
    const levelHealth = []

    if( level == 1 ){
      const levelInfo = [
        {
          shareType: 'securityQuestion',
          updatedAt: moment( new Date() ).valueOf(),
          status: 'accessible',
          shareId: keeperInfo.find( value=>value.type == 'securityQuestion'  && value.scheme == scheme ) ? keeperInfo.find( value=>value.type == 'securityQuestion'  && value.scheme == scheme ).shareId : randomIdForSecurityQ,
          reshareVersion: 0,
          name: 'Encryption Password',
        },
        {
          shareType: 'cloud',
          updatedAt: moment( new Date() ).valueOf(),
          status: 'accessible',
          shareId: keeperInfo.find( value=>value.type == 'cloud' && value.scheme == scheme ) ? keeperInfo.find( value=>value.type == 'cloud' && value.scheme == scheme ).shareId : randomIdForCloud,
          reshareVersion: 0,
          name: Platform.OS == 'ios' ? 'iCloud' : 'Google Drive',
        },
      ]
      console.log( 'SETUP_LEVEL_HEALTH levelInfo', levelInfo )
      yield put( updateHealth( [ {
        level: 1,
        levelInfo: levelInfo,
      } ], level, 'SETUP_LEVEL_HEALTH' ) )
    } else {
      if ( level == 2 || level == 3 ) {
        const levelInfo: LevelInfo[] = [
          {
            shareType: 'securityQuestion',
            updatedAt: moment( new Date() ).valueOf(),
            status: 'accessible',
            shareId: keeperInfo.find( value=>value.type == 'securityQuestion'  && value.scheme == scheme ) ? keeperInfo.find( value=>value.type == 'securityQuestion'  && value.scheme == scheme ).shareId : randomIdForSecurityQ,
            reshareVersion: 0,
            name: 'Encryption Password',
          },
          {
            shareType: 'cloud',
            updatedAt: moment( new Date() ).valueOf(),
            status: 'accessible',
            shareId: keeperInfo.find( value=>value.type == 'cloud' && value.scheme == scheme ) ? keeperInfo.find( value=>value.type == 'cloud' && value.scheme == scheme ).shareId : '',
            reshareVersion: 0,
            name: Platform.OS == 'ios' ? 'iCloud' : 'Google Drive'
          },
        ]

        for ( let i = 0; i < keeperInfo.length; i++ ) {
          const element = keeperInfo[ i ]
          if( element.scheme == scheme ){
            const obj = {
              shareType: element.type,
              updatedAt: element.createdAt,
              status: 'accessible',
              shareId: element.shareId,
              reshareVersion: 0,
              name: element.name
            }
            if( element.sharePosition == 0 ) levelInfo[ 1 ] = {
              ...levelInfo[ 1 ], shareId: element.shareId
            }
            if( element.sharePosition == 1 ) levelInfo[ 2 ] = {
              ...obj, shareId: element.shareId, name: element.name, shareType: element.type
            }
            if( element.sharePosition == 2 ) levelInfo[ 3 ] = {
              ...obj, shareId: element.shareId, name: element.name, shareType: element.type
            }
            if( element.sharePosition == 3 ) levelInfo[ 4 ] = {
              ...obj, shareId: element.shareId, name: element.name, shareType: element.type
            }
            if( element.sharePosition == 4 ) levelInfo[ 5 ] = {
              ...obj, shareId: element.shareId, name: element.name, shareType: element.type
            }
          }
        }

        levelHealth.push( {
          levelInfo, level
        } )
        console.log( 'SETUP_LEVEL_HEALTH levelInfo', levelInfo )
        yield put( updateHealth( levelHealth, level, 'SETUP_LEVEL_HEALTH' ) )
        if ( level == 2 ) yield put( isLevel2InitializedStatus() )
        if ( level == 3 ) {
          yield put( isLevel3InitializedStatus() ); yield put( isLevel2InitializedStatus() )
        }
      }
    }
    yield put( switchS3LoaderKeeper( 'initLoader' ) )
  } catch ( error ) {
    yield put( switchS3LoaderKeeper( 'initLoader' ) )
    console.log( 'Error setupPasswordStatus', error )
  }
}

export const setupLevelHealthWatcher = createWatcher(
  setupLevelHealthWorker,
  SETUP_LEVEL_HEALTH
)

function* retrieveMetaSharesWorker( ) {
  try {
    yield put( switchS3LoaderKeeper( 'restoreMetaSharesStatus' ) )
    const currentLevel: number = yield select( ( state ) => state.bhr.currentLevel )
    const keeperInfo: KeeperInfoInterface[] = yield select( ( state ) => state.bhr.keeperInfo )
    const contacts: Trusted_Contacts = yield select( ( state ) => state.trustedContacts.contacts )
    const wallet: Wallet = yield select( ( state ) => state.storage.wallet )
    // TODO: => get MetaShares and Add to DB
    const Rk: MetaShare[] = []
    const metaShares: MetaShare[] = []
    let keepers:KeeperInfoInterface[] = []
    if ( currentLevel === 2 ) keepers = keeperInfo.filter( word => word.scheme == '2of3' )
    if ( currentLevel === 3 ) keepers = keeperInfo.filter( word => word.scheme == '3of5' )

    let channelKey
    if( contacts ){
      for( const ck of Object.keys( contacts ) ){
        channelKey=ck
        if( contacts[ ck ].relationType == TrustedContactRelationTypes.KEEPER ){
          const res = yield call( TrustedContactsOperations.retrieveFromStream, {
            walletId: wallet.walletId, channelKey, options: {
              retrieveBackupData: true,
            }
          } )
          if( res.backupData && res.backupData.primaryMnemonicShard ){
            Rk.push( res.backupData.primaryMnemonicShard )
          }
        }
      }
    }
    for ( let i = 0; i < keepers.length; i++ ) {
      const element = keepers[ i ]
      metaShares[ element.sharePosition ] = Rk.find( value=>value.shareId == element.shareId )
    }
    // TODO: => store metaShares to DB and reducer

    yield put( switchS3LoaderKeeper( 'restoreMetaSharesStatus' ) )
  } catch ( error ) {
    yield put( switchS3LoaderKeeper( 'restoreMetaSharesStatus' ) )
    console.log( 'Error EF channel', error )
  }
}

export const retrieveMetaSharesWatcher = createWatcher(
  retrieveMetaSharesWorker,
  RETRIEVE_METASHRES
)

function* onPressKeeperChannelWorker( { payload } ) {
  try {
    const { value, number } = payload
    console.log( 'value, number', value, number )
    const currentLevel = yield select( ( state ) => state.bhr.currentLevel )
    const levelHealth: LevelHealthInterface[] = yield select( ( state ) => state.bhr.levelHealth )
    const isLevelThreeMetaShareCreated = yield select( ( state ) => state.bhr.isLevelThreeMetaShareCreated )
    const isLevel3Initialized = yield select( ( state ) => state.bhr.isLevel3Initialized )
    const isLevelTwoMetaShareCreated = yield select( ( state ) => state.bhr.isLevelTwoMetaShareCreated )
    const isLevel2Initialized = yield select( ( state ) => state.bhr.isLevel2Initialized )
    const s3 = yield call( dbManager.getS3Services )
    console.log( 's3', s3 )
    const metaSharesKeeper: MetaShare[] = [ ...s3.metaSharesKeeper ]
    console.log( 'currentLevel', currentLevel )

    if( currentLevel === 0 && value.id === 1 && levelHealth[ 0 ].levelInfo[ 0 ].status=='notSetup' ){
      yield put( setLevelCompletionError( 'Please complete Level 1', 'It seems you have not backed up your wallet on the cloud. Please complete Level 1 to proceed', LevelStatus.FAILED ) )
      return
    }
    else if( currentLevel === 0 && ( value.id === 2 || value.id === 3 ) ){
      yield put( setLevelCompletionError( 'Please complete Level 1', 'It seems you have not backed up your wallet on the cloud. Please complete Level 1 to proceed', LevelStatus.FAILED ) )
      return
    } else if (
      currentLevel == 1 &&
      number == 2 &&
      value.id == 2 &&
      !isLevelTwoMetaShareCreated &&
      !isLevel2Initialized
    ) {
      yield put( setLevelCompletionError( 'Please complete Personal Device Setup', 'It seems you have not completed Personal Device setup, please complete Personal Device setup to proceed', LevelStatus.FAILED ) )
      return
    } else if (
      ( currentLevel == 1 &&
      value.id == 3 &&
      !isLevelThreeMetaShareCreated &&
      !isLevel3Initialized )
    ){
      yield put( setLevelCompletionError( 'Please complete Level 2', 'It seems you have not completed Level 2. Please complete Level 2 to proceed', LevelStatus.FAILED ) )
      return
    }
    const keeper = number == 1 ? value.keeper1 : value.keeper2

    const obj = {
      id: value.id,
      selectedKeeper: {
        ...keeper,
        name: keeper.name,
        shareType: keeper.shareType,
        shareId: keeper.shareId ? keeper.shareId : value.id == 2 ? metaSharesKeeper[ 1 ] ? metaSharesKeeper[ 1 ].shareId: '' : metaSharesKeeper[ 4 ] ? metaSharesKeeper[ 4 ].shareId : ''
      },
      isSetup: keeper.status == 'notSetup' ? true : false,
      isPrimaryKeeper: false,
      isChangeKeeperAllow: currentLevel == 1 && value.id == 2 ? false : currentLevel == 2 && metaSharesKeeper.length === 5 ? false : true
    }
    if ( keeper.status != 'notSetup' ) {
      yield put( navigateToHistoryPage( obj ) )
    } else {
      if ( value.id === 2 && number === 1 && currentLevel === 1 ) {
        if ( !isLevel2Initialized && !isLevelTwoMetaShareCreated &&
          value.id == 2 && metaSharesKeeper.length != 3
        ) {
          yield put( generateMetaShare( value.id ) )
        } else if( keeper.shareType == '' || keeper.status == 'notSetup' ){
          yield put( setIsKeeperTypeBottomSheetOpen( true ) )
        } else {
          yield put( navigateToHistoryPage( obj ) )
        }
      } else {
        yield put( setIsKeeperTypeBottomSheetOpen( true ) )
      }
    }
  } catch ( error ) {
    console.log( error )
  }
}


export const onPressKeeperChannelWatcher = createWatcher(
  onPressKeeperChannelWorker,
  ON_PRESS_KEEPER
)