import React from 'react';
import {
  ImageBackground,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import {Colors} from './Colors';

export function Header() {
  const isDarkMode = useColorScheme() === 'dark';
  return (
    //<ImageBackground
    //  accessibilityRole="image"
    //  testID="new-app-screen-header"
    //  source={require('../img/background.png')}
    //  style={[
    //    styles.background,
    //    {
    //      backgroundColor: isDarkMode ? Colors.darker : Colors.lighter,
    //    },
    //  ]}
    //  imageStyle={styles.logo}>
    <View
      style={[
        styles.background,
        {
          backgroundColor: isDarkMode ? Colors.darker : Colors.darker,
        },
      ]}>
      <Text style={styles.title}>Latitude</Text>
      <Text style={styles.subtitle}>Mint</Text>
    </View>
    //</ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    paddingBottom: 40,
    paddingTop: 60,
    paddingHorizontal: 32,
  },
  logo: {
    overflow: 'visible',
    resizeMode: 'cover',
  },
  subtitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '500',
    textAlign: 'center',
  },
  title: {
    color: '#fff',
    fontSize: 40,
    fontWeight: '700',
    textAlign: 'center',
  },
});
