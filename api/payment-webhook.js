// api/payment-webhook.js
// بيلينك يرسل هنا بعد نجاح الدفع

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

// تهيئة Firebase Admin
function getDb() {
  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId:    process.env.FIREBASE_PROJECT_ID,
        clientEmail:  process.env.FIREBASE_CLIENT_EMAIL,
        privateKey:   process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      }),
    });
  }
  return getFirestore();
}

// مدة الباقات
const PLAN_DURATION = {
  basic:      30,
  pro:        30,
  enterprise: 30,
};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  if (req.method === "OPTIONS") return res.status(200).end();

  // بيلينك يرسل GET عند redirect أو POST عند webhook
  const data = req.method === "POST" ? req.body : req.query;

  console.log("Webhook received:", JSON.stringify(data));

  try {
    const {
      orderNumber,
      transactionNo,
      paymentStatus,
      amount,
    } = data;

    // تحقق من نجاح الدفع
    if (paymentStatus !== "Paid") {
      console.log("Payment not completed:", paymentStatus);
      // أعد توجيه للموقع مع حالة الفشل
      if (req.method === "GET") {
        return res.redirect(`${process.env.BASE_URL}/ja/?payment=failed`);
      }
      return res.status(200).json({ received: true, status: "not_paid" });
    }

    // استخرج userId و planId من orderNumber
    // الصيغة: JADWA-{userId8chars}-{timestamp}-{planId}
    // نبحث في Firestore عن الطلب
    const db = getDb();

    // البحث عن الطلب في pending_payments
    const pendingRef = db.collection("pending_payments")
      .where("orderNumber", "==", orderNumber)
      .limit(1);

    const pendingSnap = await pendingRef.get();

    let userId, planId, userEmail, userName;

    if (!pendingSnap.empty) {
      const pending = pendingSnap.docs[0].data();
      userId    = pending.userId;
      planId    = pending.planId;
      userEmail = pending.userEmail;
      userName  = pending.userName;
    } else {
      // استخرج من الـ note إذا لم يوجد pending
      console.error("Pending payment not found for:", orderNumber);
      if (req.method === "GET") {
        return res.redirect(`${process.env.BASE_URL}/ja/?payment=error`);
      }
      return res.status(200).json({ received: true, error: "order not found" });
    }

    const now = new Date();
    const expiryDate = new Date(now);
    expiryDate.setDate(expiryDate.getDate() + (PLAN_DURATION[planId] || 30));

    // 1. ترقية باقة المستخدم في Firestore
    await db.collection("users").doc(userId).update({
      plan:          planId,
      planStatus:    "active",
      planStartDate: FieldValue.serverTimestamp(),
      planExpiry:    expiryDate,
      updatedAt:     FieldValue.serverTimestamp(),
    });

    // 2. تسجيل الدفع
    await db.collection("payments").add({
      userId,
      planId,
      orderNumber,
      transactionNo,
      amount:        parseFloat(amount) || 0,
      status:        "paid",
      paidAt:        FieldValue.serverTimestamp(),
      userEmail,
      userName,
    });

    // 3. إشعار للمستخدم
    await db.collection("notifications").add({
      title:     "✅ تم تفعيل اشتراكك بنجاح!",
      body:      `تم تفعيل ${planId === "basic" ? "الباقة الأساسية" : planId === "pro" ? "الباقة الاحترافية" : "الباقة المؤسسية"} — يمكنك الآن الاستمتاع بجميع المميزات`,
      target:    "user",
      userId,
      read:      [],
      createdAt: FieldValue.serverTimestamp(),
    });

    // 4. حذف الطلب المعلق
    if (!pendingSnap.empty) {
      await pendingSnap.docs[0].ref.delete();
    }

    console.log(`✅ Plan upgraded: ${userId} → ${planId}`);

    // إعادة التوجيه للموقع
    if (req.method === "GET") {
      return res.redirect(`${process.env.BASE_URL}/ja/?payment=success&plan=${planId}`);
    }

    return res.status(200).json({ success: true, userId, planId });

  } catch (error) {
    console.error("Webhook error:", error);
    if (req.method === "GET") {
      return res.redirect(`${process.env.BASE_URL}/ja/?payment=error`);
    }
    return res.status(500).json({ error: error.message });
  }
}
