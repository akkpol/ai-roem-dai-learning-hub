export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export type JsonObject = { [key: string]: JsonValue };

export interface DomainEventInput<T extends JsonObject = JsonObject> {
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payload: T;
  occurredAt: Date;
  availableAt?: Date;
}
