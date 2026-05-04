import Image from "next/image";

export function SourceLogo({ source, size = "sm" }: { source: string; size?: "sm" | "md" }) {
  const isK = source === "K-Startup";
  const h = size === "sm" ? "h-4" : "h-5";
  return (
    <Image
      src={isK ? "/logo-kstartup.png" : "/logo-bizinfo.png"}
      alt={isK ? "K-Startup" : "기업마당"}
      width={96}
      height={20}
      className={`${h} w-auto object-contain shrink-0`}
    />
  );
}
