import React, { useEffect, useState } from 'react'
import {
  View,
  ScrollView,
  RefreshControl,
  Text,
  StyleSheet,
  Platform,
  SafeAreaView,
  StatusBar,
  ImageBackground,
  InteractionManager,
  TouchableOpacity,
} from 'react-native'
import Colors from '../../common/Colors'
import Fonts from '../../common/Fonts'
import { RFValue } from 'react-native-responsive-fontsize'
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen'
import { useDispatch, useSelector } from 'react-redux'
import CloudBackupStatus from '../../common/data/enums/CloudBackupStatus'
import { translations } from '../../common/content/LocContext'
import dbManager from '../../storage/realm/dbManager'
import realm from '../../storage/realm/realm'
import schema from '../../storage/realm/schema/Schema'
import debounce from 'lodash.debounce'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { LevelData, LevelHealthInterface, MetaShare, TrustedContactRelationTypes, Trusted_Contacts } from '../../bitcoin/utilities/Interface'
import { makeContactRecipientDescription } from '../../utils/sending/RecipientFactories'
import ContactTrustKind from '../../common/data/enums/ContactTrustKind'
import ManageBackupCard from './ManageBackupCard'
import BottomInfoBox from '../../components/BottomInfoBox'
import ModalContainer from '../../components/home/ModalContainer'
import KeeperTypeModalContents from './KeeperTypeModalContent'
import ErrorModalContents from '../../components/ErrorModalContents'
import QRModal from '../Accounts/QRModal'
import MBNewBhrKnowMoreSheetContents from '../../components/know-more-sheets/MBNewBhrKnowMoreSheetContents'
import Loader from '../../components/loader'
import ImageStyles from '../../common/Styles/ImageStyles'
import { ContactRecipientDescribing } from '../../common/data/models/interfaces/RecipientDescribing'
import { autoShareToLevel2Keepers, deletePrivateData, generateMetaShare, keeperProcessStatus, modifyLevelData, onPressKeeper, setHealthStatus, setIsKeeperTypeBottomSheetOpen, setLevelCompletionError, setLevelToNotSetupStatus, updateKeeperInfoToChannel } from '../../store/actions/BHR'
import RecipientAvatar from '../../components/RecipientAvatar'
import { PermanentChannelsSyncKind, syncPermanentChannels } from '../../store/actions/trustedContacts'
import { setCloudData, setCloudErrorMessage, updateCloudData } from '../../store/actions/cloud'
import LevelStatus from '../../common/data/enums/LevelStatus'
import { getTime } from '../../common/CommonFunctions/timeFormatter'
import KeeperProcessStatus from '../../common/data/enums/KeeperProcessStatus'

