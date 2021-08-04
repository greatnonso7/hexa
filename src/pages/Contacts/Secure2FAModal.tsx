import React, { useState, useEffect } from 'react'
import {
  View,
  TouchableOpacity,
  Text,
  SafeAreaView,
  StyleSheet,
} from 'react-native'
import Colors from '../../common/Colors'
import Fonts from '../../common/Fonts'
import { RFValue } from 'react-native-responsive-fontsize'
import FontAwesome from 'react-native-vector-icons/FontAwesome'
import { DeepLinkEncryptionType } from '../../bitcoin/utilities/Interface'
import { heightPercentageToDP as hp, widthPercentageToDP as wp } from 'react-native-responsive-screen'
import CardWithRadioBtn from '../../components/CardWithRadioBtn'
import idx from 'idx'
import * as ExpoContacts from 'expo-contacts'

export default function Secure2FA( props ) {

  const [ activeType, setActiveType ] = useState( DeepLinkEncryptionType.NUMBER )
  // const [ contactData, setContactData ] = useState( null )
  const [ phoneNumbers, setPhoneumber ] = useState( props.Contact.phoneNumbers )
  const [ emails, setEmails ] = useState( props.Contact.emails )

  useEffect( ()=>{
    getContact()
  }, [] )
  const getContact = () => {
    if ( !phoneNumbers || !emails ) {
      ExpoContacts.getContactsAsync().then( async ( { data } ) => {
        const filteredData = data.find( item => item.id === props.Contact.id )
        setPhoneumber( filteredData.phoneNumbers )
        setEmails( filteredData.emails )
      // await AsyncStorage.setItem( 'ContactData', JSON.stringify( data ) )
      } )
    }
  }
  return (
    <SafeAreaView style={{
      backgroundColor: Colors.backgroundColor
    }}>
      <TouchableOpacity
        activeOpacity={1}
        onPress={() => {props.closeBottomSheet()}}
        style={{
          width: wp( 7 ), height: wp( 7 ), borderRadius: wp( 7/2 ),
          alignSelf: 'flex-end',
          backgroundColor: Colors.lightBlue, alignItems: 'center', justifyContent: 'center',
          marginTop: wp( 3 ), marginRight: wp( 3 )
        }}
      >
        <FontAwesome name="close" color={Colors.white} size={19} style={{
        // marginTop: hp( 0.5 )
        }} />
      </TouchableOpacity>
      <View style={{
        // alignSelf: 'baseline'
      }}>
        <View style={{
          marginLeft: wp( 6 ),
        }}>
          <Text style={styles.modalTitleText}>Secure with 2FA</Text>
          <Text style={{
            ...styles.modalInfoText,
            marginTop: wp( 1.5 ),
            marginBottom: wp( 3 ),
            marginRight: wp( 11 )
          }}>Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor</Text>
        </View>
        {phoneNumbers && phoneNumbers[ 0 ].number &&
        <CardWithRadioBtn
          icon={''}
          mainText={'Confirm phone number'}
          subText={phoneNumbers[ 0 ].number}
          isSelected={activeType === DeepLinkEncryptionType.NUMBER}
          setActiveIndex={setActiveType}
          index={DeepLinkEncryptionType.NUMBER}
        />
        }
        {emails && emails[ 0 ].email &&
        <CardWithRadioBtn
          icon={''}
          mainText={'Confirm email address'}
          subText={emails[ 0 ].email}
          isSelected={activeType === DeepLinkEncryptionType.DEFAULT}
          setActiveIndex={setActiveType}
          index={DeepLinkEncryptionType.DEFAULT}
        />
        }
        <CardWithRadioBtn
          icon={''}
          mainText={'Confirm with OTP'}
          subText={'Lorem ipsum dolor sit amet'}
          isSelected={activeType === DeepLinkEncryptionType.OTP}
          setActiveIndex={setActiveType}
          index={DeepLinkEncryptionType.OTP}
        />
      </View>
      <Text style={styles.bottomNoteInfoText}>
      Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do ei
      </Text>
      <View style={{
        marginTop: 'auto', marginBottom: hp( 2 )
      }}>
        <TouchableOpacity
          onPress={() => {
            props.onConfirm( activeType )
            //props.navigation.navigate('SettingGetNewPin')
            //PinChangeSuccessBottomSheet.current.snapTo(1);
          }}
          style={{
            ...styles.proceedButtonView,
            backgroundColor:Colors.blue,
          }}
        >
          <Text style={styles.proceedButtonText}>Proceed</Text>
        </TouchableOpacity>
      </View>

    </SafeAreaView>
  )
}

