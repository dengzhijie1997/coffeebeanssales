// Firebase 配置
const firebaseConfig = {
  apiKey: "AIzaSyCV4zMfbBwY4jT_qiRLzIAa76dMMH7Ayng",
  authDomain: "coffeesalesdata.firebaseapp.com",
  projectId: "coffeesalesdata",
  storageBucket: "coffeesalesdata.firebasestorage.app",
  messagingSenderId: "678537310070",
  appId: "1:678537310070:web:9d455614e312cf9356d457",
  measurementId: "G-EQCE557XHD"
};

// 初始化 Firebase
firebase.initializeApp(firebaseConfig);

// 获取 Firestore 数据库实例
const db = firebase.firestore();

// 设置数据库集合名称
const SALES_COLLECTION = 'coffee_sales';

export { db, SALES_COLLECTION }; 