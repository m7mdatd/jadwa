// api/create-payment.js
// Vercel Serverless Function - تنشئ طلب دفع في بيلينك

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { planId, userId, userEmail, userName } = req.body;

    if (!planId || !userId || !userEmail) {
      return res.status(400).json({ error: "بيانات ناقصة" });
    }

    // أسعار الباقات
    const PLANS = {
      basic:      { name: "باقة جدوى الأساسية",    amount: 99,  months: 1 },
      pro:        { name: "باقة جدوى الاحترافية",  amount: 249, months: 1 },
      enterprise: { name: "باقة جدوى المؤسسية",    amount: 499, months: 1 },
    };

    const plan = PLANS[planId];
    if (!plan) return res.status(400).json({ error: "باقة غير موجودة" });

    const PAYLINK_API_ID = process.env.PAYLINK_API_ID;
    const PAYLINK_SECRET = process.env.PAYLINK_SECRET;
    const BASE_URL       = process.env.BASE_URL || "https://jadwa.tech";
    const PAYLINK_BASE   = "https://restapi.paylink.sa";

    // 1. الحصول على Token من بيلينك
    const authRes = await fetch(`${PAYLINK_BASE}/api/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apiId:       PAYLINK_API_ID,
        secretKey:   PAYLINK_SECRET,
        persistToken: false,
      }),
    });

    const authData = await authRes.json();
    if (!authData.id_token) {
      console.error("Paylink auth failed:", authData);
      return res.status(500).json({ error: "فشل التوثيق مع بيلينك" });
    }

    const token = authData.id_token;

    // 2. إنشاء طلب الدفع
    const orderRef = `JADWA-${userId.slice(0, 8)}-${Date.now()}`;

    const invoiceRes = await fetch(`${PAYLINK_BASE}/api/addInvoice`, {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({
        orderNumber:   orderRef,
        amount:        plan.amount,
        callBackUrl:   `${BASE_URL}/api/payment-webhook`,
        clientName:    userName || "عميل جدوى",
        clientEmail:   userEmail,
        note:          `اشتراك ${plan.name} - ${userId}`,
        products: [{
          title:    plan.name,
          price:    plan.amount,
          qty:      1,
          description: `اشتراك شهري - ${plan.name}`,
        }],
      }),
    });

    const invoiceData = await invoiceRes.json();

    if (!invoiceData.url) {
      console.error("Paylink invoice failed:", invoiceData);
      return res.status(500).json({ error: "فشل إنشاء فاتورة الدفع", details: invoiceData });
    }

    // 3. حفظ الطلب في Firestore (اختياري - للتتبع)
    // يمكن إضافته لاحقاً باستخدام Firebase Admin SDK

    return res.status(200).json({
      success:     true,
      paymentUrl:  invoiceData.url,
      orderNumber: invoiceData.orderNumber || orderRef,
      transactionNo: invoiceData.transactionNo,
    });

  } catch (error) {
    console.error("Create payment error:", error);
    return res.status(500).json({ error: "خطأ في الخادم: " + error.message });
  }
}
