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
  getDoc
} from "firebase/firestore";
// Firebase clients from firebaseConfig.js; AuthContext checks login state and reads user profiles.
import { auth, db } from "../firebase/firebaseConfig";
// Function from registrationService.js; checks profile data with Express before creating a customer profile.
import { createCustomerProfile } from "../services/registrationService.js";

const AuthContext = createContext(null);

/**
 * Builds local auth errors that can flow through the same formatter as Firebase errors.
 */
function authError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

/**
 * Converts Firebase and app-specific auth failures into messages the UI can show.
 */
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
      return error.message || "Your account was denied. Please contact BrandTech.";

    case "auth/account-revoked":
      return error.message || "Your account access was revoked. Please contact BrandTech.";

    case "auth/account-disabled":
      return "Your account is disabled. Please contact BrandTech.";

    case "auth/profile-missing":
      return "No user profile found. Ask an admin to finish setting up this account.";

    default:
      return error.message || "Something went wrong.";
  }
}

/**
 * Reads the Firestore user profile for the signed-in Firebase Auth account.
 * This is where the client blocks pending, denied, revoked, or unverified customers.
 */
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

  if (profile.status === "pending") {
    throw authError("Your account is waiting for admin approval.", "auth/pending-approval");
  }

  if (profile.status === "denied") {
    throw authError(
      profile.accountMessage
        ? `Your account was denied. Message from BrandTech: ${profile.accountMessage}`
        : "Your account was denied. Please contact BrandTech.",
      "auth/account-denied"
    );
  }

  if (profile.status === "revoked") {
    throw authError(
      profile.accountMessage
        ? `Your account access was revoked. Message from BrandTech: ${profile.accountMessage}`
        : "Your account access was revoked. Please contact BrandTech.",
      "auth/account-revoked"
    );
  }

  if (profile.status === "disabled") {
    throw authError("Your account is disabled. Please contact BrandTech.", "auth/account-disabled");
  }

  if (profile.role === "customer" && !firebaseUser.emailVerified) {
    throw authError("Please verify your email before signing in.", "auth/email-not-verified");
  }

  return profile;
}

/**
 * Stores app-wide auth state and exposes login, register, and logout actions.
 */
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

  /**
   * Signs in with Firebase Auth, then loads the Firestore role/status profile.
   */
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

  /**
   * Creates a Firebase Auth customer, sends verification, then asks Express to create the profile.
   */
  async function register(data) {
    let credential = null;
    let profileCreated = false;

    try {
      credential = await createUserWithEmailAndPassword(
        auth,
        data.email,
        data.password
      );
      await sendEmailVerification(credential.user);
      // Function from registrationService.js: asks Express to create the pending customer profile.
      await createCustomerProfile({
        fullName: data.fullName,
        email: data.email,
        company: data.company,
        phone: data.phone || "",
        registrationLocation: data.registrationLocation
      });
      profileCreated = true;
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
      if (credential?.user && !profileCreated) {
        await credential.user.delete().catch((deleteError) => {
          console.error("Unable to remove incomplete registration:", deleteError);
        });
      }

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

  /**
   * Ends the Firebase session and clears the local profile.
   */
  async function logout() {
    await signOut(auth);
    setUser(null);
  }

  return <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>;
}

/**
 * Convenience hook so pages can read auth state without importing the raw context.
 */
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
