import { useState, useEffect } from "react";
import { db } from "./firebase";
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from "firebase/firestore";

const PLANS = [
  {
    id: "free",
    name: "مجاني",
    nameEn: "Free",
    price: 0,
    period: "",
    color: "#64748b",
    gradient: "linear-gradient(135deg, #94a3b8, #64748b)",
    icon: "🌱",
    description: "جرّب المنصة بدون التزام",
    features: [
      { text: "دراسة واحدة فقط", included: true },
      { text: "واجهة إدخال البيانات", included: true },
      { text: "معاينة النتائج", included: true },
      { text: "تحميل PDF", included: false },
      { text: "تحليل SWOT", included: false },
      { text: "توقعات 5 سنوات", included: false },
      { text: "حفظ الدراسات", included: false },
      { text: "الذكاء الاصطناعي الكامل", included: false },
      { text: "دعم فني", included: false },
    ],
    cta: "الباقة الحالية",
    ctaDisabled: true,
    badge: null,
  },
  {
    id: "basic",
    name: "الأساسية",
    nameEn: "Basic",
    price: 99,
    period: "شهرياً",
    color: "#2d9e72",
    gradient: "linear-gradient(135deg, #2d9e72, #1a6b4a)",
    icon: "⭐",
    description: "مثالية للأفراد ورواد الأعمال",
    features: [
      { text: "3 دراسات جدوى شهرياً", included: true },
      { text: "تحميل PDF احترافي", included: true },
      { text: "تحليل SWOT كامل", included: true },
      { text: "توقعات مالية 5 سنوات", included: true },
      { text: "حفظ الدراسات وأرشفتها", included: true },
      { text: "الذكاء الاصطناعي الكامل", included: true },
      { text: "مستخدم واحد", included: true },
      { text: "دعم عبر البريد الإلكتروني", included: true },
      { text: "لوجو شركتك في PDF", included: false },
    ],
    cta: "اشترك الآن",
    ctaDisabled: false,
    badge: null,
  },
  {
    id: "pro",
    name: "الاحترافية",
    nameEn: "Pro",
    price: 249,
    period: "شهرياً",
    color: "#f0a500",
    gradient: "linear-gradient(135deg, #f0a500, #e08000)",
    icon: "🚀",
    description: "للمستشارين والشركات الناشئة",
    features: [
      { text: "دراسات غير محدودة", included: true },
      { text: "تحميل PDF احترافي", included: true },
      { text: "تحليل SWOT كامل", included: true },
      { text: "توقعات مالية 5 سنوات", included: true },
      { text: "حفظ الدراسات وأرشفتها", included: true },
      { text: "الذكاء الاصطناعي + أولوية معالجة", included: true },
      { text: "3 مستخدمين", included: true },
      { text: "دعم واتساب مباشر", included: true },
      { text: "لوجو شركتك في PDF", included: true },
    ],
    cta: "ابدأ الآن",
    ctaDisabled: false,
    badge: "الأكثر طلباً 🔥",
    popular: true,
  },
  {
    id: "enterprise",
    name: "المؤسسية",
    nameEn: "Enterprise",
    price: 499,
    period: "شهرياً",
    color: "#3d5a80",
    gradient: "linear-gradient(135deg, #3d5a80, #1e3a5f)",
    icon: "🏢",
    description: "للشركات والمكاتب الاستشارية",
    features: [
      { text: "دراسات غير محدودة", included: true },
      { text: "تحميل PDF احترافي", included: true },
      { text: "تحليل SWOT كامل", included: true },
      { text: "توقعات مالية 5 سنوات", included: true },
      { text: "حفظ الدراسات وأرشفتها", included: true },
      { text: "الذكاء الاصطناعي + أولوية قصوى", included: true },
      { text: "10 مستخدمين", included: true },
      { text: "مدير حساب مخصص", included: true },
      { text: "لوجو + تخصيص كامل للـ PDF", included: true },
    ],
    cta: "تواصل معنا",
    ctaDisabled: false,
    badge: "للشركات 🏆",
  },
];

