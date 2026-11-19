import { createFileRoute } from "@tanstack/react-router";
import { ControlApp } from "@/components/control-app";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  return <ControlApp />;
}
