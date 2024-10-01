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

import {fromUint8Array} from 'js-base64';
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
//import {createNft} from '@metaplex-foundation/mpl-token-metadata';
import {Keypair, PublicKey, SystemProgram, Transaction} from '@solana/web3.js';
import {createCreateMetadataAccountV3Instruction} from '@metaplex-foundation/mpl-token-metadata';
import {
  createAssociatedTokenAccountInstruction,
  createInitializeMintInstruction,
  createMintToInstruction,
  getAssociatedTokenAddress,
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import {alertAndLog} from '../util/alertAndLog';

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
          symbol: 'Latt',
          description: `Lattitude mint nft, minted at ${location?.latitude},${location?.longitude}`,
          image: `https://gateway.pinata.cloud/ipfs/${imageData.IpfsHash}`,
          external_url: 'https://github.com/Clish254/latitude-mint',
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
              address: walletAddress,
              verified: false,
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

        const mint = new Keypair();
        const TOKEN_METADATA_PROGRAM_ID = new PublicKey(
          'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s',
        );
        const mintMetadata = {
          name: metadata.name,
          symbol: metadata.symbol,
          uri: `https://gateway.pinata.cloud/ipfs/${metadataData.IpfsHash}`,
          sellerFeeBasisPoints: 500,
          creators: metadata.creators,
          collection: null,
          uses: null,
        };
        const metadataPDAAndBump = PublicKey.findProgramAddressSync(
          [
            Buffer.from('metadata'),
            TOKEN_METADATA_PROGRAM_ID.toBuffer(),
            mint.publicKey.toBuffer(),
          ],
          TOKEN_METADATA_PROGRAM_ID,
        );

        const metadataPDA = metadataPDAAndBump[0];

        const signedTransaction = await transact(
          async (wallet: Web3MobileWallet) => {
            const [authorizationResult, latestBlockhash] = await Promise.all([
              authorizeSession(wallet),
              connection.getLatestBlockhash(),
            ]);
            console.log('Creating new mint...');

            // Calculate rent for mint
            const lamports = await connection.getMinimumBalanceForRentExemption(
              MINT_SIZE,
            );
            // Create instructions
            const createAccountInstruction = SystemProgram.createAccount({
              fromPubkey: walletAddress,
              newAccountPubkey: mint.publicKey,
              space: MINT_SIZE,
              lamports,
              programId: TOKEN_PROGRAM_ID,
            });
            const initializeMintInstruction = createInitializeMintInstruction(
              mint.publicKey,
              0,
              walletAddress,
              walletAddress,
            );
            // Get the associated token account address
            const associatedTokenAddress = await getAssociatedTokenAddress(
              mint.publicKey,
              walletAddress,
            );

            // Create the associated token account if it doesn't exist
            const createAssociatedTokenAccountIx =
              createAssociatedTokenAccountInstruction(
                walletAddress,
                associatedTokenAddress,
                walletAddress,
                mint.publicKey,
              );

            // Create mint-to instruction
            const mintToInstruction = createMintToInstruction(
              mint.publicKey,
              associatedTokenAddress,
              walletAddress,
              1,
            );
            // Create metadata account instruction
            // check https://solana.stackexchange.com/questions/7909/how-to-build-an-instruction-to-a-create-metadata-account-using-latest-mpl-token
            const createMetadataAccountInstruction =
              createCreateMetadataAccountV3Instruction(
                {
                  metadata: metadataPDA,
                  mint: mint.publicKey,
                  mintAuthority: authorizationResult.publicKey,
                  payer: authorizationResult.publicKey,
                  updateAuthority: authorizationResult.publicKey,
                },
                {
                  createMetadataAccountArgsV3: {
                    collectionDetails: null,
                    data: mintMetadata,
                    isMutable: true,
                  },
                },
              );
            const transaction = new Transaction({
              ...latestBlockhash,
              feePayer: authorizationResult.publicKey,
            });
            transaction.add(
              createAccountInstruction,
              initializeMintInstruction,
              createAssociatedTokenAccountIx,
              mintToInstruction,
              createMetadataAccountInstruction,
            );

            // Sign a transaction and receive
            const signedTransactions = await wallet.signTransactions({
              transactions: [transaction],
            });

            return signedTransactions[0];
          },
        );

        signedTransaction.partialSign(mint);
        const signature = await connection.sendRawTransaction(
          signedTransaction.serialize(),
        );
        await connection.confirmTransaction(signature);

        console.log(
          `NFT minted successfully. Token Mint: https://explorer.solana.com/address/${mint.publicKey.toBase58()}?cluster=devnet`,
        );
        alertAndLog(
          'NFT minted successfully🎉',
          `Token Mint: https://explorer.solana.com/address/${mint.publicKey.toBase58()}?cluster=devnet`,
        );
        console.log('signature', signature);
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