export default function ManageBackup( props ) {
  const dispatch = useDispatch()
  const s3 = dbManager.getBHR()
  const cloudBackupStatus: CloudBackupStatus = useSelector( ( state ) => state.cloud.cloudBackupStatus ) || CloudBackupStatus.PENDING
  const levelHealth: LevelHealthInterface[] = useSelector( ( state ) => state.bhr.levelHealth )
  const currentLevel: number = useSelector( ( state ) => state.bhr.currentLevel )
  const isLevel3Initialized: boolean = useSelector( ( state ) => state.bhr.isLevel3Initialized )
  const isLevelThreeMetaShareCreated: boolean = useSelector( ( state ) => state.bhr.isLevelThreeMetaShareCreated )
  const cloudPermissionGranted: boolean = useSelector( ( state ) => state.bhr.cloudPermissionGranted )
  const keeperProcessStatusFlag: string = useSelector( ( state ) => state.bhr.keeperProcessStatus )
  const isLevelToNotSetupStatus: boolean = useSelector( ( state ) => state.bhr.isLevelToNotSetupStatus )
  const status: any = useSelector( ( state ) => state.bhr.status )
  const errorTitleProp: string = useSelector( ( state ) => state.bhr.errorTitle )
  const navigationObj: any = useSelector( ( state ) => state.bhr.navigationObj )
  const errorInfoProp: string = useSelector( ( state ) => state.bhr.errorInfo )
  const isTypeBottomSheetOpen: any = useSelector( ( state ) => state.bhr.isTypeBottomSheetOpen )
  const levelData: LevelData[] = useSelector( ( state ) => state.bhr.levelData )
  const shieldHealth: boolean = useSelector( ( state ) => state.bhr.shieldHealth )
  const trustedContacts: Trusted_Contacts = useSelector( ( state ) => state.trustedContacts.contacts )
  const approvalStatus: boolean = useSelector( ( state ) => state.bhr.approvalStatus )
  const isKeeperInfoUpdated2: boolean = useSelector( ( state ) => state.bhr.isKeeperInfoUpdated2 )
  const isKeeperInfoUpdated3: boolean = useSelector( ( state ) => state.bhr.isKeeperInfoUpdated3 )
  const cloudErrorMessage: string = useSelector( ( state ) => state.cloud.cloudErrorMessage )
  const strings  = translations[ 'bhr' ]
  const common  = translations[ 'common' ]
  const iCloudErrors  = translations[ 'iCloudErrors' ]
  const driveErrors  = translations[ 'driveErrors' ]
  const defaultKeeperObj: {
    shareType: string
    updatedAt: number;
    status: string
    shareId: string
    reshareVersion: number;
    name?: string
    data?: any;
    channelKey?:string
  } = {
    shareType: '',
    updatedAt: 0,
    status: 'notAccessible',
    shareId: '',
    reshareVersion: 0,
    name: '',
    data: {
    },
    channelKey: ''
  }
  const [ selectedKeeper, setSelectedKeeper ]: [ {
    shareType: string;
    updatedAt: number;
    status: string;
    shareId: string;
    reshareVersion: number;
    name?: string;
    data?: any;
    channelKey?: string;
  }, any ] = useState( defaultKeeperObj )
  const [ selectedId, setSelectedId ] = useState( 0 )
  const [ selectedLevelId, setSelectedLevelId ] = useState( 0 )
  const [ SelectedRecoveryKeyNumber, setSelectedRecoveryKeyNumber ] = useState( 0 )
  const [ selectedKeeperType, setSelectedKeeperType ] = useState( '' )
  const [ selectedKeeperName, setSelectedKeeperName ] = useState( '' )
  const [ isEnabled, setIsEnabled ] = useState( false )
  const [ errorTitle, setErrorTitle ] = useState( '' )
  const [ errorInfo, setErrorInfo ] = useState( '' )

  const [ refreshControlLoader, setRefreshControlLoader ] = useState( false )
  const [ showLoader, setShowLoader ] = useState( false )
  const [ knowMoreType, setKnowMoreType ] = useState( 'manageBackup' )
  const [ keeping, setKeeping ] = useState( [] )
  const [ keeperTypeModal, setKeeperTypeModal ] = useState( false )
  const [ errorModal, setErrorModal ] = useState( false )
  const [ isLevel3Started, setIsLevel3Started ] = useState( false )

  const [ loaderModal, setLoaderModal ] = useState( false )
  const [ knowMoreModal, setKnowMoreModal ] = useState( false )
  const [ metaSharesKeeper, setMetaSharesKeeper ]: [ MetaShare[], any ] = useState( [ ...s3.metaSharesKeeper ] )
  const [ onKeeperButtonClick, setOnKeeperButtonClick ] = useState( false )
  const [ cloudErrorModal, setCloudErrorModal ] = useState( false )
  const [ errorMsg, setErrorMsg ] = useState( '' )

  // After Mount didMount
  useEffect( ()=>{

    InteractionManager.runAfterInteractions( async() => {
      realm.objects( schema.BHR ).addListener( obj => {
        if( obj.length > 0 ) {
          setMetaSharesKeeper( obj[ 0 ].metaSharesKeeper )
        }
      } )
      // onPressKeeperButton= debounce( onPressKeeperButton.bind( this ), 1500 )
      await AsyncStorage.getItem( 'walletRecovered' ).then( async( recovered ) => {
        if( !isLevelToNotSetupStatus && JSON.parse( recovered ) ) {
          dispatch( setLevelToNotSetupStatus() )
          dispatch( modifyLevelData() )
        } else {
          await onRefresh()
          dispatch( modifyLevelData() )
        }
      } )
    } )
    const focusListener = props.navigation.addListener( 'didFocus', () => {
      updateAddressBook()
    } )
    return () => {
      focusListener.remove()
    }
  }, [] )

  const updateAddressBook = async ( ) => {
    const keeping = []
    for( const channelKey of Object.keys( trustedContacts ) ){
      const contact = trustedContacts[ channelKey ]
      const isWard = [ TrustedContactRelationTypes.WARD, TrustedContactRelationTypes.KEEPER_WARD ].includes( contact.relationType )

      if( contact.isActive ){
        if( isWard ){
          if( isWard ) keeping.push( makeContactRecipientDescription(
            channelKey,
            contact,
            ContactTrustKind.USER_IS_KEEPING,
          ) )
        }
      } else {
        // TODO: inject in expired contacts list
      }
    }

    setKeeping( keeping )
  }

  // On update
  useEffect( ()=>{
    requestAnimationFrame( () => {
      updateAddressBook()
    } )
  }, [ trustedContacts ] )

  useEffect( ()=>{
    if ( cloudBackupStatus === CloudBackupStatus.IN_PROGRESS ) {
      setRefreshControlLoader( true )
      setShowLoader( true )
    } else if ( ( cloudBackupStatus === CloudBackupStatus.COMPLETED || cloudBackupStatus === CloudBackupStatus.PENDING || cloudBackupStatus === CloudBackupStatus.FAILED ) ) {
      setRefreshControlLoader( false )
      setShowLoader( false )
      if( ( currentLevel == 2 && !isKeeperInfoUpdated2 ) || currentLevel == 3 && !isKeeperInfoUpdated3 )
        dispatch( updateKeeperInfoToChannel() )
    }
  }, [ cloudBackupStatus ] )

  useEffect( ()=>{
    if( isLevelToNotSetupStatus ){
      setShowLoader( false )
    }
  }, [ isLevelToNotSetupStatus ] )

  useEffect( ()=>{
    autoCloudUpload()
    if (
      levelHealth.length > 0 &&
      levelHealth.length == 1 &&
      cloudBackupStatus !== CloudBackupStatus.IN_PROGRESS &&
      cloudPermissionGranted === true &&
      levelHealth.length &&
      levelHealth[ 0 ].levelInfo.length &&
      levelHealth[ 0 ].levelInfo[ 0 ].status != 'notSetup' &&
      levelHealth[ 0 ].levelInfo[ 1 ].updatedAt == 0
    ) {
      dispatch( setCloudData() )
    }

    if (
      currentLevel == 2 &&
      levelHealth[ 1 ] &&
      levelHealth[ 1 ].levelInfo[ 4 ] &&
      levelHealth[ 1 ].levelInfo[ 5 ] &&
      levelHealth[ 1 ].levelInfo[ 4 ].updatedAt > 0 &&
      levelHealth[ 1 ].levelInfo[ 5 ].updatedAt > 0 &&
      ( levelHealth[ 1 ].levelInfo[ 2 ].updatedAt == 0 ||
      levelHealth[ 1 ].levelInfo[ 3 ].updatedAt == 0 )
    ) {
      dispatch( autoShareToLevel2Keepers() )
    }
  }, [ levelHealth ] )

  useEffect( ()=>{
    if ( metaSharesKeeper.length == 3 && onKeeperButtonClick ) {
      const obj = {
        id: 2,
        selectedKeeper: {
          shareType: 'primaryKeeper',
          name: 'Personal Device 1',
          reshareVersion: 0,
          status: 'notSetup',
          updatedAt: 0,
          shareId: metaSharesKeeper[ 1 ].shareId,
          data: {
          },
        },
        isSetup: true,
      }
      setSelectedKeeper( obj.selectedKeeper )
      setShowLoader( false )
      setSelectedLevelId( 2 )
      goToHistory( obj, 'metaSharesKeeper2' )
      dispatch( setIsKeeperTypeBottomSheetOpen( false ) )
    }
  }, [ metaSharesKeeper ] )

  useEffect( ()=>{
    if ( metaSharesKeeper.length == 5 && onKeeperButtonClick ) {
      const obj = {
        id: 2,
        selectedKeeper: {
          shareType: selectedKeeperType,
          name: selectedKeeperName,
          reshareVersion: 0,
          status: 'notSetup',
          updatedAt: 0,
          shareId: metaSharesKeeper[ 3 ].shareId,
          data: {
          },
        },
        isSetup: true,
      }
      setSelectedKeeper( obj.selectedKeeper )
      dispatch( setIsKeeperTypeBottomSheetOpen( false ) )
      setShowLoader( false )
      setSelectedLevelId( 3 )
      goToHistory( obj, 'metaSharesKeeper' )
    }
  }, [ metaSharesKeeper ] )

  useEffect( ()=>{
    if( keeperProcessStatusFlag == KeeperProcessStatus.COMPLETED ) {
      dispatch( keeperProcessStatus( '' ) )
    }
  }, [ keeperProcessStatusFlag ] )

  useEffect( ()=>{
    if( status === LevelStatus.FAILED ){
      setErrorTitle( errorTitleProp )
      setErrorInfo( errorInfoProp )
      setShowLoader( false )
      dispatch( setLevelCompletionError( null, null, LevelStatus.PENDING ) )
      setTimeout( () => {
        setErrorModal( true )
      }, 600 )
    }
  }, [ status ] )

  useEffect( ()=>{
    if( navigationObj.selectedKeeper && onKeeperButtonClick ){
      setSelectedKeeper( navigationObj.selectedKeeper )
      setSelectedLevelId( navigationObj.id )
      if( navigationObj.selectedKeeper.shareType && navigationObj.selectedKeeper.shareType == 'primaryKeeper' ){
        goToHistory( navigationObj, 'navigationObjIF' )
      } else if( navigationObj.selectedKeeper && navigationObj.selectedKeeper.shareId && navigationObj.selectedKeeper.status !== 'notSetup' ){
        goToHistory( navigationObj, 'navigationObjIF' )
      } else {
        setTimeout( () => {
          setKeeperTypeModal( true )
        }, 500 )
      }
    }
  }, [ navigationObj ] )

  useEffect( () => {
    if( isTypeBottomSheetOpen === true && onKeeperButtonClick ){
      // setShowLoader( false )
      // setTimeout( () => {
      setKeeperTypeModal( true )
      // }, 500 )
      dispatch( setIsKeeperTypeBottomSheetOpen( false ) )
    }
  }, [ isTypeBottomSheetOpen ] )

  useEffect( ()=>{
    if( approvalStatus && isLevel3Started ) {
      setShowLoader( false )
      const obj = {
        id: selectedLevelId,
        selectedKeeper: {
          ...selectedKeeper, name: selectedKeeper.name?selectedKeeper.name:selectedKeeperName, shareType: selectedKeeper.shareType?selectedKeeper.shareType:selectedKeeperType,
          shareId: selectedKeeper.shareId ? selectedKeeper.shareId : selectedLevelId == 2 ? metaSharesKeeper[ 1 ] ? metaSharesKeeper[ 1 ].shareId: '' : metaSharesKeeper[ 4 ] ? metaSharesKeeper[ 4 ].shareId : ''
        },
        isSetup: true,
      }
      goToHistory( obj, 'approvalStatus' )
    }
  }, [ approvalStatus ] )

  useEffect( ()=>{
    if( cloudErrorMessage != '' ){
      const message = Platform.select( {
        ios: iCloudErrors[ cloudErrorMessage ],
        android: driveErrors[ cloudErrorMessage ],
      } )
      setErrorMsg( message )
      setCloudErrorModal( true )
      //setErrorMsg( cloudErrorMessage )
      dispatch( setCloudErrorMessage( '' ) )
    } else if( cloudBackupStatus == CloudBackupStatus.COMPLETED || cloudBackupStatus == CloudBackupStatus.IN_PROGRESS ){
      setCloudErrorModal( false )
    }
  }, [ cloudErrorMessage, cloudBackupStatus ] )

  const handleContactSelection = (
    contactDescription: ContactRecipientDescribing,
    index: number,
    contactType: string,
  ) => {
    props.navigation.navigate( 'ContactDetails', {
      contact: contactDescription,
      index,
      contactsType: contactType,
    } )
  }

  const renderContactItem = ( {
    contactDescription,
    index,
    contactsType,
  }: {
    contactDescription: ContactRecipientDescribing;
    index: number;
    contactsType: string;
  } ) => {
    return (
      <TouchableOpacity
        onPress={() =>
          handleContactSelection( contactDescription, index, contactsType )
        }
        style={{
          marginTop: hp( 1 ),
          alignItems: 'center',
          justifyContent: 'center'
        }}
        key={index}
      >
        <View style={styles.imageContainer}>
          <RecipientAvatar recipient={contactDescription} contentContainerStyle={styles.avatarImage} />
        </View>
        <Text style={{
          textAlign: 'center',
          marginTop: hp ( 0.5 ),
          alignSelf: 'center',
          fontSize: RFValue( 10 ),
          fontFamily: Fonts.FiraSansRegular
        }}>{contactDescription.displayedName.split( ' ' )[ 0 ] + ' '} </Text>
      </TouchableOpacity>
    )
  }

  const onRefresh = async () => {
    const contacts: Trusted_Contacts = trustedContacts
    const channelUpdates = []
    // Contact or Device type
    if( contacts ){
      for( const ck of Object.keys( contacts ) ){
        if( contacts[ ck ].relationType == TrustedContactRelationTypes.KEEPER || contacts[ ck ].relationType == TrustedContactRelationTypes.PRIMARY_KEEPER ){
          // initiate permanent channel
          const channelUpdate =  {
            contactInfo: {
              channelKey: ck,
            }
          }
          channelUpdates.push( channelUpdate )
        }
      }
      dispatch( syncPermanentChannels( {
        permanentChannelsSyncKind: PermanentChannelsSyncKind.SUPPLIED_CONTACTS,
        channelUpdates: channelUpdates,
        metaSync: true
      } ) )
    }
    dispatch( modifyLevelData() )
    dispatch( setHealthStatus() )
    autoCloudUpload()
  }

  const autoCloudUpload = () =>{
    if( levelHealth[ 0 ] && levelHealth[ 1 ] ){
      if( levelHealth[ 1 ].levelInfo.length == 4 &&
        levelHealth[ 1 ].levelInfo[ 1 ].updatedAt == 0 &&
        levelHealth[ 1 ].levelInfo[ 2 ].updatedAt > 0 &&
        levelHealth[ 1 ].levelInfo[ 3 ].updatedAt > 0 &&
        cloudBackupStatus !== CloudBackupStatus.IN_PROGRESS ){
        dispatch( deletePrivateData() )
        setLoaderModal( true )
        dispatch( updateCloudData() )
      } else if( levelHealth[ 1 ].levelInfo.length == 6 &&
        levelHealth[ 1 ].levelInfo[ 1 ].updatedAt == 0 &&
        levelHealth[ 1 ].levelInfo[ 2 ].updatedAt > 0 &&
        levelHealth[ 1 ].levelInfo[ 3 ].updatedAt > 0 &&
        levelHealth[ 1 ].levelInfo[ 4 ].updatedAt > 0 &&
        levelHealth[ 1 ].levelInfo[ 5 ].updatedAt > 0 &&
        cloudBackupStatus !== CloudBackupStatus.IN_PROGRESS ){
        dispatch( updateCloudData() )
        setLoaderModal( true )
      }
    }
  }

  const onKeeperButtonPress = ( value, keeperNumber ) => {
    setSelectedRecoveryKeyNumber( keeperNumber )
    // requestAnimationFrame( () => {
    if( ( currentLevel == 0 && levelHealth.length == 0 ) || ( currentLevel == 0 && levelHealth.length && levelHealth[ 0 ].levelInfo.length && levelHealth[ 0 ].levelInfo[ 0 ].status == 'notSetup' ) ) {
      dispatch( setLevelCompletionError( strings[ 'PleaseSetPasswordTitle' ], strings[ 'PleaseSetPasswordInfo' ], LevelStatus.FAILED ) )
      return
    }
    if( value.id == 1 && keeperNumber == 2 ) {
      if ( cloudBackupStatus !== CloudBackupStatus.IN_PROGRESS ) {
        props.navigation.navigate(
          'CloudBackupHistory',
          {
            selectedTime: value.keeper2.updatedAt
              ? getTime( value.keeper2.updatedAt )
              : 'Never',
          }
        )
      }
    } else if( value.id == 1 && keeperNumber == 1 ) {
      props.navigation.navigate(
        'SecurityQuestionHistoryNewBHR',
        {
          selectedTime: value.keeper1.updatedAt
            ? getTime( value.keeper1.updatedAt )
            : 'Never',
        }
      )
    } else {
      // setShowLoader( true )
      setSelectedKeeper( keeperNumber == 1 ? value.keeper1 : value.keeper2 )
      onPressKeeperButton( value, keeperNumber )
    }
    // } )
  }

  let onPressKeeperButton = ( value, number ) => {
    setSelectedLevelId( value.id )
    setOnKeeperButtonClick( true )
    dispatch( onPressKeeper( value, number ) )
  }

  const goToHistory = ( value, test ) => {
    const { id, selectedKeeper, isSetup, isChangeKeeperAllow } = value
    setShowLoader( false )
    const navigationParams = {
      selectedTitle: selectedKeeper.name ? selectedKeeper.name : selectedKeeperName,
      SelectedRecoveryKeyNumber,
      selectedKeeper,
    }
    let index = 1
    let count = 0
    if ( selectedKeeper.shareType == 'primaryKeeper' || selectedKeeper.shareType == 'device' || selectedKeeper.shareType == 'contact' || selectedKeeper.shareType == 'existingContact' ) {
      for ( let i = 0; i < levelData.length; i++ ) {
        const element = levelData[ i ]
        if( selectedKeeper.shareType == 'contact' || selectedKeeper.shareType == 'existingContact' ) {
          if ( element.keeper1.shareType == 'contact' || element.keeper1.shareType == 'existingContact' ) count++
          if ( element.keeper2.shareType == 'contact' || element.keeper2.shareType == 'existingContact' ) count++
        }
        if( selectedKeeper.shareType == 'device' || selectedKeeper.shareType == 'primaryKeeper' ) {
          if ( element.keeper1.shareType == 'device' || element.keeper1.shareType == 'primaryKeeper' ) count++
          if ( element.keeper2.shareType == 'device' ) count++
        }
      }
      if( selectedKeeper.shareType == 'contact' || selectedKeeper.shareType == 'existingContact' ) {
        if ( count == 1 && isSetup ) index = 2
        else if ( count == 0 && isSetup ) index = 1
        else index = selectedKeeper.data && selectedKeeper.data.index ? selectedKeeper.data.index : 1
      }
      if( selectedKeeper.shareType == 'device' || selectedKeeper.shareType == 'primaryKeeper' ) {
        if( selectedKeeper.data && ( selectedKeeper.data.index == 0 || selectedKeeper.data.index > 0 ) ) index = selectedKeeper.data.index
        else if ( count == 0 && isSetup ) index = 0
        else if ( count == 1 && isSetup ) index = 3
        else if ( count == 2 && isSetup ) index = 4
        else index = 0
      }
      if( selectedKeeper.shareType == 'primaryKeeper' ) index = 0
    }
    setSelectedKeeper( defaultKeeperObj )
    setKeeperTypeModal( false )
    if ( selectedKeeper.shareType == 'device' || selectedKeeper.shareType == 'primaryKeeper' ) {
      props.navigation.navigate( 'SecondaryDeviceHistoryNewBHR', {
        ...navigationParams,
        isPrimaryKeeper: selectedKeeper.shareType == 'primaryKeeper' ? true : false,
        isChangeKeeperAllow,
        index: index > -1 ? index : 0,
      } )
    } else if ( selectedKeeper.shareType == 'contact' || selectedKeeper.shareType == 'existingContact' ) {
      props.navigation.navigate( 'TrustedContactHistoryNewBHR', {
        ...navigationParams,
        index,
        isChangeKeeperAllow
      } )
    } else if ( selectedKeeper.shareType == 'pdf' ) {
      props.navigation.navigate(
        'PersonalCopyHistoryNewBHR', {
          ...navigationParams,
          isChangeKeeperAllow
        }
      )
    }
    setOnKeeperButtonClick( false )
  }

  return (
    <View style={{
      backgroundColor: Colors.blue,
      flex: 1
    }}>
      <StatusBar backgroundColor={Colors.blue} barStyle="light-content" />
      <View style={styles.accountCardsSectionContainer}>
        <Text style={{
          color: Colors.blue,
          fontSize: RFValue( 18 ),
          letterSpacing: 0.54,
          fontFamily: Fonts.FiraSansMedium,
          marginTop: hp( 4 ),
          marginHorizontal: wp( 4 ),
          paddingBottom: hp( 1 )
        }}>
          {strings[ 'SecurityPrivacy' ]}
        </Text>
        <ScrollView
          refreshControl={
            <RefreshControl
              refreshing={refreshControlLoader}
              onRefresh={() => onRefresh()}
            />
          }
          style={{
            flex: 1
          }}
        >
          <View style={{
            flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: wp( 4 ), alignItems: 'center', paddingTop: wp( 3 ),
          }}>
            <View style={{
              flex:2
            }}>
              <Text style={{
                color: Colors.blue,
                fontSize: RFValue( 12 ),
                fontFamily: Fonts.FiraSansRegular
              }}>{strings[ 'WalletBackup' ]}</Text>
              <Text style={styles.headerMessageText}>{strings[ 'WalletBackupInfo' ]}</Text>
            </View>
            <ImageBackground
              source={require( '../../assets/images/icons/keeper_sheild.png' )}
              style={{
                ...styles.healthShieldImage, position: 'relative',
              }}
              resizeMode={'contain'}
            >
              {shieldHealth && (
                <View style={styles.shieldErrorDot} />
              )}
            </ImageBackground>
          </View>
          <View style={styles.body}>
            {levelData.map( ( value, index ) => {
              return (
                <ManageBackupCard
                  key={index}
                  value={value}
                  selectedId={selectedId}
                  selectedKeeper={selectedKeeper}
                  onPressSelectId={( )=>{ setSelectedId( value.id != selectedId ? value.id : 0 ) }}
                  onPressKnowMore={() => {
                    setKnowMoreType( value.levelName )
                    setKnowMoreModal( true )
                  }}
                  onPressKeeper1={()=> onKeeperButtonPress( value, 1 )}
                  onPressKeeper2={()=> onKeeperButtonPress( value, 2 )}
                />
              )
            } )}
          </View>
          <View style={{
            marginTop: wp( '5%' ), backgroundColor: Colors.backgroundColor, height: '100%',
            paddingLeft: wp ( '6%' ),
            paddingBottom: hp( 3 )
          }}>
            <Text style={styles.pageTitle}>{strings.IamtheKeeper}</Text>
            <Text style={styles.pageInfoText}>
              {strings[ 'Contactswhose' ]}
            </Text>
            <View style={{
              marginBottom: 15
            }}>
              {keeping.length > 0 ?
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{
                    height: 'auto', alignItems: 'flex-start', flexDirection: 'row'
                  }}>
                  {keeping.length && keeping.map( ( item, index ) => {
                    return renderContactItem( {
                      contactDescription: item,
                      index,
                      contactsType: 'I am the Keeper of',
                    } )
                  } ) }
                </ScrollView>
                :
                <BottomInfoBox
                  containerStyle={{
                    marginLeft: wp( 0 ),
                    marginTop: hp( 2.5 ),
                    backgroundColor: Colors.white
                  }}
                  title={common[ 'note' ]}
                  infoText={strings[ 'Whenyouhave' ]}
                />
              }
            </View>
          </View>
        </ScrollView>

        <ModalContainer visible={keeperTypeModal} closeBottomSheet={() => setKeeperTypeModal( false )}>
          <KeeperTypeModalContents
            headerText={'Backup Recovery Key'}
            subHeader={strings[ 'saveyourRecovery' ]}
            onPressSetup={async ( type, name ) => {
              try{
                setSelectedKeeperType( type )
                setSelectedKeeperName( name )
                if (
                  selectedLevelId == 3 &&
                !isLevelThreeMetaShareCreated &&
                !isLevel3Initialized &&
                currentLevel == 2 &&
                metaSharesKeeper.length != 5
                ) {
                  dispatch( generateMetaShare( selectedLevelId ) )
                } else {
                  const obj = {
                    id: selectedLevelId,
                    selectedKeeper: {
                      shareType: type,
                      name: name,
                      reshareVersion: 0,
                      status: 'notSetup',
                      updatedAt: 0,
                      shareId: selectedKeeper.shareId,
                      data: {
                      },
                    },
                    isSetup: true,
                  }
                  setSelectedKeeper( obj.selectedKeeper )
                  setShowLoader( false )
                  setSelectedLevelId( 2 )
                  goToHistory( obj, 'TYPE' )
                }
              } catch( err ){
                console.log( 'err', err )
              }
            }}
            onPressBack={() =>{
              dispatch( setIsKeeperTypeBottomSheetOpen( false ) )
              setKeeperTypeModal( false )
            }}
          />
        </ModalContainer>
        <ModalContainer visible={errorModal} closeBottomSheet={() => setErrorModal( false )}>
          <ErrorModalContents
            title={errorTitle}
            info={errorInfo}
            proceedButtonText={( currentLevel == 0 && levelHealth.length == 0 ) || ( currentLevel == 0 && levelHealth.length && levelHealth[ 0 ].levelInfo.length && levelHealth[ 0 ].levelInfo[ 0 ].status == 'notSetup' ) ? 'Proceed To Password' : 'Got it'}
            cancelButtonText={( currentLevel == 0 && levelHealth.length == 0 ) || ( currentLevel == 0 && levelHealth.length && levelHealth[ 0 ].levelInfo.length && levelHealth[ 0 ].levelInfo[ 0 ].status == 'notSetup' ) ? 'Got it' : ''}
            isIgnoreButton={( currentLevel == 0 && levelHealth.length == 0 ) || ( currentLevel == 0 && levelHealth.length && levelHealth[ 0 ].levelInfo.length && levelHealth[ 0 ].levelInfo[ 0 ].status == 'notSetup' ) ? true : false}
            onPressProceed={() => {
              setErrorModal( false )
              if( ( currentLevel == 0 && levelHealth.length == 0 ) || ( currentLevel == 0 && levelHealth.length && levelHealth[ 0 ].levelInfo.length && levelHealth[ 0 ].levelInfo[ 0 ].status == 'notSetup' ) ) props.navigation.navigate( 'SetNewPassword', {
                isFromManageBackup: true,
              } )
            }}
            onPressIgnore={() => setErrorModal( false )}
            isBottomImage={true}
            bottomImage={require( '../../assets/images/icons/errorImage.png' )}
          />
        </ModalContainer>
        <ModalContainer visible={knowMoreModal} closeBottomSheet={() => setKnowMoreModal( false )} >
          <MBNewBhrKnowMoreSheetContents
            type={knowMoreType}
            titleClicked={()=> setKnowMoreModal( false ) }
            containerStyle={{
              shadowOpacity: 0,
            }}
          />
        </ModalContainer>
        <ModalContainer visible={cloudErrorModal} closeBottomSheet={() => setCloudErrorModal( false ) }>
          <ErrorModalContents
            title={strings[ 'CloudBackupError' ]}
            //info={cloudErrorMessage}
            note={errorMsg}
            onPressProceed={()=>{
              setCloudErrorModal( false )
              setTimeout( () => {
                setLoaderModal( true )
              }, 500 )
              dispatch( updateCloudData() )
            }}
            onPressIgnore={()=> setTimeout( ()=>{setCloudErrorModal( false )}, 500 )}
            proceedButtonText={common.tryAgain}
            cancelButtonText={common.ok}
            isIgnoreButton={true}
            isBottomImage={true}
            isBottomImageStyle={{
              width: wp( '27%' ),
              height: wp( '27%' ),
              marginLeft: 'auto',
              resizeMode: 'stretch',
              marginBottom: hp( '-3%' ),
            }}
            bottomImage={require( '../../assets/images/icons/cloud_ilustration.png' )}
          />
        </ModalContainer>
      </View>
      {showLoader ? <Loader /> : null}
    </View>
  )
}

