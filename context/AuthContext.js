// Authentication context - manages user authentication state across the app
import * as React from 'react';
import { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChange, getCurrentUserData } from '../services/authService';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  // State for current user
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Function to refresh user data manually
  const refreshUserData = React.useCallback(async (uid) => {
    if (!uid) return;
    try {
      const { userData: data } = await getCurrentUserData(uid);
      if (data) {
        setUserData(data);
        console.log('✅ User data refreshed manually');
      }
    } catch (error) {
      console.error('Error refreshing user data:', error);
    }
  }, []);

  // Listen to authentication state changes
  useEffect(() => {
    let isMounted = true;
    let timeoutId;
    
    try {
      // Set a timeout to stop blocking the app if auth check takes too long
      // Firebase auth with persistence should respond quickly, but give it 5 seconds
      timeoutId = setTimeout(() => {
        if (isMounted) {
          console.warn('⚠️ Auth check taking too long, showing app anyway');
          setLoading(false);
        }
      }, 5000); // Show app after 5 seconds max (Firebase persistence should be faster)

      const unsubscribe = onAuthStateChange(async (firebaseUser) => {
        if (!isMounted) return;
        
        try {
          // Clear timeout since we got a response
          if (timeoutId) {
            clearTimeout(timeoutId);
          }
          
          if (firebaseUser) {
            // User is signed in - automatically restored from AsyncStorage (persistence)
            setUser(firebaseUser);
            
            // Set basic userData immediately from Firebase Auth (don't block UI)
            setUserData({
              name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
              username: firebaseUser.email?.split('@')[0] || 'user',
              avatar: firebaseUser.photoURL || null,
            });
            setLoading(false); // Show app immediately, don't wait for Firestore
            
            // Fetch full user data from Firestore in background (non-blocking)
            if (firebaseUser.uid) {
              getCurrentUserData(firebaseUser.uid).then(({ userData: data }) => {
                if (isMounted && data) {
                  setUserData(data);
                }
              }).catch((error) => {
                // Silently fail - we already have basic data from Auth
              });
            }
          } else {
            // No user signed in - show login screen
            setUser(null);
            setUserData(null);
            setLoading(false);
          }
        } catch (error) {
          console.error('Auth state change error:', error);
          if (isMounted) {
            setUser(null);
            setUserData(null);
            setLoading(false);
          }
        }
      });

      return () => {
        isMounted = false;
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        if (unsubscribe && typeof unsubscribe === 'function') {
          unsubscribe();
        }
      };
    } catch (error) {
      console.error('Auth listener setup error:', error);
      // If Firebase not configured, just set loading to false
      if (isMounted) {
        setLoading(false);
      }
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, userData, loading, refreshUserData }}>
      {children}
    </AuthContext.Provider>
  );
}

// Hook to use auth context
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

