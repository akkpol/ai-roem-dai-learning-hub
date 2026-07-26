import { randomUUID } from "node:crypto";

export type TelemetryFields = Record<
  string,
  string | number | boolean | null
>;

export type Telemetry = (event: string, fields: TelemetryFields) => void;

const correlationIdPattern = /^[a-zA-Z0-9._:-]{1,64}$/;

export function requestCorrelationId(request?: Request): string {
  const supplied = request?.headers.get("x-correlation-id");
  return supplied && correlationIdPattern.test(supplied)
    ? supplied
    : randomUUID();
}

export function createStructuredTelemetry(
  write: (line: string) => void = console.info,
): Telemetry {
  return (event, fields) => {
    write(
      JSON.stringify({
        ...fields,
        event: event.slice(0, 96),
        occurredAt: new Date().toISOString(),
      }),
    );
  };
}

export const emitStructuredTelemetry = createStructuredTelemetry();
