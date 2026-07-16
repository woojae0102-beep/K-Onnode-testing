// @ts-nocheck
/**
 * Avatar Asset library — admin upload/select, Firestore metadata.
 */
import type { AvatarAssetRecord } from '../../types/productionDanceAsset';
import { authHeaders } from '../../utils/apiAuth';
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { auth, storage } from '../../firebase';

const API = '/api/group?path=avatar-assets';

export async function listAvatarAssets(groupId: string): Promise<AvatarAssetRecord[]> {
  const headers = await authHeaders();
  const res = await fetch(`${API}&groupId=${encodeURIComponent(groupId)}`, { headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'avatar_list_failed');
  }
  return data.assets || [];
}

export async function uploadAvatarAssetFile(opts: {
  groupId: string;
  memberId: string;
  memberName?: string;
  file: File;
  skeletonType?: string;
}): Promise<AvatarAssetRecord> {
  const user = auth?.currentUser;
  if (!user) throw new Error('ADMIN_ACCESS_REQUIRED: 로그인이 필요합니다.');
  if (!storage) throw new Error('Firebase Storage 설정이 필요합니다.');

  const assetId = `${opts.groupId}__${opts.memberId}__${Date.now()}`;
  const storagePath = `production-avatars/${opts.groupId}/${assetId}.glb`;
  const storageRef = ref(storage, storagePath);

  await new Promise<void>((resolve, reject) => {
    const task = uploadBytesResumable(storageRef, opts.file, {
      contentType: opts.file.type || 'model/gltf-binary',
    });
    task.on('state_changed', () => {}, reject, () => resolve());
  });

  const url = await getDownloadURL(storageRef);
  const headers = await authHeaders({ 'Content-Type': 'application/json' });
  const res = await fetch(API, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      asset: {
        id: assetId,
        groupId: opts.groupId,
        memberId: opts.memberId,
        memberName: opts.memberName,
        url,
        format: 'glb',
        skeletonType: opts.skeletonType || 'humanoid-v1',
        version: 1,
        status: 'ready',
      },
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'avatar_save_failed');
  return data.asset;
}

export async function uploadAvatarViaAdminApi(opts: {
  groupId: string;
  memberId: string;
  memberName?: string;
  file: File;
}): Promise<AvatarAssetRecord> {
  const headers = await authHeaders();
  const form = new FormData();
  form.append('groupId', opts.groupId);
  form.append('memberId', opts.memberId);
  if (opts.memberName) form.append('memberName', opts.memberName);
  form.append('avatar', opts.file);
  const res = await fetch(API, { method: 'POST', headers, body: form });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'avatar_upload_failed');
  return data.asset;
}

export default { listAvatarAssets, uploadAvatarAssetFile, uploadAvatarViaAdminApi };
