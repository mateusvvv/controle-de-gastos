// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyC7m0zL16zfRL7Wf20gvAHdr1PWjvA3KhM",
  authDomain: "controle-de-gastos-b5bcf.firebaseapp.com",
  projectId: "controle-de-gastos-b5bcf",
  storageBucket: "controle-de-gastos-b5bcf.firebasestorage.app",
  messagingSenderId: "776155656423",
  appId: "1:776155656423:web:ef4b782f6f28699c52f242",
  measurementId: "G-YS7XJTYX4L"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };
