
declare module "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js" {
  export const initializeApp: any;
  export const getApps: any;
  export const getApp: any;
}

declare module "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js" {
  export const getFirestore: any;
  export const initializeFirestore: any;
  export const collection: any;
  export const getDocs: any;
  export const query: any;
  export const where: any;
  export const doc: any;
  export const getDoc: any;
  export const setDoc: any;
  export const runTransaction: any;
  export const increment: any;
  export const limit: any;
  export type Firestore = any;
  export const updateDoc: any;
  export const orderBy: any;
  export const deleteDoc: any;
  export const writeBatch: any;
  export type DocumentSnapshot = any;
  export const startAfter: any;
  export const documentId: any;
}

declare module "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js" {
  export const getAuth: any;
  export const signInAnonymously: any;
  export type Auth = any;
  export type User = any;
  export const signInWithEmailAndPassword: any;
  export const signOut: any;
  export const onAuthStateChanged: any;
}
