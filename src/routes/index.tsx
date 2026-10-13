import { createFileRoute } from "@tanstack/react-router";
import { TelemetryWorld } from "@/components/telemetry-world";

export const Route = createFileRoute("/")({
  component: TelemetryWorld,
});
