/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signOut
} from "firebase/auth";
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc
} from "firebase/firestore";
import { auth, db } from "../firebase/firebaseConfig";

const AuthContext = createContext(null);

function authError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function formatFirebaseError(error) {
  switch (error.code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Invalid email or password.";

    case "auth/email-already-in-use":
      return "An account with this email already exists.";

    case "auth/weak-password":
      return "Password must be at least 6 characters.";

    case "auth/email-not-verified":
      return "Please verify your email before signing in.";

    case "auth/pending-approval":
      return "Your account is waiting for admin approval.";

    case "auth/account-denied":
      return "Your account was denied. Please contact BrandTech.";

    case "auth/account-disabled":
      return "Your account is disabled. Please contact BrandTech.";

    case "auth/profile-missing":
      return "No user profile found. Ask an admin to finish setting up this account.";

    default:
      return error.message || "Something went wrong.";
  }
}

async function loadUserProfile(firebaseUser) {
  const userRef = doc(db, "users", firebaseUser.uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    throw authError(
      "No user profile found. Ask an admin to finish setting up this account.",
      "auth/profile-missing"
    );
  }

  const profileData = userSnap.data();
  const profile = {
    id: firebaseUser.uid,
    ...profileData,
    email: firebaseUser.email,
    emailVerified: firebaseUser.emailVerified
  };

  if (profile.role === "customer" && !firebaseUser.emailVerified) {
    throw authError("Please verify your email before signing in.", "auth/email-not-verified");
  }

  if (profile.status === "pending") {
    throw authError("Your account is waiting for admin approval.", "auth/pending-approval");
  }

  if (profile.status === "denied") {
    throw authError("Your account was denied. Please contact BrandTech.", "auth/account-denied");
  }

  if (profile.status === "disabled") {
    throw authError("Your account is disabled. Please contact BrandTech.", "auth/account-disabled");
  }

  return profile;
}

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (!firebaseUser) {
          setUser(null);
          return;
        }

        const profile = await loadUserProfile(firebaseUser);
        setUser(profile);
      } catch (error) {
        console.error(error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  async function login(email, password) {
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      const profile = await loadUserProfile(credential.user);

      setUser(profile);

      return {
        success: true,
        role: profile.role
      };
    } catch (error) {
      if (auth.currentUser) {
        await signOut(auth);
      }

      setUser(null);

      return {
        success: false,
        error: formatFirebaseError(error)
      };
    }
  }

  async function register(data) {
    try {
      const credential = await createUserWithEmailAndPassword(
        auth,
        data.email,
        data.password
      );

      const profile = {
        name: data.fullName,
        email: data.email,
        company: data.company,
        phone: data.phone || "",
        role: "customer",
        status: "pending",
        emailVerified: false,
        createdAt: serverTimestamp()
      };

      await setDoc(doc(db, "users", credential.user.uid), profile);
      await sendEmailVerification(credential.user);
      await signOut(auth);

      setUser(null);

      return {
        success: true,
        role: "customer",
        pendingApproval: true,
        emailVerificationSent: true,
        message: "Account created. Check your email to verify your address, then wait for admin approval."
      };
    } catch (error) {
      if (auth.currentUser) {
        await signOut(auth);
      }

      setUser(null);

      return {
        success: false,
        error: formatFirebaseError(error)
      };
    }
  }

  async function logout() {
    await signOut(auth);
    setUser(null);
  }

  return <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>;
}

function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}

export {
  AuthProvider,
  useAuth
};
