// api/create-payment.js
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

function getDb() {
  if (!getApps().length) {
    initializeApp({ credential: cert({
      projectId:   process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey:  process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    })});
  }
  return getFirestore();
}

const DEFAULT_PRICES = {
  basic:      { name: "الأساسية",   amount: 99  },
  pro:        { name: "الاحترافية", amount: 249 },
  enterprise: { name: "المؤسسية",   amount: 499 },
};

export default async function handler(req, res) {
  // Allow production domain + localhost for testing
  const origin = req.headers.origin || "";
  const allowed = ["https://jadwa.tech", "https://www.jadwa.tech", "https://jadwa-beta.vercel.app"];
  const isAllowed = allowed.includes(origin) || origin.startsWith("http://localhost") || origin.startsWith("http://127.0.0.1");
  res.setHeader("Access-Control-Allow-Origin", isAllowed ? origin : "https://jadwa.tech");
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { planId, userId, userEmail, userName } = req.body;

    if (!planId || !userId || !userEmail)
      return res.status(400).json({ error: "بيانات ناقصة" });

    if (!DEFAULT_PRICES[planId])
      return res.status(400).json({ error: "باقة غير موجودة" });

    // جلب السعر الحقيقي من Firestore
    let planAmount = DEFAULT_PRICES[planId].amount;
    let planName   = DEFAULT_PRICES[planId].name;
    try {
      const db  = getDb();
      const doc = await db.collection("settings").doc("plans").get();
      if (doc.exists) {
        const data = doc.data();
        if (data[planId]?.price) planAmount = Number(data[planId].price);
        if (data[planId]?.name)  planName   = data[planId].name;
      }
      console.log(`Plan ${planId}: ${planName} = ${planAmount} SAR`);
    } catch (e) {
      console.warn("Firestore fetch failed, using default:", e.message);
    }

    const PAYLINK_BASE = "https://restapi.paylink.sa";
    const BASE_URL     = process.env.BASE_URL || "https://jadwa.tech";

    // 1. Token من بيلينك
    const authRes  = await fetch(`${PAYLINK_BASE}/api/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apiId:        process.env.PAYLINK_API_ID,
        secretKey:    process.env.PAYLINK_SECRET,
        persistToken: false,
      }),
    });
    const authData = await authRes.json();
    if (!authData.id_token)
      return res.status(500).json({ error: "فشل التوثيق مع بيلينك", details: authData });

    // 2. إنشاء الفاتورة بالسعر الحقيقي
    const orderRef  = `JADWA-${userId.slice(0, 8)}-${Date.now()}`;
    const fullName  = `باقة جدوى ${planName}`;
    const webhookUrl = process.env.WEBHOOK_URL || `${BASE_URL}/api/payment-webhook`;

    const invoiceRes  = await fetch(`${PAYLINK_BASE}/api/addInvoice`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${authData.id_token}` },
      body: JSON.stringify({
        orderNumber:  orderRef,
        amount:       planAmount,
        callBackUrl:  webhookUrl,
        clientName:   userName || "عميل جدوى",
        clientEmail:  userEmail,
        note:         `اشتراك ${fullName} - ${userId}`,
        products: [{ title: fullName, price: planAmount, qty: 1 }],
      }),
    });
    const invoiceData = await invoiceRes.json();

    if (!invoiceData.url)
      return res.status(500).json({ error: "فشل إنشاء الفاتورة", details: invoiceData });

    return res.status(200).json({
      success: true, paymentUrl: invoiceData.url,
      orderNumber: invoiceData.orderNumber || orderRef,
      amount: planAmount,
    });

  } catch (error) {
    console.error("Create payment error:", error);
    return res.status(500).json({ error: error.message });
  }
}
