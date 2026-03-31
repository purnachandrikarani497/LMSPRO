import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type InstructorAvatarProps = {
  name: string;
  photoUrl?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const sizeClasses = {
  sm: "h-14 w-14 text-lg",
  md: "h-20 w-20 text-2xl",
  lg: "h-24 w-24 text-3xl"
};

/**
 * Shows instructor photo when `photoUrl` loads; otherwise the first letter of `name` on an amber circle.
 */
export function InstructorAvatar({ name, photoUrl, size = "sm", className }: InstructorAvatarProps) {
  const initial = (name?.trim()?.charAt(0) || "?").toUpperCase();
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [photoUrl]);

  const trimmed = photoUrl?.trim();
  const showImg = Boolean(trimmed) && !imgFailed;

  return (
    <div
      className={cn("relative shrink-0", sizeClasses[size], className)}
      role="img"
      aria-label={name || "Instructor"}
    >
      <div
        className="absolute inset-0 flex items-center justify-center rounded-full bg-amber-100 text-center font-bold text-amber-600 ring-2 ring-amber-200"
        aria-hidden={showImg}
      >
        {initial}
      </div>
      {showImg && (
        <img
          src={trimmed}
          alt=""
          className="absolute inset-0 z-10 h-full w-full rounded-full object-cover ring-2 ring-gray-200"
          onError={() => setImgFailed(true)}
        />
      )}
    </div>
  );
}
