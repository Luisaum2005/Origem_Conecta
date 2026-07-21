import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/signup/admin")({
  component: () => <Navigate to="/signup/organization" replace />,
});
