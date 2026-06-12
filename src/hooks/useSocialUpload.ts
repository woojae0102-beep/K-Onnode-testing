// @ts-nocheck
import { useCallback, useState } from 'react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { auth, db, storage } from '../firebase';

function slug(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9가-힣_-]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'shorts';
}

export function useSocialUpload() {
  const [progressByPlatform, setProgressByPlatform] = useState({});
  const [storageProgress, setStorageProgress] = useState(0);

  const uploadToStorage = useCallback(async ({ videoBlob, trackType, caption }) => {
    const user = auth?.currentUser;
    if (!user) throw new Error('로그인이 필요합니다.');
    if (!storage) throw new Error('Firebase Storage 설정이 필요합니다.');

    const fileName = `${Date.now()}-${slug(trackType)}.mp4`;
    const storageRef = ref(storage, `shorts/${user.uid}/${fileName}`);
    await new Promise((resolve, reject) => {
      const task = uploadBytesResumable(storageRef, videoBlob, {
        contentType: 'video/mp4',
        customMetadata: {
          caption: caption || '',
          trackType: trackType || 'practice',
        },
      });
      task.on(
        'state_changed',
        (snapshot) => {
          const pct = snapshot.totalBytes ? Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100) : 0;
          setStorageProgress(pct);
        },
        reject,
        resolve,
      );
    });
    const videoUrl = await getDownloadURL(storageRef);
    return { videoUrl, storagePath: storageRef.fullPath };
  }, []);

  const uploadToPlatform = useCallback(async (platform, payload) => {
    const user = auth?.currentUser;
    if (!user) throw new Error('로그인이 필요합니다.');
    const idToken = await user.getIdToken();
    setProgressByPlatform((prev) => ({ ...prev, [platform]: 10 }));

    const res = await fetch('/api/group?path=shorts-upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idToken,
        platform,
        videoUrl: payload.videoUrl,
        storagePath: payload.storagePath,
        caption: payload.caption,
        title: payload.title || payload.caption,
        tags: payload.tags,
        trackType: payload.trackType,
      }),
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || `${platform} 업로드 실패`);
    setProgressByPlatform((prev) => ({ ...prev, [platform]: 100 }));
    return data;
  }, []);

  const uploadMany = useCallback(async ({ platforms, videoBlob, caption, tags, trackType }) => {
    if (!videoBlob) throw new Error('업로드할 쇼츠 영상이 없습니다.');
    const user = auth?.currentUser;
    if (!user) throw new Error('로그인이 필요합니다.');
    const storageInfo = await uploadToStorage({ videoBlob, trackType, caption });
    const results = [];

    for (const platform of platforms) {
      try {
        const result = await uploadToPlatform(platform, {
          ...storageInfo,
          videoBlob,
          caption,
          tags,
          trackType,
        });
        results.push({ platform, success: true, ...result });
      } catch (err) {
        results.push({ platform, success: false, error: err?.message || String(err) });
      }
    }

    try {
      await addDoc(collection(db, 'users', user.uid, 'shorts_uploads'), {
        trackType,
        caption,
        tags,
        storagePath: storageInfo.storagePath,
        videoUrl: storageInfo.videoUrl,
        results,
        createdAt: serverTimestamp(),
      });
    } catch {
      /* upload itself already completed */
    }

    return results;
  }, [uploadToPlatform, uploadToStorage]);

  return {
    uploadMany,
    uploadToPlatform,
    uploadToStorage,
    progressByPlatform,
    storageProgress,
  };
}

export default useSocialUpload;
