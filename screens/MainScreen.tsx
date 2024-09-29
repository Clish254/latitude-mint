import React, {useCallback, useEffect, useState} from 'react';
import {
  Button,
  Image,
  PermissionsAndroid,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {Section} from '../components/Section';
import ConnectButton from '../components/ConnectButton';
import AccountInfo from '../components/AccountInfo';
import {
  useAuthorization,
  Account,
} from '../components/providers/AuthorizationProvider';
import {useConnection} from '../components/providers/ConnectionProvider';
import DisconnectButton from '../components/DisconnectButton';
import RequestAirdropButton from '../components/RequestAirdropButton';
import SignMessageButton from '../components/SignMessageButton';
import SignTransactionButton from '../components/SignTransactionButton';
import TakePhotoButton from '../components/TakePhotoButton';
import Geolocation from '@react-native-community/geolocation';
import RNFetchBlob from 'rn-fetch-blob';
import Config from 'react-native-config';
import {
  transact,
  Web3MobileWallet,
} from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';
import useMetaplex from '../metaplex-util/useMetaplex';

export default function MainScreen() {
  const {authorizeSession} = useAuthorization();
  const {connection} = useConnection();
  const {selectedAccount} = useAuthorization();
  const [balance, setBalance] = useState<number | null>(null);
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [isMinting, setIsMinting] = useState<boolean>(false);
  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  const fetchAndUpdateBalance = useCallback(
    async (account: Account) => {
      console.log('Fetching balance for: ' + account.publicKey);
      const fetchedBalance = await connection.getBalance(account.publicKey);
      console.log('Balance fetched: ' + fetchedBalance);
      setBalance(fetchedBalance);
    },
    [connection],
  );

  useEffect(() => {
    if (!selectedAccount) {
      return;
    }
    fetchAndUpdateBalance(selectedAccount);
  }, [fetchAndUpdateBalance, selectedAccount]);

  const handlePhotoTaken = useCallback((uri: string) => {
    setPhotoPath(uri);
    getCurrentLocation();
  }, []);

  const requestLocationPermission = async () => {
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: 'Location Permission',
          message: 'This app needs access to your location.',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        },
      );
      if (granted === PermissionsAndroid.RESULTS.GRANTED) {
        getCurrentLocation();
      } else {
        console.log('Location permission denied');
      }
    } catch (err) {
      console.warn(err);
    }
  };

  const getCurrentLocation = () => {
    Geolocation.getCurrentPosition(
      position => {
        const {latitude, longitude} = position.coords;
        setLocation({latitude, longitude});
      },
      error => {
        console.log(error.code, error.message);
      },
      {enableHighAccuracy: true, timeout: 15000, maximumAge: 10000},
    );
  };

  const mintNft = async () => {
    if (photoPath) {
      // Read the image file and get the base64 string.
      const imageBytesInBase64: string = await RNFetchBlob.fs.readFile(
        photoPath,
        'base64',
      );

      // Convert base64 into raw bytes.
      const bytes = Buffer.from(imageBytesInBase64, 'base64');

      // Upload the image to IPFS by sending a POST request to the NFT.storage upload endpoint.
      const headers = {
        Accept: 'application/json',
        Authorization: `Bearer ${Config.NFT_STORAGE_API_KEY}`,
      };
      const imageUpload = await fetch('https://api.nft.storage/upload', {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'image/jpg',
        },
        body: bytes,
      });

      const imageData = await imageUpload.json();
      console.log(imageData.value.cid);
      const walletAddress = await transact(async (wallet: Web3MobileWallet) => {
        const authorizationResult = await authorizeSession(wallet);
        return authorizationResult.address;
      });
      const metadata = {
        name: 'Lattitude mint nft',
        description: `Lattitude mint nft, minted at ${location?.latitude},${location?.longitude}`,
        image: `https://ipfs.io/ipfs/${imageData.value.cid}`,
        external_url: 'https://github.com/Laugharne/ssf_s7_exo',
        attributes: [
          {
            trait_type: 'Latitude',
            value: location?.latitude,
          },
          {
            trait_type: 'Longitude',
            value: location?.longitude,
          },
        ],
        properties: {
          files: [
            {
              uri: `https://ipfs.io/ipfs/${imageData.value.cid}`,
              type: 'image/jpeg',
            },
          ],
          category: 'image',
        },
        creators: [
          {
            address: walletAddress,
            share: 100,
          },
        ],
      };
      // Upload to IPFS
      const metadataUpload = await fetch('https://api.nft.storage/upload', {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(metadata),
      });
      const metadataData = await metadataUpload.json();
      console.log(metadataData.value.cid);
      const {metaplex} = useMetaplex(
        connection,
        selectedAccount,
        authorizeSession,
      );

      if (metaplex) {
        const {nft, response} = await metaplex.nfts().create({
          name: metadata.name,
          uri: `https://ipfs.io/ipfs/${metadataData.value.cid}`,
          sellerFeeBasisPoints: 0,
          tokenOwner: selectedAccount?.publicKey,
        });
        console.log(nft.address.toBase58());
        console.log(response.signature);
      }
    }
  };

  useEffect(() => {
    requestLocationPermission();
  }, []);

  return (
    <>
      <View style={styles.mainContainer}>
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          {selectedAccount ? (
            <>
              <Section title="Take a photo">
                <TakePhotoButton onPhotoTaken={handlePhotoTaken} />
                {photoPath && (
                  <>
                    <Image
                      source={{uri: photoPath}}
                      style={styles.photo}
                      resizeMode="contain"
                    />
                    {location && (
                      <Text style={styles.locationText}>
                        Location: {location.latitude.toFixed(6)},{' '}
                        {location.longitude.toFixed(6)}
                      </Text>
                    )}
                    {photoPath && location && (
                      <Button
                        title="Mint"
                        disabled={isMinting}
                        onPress={async () => {
                          if (isMinting) {
                            return;
                          }
                          try {
                            setIsMinting(true);
                            await mintNft();
                          } catch (err: any) {
                            console.error(err);
                          } finally {
                            setIsMinting(false);
                          }
                        }}
                      />
                    )}
                  </>
                )}
              </Section>
            </>
          ) : null}
        </ScrollView>
        {selectedAccount ? (
          <AccountInfo
            selectedAccount={selectedAccount}
            balance={balance}
            fetchAndUpdateBalance={fetchAndUpdateBalance}
          />
        ) : (
          <ConnectButton title="Connect wallet" />
        )}
        <Text>Selected cluster: {connection.rpcEndpoint}</Text>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    height: '100%',
    padding: 16,
    flex: 1,
  },
  scrollContainer: {
    height: '100%',
  },
  buttonGroup: {
    flexDirection: 'column',
    paddingVertical: 4,
  },
  photo: {
    width: '100%',
    height: 200,
    marginTop: 10,
  },
  locationText: {
    marginTop: 10,
    fontSize: 16,
  },
});
