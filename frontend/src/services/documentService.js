import { storage } from "../firebase/firebaseConfig";
import { ref, uploadBytesResumable } from "firebase/storage";

export function uploadDocument(file, onProgress) {
  // 1. validate file
  if(!file){
    throw new Error("Please select a file.");
  }
  // 2. make file path
  const filePath = `files/${file.name}`;


  // 3. make storage ref
  const fileRef = ref(storage, filePath)
  // 4. start upload task
    uploadBytesResumable(fileRef, file)
  // 5. listen to progress

  // 6. finish or error
};