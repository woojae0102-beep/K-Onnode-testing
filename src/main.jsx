import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import AuthScreen from './screens/AuthScreen';
import OnboardingScreen from './screens/OnboardingScreen';
import TVDisplayBootstrap from './views/TVDisplayBootstrap';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SocialAuthProvider } from './contexts/SocialAuthContext';
import { firebaseInitError } from './firebase';
import { parseTVCodeFromUrl } from './utils/tvConnect';
import './index.css';
import './i18n.ts';
import './store/languageStore.ts';

function FullScreenLoader({ message = '' }) {
  return (
    <div
      style={{
        height: '100vh',
        width: '100vw',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        background: '#0a0a0a',
        color: 'rgba(255,255,255,0.55)',
        padding: 24,
        textAlign: 'center',
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
      {message ? <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6 }}>{message}</p> : null}
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
            소셜 로그인은 Google, 이메일/비밀번호 sign-in method를 켜야 합니다.
          </li>
        </ol>
      </div>
    </div>
  );
}

function BootstrapErrorScreen({ message, onRetry }) {
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
          maxWidth: 420,
          width: '100%',
          background: '#141414',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 16,
          padding: 28,
          textAlign: 'center',
        }}
      >
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>앱을 불러오지 못했습니다</h1>
        <p style={{ color: '#bbb', fontSize: 13, lineHeight: 1.7, marginBottom: 20 }}>{message}</p>
        <button
          type="button"
          onClick={onRetry}
          style={{
            border: 'none',
            borderRadius: 999,
            background: '#FF1F8E',
            color: '#fff',
            padding: '12px 20px',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          다시 시도
        </button>
      </div>
    </div>
  );
}

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    console.error('[App] render crash:', error);
  }

  render() {
    if (this.state.error) {
      return (
        <BootstrapErrorScreen
          message={this.state.error?.message || '앱 화면을 그리는 중 오류가 발생했습니다.'}
          onRetry={() => window.location.reload()}
        />
      );
    }
    return this.props.children;
  }
}

function AppGate() {
  const { isLoading, isAuthenticated, userProfile, authBootstrapError, clearAuthBootstrapError } = useAuth();

  if (isLoading) {
    return <FullScreenLoader message="앱을 준비하는 중..." />;
  }

  if (authBootstrapError) {
    return (
      <BootstrapErrorScreen
        message={authBootstrapError}
        onRetry={() => {
          clearAuthBootstrapError();
          window.location.href = '/';
        }}
      />
    );
  }

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

  const tvCode = parseTVCodeFromUrl();
  if (tvCode) {
    return <TVDisplayBootstrap code={tvCode} />;
  }

  return (
    <AppErrorBoundary>
      <AuthProvider>
        <SocialAuthProvider>
          <AppGate />
        </SocialAuthProvider>
      </AuthProvider>
    </AppErrorBoundary>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
