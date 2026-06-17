import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyB7mM0iMaQnQ65GTyW9-9jQ_eZUHWE_6go",
  authDomain: "booth-booking-31111.firebaseapp.com",
  projectId: "booth-booking-31111",
  storageBucket: "booth-booking-31111.firebasestorage.app",
  messagingSenderId: "280651230987",
  appId: "1:280651230987:web:069f8ba9562691a4afbc0e"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
