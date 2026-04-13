/**
 * 수정됨 — Firestore 시그널링 기반 WebRTC (같은 sessionId로 P2P 비디오)
 * 경로: artifacts/{appId}/public/data/sessions/{sessionId}/webrtc/signaling
 *       artifacts/{appId}/public/data/sessions/{sessionId}/webrtcIce/{docId}
 */
import { useState, useEffect, useRef } from 'react';
import {
  doc,
  collection,
  setDoc,
  onSnapshot,
  addDoc,
  getDocs,
  serverTimestamp,
  writeBatch,
  deleteField,
} from 'firebase/firestore';

const DEFAULT_ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

function parseCsv(value) {
  return String(value || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function buildIceServers() {
  const servers = [...DEFAULT_ICE_SERVERS];
  try {
    const turnUrls = parseCsv(import.meta.env.VITE_WEBRTC_TURN_URLS);
    const turnUsername = String(import.meta.env.VITE_WEBRTC_TURN_USERNAME || '').trim();
    const turnCredential = String(import.meta.env.VITE_WEBRTC_TURN_CREDENTIAL || '').trim();

    if (turnUrls.length && turnUsername && turnCredential) {
      servers.push({
        urls: turnUrls.length === 1 ? turnUrls[0] : turnUrls,
        username: turnUsername,
        credential: turnCredential,
      });
    }
  } catch (e) {
    console.error(e);
  }
  return servers;
}

function webrtcSignalingDocRef(db, appId, sessionKey) {
  return doc(db, 'artifacts', appId, 'public', 'data', 'sessions', sessionKey, 'webrtc', 'signaling');
}

function webrtcIceCollectionRef(db, appId, sessionKey) {
  return collection(db, 'artifacts', appId, 'public', 'data', 'sessions', sessionKey, 'webrtcIce');
}

async function clearWebrtcSignaling(db, appId, sessionId) {
  try {
    const iceCol = webrtcIceCollectionRef(db, appId, sessionId);
    let hasMore = true;
    while (hasMore) {
      const snap = await getDocs(iceCol);
      if (snap.empty) {
        hasMore = false;
        break;
      }
      const batch = writeBatch(db);
      let n = 0;
      snap.forEach((d) => {
        if (n < 500) {
          batch.delete(d.ref);
          n += 1;
        }
      });
      await batch.commit();
      hasMore = snap.size >= 500;
    }
    await setDoc(
      webrtcSignalingDocRef(db, appId, sessionId),
      {
        offer: deleteField(),
        answer: deleteField(),
        resetAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (e) {
    console.error(e);
  }
}

function useWebRtcSession({ db, appId, sessionId, role, localStream, enabled }) {
  const [remoteStream, setRemoteStream] = useState(null);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);
  const [retryToken, setRetryToken] = useState(0);
  const reconnectTimerRef = useRef(null);

  useEffect(() => {
    if (!enabled || !db || !sessionId || !appId) {
      setRemoteStream(null);
      setStatus('idle');
      return undefined;
    }

    if (role === 'mobile' && !localStream) {
      setRemoteStream(null);
      setStatus('idle');
      return undefined;
    }

    let cancelled = false;
    const pc = new RTCPeerConnection({ iceServers: buildIceServers() });
    const unsubscribersRef = { current: [] };
    const processedIceIds = new Set();
    const pendingIce = [];
    let lastAnswerSdp = '';
    let lastOfferSdp = '';

    setError(null);
    setStatus('connecting');

    const signalingRef = webrtcSignalingDocRef(db, appId, sessionId);
    const iceCol = webrtcIceCollectionRef(db, appId, sessionId);

    const flushPendingIce = async () => {
      const q = pendingIce.splice(0);
      for (const candStr of q) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(JSON.parse(candStr)));
        } catch (e) {
          console.error(e);
        }
      }
    };

    const cancelReconnect = () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };

    const scheduleReconnect = () => {
      if (cancelled) return;
      cancelReconnect();
      reconnectTimerRef.current = setTimeout(() => {
        reconnectTimerRef.current = null;
        if (!cancelled) setRetryToken((n) => n + 1);
      }, 3000);
    };

    pc.onicecandidate = (ev) => {
      try {
        if (!ev.candidate || cancelled) return;
        void addDoc(iceCol, {
          from: role,
          candidate: JSON.stringify(ev.candidate.toJSON()),
          ts: Date.now(),
        });
      } catch (e) {
        console.error(e);
      }
    };

    pc.onconnectionstatechange = () => {
      try {
        const s = pc.connectionState;
        if (s === 'connected') {
          setStatus('connected');
          cancelReconnect();
        } else if (s === 'failed' || s === 'closed') {
          setStatus(s);
          setRemoteStream(null);
          scheduleReconnect();
        } else if (s === 'disconnected') {
          setStatus(s);
          cancelReconnect();
          reconnectTimerRef.current = setTimeout(() => {
            reconnectTimerRef.current = null;
            if (!cancelled && pc.connectionState === 'disconnected') {
              setRemoteStream(null);
              setRetryToken((n) => n + 1);
            }
          }, 5000);
        }
      } catch (e) {
        console.error(e);
      }
    };

    pc.oniceconnectionstatechange = () => {
      try {
        const s = pc.iceConnectionState;
        if (s === 'connected') {
          cancelReconnect();
        } else if (s === 'failed') {
          setStatus(s);
          setRemoteStream(null);
          scheduleReconnect();
        }
      } catch (e) {
        console.error(e);
      }
    };

    if (role === 'laptop') {
      pc.ontrack = (ev) => {
        try {
          const [stream] = ev.streams;
          if (stream) setRemoteStream(stream);
        } catch (e) {
          console.error(e);
        }
      };
    }

    const handleRemoteIce = (fromPeer) => (snap) => {
      try {
        snap.docChanges().forEach((ch) => {
          if (ch.type !== 'added') return;
          const id = ch.doc.id;
          if (processedIceIds.has(id)) return;
          const d = ch.doc.data();
          if (d.from !== fromPeer) return;
          const candStr = d.candidate;
          if (!pc.remoteDescription) {
            pendingIce.push(candStr);
            return;
          }
          processedIceIds.add(id);
          void pc.addIceCandidate(new RTCIceCandidate(JSON.parse(candStr))).catch((e) => console.error(e));
        });
      } catch (e) {
        console.error(e);
      }
    };

    void (async () => {
      try {
        if (role === 'mobile') {
          await clearWebrtcSignaling(db, appId, sessionId);
          if (cancelled) return;

          localStream.getTracks().forEach((t) => {
            try {
              pc.addTrack(t, localStream);
            } catch (e) {
              console.error(e);
            }
          });

          if (cancelled) return;
          unsubscribersRef.current.push(onSnapshot(iceCol, handleRemoteIce('laptop')));
          if (cancelled) return;

          unsubscribersRef.current.push(
            onSnapshot(signalingRef, async (snap) => {
              try {
                if (!snap.exists() || cancelled) return;
                const d = snap.data();
                if (!d?.answer?.sdp) {
                  lastAnswerSdp = '';
                  return;
                }
                if (d.answer.sdp === lastAnswerSdp) return;
                lastAnswerSdp = d.answer.sdp;
                await pc.setRemoteDescription(new RTCSessionDescription(d.answer));
                await flushPendingIce();
              } catch (e) {
                console.error(e);
                setError(e?.message || String(e));
              }
            })
          );

          const offer = await pc.createOffer();
          if (cancelled) return;
          await pc.setLocalDescription(offer);
          if (cancelled) return;
          await setDoc(
            signalingRef,
            {
              offer: { type: offer.type, sdp: offer.sdp },
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
        } else {
          if (cancelled) return;
          unsubscribersRef.current.push(onSnapshot(iceCol, handleRemoteIce('mobile')));
          if (cancelled) return;

          unsubscribersRef.current.push(
            onSnapshot(signalingRef, async (snap) => {
              try {
                if (!snap.exists() || cancelled) return;
                const d = snap.data();
                if (!d?.offer?.sdp) {
                  lastOfferSdp = '';
                  return;
                }
                if (d.offer.sdp === lastOfferSdp) return;
                lastOfferSdp = d.offer.sdp;
                await pc.setRemoteDescription(new RTCSessionDescription(d.offer));
                await flushPendingIce();
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                await setDoc(
                  signalingRef,
                  {
                    answer: { type: answer.type, sdp: answer.sdp },
                    updatedAt: serverTimestamp(),
                  },
                  { merge: true }
                );
              } catch (e) {
                console.error(e);
                setError(e?.message || String(e));
              }
            })
          );
        }
      } catch (e) {
        console.error(e);
        setError(e?.message || String(e));
        setStatus('error');
      }
    })();

    return () => {
      cancelled = true;
      try {
        cancelReconnect();
        unsubscribersRef.current.forEach((u) => {
          try {
            u();
          } catch (e) {
            console.error(e);
          }
        });
        unsubscribersRef.current = [];
        pc.close();
        setRemoteStream(null);
        setStatus('idle');
      } catch (e) {
        console.error(e);
      }
    };
  }, [db, appId, sessionId, role, localStream, enabled, retryToken]);

  return { remoteStream, status, error };
}

export default useWebRtcSession;
