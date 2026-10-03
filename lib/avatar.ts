import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

import { supabase } from './supabase';

const BUCKET = 'profile-images';

export type AvatarCrop = {
  originX: number;
  originY: number;
  width: number;
  height: number;
};

export async function cropAvatar(uri: string, crop?: AvatarCrop) {
  return manipulateAsync(
    uri,
    crop ? [{ crop }] : [],
    {
      compress: 0.86,
      format: SaveFormat.JPEG,
      base64: true,
    }
  );
}

export async function uploadAvatar(userId: string, uri: string, base64?: string | null) {
  const path = `${userId}/avatar.jpg`;
  const body = base64 ? decodeBase64(base64) : await uriToBlob(uri);

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, body, {
      contentType: 'image/jpeg',
      upsert: true,
    });

  if (error) return { avatarUrl: null, error };

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return {
    avatarUrl: `${data.publicUrl}?v=${Date.now()}`,
    error: null,
  };
}

export async function removeAvatar(userId: string) {
  return supabase.storage.from(BUCKET).remove([`${userId}/avatar.jpg`]);
}

function decodeBase64(base64: string) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const clean = base64.replace(/=+$/, '');
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;

  for (const char of clean) {
    const value = chars.indexOf(char);
    if (value < 0) continue;
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }

  return new Uint8Array(bytes);
}

async function uriToBlob(uri: string) {
  const response = await fetch(uri);
  return response.blob();
}
