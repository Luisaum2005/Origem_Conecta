import { Navigate } from "@tanstack/react-router";
import { getProfileHome, type ProfileRole, type ProfileType, useAuth } from "@/lib/auth";

type RequireProfileProps = {
  allowed?: ProfileType[];
  roles?: ProfileRole[];
  children: React.ReactNode;
};

export function RequireProfile({ allowed, roles, children }: RequireProfileProps) {
  const { profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-canvas px-4">
        <div className="rounded-2xl border border-border bg-white px-5 py-4 text-sm font-semibold text-brand-900 shadow-xs">
          Carregando acesso...
        </div>
      </div>
    );
  }

  if (!profile) return <Navigate to="/login" replace />;

  if (roles && !roles.some((role) => profile.roles?.includes(role))) {
    return <Navigate to={getProfileHome(profile.tipo)} replace />;
  }

  if (allowed && !allowed.includes(profile.tipo)) {
    return <Navigate to={getProfileHome(profile.tipo)} replace />;
  }

  return children;
}
