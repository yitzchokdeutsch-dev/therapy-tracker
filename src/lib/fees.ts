import type { Client, ServiceType, Fee } from "./types";

type FeeClient = Pick<Client, "session_rate" | "service_type_id" | "late_cancel_fee" | "no_show_fee">;

export const getSessionRate = (
  client: FeeClient | undefined,
  serviceTypes: ServiceType[]
): number => {
  if (!client) return 0;
  if (client.session_rate != null) return Number(client.session_rate);
  const svc = serviceTypes.find((s) => s.id === client.service_type_id);
  return svc ? Number(svc.rate) : 0;
};

export const getLateCancelFee = (
  client: Pick<FeeClient, "late_cancel_fee"> | undefined,
  fees: Fee[]
): number => {
  if (!client) return 0;
  if (client.late_cancel_fee != null) return Number(client.late_cancel_fee);
  const fee = fees.find((f) => f.name === "late_cancel");
  return fee ? Number(fee.amount) : 0;
};

export const getNoShowFee = (
  client: Pick<FeeClient, "no_show_fee"> | undefined,
  fees: Fee[]
): number => {
  if (!client) return 0;
  if (client.no_show_fee != null) return Number(client.no_show_fee);
  const fee = fees.find((f) => f.name === "no_show");
  return fee ? Number(fee.amount) : 0;
};
