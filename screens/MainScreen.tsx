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
import {Buffer} from 'buffer';
import {useUmi} from '../components/providers/UmiProvider';
import {base58, generateSigner, percentAmount} from '@metaplex-foundation/umi';
import {createNft} from '@metaplex-foundation/mpl-token-metadata';

export default function MainScreen() {
  const {authorizeSession} = useAuthorization();
  const {connection} = useConnection();
  const umi = useUmi();
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
      try {
        // Read the image file and get the base64 string.
        const imageBytesInBase64: string = await RNFetchBlob.fs.readFile(
          photoPath,
          'base64',
        );

        // Convert base64 into raw bytes.
        const bytes = Buffer.from(imageBytesInBase64, 'base64');

        // Upload the image to Pinata
        const formData = new FormData();
        formData.append('file', {
          uri: photoPath,
          type: 'image/jpeg',
          name: 'photo.jpg',
        });

        const imageUploadResponse = await fetch(
          'https://api.pinata.cloud/pinning/pinFileToIPFS',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'multipart/form-data',
              Authorization: `Bearer ${Config.PINATA_JWT}`,
            },
            body: formData,
          },
        );

        const imageData = await imageUploadResponse.json();
        console.log(imageData);

        const walletAddress = await transact(
          async (wallet: Web3MobileWallet) => {
            const authorizationResult = await authorizeSession(wallet);
            return authorizationResult.publicKey;
          },
        );

        const metadata = {
          name: 'Lattitude mint nft',
          symbol: 'Lattitude mint',
          description: `Lattitude mint nft, minted at ${location?.latitude},${location?.longitude}`,
          image: `https://gateway.pinata.cloud/ipfs/${imageData.IpfsHash}`,
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
                uri: `https://gateway.pinata.cloud/ipfs/${imageData.IpfsHash}`,
                type: 'image/jpeg',
              },
            ],
            category: 'image',
          },
          creators: [
            {
              address: walletAddress.toBase58(),
              share: 100,
            },
          ],
        };

        // Prepare the request body for pinJSONToIPFS
        const pinJSONBody = {
          pinataContent: metadata,
          pinataOptions: {
            cidVersion: 1,
          },
          pinataMetadata: {
            name: 'Lattitude NFT Metadata',
          },
        };

        // Upload metadata to Pinata
        const metadataUploadResponse = await fetch(
          'https://api.pinata.cloud/pinning/pinJSONToIPFS',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${Config.PINATA_JWT}`,
            },
            body: JSON.stringify(pinJSONBody),
          },
        );

        const metadataData = await metadataUploadResponse.json();
        console.log(metadataData);

        const mint = generateSigner(umi);
        const tx = await createNft(umi, {
          mint: mint,
          sellerFeeBasisPoints: percentAmount(5.5),
          name: metadata.name.toString(),
          uri: `https://gateway.pinata.cloud/ipfs/${metadataData.IpfsHash}`,
        }).sendAndConfirm(umi, {
          send: {skipPreflight: true, commitment: 'confirmed', maxRetries: 3},
        });

        const signature = base58.deserialize(tx.signature)[0];
        console.log(
          'transaction: ',
          `https://explorer.solana.com/tx/${signature}?cluster=devnet`,
        );

        // Here you would typically continue with minting the NFT using the metadata CID
        // This part depends on your specific blockchain and minting process
      } catch (error) {
        console.error('Error minting NFT:', error);
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
