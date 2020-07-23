import {
    CURRENCY_CODE,
    CURRENCY_TOGGLE_VALUE,
    FCM_TOKEN_VALUE,
    SECONDARY_DEVICE_ADDRESS_VALUE,
    RELEASE_CASES_VALUE,
    TEST_ACCOUNT_HELPER_DONE,
    TRANSACTION_HELPER_DONE,
    RECEIVE_HELPER_DONE,
    SEND_HELPER_DONE,
    SAVING_WARNING,
    TWO_FA_SETUP
  } from '../actions/preferences';
import { UPDATE_APP_PREFERENCE } from "../constants";
import { chain } from 'icepick';

const initialState = {
    isInternetModalCome: false,
    currencyCode: null,
    currencyToggleValue: null,
    fcmTokenValue: '',
    secondaryDeviceAddressValue: '',
    releaseCasesValue: null,
    isTestHelperDoneValue: false,
    isTransactionHelperDoneValue: false,
    isReceiveHelperDoneValue: false,
    savingWarning: false,
    isSendHelperDoneValue: false,
    isTwoFASetupDone: false,
}

export default (state = initialState, { type, payload }) => {
    switch (type) {
        case UPDATE_APP_PREFERENCE:
            return chain(state).setIn([payload.key], payload.value).value()
            case CURRENCY_CODE:
              return {
                ...state,
                currencyCode: payload.currencyCode,
              };
              case CURRENCY_TOGGLE_VALUE:
              return {
                ...state,
                currencyToggleValue: payload.currencyToggleValue,
              };
              case FCM_TOKEN_VALUE:
              return {
                ...state,
                fcmTokenValue: payload.fcmTokenValue,
              };
              case SECONDARY_DEVICE_ADDRESS_VALUE:
              return {
                ...state,
                secondaryDeviceAddressValue: payload.secondaryDeviceAddressValue,
              };
              case RELEASE_CASES_VALUE:
              return {
                ...state,
                releaseCasesValue: payload.releaseCasesValue,
              };
              case TEST_ACCOUNT_HELPER_DONE:
              return {
                ...state,
                isTestHelperDoneValue: payload.isTestHelperDoneValue,
              };
              case TRANSACTION_HELPER_DONE:
              return {
                ...state,
                isTransactionHelperDoneValue: payload.isTransactionHelperDoneValue,
              };
              case RECEIVE_HELPER_DONE:
              return {
                ...state,
                isReceiveHelperDoneValue: payload.isReceiveHelperDoneValue,
              };
              case SEND_HELPER_DONE:
              return {
                ...state,
                isSendHelperDoneValue: payload.isSendHelperDoneValue,
              };
              case SAVING_WARNING:
              return {
                ...state,
                savingWarning: payload.savingWarning,
              };
        default:
            return state
    }
}
