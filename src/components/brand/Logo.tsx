import { Link } from "@tanstack/react-router";
import logoImg from "@/assets/logo.png";

export function Logo({ tagline = false }: { tagline?: boolean }) {
  return (
    <Link to="/" className="group inline-flex items-center gap-1.5">
      <img
        src={logoImg}
        alt="Origem Conecta"
        className="h-16 w-16 object-contain sm:h-[72px] sm:w-[72px]"
      />
      <span className="flex flex-col leading-none">
        <span className="text-[19px] font-semibold tracking-tight text-brand-900 sm:text-[21px]">
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