const styles = StyleSheet.create( {
  bottomNoteInfoText: {
    color: Colors.textColorGrey,
    fontSize: RFValue( 12 ),
    fontFamily: Fonts.FiraSansRegular,
    marginLeft: wp( 8 ),
    marginVertical: wp( 4 ),
    width: '85%'
  },
  statusIndicatorView: {
    flexDirection: 'row',
    marginLeft: 'auto',
    marginHorizontal: wp( '6%' ),
    marginBottom: hp( 1 ),
    // marginTop: hp( 9 )
  },
  statusIndicatorActiveView: {
    height: 5,
    width: 25,
    backgroundColor: Colors.blue,
    borderRadius: 10,
    marginLeft: 5,
  },
  statusIndicatorInactiveView: {
    width: 5,
    backgroundColor: Colors.lightBlue,
    borderRadius: 10,
    marginLeft: 5,
  },
  modalBoldText: {
    color: Colors.textColorGrey,
    fontSize: RFValue( 12 ),
    fontFamily: Fonts.FiraSansMedium,
    letterSpacing: 0.6,
    lineHeight: 18
  },
  modalTitleText: {
    color: Colors.blue,
    fontSize: RFValue( 18 ),
    fontFamily: Fonts.FiraSansRegular,
    // width: wp( 30 ),
  },
  modalInfoText: {
    marginRight: wp( 4 ),
    color: Colors.textColorGrey,
    fontSize: RFValue( 12 ),
    fontFamily: Fonts.FiraSansRegular,
    textAlign: 'justify',
    letterSpacing: 0.6,
    lineHeight: 18
  },
  keyPadRow: {
    flexDirection: 'row',
    height: hp( '8%' ),
  },
  errorText: {
    fontFamily: Fonts.FiraSansMediumItalic,
    color: Colors.red,
    fontSize: RFValue( 11, 812 ),
    fontStyle: 'italic',
  },
  keyPadElementTouchable: {
    flex: 1,
    height: hp( '8%' ),
    fontSize: RFValue( 18 ),
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyPadElementText: {
    color: Colors.blue,
    fontSize: RFValue( 25 ),
    fontFamily: Fonts.FiraSansRegular,
    fontStyle: 'normal',
  },
  proceedButtonView: {
    marginLeft: wp( 6 ),
    marginTop: hp( '3%' ),
    height: wp( '13%' ),
    width: wp( '30%' ),
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    elevation: 10,
    shadowColor: Colors.shadowBlue,
    shadowOpacity: 1,
    shadowOffset: {
      width: 15, height: 15
    },
    marginBottom: hp( '1%' ),
  },
  proceedButtonText: {
    color: Colors.white,
    fontSize: RFValue( 13 ),
    fontFamily: Fonts.FiraSansMedium,
  },
  passcodeTextInputText: {
    color: Colors.blue,
    fontWeight: 'bold',
    fontSize: RFValue( 13 ),
  },
  textStyles: {
    color: Colors.black,
    fontSize: RFValue( 13 ),
    textAlign: 'center',
    lineHeight: 18,
  },
  textFocused: {
    color: Colors.black,
    fontSize: RFValue( 13 ),
    textAlign: 'center',
    lineHeight: 18,
  },
  textBoxStyles: {
    borderWidth: 0.5,
    height: wp( '13%' ),
    width: wp( '13%' ),
    borderRadius: 7,
    marginLeft: wp( 6 ),
    borderColor: Colors.borderColor,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
  },
  textBoxActive: {
    borderWidth: 0.5,
    height: wp( '13%' ),
    width: wp( '13%' ),
    borderRadius: 7,
    marginLeft: wp( 6 ),
    elevation: 10,
    shadowColor: Colors.borderColor,
    shadowOpacity: 0.35,
    shadowOffset: {
      width: 0, height: 3
    },
    borderColor: Colors.borderColor,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
  },
  passcodeTextInputView: {
    flexDirection: 'row',
    marginTop: hp( '1%' ),
    marginBottom: hp( '2%' ),
  },
  boldItalicText: {
    fontFamily: Fonts.FiraSansMediumItalic,
    fontWeight: 'bold',
    fontStyle: 'italic',
  },
  headerTitleText: {
    color: Colors.blue,
    fontSize: RFValue( 25 ),
    marginLeft: wp( 6 ),
    marginTop: hp( '10%' ),
    fontFamily: Fonts.FiraSansRegular,
  },
  headerInfoText: {
    marginTop: hp( '2%' ),
    color: Colors.textColorGrey,
    fontSize: RFValue( 12 ),
    marginLeft: wp( 6 ),
    fontFamily: Fonts.FiraSansRegular,
  },
} )