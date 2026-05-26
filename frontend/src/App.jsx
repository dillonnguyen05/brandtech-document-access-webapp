import { useEffect, useState } from 'react'
import './App.css'
import { auth } from './firebaseConfig'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth'

function App() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [user, setUser] = useState(null)
  const [message, setMessage] = useState('Please sign in or sign up')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser)
      if (currentUser) {
        setMessage(`Signed in as ${currentUser.email}`)
      } else {
        setMessage('Please sign in or sign up')
      }
    })
    return unsubscribe
  }, [])

  const handleSignUp = async () => {
    setLoading(true)
    setMessage('Creating account...')
    try {
      await createUserWithEmailAndPassword(auth, email, password)
      setMessage('Account created! You are signed in.')
    } catch (err) {
      setMessage(`Sign-up error: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleSignIn = async () => {
    setLoading(true)
    setMessage('Signing in...')
    try {
      await signInWithEmailAndPassword(auth, email, password)
      setMessage('Signed in successfully.')
    } catch (err) {
      setMessage(`Sign-in error: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleSignOut = async () => {
    setLoading(true)
    setMessage('Signing out...')
    try {
      await signOut(auth)
      setMessage('Signed out successfully.')
    } catch (err) {
      setMessage(`Sign-out error: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-container">
      <h1>Firebase Email/Password Auth</h1>
      <p>{message}</p>

      {user ? (
        <div className="signed-in">
          <p>
            Signed in as <strong>{user.email}</strong>
          </p>
          <button onClick={handleSignOut} disabled={loading}>
            Sign out
          </button>
        </div>
      ) : (
        <div className="auth-form">
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 6 characters"
            />
          </label>
          <div className="button-row">
            <button onClick={handleSignIn} disabled={loading || !email || !password}>
              Sign in
            </button>
            <button onClick={handleSignUp} disabled={loading || !email || !password}>
              Sign up
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
