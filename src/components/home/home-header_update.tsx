import React, { useMemo, useEffect } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ImageBackground,
  Image,
} from 'react-native'
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen'
import Colors from '../../common/Colors'
import Fonts from './../../common/Fonts'
import CommonStyles from '../../common/Styles/Styles'
import { RFValue } from 'react-native-responsive-fontsize'
import { UsNumberFormat } from '../../common/utilities'
import { useDispatch, useSelector } from 'react-redux'
import CurrencyKindToggleSwitch from '../../components/CurrencyKindToggleSwitch'
const currencyCode = [
  'BRL',
  'CNY',
  'JPY',
  'GBP',
  'KRW',
  'RUB',
  'TRY',
  'INR',
  'EUR',
]
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons'
import { getCurrencyImageName } from '../../common/CommonFunctions/index'
import AntDesign from 'react-native-vector-icons/AntDesign'
import CurrencyKind from '../../common/data/enums/CurrencyKind'
import useCurrencyKind from '../../utils/hooks/state-selectors/UseCurrencyKind'
import { currencyKindSet } from '../../store/actions/preferences'
import { LevelData, LevelHealthInterface } from '../../bitcoin/utilities/Interface'
import { SATOSHIS_IN_BTC } from '../../common/constants/Bitcoin'
import KeeperProcessStatus from '../../common/data/enums/KeeperProcessStatus'
import MaterialCurrencyCodeIcon, {
  materialIconCurrencyCodes,
} from '../MaterialCurrencyCodeIcon'
import useCurrencyCode from '../../utils/hooks/state-selectors/UseCurrencyCode'
import CloudBackupStatus from '../../common/data/enums/CloudBackupStatus'

function setCurrencyCodeToImage( currencyName, currencyColor ) {
  return (
    <View
      style={{
        marginRight: 5,
        marginBottom: wp( '0.7%' ),
      }}
    >
      <MaterialCommunityIcons
        name={currencyName}
        color={currencyColor == 'light' ? Colors.white : Colors.lightBlue}
        size={wp( '3.5%' )}
      />
    </View>
  )
}

