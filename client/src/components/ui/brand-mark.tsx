import Image from "next/image";
import { cn } from "@/components/ui/styles";

type BrandMarkProps = {
  className?: string;
  alt?: string;
  decorative?: boolean;
  variant?: "icon" | "wordmark";
};

export function BrandMark({
  className,
  alt = "OpsFlow",
  decorative = true,
  variant = "icon",
}: BrandMarkProps) {
  if (variant === "wordmark") {
    return (
      <span
        className={cn(
          "relative inline-flex h-10 w-[190px] shrink-0",
          className,
        )}
      >
        <Image
          src="/opsflow-logo-full.png"
          alt={decorative ? "" : alt}
          aria-hidden={decorative ? true : undefined}
          fill
          sizes="190px"
          className="brand-wordmark-light object-contain"
          priority
        />
        <Image
          src="/opsflow-logo-full-dark.png"
          alt=""
          aria-hidden="true"
          fill
          sizes="190px"
          className="brand-wordmark-dark object-contain"
          priority
        />
      </span>
    );
  }

  return (
    <Image
      src="/opsflow-logo-icon.png"
      alt={decorative ? "" : alt}
      aria-hidden={decorative ? true : undefined}
      width={512}
      height={512}
      className={cn(
        "h-10 w-10 shrink-0 drop-shadow-[0_14px_28px_-20px_var(--color-brand-glow)]",
        className,
      )}
    />
  );
}