const COMPARISONS = [
  { feature: "عدد الدراسات الشهرية", free: "1", basic: "3", pro: "∞", enterprise: "∞" },
  { feature: "تحميل PDF احترافي", free: false, basic: true, pro: true, enterprise: true },
  { feature: "تحليل SWOT", free: false, basic: true, pro: true, enterprise: true },
  { feature: "توقعات 5 سنوات", free: false, basic: true, pro: true, enterprise: true },
  { feature: "الذكاء الاصطناعي", free: "محدود", basic: "كامل", pro: "أولوية", enterprise: "أولوية قصوى" },
  { feature: "عدد المستخدمين", free: "1", basic: "1", pro: "3", enterprise: "10" },
  { feature: "لوجو في PDF", free: false, basic: false, pro: true, enterprise: true },
  { feature: "الدعم الفني", free: false, basic: "بريد", pro: "واتساب", enterprise: "مدير حساب" },
];

export default function PricingPage({ user, currentPlan = "free", onBack, onSelectPlan }) {
  const [billing, setBilling] = useState("monthly");
  const [dbPlans, setDbPlans] = useState(null);
  const [paymentLoading, setPaymentLoading] = useState(null); // planId being processed
  const [paymentError, setPaymentError] = useState("");

  useEffect(() => {
    getDoc(doc(db, "settings", "plans"))
      .then(d => { if (d.exists()) setDbPlans(d.data()); })
      .catch(() => {});

    // التحقق من العودة من صفحة الدفع
    const params = new URLSearchParams(window.location.search);
    const payment = params.get("payment");
    const plan = params.get("plan");
    if (payment === "success" && plan) {
      window.history.replaceState({}, "", window.location.pathname);
      setSuccessMsg(`✅ تم تفعيل ${plan === "basic" ? "الباقة الأساسية" : plan === "pro" ? "الباقة الاحترافية" : "الباقة المؤسسية"} بنجاح!`);
      setTimeout(() => setSuccessMsg(""), 8000);
    } else if (payment === "failed") {
      window.history.replaceState({}, "", window.location.pathname);
      setPaymentError("❌ فشلت عملية الدفع، يرجى المحاولة مجدداً");
      setTimeout(() => setPaymentError(""), 6000);
    }
  }, []);

  const [hoveredPlan, setHoveredPlan] = useState(null);
  const [showComparison, setShowComparison] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  const discount = billing === "yearly" ? 0.8 : 1;

  const VERCEL_API = import.meta.env.VITE_VERCEL_API_URL || "https://jadwa-payment.vercel.app";

  const handleSelectPlan = async (planId) => {
    if (planId === "free" || planId === currentPlan) return;

    if (planId === "enterprise") {
      window.open("mailto:info@jadwa.tech?subject=طلب باقة المؤسسية", "_blank");
      return;
    }

    if (!user) {
      if (onSelectPlan) onSelectPlan(planId);
      return;
    }

    setPaymentLoading(planId);
    setPaymentError("");

    try {
      // 1. إنشاء طلب الدفع
      const res = await fetch(`${VERCEL_API}/api/create-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId,
          userId:    user.uid,
          userEmail: user.email,
          userName:  user.displayName || user.email,
        }),
      });

      const data = await res.json();
      if (!data.success || !data.paymentUrl) throw new Error(data.error || "فشل إنشاء الدفع");

      // 2. حفظ الطلب المعلق
      await fetch(`${VERCEL_API}/api/save-pending`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderNumber: data.orderNumber,
          userId:      user.uid,
          planId,
          userEmail:   user.email,
          userName:    user.displayName || user.email,
          amount:      { basic: 99, pro: 249, enterprise: 499 }[planId],
        }),
      });

      // 3. تحويل للدفع
      window.location.href = data.paymentUrl;

    } catch (error) {
      console.error("Payment error:", error);
      setPaymentError("حدث خطأ: " + error.message);
      setPaymentLoading(null);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(160deg, #0a2e1f 0%, #0d3d2b 40%, #0f4a34 100%)",
      fontFamily: "'Tajawal', Arial, sans-serif",
      direction: "rtl",
      color: "#fff",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .plan-card {
          transition: transform 0.3s ease, box-shadow 0.3s ease;
          cursor: pointer;
        }
        .plan-card:hover {
          transform: translateY(-8px);
          box-shadow: 0 32px 64px rgba(0,0,0,0.4) !important;
        }
        .popular-card {
          transform: translateY(-12px) scale(1.02);
          box-shadow: 0 40px 80px rgba(240,165,0,0.25) !important;
        }
        .popular-card:hover {
          transform: translateY(-20px) scale(1.02) !important;
        }
        .glow-btn {
          transition: all 0.2s ease;
          position: relative;
          overflow: hidden;
        }
        .glow-btn:hover { opacity: 0.9; transform: translateY(-1px); }
        .glow-btn:active { transform: scale(0.98); }
        .toggle-btn { transition: all 0.2s; }
        .toggle-btn:hover { opacity: 0.8; }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        @keyframes pulse-ring {
          0% { transform: scale(0.8); opacity: 1; }
          100% { transform: scale(2); opacity: 0; }
        }
        .float-anim { animation: float 4s ease-in-out infinite; }
      `}</style>

      {/* Background decorations */}
      <div style={{ position: "fixed", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 0 }}>
        <div style={{ position: "absolute", top: "-10%", right: "-5%", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(45,158,114,0.12) 0%, transparent 70%)" }} />
        <div style={{ position: "absolute", bottom: "0%", left: "-10%", width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle, rgba(240,165,0,0.06) 0%, transparent 70%)" }} />
        <div style={{ position: "absolute", top: "40%", left: "50%", width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle, rgba(61,90,128,0.08) 0%, transparent 70%)" }} />
      </div>

      <div style={{ position: "relative", zIndex: 1 }}>
        {/* Header */}
        <div style={{ padding: "24px 40px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: "linear-gradient(135deg, #2d9e72, #f0a500)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>📊</div>
            <div style={{ fontWeight: 900, fontSize: 20 }}>جدوى</div>
          </div>
          <button onClick={onBack} style={{ padding: "8px 20px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.7)", cursor: "pointer", fontSize: 13, fontFamily: "inherit" }}>
            ← رجوع
          </button>
        </div>

        {/* رسائل الدفع */}
        {successMsg && (
          <div style={{ margin: "0 5% 16px", padding: "14px 20px", background: "rgba(45,158,114,0.2)", border: "1px solid rgba(45,158,114,0.5)", borderRadius: 12, color: "#7effd4", fontWeight: 700, fontSize: 15, textAlign: "center" }}>
            {successMsg}
          </div>
        )}
        {paymentError && (
          <div style={{ margin: "0 5% 16px", padding: "14px 20px", background: "rgba(220,38,38,0.15)", border: "1px solid rgba(220,38,38,0.4)", borderRadius: 12, color: "#fca5a5", fontWeight: 700, fontSize: 14, textAlign: "center" }}>
            {paymentError}
          </div>
        )}
        <div style={{ textAlign: "center", padding: "40px 20px 20px" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(45,158,114,0.15)", border: "1px solid rgba(45,158,114,0.3)", borderRadius: 20, padding: "6px 16px", marginBottom: 20 }}>
            <span style={{ color: "#2d9e72", fontSize: 13, fontWeight: 700 }}>💎 اختر الباقة المناسبة لك</span>
          </div>
          <h1 style={{ fontSize: 44, fontWeight: 900, marginBottom: 14, lineHeight: 1.3 }}>
            استثمر في <span style={{ background: "linear-gradient(135deg, #2d9e72, #f0a500)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>قرارات أفضل</span>
          </h1>
          <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 16, maxWidth: 500, margin: "0 auto 32px", lineHeight: 1.8 }}>
            دراسة جدوى واحدة احترافية تساوي أضعاف قيمة اشتراكك الشهري
          </p>

          {/* Billing Toggle */}
          <div style={{ display: "inline-flex", background: "rgba(255,255,255,0.08)", borderRadius: 14, padding: 4, gap: 4, marginBottom: 8 }}>
            {[["monthly", "شهري"], ["yearly", "سنوي"]].map(([val, label]) => (
              <button key={val} className="toggle-btn" onClick={() => setBilling(val)} style={{
                padding: "9px 24px", borderRadius: 10, border: "none",
                background: billing === val ? "#fff" : "transparent",
                color: billing === val ? "#0d3d2b" : "rgba(255,255,255,0.6)",
                fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit",
              }}>{label}</button>
            ))}
          </div>
          {billing === "yearly" && (
            <div style={{ color: "#2d9e72", fontSize: 13, fontWeight: 700, marginBottom: 8 }}>🎉 وفّر 20% مع الاشتراك السنوي</div>
          )}
        </div>

        {/* Plans Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 20, padding: "20px 40px 40px", maxWidth: 1200, margin: "0 auto" }}>
          {PLANS.map((plan) => {
            // استخدم البيانات من Firestore إذا كانت متاحة
    const dbPlan = plan.id === "basic" ? dbPlans?.basic
      : plan.id === "pro" ? dbPlans?.pro
      : plan.id === "enterprise" ? dbPlans?.enterprise
      : null;
    const basePrice = dbPlan?.price || plan.price;
    const finalPrice = billing === "yearly" ? Math.round(basePrice * discount) : basePrice;
    const planName = dbPlan?.name || plan.name;
    const planDesc = dbPlan?.description || plan.description;
    const planBadge = dbPlan?.badge || plan.badge;
    // المميزات: إذا كانت محفوظة في Firestore استخدمها، وإلا الافتراضية
    const dynamicFeatures = (() => {
      try {
        if (dbPlan?.features && Array.isArray(dbPlan.features) && dbPlan.features.length > 0) {
          return dbPlan.features.map(f => {
            if (typeof f === "string") {
              if (f.startsWith("✗")) return { text: f.slice(1).trim(), included: false };
              return { text: f.replace(/^[✓✔]/, "").trim(), included: true };
            }
            // بنية {text, inc} من لوحة الأدمن
            if (f && typeof f === "object") {
              return { text: f.text || f.name || "", included: f.inc !== false && f.included !== false };
            }
            return { text: String(f), included: true };
          });
        }
        return plan.features || [];
      } catch(e) {
        return plan.features || [];
      }
    })();

    const isCurrentPlan = plan.id === currentPlan;
            const isPopular = plan.popular;

            return (
              <div
                key={plan.id}
                className={`plan-card ${isPopular ? "popular-card" : ""}`}
                onMouseEnter={() => setHoveredPlan(plan.id)}
                onMouseLeave={() => setHoveredPlan(null)}
                onClick={() => handleSelectPlan(plan.id)}
                style={{
                  background: isPopular
                    ? "linear-gradient(160deg, #1a1a2e, #16213e)"
                    : "rgba(255,255,255,0.05)",
                  backdropFilter: "blur(20px)",
                  border: isPopular
                    ? "2px solid rgba(240,165,0,0.5)"
                    : isCurrentPlan
                    ? `2px solid ${plan.color}`
                    : "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 20,
                  padding: "28px 24px",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                {/* Popular glow */}
                {isPopular && (
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "linear-gradient(90deg, #f0a500, #2d9e72, #f0a500)" }} />
                )}

                {/* Badge */}
                {plan.badge && (
                  <div style={{ position: "absolute", top: 16, left: 16, background: isPopular ? "linear-gradient(135deg, #f0a500, #e08000)" : "rgba(61,90,128,0.8)", borderRadius: 8, padding: "4px 10px", fontSize: 11, fontWeight: 700, color: "#fff" }}>
                    {plan.badge}
                  </div>
                )}

                {/* Current plan badge */}
                {isCurrentPlan && (
                  <div style={{ position: "absolute", top: 16, left: 16, background: "rgba(45,158,114,0.8)", borderRadius: 8, padding: "4px 10px", fontSize: 11, fontWeight: 700, color: "#fff" }}>
                    ✓ باقتك الحالية
                  </div>
                )}

                {/* Icon + Name */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, marginTop: plan.badge || isCurrentPlan ? 28 : 0 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: plan.gradient, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>
                    {plan.icon}
                  </div>
                  <div>
                    <div style={{ fontWeight: 900, fontSize: 18 }}>{planName}</div>
                  {planBadge && <div style={{ fontSize: 11, opacity: 0.8, marginTop: 2 }}>{planBadge}</div>}
                    <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }}>{plan.description}</div>
                  </div>
                </div>

                {/* Price */}
                <div style={{ marginBottom: 24 }}>
                  {plan.price === 0 ? (
                    <div style={{ fontSize: 36, fontWeight: 900, color: "#fff" }}>مجاني</div>
                  ) : (
                    <div style={{ display: "flex", alignItems: "flex-end", gap: 6 }}>
                      <div style={{ fontSize: 40, fontWeight: 900, color: plan.color }}>{finalPrice.toLocaleString("ar-SA")}</div>
                      <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 14, marginBottom: 8 }}>
                        ر.س / {plan.period}
                        {billing === "yearly" && plan.price > 0 && (
                          <div style={{ color: "#2d9e72", fontSize: 11, fontWeight: 700 }}>بدلاً من {plan.price} ر.س</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Features */}
                <div style={{ marginBottom: 24 }}>
                  {dynamicFeatures.map((feat, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, opacity: feat.included ? 1 : 0.4 }}>
                      <div style={{ width: 20, height: 20, borderRadius: "50%", background: feat.included ? plan.gradient : "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, flexShrink: 0 }}>
                        {feat.included ? "✓" : "×"}
                      </div>
                      <span style={{ fontSize: 13, color: feat.included ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.4)" }}>
                        {feat.text}
                      </span>
                    </div>
                  ))}
                </div>

                {/* CTA Button */}
                <button
                  className="glow-btn"
                  disabled={plan.ctaDisabled || isCurrentPlan || !!paymentLoading}
                  onClick={(e) => { e.stopPropagation(); handleSelectPlan(plan.id); }}
                  style={{
                    width: "100%",
                    padding: "13px 0",
                    borderRadius: 12,
                    border: "none",
                    background: plan.ctaDisabled || isCurrentPlan
                      ? "rgba(255,255,255,0.08)"
                      : paymentLoading === plan.id
                      ? "rgba(255,255,255,0.15)"
                      : plan.gradient,
                    color: plan.ctaDisabled || isCurrentPlan ? "rgba(255,255,255,0.4)" : "#fff",
                    fontWeight: 700,
                    fontSize: 15,
                    cursor: plan.ctaDisabled || isCurrentPlan || paymentLoading ? "default" : "pointer",
                    fontFamily: "inherit",
                    boxShadow: isPopular && !isCurrentPlan && !paymentLoading ? `0 8px 24px ${plan.color}40` : "none",
                    transition: "all 0.2s",
                  }}
                >
                  {paymentLoading === plan.id
                    ? "⏳ جاري التحويل..."
                    : isCurrentPlan
                    ? "✓ اشتراكك الحالي"
                    : plan.cta}
                </button>
              </div>
            );
          })}
        </div>

        {/* Comparison Table Toggle */}
        <div style={{ textAlign: "center", padding: "0 40px 20px" }}>
          <button onClick={() => setShowComparison(!showComparison)} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, padding: "12px 28px", color: "rgba(255,255,255,0.7)", cursor: "pointer", fontSize: 14, fontFamily: "inherit", fontWeight: 600 }}>
            {showComparison ? "▲ إخفاء" : "▼ مقارنة الباقات بالتفصيل"}
          </button>
        </div>

        {/* Comparison Table */}
        {showComparison && (
          <div style={{ padding: "0 40px 40px", maxWidth: 900, margin: "0 auto" }}>
            <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                    <th style={{ padding: "16px 20px", textAlign: "right", color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>الميزة</th>
                    {PLANS.map(p => (
                      <th key={p.id} style={{ padding: "16px 12px", textAlign: "center", color: p.color, fontWeight: 700 }}>{p.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {COMPARISONS.map((row, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", background: i % 2 === 0 ? "rgba(255,255,255,0.02)" : "transparent" }}>
                      <td style={{ padding: "12px 20px", color: "rgba(255,255,255,0.8)" }}>{row.feature}</td>
                      {["free", "basic", "pro", "enterprise"].map(planId => {
                        const val = row[planId];
                        return (
                          <td key={planId} style={{ padding: "12px 12px", textAlign: "center" }}>
                            {typeof val === "boolean" ? (
                              <span style={{ color: val ? "#2d9e72" : "#c0392b", fontSize: 16 }}>{val ? "✓" : "×"}</span>
                            ) : (
                              <span style={{ color: "rgba(255,255,255,0.8)", fontWeight: 600 }}>{val}</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Trust Signals */}
        <div style={{ padding: "20px 40px 40px", maxWidth: 900, margin: "0 auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
            {[
              { icon: "🔒", title: "دفع آمن 100%", desc: "مشفّر بأعلى معايير الأمان" },
              { icon: "↩️", title: "ضمان الاسترداد", desc: "استرداد كامل خلال 7 أيام" },
              { icon: "📞", title: "دعم فوري", desc: "نرد خلال 24 ساعة" },
              { icon: "🇸🇦", title: "منصة سعودية", desc: "مصمّمة للسوق المحلي" },
            ].map(item => (
              <div key={item.title} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "18px 20px", display: "flex", gap: 12, alignItems: "flex-start" }}>
                <div style={{ fontSize: 24, flexShrink: 0 }}>{item.icon}</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{item.title}</div>
                  <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }}>{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ */}
        <div style={{ padding: "0 40px 60px", maxWidth: 700, margin: "0 auto" }}>
          <h2 style={{ fontSize: 22, fontWeight: 900, textAlign: "center", marginBottom: 24 }}>أسئلة شائعة</h2>
          {[
            { q: "هل يمكنني ترقية أو تخفيض باقتي؟", a: "نعم، يمكنك تغيير باقتك في أي وقت وستُطبّق التغييرات فوراً على حسابك." },
            { q: "ماذا يحدث بعد انتهاء الاشتراك؟", a: "ستتمكن من الوصول لدراساتك المحفوظة ولكن لن تستطيع إنشاء دراسات جديدة حتى تجديد الاشتراك." },
            { q: "كيف يختلف الذكاء الاصطناعي بين الباقات؟", a: "الباقة الأساسية تستخدم الذكاء الاصطناعي الكامل، بينما الاحترافية والمؤسسية تحظى بأولوية معالجة أسرع ومحتوى أكثر تفصيلاً." },
            { q: "هل يمكن تخصيص PDF بشعار شركتي؟", a: "نعم، الباقة الاحترافية والمؤسسية تتيح إضافة شعار شركتك على جميع صفحات الـ PDF." },
          ].map((faq, i) => (
            <div key={i} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "18px 20px", marginBottom: 10 }}>
              <div style={{ fontWeight: 700, marginBottom: 8, color: "#fff", fontSize: 14 }}>❓ {faq.q}</div>
              <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, lineHeight: 1.8 }}>{faq.a}</div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "20px 40px", textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: 12 }}>
          جميع الأسعار بالريال السعودي وتشمل ضريبة القيمة المضافة &nbsp;|&nbsp; jadwa.tech &nbsp;|&nbsp; info@jadwa.tech
        </div>
      </div>
    </div>
  );
}