const HomeHeader = ( {
  onPressNotifications,
  navigateToQRScreen,
  notificationData,
  walletName,
  netBalance,
  getCurrencyImageByRegion,
  exchangeRates,
  CurrencyCode,
  navigation,
  currentLevel,
} ) => {
  const fiatCurrencyCode = useCurrencyCode()
  const levelData: LevelData[] = useSelector(
    ( state ) => state.bhr.levelData
  )
  const currencyKind: CurrencyKind = useCurrencyKind()

  const prefersBitcoin = useMemo( () => {
    return currencyKind === CurrencyKind.BITCOIN
  }, [ currencyKind ] )

  const cloudBackupStatus = useSelector(
    ( state ) => state.cloud.cloudBackupStatus
  )

  const getMessage = () => {
    const { messageOne, messageTwo, isFirstMessageBold, isError, isInit } = getMessageToShow()
    return <View style={{
      flexDirection: 'row', alignItems: 'center', marginTop: hp( 1.8 )
    }}>
      { isInit ?
        <View style={{
          width: wp( '4.7%' ), height: wp( '4.7%' ), borderRadius: wp( '4.7/2%' ), backgroundColor: Colors.white, justifyContent: 'center', alignItems: 'center'
        }}>
          <Image
            source={require( '../../assets/images/icons/icon_account_sync_in_progress.gif' )}
            style={{
              width: wp( '4.0%' ), height: wp( '4.0%' ), borderRadius: wp( '4.0/2%' ),
            }}
            resizeMode={'contain'}
          />
        </View>
        : <View style={{
          backgroundColor: isError ? Colors.red : Colors.green,
          width: wp( '4.7%' ), height: wp( '4.7%' ), borderRadius: wp( '4.7/2%' ),
          alignItems:'center',
          justifyContent: 'center'
        }}>
          <Image
            source={isError ? require( '../../assets/images/icons/icon_error_white.png' ) : require( '../../assets/images/icons/check_white.png' )}
            style={{
              width: wp( '2.7%' ), height: wp( '2.7%' ),
            }}
            resizeMode={'contain'}
          />
        </View>
      }
      {isFirstMessageBold ? <Text style={{
        flex:1, color: Colors.backgroundColor1, marginLeft: wp( 2 ), fontSize: RFValue( 11 )
      }}><Text style={{
          fontFamily: Fonts.FiraSansMediumItalic
        }}>{messageOne}</Text>{messageTwo}</Text> : <Text style={{
        flex:1, color: Colors.backgroundColor1, marginLeft: wp( 2 ), fontSize: RFValue( 11 )
      }}>{messageOne} <Text style={{
          fontFamily: Fonts.FiraSansMediumItalic
        }}>{messageTwo}</Text></Text>}
    </View>
  }

  useEffect( () => {
    const focusListener = navigation.addListener( 'didFocus', () => {
      getMessageToShow()
    } )
    return () => {
      focusListener.remove()
    }
  }, [] )

  const getMessageToShow = () => {
    if( levelData[ 0 ].keeper2.updatedAt == 0 && currentLevel == 0 && cloudBackupStatus === CloudBackupStatus.IN_PROGRESS ) {
      return {
        isFirstMessageBold: false, messageOne: 'Initialising Cloud Backup', messageTwo: '', isError: false, isInit: true
      }
    }
    if( currentLevel == 0 ){
      return {
        isFirstMessageBold: false, messageOne: 'Cloud backup incomplete, please complete Level 1', messageTwo: '', isError: true
      }
    } else if( currentLevel === 1 ){
      return {
        isFirstMessageBold: false, messageOne: 'Level 1 Cloud Backup is complete', messageTwo: '', isError: false
      }
    } else if( currentLevel === 2 ){
      return {
        isFirstMessageBold: false, messageOne: 'Level 2 Double Backup is complete', messageTwo: '', isError: false
      }
    } else if( currentLevel == 3 ){
      return {
        isFirstMessageBold: true, messageOne: 'Level 3 Multi-key Backup is complete', messageTwo: '', isError: false
      }
    }
  }

  return (
    <View style={{
      ...styles.headerViewContainer, flex: 1
    }}>
      <View style={{
        flexDirection: 'row', alignItems: 'center'
      }}>
        <View style={{
          flex: 1, justifyContent: 'center', alignItems: 'flex-start'
        }}>
          <View
            style={{
              justifyContent: 'center',
              alignItems: 'flex-start',
            }}
          >
            <Text style={styles.headerTitleText}>{`${walletName}’s Wallet`}</Text>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
              }}
            >
              {prefersBitcoin ? (
                <Image
                  style={{
                    ...CommonStyles.homepageAmountImage,
                    marginTop: hp( 0.2 )
                  }}
                  source={require( '../../assets/images/icons/icon_bitcoin_light.png' )}
                />
              ) : materialIconCurrencyCodes.includes( fiatCurrencyCode ) ? (
                <MaterialCurrencyCodeIcon
                  currencyCode={fiatCurrencyCode}
                  color={Colors.white}
                  size={RFValue( 16 )}
                  style={{
                    marginRight: wp( 1 ), marginLeft:  [ 'SEK', 'BRL', 'DKK', 'ISK', 'KRW', 'PLN', 'SEK' ].includes( fiatCurrencyCode  ) ? 0 : -wp( 1 )
                  }}
                />
              ) : (
                <Image
                  style={{
                    ...styles.cardBitCoinImage,
                  }}
                  source={getCurrencyImageByRegion( fiatCurrencyCode, 'light' )}
                />
              )}
              <Text style={styles.homeHeaderAmountText}>
                {prefersBitcoin
                  ? UsNumberFormat( netBalance )
                  : exchangeRates && exchangeRates[ CurrencyCode ]
                    ? (
                      ( netBalance / SATOSHIS_IN_BTC ) *
                    exchangeRates[ CurrencyCode ].last
                    ).toFixed( 2 )
                    : 0}
              </Text>
              <Text style={styles.homeHeaderAmountUnitText}>
                {prefersBitcoin ? 'sats' : fiatCurrencyCode}
              </Text>
            </View>
          </View>
        </View>
        <TouchableOpacity
          onPress={navigateToQRScreen}
          style={{
            height: wp( '9%' ),
            width: wp( '10%' ),
            justifyContent: 'center',
            marginLeft: 'auto',
          }}
        >
          <ImageBackground
            source={require( '../../assets/images/icons/qr.png' )}
            style={{
              width: wp( '7%' ), height: wp( '7%' ), marginLeft: 'auto',
            }}
            resizeMode={'contain'}
          >
            {notificationData.findIndex( ( value ) => value.read == false ) > -1 ? (
              <View
                style={{
                  backgroundColor: Colors.red,
                  height: wp( '2.5%' ),
                  width: wp( '2.5%' ),
                  borderRadius: wp( '2.5%' ) / 2,
                  alignSelf: 'flex-end',
                }}
              />
            ) : null}
          </ImageBackground>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onPressNotifications}
          style={{
            height: wp( '9%' ),
            width: wp( '10%' ),
            justifyContent: 'center',
            marginLeft: 'auto',
            // marginTop: hp( 1 )
          }}
        >
          <ImageBackground
            source={require( '../../assets/images/icons/icon_notification.png' )}
            style={{
              width: wp( '6%' ), height: wp( '6%' ), marginLeft: 'auto'
            }}
            resizeMode={'contain'}
          >
            {notificationData.findIndex( ( value ) => value.status === 'unread' ) > -1 ? (
              <View
                style={{
                  backgroundColor: Colors.red,
                  height: wp( '2.5%' ),
                  width: wp( '2.5%' ),
                  borderRadius: wp( '2.5%' ) / 2,
                  alignSelf: 'flex-end',
                }}
              />
            ) : null}
          </ImageBackground>
        </TouchableOpacity>
      </View>
      {getMessage()}
    </View>
  )
}