const styles = StyleSheet.create( {
  imageContainer: {
    width: wp( 15 ),
    height: wp( 15 ),
    borderRadius: wp( 15 )/2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
    shadowColor: Colors.shadowColor,
    shadowOpacity: 0.6,
    shadowOffset: {
      width: 10, height: 10
    },
    elevation: 10
  },
  avatarImage: {
    ...ImageStyles.thumbnailImageLarge,
    borderRadius: wp( 14 )/2,
    marginHorizontal: wp ( 1 ),
  },
  moreImage: {
    width: wp( '10%' ),
    height: wp( '10%' ),
  },
  pageTitle: {
    color: Colors.blue,
    fontSize: RFValue( 16 ),
    // fontFamily: Fonts.FiraSansRegular,
    paddingTop: wp ( '2%' ),
    fontFamily: Fonts.FiraSansMedium,
    // paddingLeft: wp ( '4%' )
  },
  cardTitle: {
    color: Colors.blue,
    fontSize: RFValue( 12 ),
    // fontFamily: Fonts.FiraSansRegular,
    fontFamily: Fonts.FiraSansMedium,
    marginVertical: wp( 2 ),
    // marginHorizontal: wp( 4 )
  },
  pageInfoText: {
    // paddingLeft: wp ( '4%' ),
    color: Colors.textColorGrey,
    letterSpacing: 0.5,
    fontSize: RFValue( 11 ),
    fontFamily: Fonts.FiraSansRegular,
    marginTop: 3,
  },
  addModalTitleText: {
    color: Colors.blue,
    fontSize: RFValue( 13 ),
    fontFamily: Fonts.FiraSansRegular
  },

  addModalInfoText: {
    color: Colors.textColorGrey,
    fontSize: RFValue( 11 ),
    marginTop: 5,
    fontFamily: Fonts.FiraSansRegular
  },

  modalElementInfoView: {
    flex: 1,
    // margin: 10,
    height: hp( '5%' ),
    flexDirection: 'row',
    // justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: wp ( '6%' )
  },
  accountCardsSectionContainer: {
    height: hp( '71.46%' ),
    // marginTop: 30,
    backgroundColor: Colors.backgroundColor,
    borderTopLeftRadius: 25,
    shadowColor: 'black',
    shadowOpacity: 0.4,
    shadowOffset: {
      width: 2,
      height: -1,
    },
    flexDirection: 'column',
    justifyContent: 'space-around'
  },
  modalHeaderTitleView: {
    alignItems: 'center',
    flexDirection: 'row',
    paddingRight: 5,
    paddingBottom: 5,
    paddingTop: 7,
    marginLeft: 20,
    marginRight: 20,
  },
  headerBackArrowView: {
    height: 30,
    width: 30,
    justifyContent: 'center',
  },
  topHealthView: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  healthShieldImage: {
    width: wp( '10%' ),
    height: wp( '18%' ),
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerSeparator: {
    backgroundColor: Colors.seaBlue,
    width: 4,
    borderRadius: 5,
    height: wp( '17%' ),
    marginLeft: wp( '5%' ),
    marginRight: wp( '5%' ),
  },
  backupText: {
    color: Colors.black,
    fontFamily: Fonts.FiraSansRegular,
    fontSize: RFValue( 15 ),
  },
  backupInfoText: {
    color: Colors.blue,
    fontFamily: Fonts.FiraSansRegular,
    fontSize: RFValue( 18 ),
  },
  cardView: {
    height: wp( '11%' ),
    width: wp( '85%' ),
    padding: 15,
    borderBottomWidth: 0.5,
    borderColor: Colors.textColorGrey,
  },
  cardHealthImageView: {
    backgroundColor: Colors.red,
    // shadowColor: Colors.deepBlue,
    // shadowOpacity: 1,
    // shadowOffset: {
    //   width: 0, height: 3
    // },
    // shadowRadius: 10,
    borderRadius: wp( '7%' ) / 2,
    width: wp( '6%' ),
    height: wp( '6%' ),
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardHealthImage: {
    width: wp( '2%' ),
    height: wp( '4%' ),
    resizeMode: 'contain',
  },
  cardButtonView: {
    width: wp( '21%' ),
    height: wp( '8' ),
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 'auto',
    borderRadius: 8,
  },
  cardButtonText: {
    fontSize: RFValue( 10 ),
    fontFamily: Fonts.FiraSansRegular,
    color: Colors.white,
    width: wp( '24%' ),
  },
  levelText: {
    fontSize: RFValue( 16 ),
    fontFamily: Fonts.FiraSansRegular,
    color: Colors.white,
  },
  levelInfoText: {
    fontSize: RFValue( 10 ),
  },
  shieldErrorDot: {
    backgroundColor: Colors.red,
    height: wp( '3%' ),
    width: wp( '3%' ),
    borderRadius: wp( '3%' ) / 2,
    position: 'absolute',
    top: wp( '5%' ),
    right: 0,
    borderWidth: 2,
    borderColor: Colors.white,
  },
  headerMessageView: {
    justifyContent:'center',
    alignItems:'center',
    width: wp( '85%' ),
    marginLeft: 30,
    marginRight: 30
  },
  headerMessageText: {
    color: Colors.textColorGrey,
    fontSize: RFValue( 12 ),
    fontFamily: Fonts.FiraSansRegular,
    // textAlign: 'center'
  },
  body: {
    flex: 1,
    alignItems: 'center',
    position: 'relative',
    paddingBottom: wp( '7%' ),
  }
} )