import React from 'react';
export function VantraLogo({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* حرف الـ V - رمادي معدني هادئ يندمج مع الخلفية */}
      <path
        d="M 18 20 L 50 85 L 82 20 L 68 20 L 50 58 L 32 20 Z"
        fill="#9CA3AF" /* لون رمادي أنيق (Tailwind gray-400) */
        className="opacity-80"
      />

      {/* نجمة الذكاء الاصطناعي - أبيض ناصع جداً للفت الانتباه (High Contrast) */}
      <path
        d="M 50 12 L 53.5 35 L 76 38.5 L 53.5 42 L 50 65 L 46.5 42 L 24 38.5 L 46.5 35 Z"
        fill="#FFFFFF"
      />
    </svg>
  );
}
