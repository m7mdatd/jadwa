# دليل ربط بيلينك مع جدوى

## الخطوات بالترتيب

---

### 1️⃣ غيّر مفتاح بيلينك السري فوراً
اذهب إلى: بيلينك Dashboard ← الإعدادات ← API Keys ← توليد مفتاح جديد
المفتاح القديم مكشوف في المحادثة — يجب تغييره قبل أي شيء

---

### 2️⃣ احصل على Firebase Admin Key
1. افتح: console.firebase.google.com
2. اختر مشروع jadwa-pro
3. Project Settings ← Service Accounts
4. اضغط "Generate New Private Key"
5. احفظ ملف JSON — ستحتاجه لاحقاً

---

### 3️⃣ أنشئ مشروع Vercel
1. اذهب إلى: vercel.com
2. سجّل دخول بـ GitHub
3. New Project ← Import Git Repository
   (أو: npm i -g vercel ثم vercel deploy من مجلد jadwa-payment)

---

### 4️⃣ أضف متغيرات البيئة في Vercel
Vercel Dashboard ← مشروعك ← Settings ← Environment Variables

أضف هذه المتغيرات:

| Key | Value |
|-----|-------|
| PAYLINK_API_ID | APP_ID_1629695188546 |
| PAYLINK_SECRET | المفتاح الجديد من بيلينك |
| BASE_URL | https://jadwa.tech |
| ALLOWED_ORIGIN | https://jadwa.tech |
| FIREBASE_PROJECT_ID | jadwa-pro |
| FIREBASE_CLIENT_EMAIL | من ملف JSON الذي حمّلته |
| FIREBASE_PRIVATE_KEY | من ملف JSON (كامل مع -----BEGIN PRIVATE KEY-----) |

---

### 5️⃣ أضف متغير في مشروع جدوى الأساسي
في ملف `.env` في مجلد jadwa-pro:
```
VITE_VERCEL_API_URL=https://اسم-مشروعك.vercel.app
```

---

### 6️⃣ استبدل الملفات في مشروع جدوى
```
src/PricingPage.jsx  ← استبدل
```

---

### 7️⃣ أضف Webhook URL في بيلينك
بيلينك Dashboard ← الإعدادات ← Webhook URL:
```
https://اسم-مشروعك.vercel.app/api/payment-webhook
```

---

### 8️⃣ أضف Firestore Collection جديدة
في Firestore أضف قاعدة للـ pending_payments في Rules:
```
match /pending_payments/{doc} {
  allow read, write: if false; // يكتب عليها Vercel فقط عبر Admin SDK
}
match /payments/{doc} {
  allow read: if request.auth != null && resource.data.userId == request.auth.uid;
  allow write: if false; // يكتب عليها Vercel فقط
}
```

---

### تدفق الدفع الكامل
```
المستخدم يضغط "اشترك"
    ↓
PricingPage.jsx يستدعي Vercel /api/create-payment
    ↓
Vercel تتصل ببيلينك وترجع رابط الدفع
    ↓
المستخدم يدفع في صفحة بيلينك
    ↓
بيلينك يرسل Webhook لـ Vercel /api/payment-webhook
    ↓
Vercel ترقي الباقة في Firestore
    ↓
Vercel تعيد توجيه المستخدم لـ jadwa.tech/ja/?payment=success
    ↓
PricingPage يعرض رسالة النجاح ويحدّث الباقة
```
