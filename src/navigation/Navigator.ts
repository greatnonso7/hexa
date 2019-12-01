import { createAppContainer, createSwitchNavigator } from "react-navigation";
import { createStackNavigator } from "react-navigation-stack";

import Launch from "../pages/Launch";
import PasscodeConfirm from "../pages/PasscodeConfirm";
import RestoreAndReoverWallet from "../pages/RestoreAndReoverWallet";
import RestoreSelectedContactsList from "../pages/RestoreSelectedContactsList";
import Home from "../pages/Home";
import NewWalletName from "../pages/NewWalletName";
import NewWalletQuestion from "../pages/NewWalletQuestion";
import RestoreWalletBySecondaryDevice from "../pages/RestoreWalletBySecondaryDevice";
import RestoreWalletUsingDocuments from "../pages/RestoreWalletUsingDocuments";
import RestoreWalletByContacts from "../pages/RestoreWalletByContacts";
import ManageBackup from "../pages/ManageBackup";

const HomeNavigator = createStackNavigator(
  {
    Home,
    ManageBackup
  },
  {
    headerLayoutPreset: "center",
    defaultNavigationOptions: ({ navigation }) => ({
      header: null
    })
  }
);

const SetupNavigator = createStackNavigator(
  {
    Launch,
    PasscodeConfirm,
    NewWalletName,
    NewWalletQuestion,
    RestoreAndReoverWallet,
    RestoreSelectedContactsList,
    RestoreWalletBySecondaryDevice,
    RestoreWalletUsingDocuments,
    RestoreWalletByContacts
  },
  {
    initialRouteName: "Launch",
    headerLayoutPreset: "center",
    defaultNavigationOptions: ({ navigation }) => ({
      header: null
    })
  }
);

const Navigator = createSwitchNavigator({
  SetupNav: SetupNavigator,
  HomeNav: HomeNavigator
});

export default createAppContainer(Navigator);
