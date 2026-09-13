import React from 'react';
import { Sparkles, Code2, BookOpen, TrendingUp, History, Shield, LogIn, LogOut, CheckCircle2, Cloud } from 'lucide-react';
import { AuthUserState, loginWithGoogle, logoutUser, DEMO_USER } from '../lib/firebase';

interface NavbarProps {
  activeTab: 'reviewer' | 'rules' | 'growth' | 'history';
  setActiveTab: (tab: 'reviewer' | 'rules' | 'growth' | 'history') => void;
  user: AuthUserState;
  setUser: (user: AuthUserState) => void;
  backendHealthy: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  user,
  setUser,
  backendHealthy,
}) => {
  const handleGoogleLogin = async () => {
    const googleUser = await loginWithGoogle();
    if (googleUser) {
      const token = await googleUser.getIdToken();
      setUser({
        uid: googleUser.uid,
        email: googleUser.email,
        displayName: googleUser.displayName,
        photoURL: googleUser.photoURL,
        isDemoUser: false,
        token,
      });
    }
  };

  const handleLogout = async () => {
    await logoutUser();
    setUser(DEMO_USER);
  };

  return (
    <header className="sticky top-0 z-50 glass-panel border-b border-slate-800/80 bg-[#0B0F19]/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand & GCP Badges */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-emerald-400 p-[1.5px] shadow-lg shadow-indigo-500/20">
            <div className="w-full h-full bg-[#0B0F19] rounded-[10px] flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-emerald-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-base tracking-tight text-white font-mono">
                The 24/7 Intelligent Code Reviewer
              </span>
              <span className="hidden sm:inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Track 01
              </span>
            </div>
            <div className="flex items-center space-x-2 text-[11px] text-slate-400">
              <span className="flex items-center">
                <Cloud className="w-3 h-3 mr-1 text-indigo-400" /> Google Cloud Native
              </span>
              <span>•</span>
              <span className="text-slate-500 font-mono">Vertex AI (Gemini + text-embedding-004)</span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="hidden md:flex items-center space-x-1 bg-slate-900/60 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveTab('reviewer')}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'reviewer'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Code2 className="w-4 h-4" />
            <span>Code Reviewer</span>
          </button>
          <button
            onClick={() => setActiveTab('rules')}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'rules'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Historical Rules</span>
          </button>
          <button
            onClick={() => setActiveTab('growth')}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'growth'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>Developer Growth</span>
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'history'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Review History</span>
          </button>
        </nav>

        {/* User Auth & Backend Status */}
        <div className="flex items-center space-x-3">
          <div className="hidden lg:flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-[11px]">
            <span
              className={`w-2 h-2 rounded-full ${
                backendHealthy ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
              }`}
            />
            <span className="text-slate-400">
              {backendHealthy ? 'Cloud Run Online' : 'Backend Connecting'}
            </span>
          </div>

          {/* User Profile */}
          <div className="flex items-center space-x-2 pl-2 border-l border-slate-800">
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt="Avatar"
                className="w-8 h-8 rounded-full border border-indigo-500/50"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-indigo-950 border border-indigo-500 flex items-center justify-center text-xs font-bold text-indigo-300">
                {user.displayName?.[0] || 'U'}
              </div>
            )}
            <div className="hidden sm:block text-left">
              <div className="text-xs font-semibold text-slate-200 truncate max-w-[120px]">
                {user.displayName || 'Developer'}
              </div>
              <div className="text-[10px] text-slate-400 truncate max-w-[120px]">
                {user.isDemoUser ? 'Evaluation Mode' : user.email}
              </div>
            </div>

            {user.isDemoUser ? (
              <button
                onClick={handleGoogleLogin}
                title="Sign in with Google Cloud Identity"
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              >
                <LogIn className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleLogout}
                title="Switch to Demo Developer"
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
