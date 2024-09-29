import React, {useState, useCallback} from 'react';
import {Button, Alert} from 'react-native';
import {fromUint8Array} from 'js-base64';
import {
  transact,
  Web3MobileWallet,
} from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';

import {useAuthorization} from './providers/AuthorizationProvider';
import {alertAndLog} from '../util/alertAndLog';
import {launchCamera} from 'react-native-image-picker';

interface TakePhotoButtonProps {
  onPhotoTaken: (uri: string) => void;
}
export default function TakePhotoButton({onPhotoTaken}: TakePhotoButtonProps) {
  const [takingPhoto, setTakingPhoto] = useState(false);

  const takePhoto = async () => {
    const photo = await launchCamera({
      mediaType: 'photo',
    });
    const selectedPhoto = photo?.assets?.[0];
    if (!selectedPhoto?.uri) {
      console.warn('Selected photo not found');
      return;
    }
    const imagePath = selectedPhoto.uri;
    if (imagePath) {
      onPhotoTaken(imagePath);
    }
  };

  return (
    <Button
      title="Take Photo"
      disabled={takingPhoto}
      onPress={async () => {
        if (takingPhoto) {
          return;
        }
        setTakingPhoto(true);
        try {
          await takePhoto();
        } catch (err: any) {
          alertAndLog(
            'Error during takingPhoto',
            err instanceof Error ? err.message : err,
          );
        } finally {
          setTakingPhoto(false);
        }
      }}
    />
  );
}
