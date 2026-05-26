import { useEffect, useState } from "react"
import { db, storage } from "./firebaseConfig"
import { collection, addDoc, getDocs } from "firebase/firestore"
import { ref, uploadBytes, getDownloadURL } from "firebase/storage"

function App() {
  const [status, setStatus] = useState("Starting Firebase tests...")

  useEffect(() => {
    async function runTests() {
      try {
        await addDoc(collection(db, "test"), { time: Date.now() })
        const snapshot = await getDocs(collection(db, "test"))

        const fileRef = ref(storage, `test-${Date.now()}.txt`)
        const blob = new Blob(["firebase storage test"], { type: "text/plain" })
        await uploadBytes(fileRef, blob)
        const url = await getDownloadURL(fileRef)

        console.log("Firestore docs:", snapshot.size)
        console.log("Storage URL:", url)
        setStatus(`Firestore OK (${snapshot.size} docs), Storage OK`)
      } catch (error) {
        console.error("Firebase test error:", error)
        setStatus(`Firebase test failed: ${error.message}`)
      }
    }

    runTests()
  }, [])

  return <div style={{ padding: 20 }}>{status}</div>
}

export default App