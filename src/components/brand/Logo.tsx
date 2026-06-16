import { Link } from "@tanstack/react-router";
import logoImg from "@/assets/logo.png";

export function Logo({
  tagline = false,
  compactOnMobile = false,
}: {
  tagline?: boolean;
  compactOnMobile?: boolean;
}) {
  return (
    <Link to="/" className="group inline-flex items-center gap-1.5">
      <img
        src={logoImg}
        alt="Origem Conecta"
        className="h-12 w-12 object-contain sm:h-16 sm:w-16 lg:h-[72px] lg:w-[72px]"
      />
      <span className={`${compactOnMobile ? "hidden sm:flex" : "flex"} flex-col leading-none`}>
        <span className="text-[17px] font-semibold tracking-tight text-brand-900 sm:text-[19px] lg:text-[21px]">
          Origem <span className="text-orange-600">Conecta</span>
        </span>
        {tagline && (
          <span className="mt-1 text-[12px] font-medium text-muted-foreground">
            Da lavoura ao restaurante
          </span>
        )}
      </span>
    </Link>
  );
}