export default HomeHeader

const styles = StyleSheet.create( {
  headerViewContainer: {
    marginTop: hp( '3.6%' ),
    marginLeft: wp( 5 ),
    marginRight: wp( 5 )
  },
  headerTitleText: {
    color: Colors.white,
    fontFamily: Fonts.FiraSansRegular,
    fontSize: RFValue( 25 ),
    marginBottom: wp( '1%' ),
    letterSpacing: RFValue( 0.01 )
  },
  cardBitCoinImage: {
    width: wp( '3.5%' ),
    height: wp( '3.5%' ),
    marginRight: 5,
    resizeMode: 'contain',
    // marginBottom: wp( '0.7%' ),
  },
  manageBackupMessageView: {
    marginLeft: wp( '2%' ),
    borderRadius: wp( '13' ) / 2,
    height: wp( '13' ),
    flex: 1,
    backgroundColor: Colors.deepBlue,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: wp( '5%' ),
    paddingRight: wp( '5%' ),
  },
  manageBackupMessageTextHighlight: {
    color: Colors.white,
    fontFamily: Fonts.FiraSansMediumItalic,
    fontSize: RFValue( 13 ),
  },
  manageBackupMessageText: {
    fontFamily: Fonts.FiraSansRegular,
    fontSize: RFValue( 12 ),
    color: Colors.white,
  },
  homeHeaderAmountText: {
    fontFamily: Fonts.FiraSansRegular,
    fontSize: RFValue( 19 ),
    marginRight: 5,
    color: Colors.white,
  },
  homeHeaderAmountUnitText: {
    fontFamily: Fonts.FiraSansRegular,
    fontSize: RFValue( 10 ),
    // marginBottom: 3,
    color: Colors.white,
    marginTop: hp( 0.7 )
  },
} )
