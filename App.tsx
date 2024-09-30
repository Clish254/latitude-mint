import {
  ConnectionProvider,
  RPC_ENDPOINT,
} from './components/providers/ConnectionProvider';
import {clusterApiUrl} from '@solana/web3.js';
import React from 'react';
import {SafeAreaView, StyleSheet} from 'react-native';
import {AuthorizationProvider} from './components/providers/AuthorizationProvider';
import {Header} from './components/Header';

import MainScreen from './screens/MainScreen';
import {UmiProvider} from './components/providers/UmiProvider';

export default function App() {
  return (
    <ConnectionProvider
      config={{commitment: 'processed'}}
      endpoint={clusterApiUrl(RPC_ENDPOINT)}>
      <AuthorizationProvider>
        <UmiProvider endpoint={clusterApiUrl(RPC_ENDPOINT)}>
          <SafeAreaView style={styles.shell}>
            <Header />
            <MainScreen />
          </SafeAreaView>
        </UmiProvider>
      </AuthorizationProvider>
    </ConnectionProvider>
  );
}

const styles = StyleSheet.create({
  shell: {
    height: '100%',
  },
});
