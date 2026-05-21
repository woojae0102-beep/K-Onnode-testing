import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import AuthScreen from './screens/AuthScreen';
import OnboardingScreen from './screens/OnboardingScreen';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { firebaseInitError } from './firebase';
import './index.css';
import './i18n.ts';
import './store/languageStore.ts';

function FullScreenLoader() {
  return (
    <div
      style={{
        height: '100vh',
        width: '100vw',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0a0a0a',
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          border: '3px solid #FF1F8E',
          borderTopColor: 'transparent',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }}
      />
    </div>
  );
}

function FirebaseSetupErrorScreen({ message }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0a0a0a',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        style={{
          maxWidth: 600,
          width: '100%',
          background: '#1a1010',
          border: '1px solid #4a1d23',
          borderRadius: 16,
          padding: 28,
        }}
      >
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>
          Firebase 설정 오류
        </h1>
        <p
          style={{
            color: '#ffc4cc',
            marginBottom: 16,
            wordBreak: 'break-word',
          }}
        >
          {message}
        </p>
        <ol
          style={{
            color: '#bbb',
            fontSize: 13,
            lineHeight: 1.7,
            paddingLeft: 18,
          }}
        >
          <li>
            <code>VITE_FIREBASE_CONFIG</code> 또는 개별{' '}
            <code>VITE_FIREBASE_*</code> 키를 <code>.env</code>에 설정하세요.
          </li>
          <li>Firebase Console에서 Authentication / Firestore를 활성화하세요.</li>
          <li>
            소셜 로그인은 Google, Apple, 이메일/비밀번호 sign-in method를 켜야
            합니다.
          </li>
        </ol>
      </div>
    </div>
  );
}

function AppGate() {
  const { isLoading, isAuthenticated, userProfile } = useAuth();

  if (isLoading) return <FullScreenLoader />;
  if (!isAuthenticated) return <AuthScreen />;
  if (userProfile && !userProfile.onboardingCompleted) {
    return <OnboardingScreen />;
  }
  return <App />;
}

function Root() {
  if (firebaseInitError) {
    return <FirebaseSetupErrorScreen message={firebaseInitError} />;
  }
  return (
    <AuthProvider>
      <AppGate />
    </AuthProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
