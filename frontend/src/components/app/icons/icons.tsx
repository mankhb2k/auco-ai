import { Share2, Check, CheckCheck } from "lucide-react";
import Image from "next/image";

export const DoubleCheck = ({ className = "text-[#4ec163]" }) => (
  <CheckCheck className={`w-[15px] h-[15px] inline-block ${className} stroke-[2.5]`} />
);

export const SingleCheck = ({ className = "text-gray-400" }) => (
  <Check className={`w-[15px] h-[15px] inline-block ${className} stroke-[2.5]`} />
);

/** Telegram-blue verified seal — `/public/icons/verified-check.svg`. */
export function VerifiedBadge({
  className = "w-[16px] h-[16px]",
  title = "Verified",
}: {
  className?: string;
  title?: string;
}) {
  return (
    <Image
      src="/icons/verified-check.svg"
      alt={title}
      width={16}
      height={16}
      unoptimized
      className={`inline-block flex-shrink-0 align-middle ${className}`}
    />
  );
}

// Phone Icon to match Telegram style
export const PhoneIcon = () => (
  <svg
    className="w-5 h-5 text-gray-400"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
    <line x1="12" y1="18" x2="12.01" y2="18" />
  </svg>
);

// DisableShareIcon matches Telegram's slash-through share icon
export const DisableShareIcon = ({ className = "w-5 h-5 text-gray-500" }) => (
  <div className="relative w-5 h-5 flex items-center justify-center">
    <Share2 className={className} />
    <div className="absolute w-[1.5px] h-6 bg-gray-500 rotate-45 transform origin-center"></div>
  </div>
);
