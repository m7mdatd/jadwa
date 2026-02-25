// api/save-pending.js
// يحفظ الطلب المعلق قبل التحويل لبيلينك

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

function getDb() {
  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId:   process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey:  process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      }),
    });
  }
  return getFirestore();
}

export default async function handler(req, res) {
  const origin = req.headers.origin || "";
  const allowed = ["https://jadwa.tech", "https://www.jadwa.tech", "https://jadwa-beta.vercel.app"];
  const isAllowed = allowed.includes(origin) || origin.startsWith("http://localhost") || origin.startsWith("http://127.0.0.1");
  res.setHeader("Access-Control-Allow-Origin", isAllowed ? origin : "https://jadwa.tech");
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).end();

  try {
    const { orderNumber, userId, planId, userEmail, userName, amount } = req.body;

    const db = getDb();
    await db.collection("pending_payments").add({
      orderNumber,
      userId,
      planId,
      userEmail,
      userName:  userName || "",
      amount:    amount || 0,
      createdAt: FieldValue.serverTimestamp(),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // ساعة واحدة
    });

    return res.status(200).json({ success: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
