// src/paymentService.js
// خدمة الدفع في الـ Frontend

const VERCEL_API = import.meta.env.VITE_VERCEL_API_URL || "https://jadwa-payment.vercel.app";

/**
 * بدء عملية الدفع
 * @param {Object} params
 * @param {string} params.planId - basic | pro | enterprise
 * @param {string} params.userId - Firebase UID
 * @param {string} params.userEmail
 * @param {string} params.userName
 */
export async function initiatePayment({ planId, userId, userEmail, userName }) {
  try {
    // 1. إنشاء طلب الدفع في بيلينك
    const res = await fetch(`${VERCEL_API}/api/create-payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId, userId, userEmail, userName }),
    });

    const data = await res.json();

    if (!data.success || !data.paymentUrl) {
      throw new Error(data.error || "فشل إنشاء طلب الدفع");
    }

    // 2. حفظ الطلب المعلق في Firestore عبر Vercel
    await fetch(`${VERCEL_API}/api/save-pending`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderNumber: data.orderNumber,
        userId,
        planId,
        userEmail,
        userName,
        amount: { basic: 99, pro: 249, enterprise: 499 }[planId],
      }),
    });

    // 3. تحويل المستخدم لصفحة الدفع
    window.location.href = data.paymentUrl;

  } catch (error) {
    console.error("Payment error:", error);
    throw error;
  }
}

/**
 * التحقق من نتيجة الدفع عند العودة للموقع
 * يُستدعى في App.jsx عند تحميل الصفحة
 */
export function checkPaymentReturn() {
  const params = new URLSearchParams(window.location.search);
  const payment = params.get("payment");
  const plan = params.get("plan");

  if (payment === "success") {
    // نظّف الـ URL
    window.history.replaceState({}, "", window.location.pathname);
    return { success: true, plan };
  }

  if (payment === "failed" || payment === "error") {
    window.history.replaceState({}, "", window.location.pathname);
    return { success: false, error: payment };
  }

  return null;
}
