import Image from "next/image";
import { cn } from "@/components/ui/styles";

type BrandMarkProps = {
  className?: string;
  alt?: string;
  decorative?: boolean;
};

export function BrandMark({
  className,
  alt = "OpsFlow",
  decorative = true,
}: BrandMarkProps) {
  return (
    <Image
      src="/logo.svg"
      alt={decorative ? "" : alt}
      aria-hidden={decorative ? true : undefined}
      width={40}
      height={40}
      className={cn(
        "h-10 w-10 shrink-0 drop-shadow-[0_14px_28px_-20px_var(--color-brand-glow)]",
        className,
      )}
    />
  );
}
