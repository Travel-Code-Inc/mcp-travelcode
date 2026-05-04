import {
  OrderList,
  OrderFull,
  CancelCheckResponse,
  CancelResult,
  ModifyCheckResponse,
  ModifyResult,
} from "../client/types.js";

export function formatOrderList(data: OrderList): string {
  const lines: string[] = [];

  lines.push(`Orders: showing ${data.items.length} of ${data.total} (offset ${data.offset})`);
  lines.push("");

  if (data.items.length === 0) {
    lines.push("No orders found.");
    return lines.join("\n");
  }

  for (const order of data.items) {
    const date = order.createdAt ? order.createdAt.split("T")[0] : "—";
    lines.push(`#${order.orderId} [${order.code}] | ${order.status} | ${order.totalPrice} ${order.currency} | payment: ${order.paymentStatus} | ${date}`);
  }

  return lines.join("\n");
}

export function formatOrderDetail(order: OrderFull): string {
  // Canonical fields (current API) with fallbacks to the legacy aliases so
  // either response shape renders cleanly.
  const id = order.id ?? order.orderId;
  const total = order.priceGross ?? order.price ?? order.totalPrice;
  const payNow = order.payPrice;
  const paid = order.paid;
  const guests = order.clients ?? order.passengers ?? [];

  const lines: string[] = [];

  const head: string[] = [];
  if (id !== undefined) head.push(`#${id}`);
  if (order.code) head.push(`[${order.code}]`);
  lines.push(`Order ${head.join(" ").trim() || "(no id returned)"}`);

  const statusLine: string[] = [];
  if (order.status) statusLine.push(`Status: ${order.status}`);
  if (order.paymentStatus) statusLine.push(`Payment: ${order.paymentStatus}`);
  if (statusLine.length) lines.push(statusLine.join(" | "));

  if (total !== undefined) {
    const cur = order.currency ?? "";
    const moneyParts: string[] = [`Total: ${total} ${cur}`.trim()];
    if (payNow !== undefined && payNow !== total) moneyParts.push(`pay now: ${payNow} ${cur}`.trim());
    if (paid !== undefined && paid > 0) moneyParts.push(`paid: ${paid} ${cur}`.trim());
    lines.push(moneyParts.join(" | "));
  }

  if (order.tourBegin || order.tourEnd) {
    lines.push(`Dates: ${order.tourBegin ?? "?"} → ${order.tourEnd ?? "?"}`);
  }

  if (order.ticketingDeadline) {
    lines.push(`Ticketing deadline: ${order.ticketingDeadline}`);
  }

  // Travelers (clients on hotels, passengers on flights — same shape).
  if (guests.length > 0) {
    lines.push("");
    lines.push("Travelers:");
    for (const p of guests) {
      const parts = [`${p.firstName ?? ""} ${p.lastName ?? ""}`.trim()];
      if (p.type) parts.push(`(${p.type})`);
      lines.push(`  - ${parts.join(" ")}`);
    }
  }

  // Services (flights, hotel stays).
  if (order.services && order.services.length > 0) {
    lines.push("");
    lines.push("Services:");
    for (const s of order.services) {
      const price = s.priceGross > 0 ? ` | ${s.priceGross}` : "";
      const pnr = s.pnr ? ` | PNR: ${s.pnr}` : "";
      const ticket = s.ticketNumber ? ` | Ticket: ${s.ticketNumber}` : "";
      lines.push(`  - ${s.title}`);
      lines.push(`    ${s.status} | ${s.date}${price}${pnr}${ticket}`);
    }
  }

  // Tickets (flights only).
  if (order.tickets && order.tickets.length > 0) {
    lines.push("");
    lines.push("Tickets:");
    for (const t of order.tickets) {
      lines.push(`  - ${t.ticketNumber} | ${t.status}`);
    }
  }

  if (order.createdAt || order.updatedAt) {
    lines.push("");
    if (order.createdAt) lines.push(`Created: ${order.createdAt}`);
    if (order.updatedAt) lines.push(`Updated: ${order.updatedAt}`);
  }

  // Sanity check: if we somehow ended up with a header line and nothing else,
  // tell the LLM rather than silently rendering a blank "Order".
  if (lines.length === 1 && id === undefined && !order.code) {
    return (
      "Order returned by the API but the response had no recognizable fields " +
      "(no id, code, status, price, or travelers). The booking may still have " +
      "been created — ask the user to verify in the admin dashboard before retrying."
    );
  }

  return lines.join("\n");
}

export function formatCancelCheck(data: CancelCheckResponse, orderId: number): string {
  const lines: string[] = [];

  lines.push(`Cancel check for order #${orderId}`);

  if (!data.cancellable) {
    lines.push(`Result: NOT cancellable`);
    if (data.rules) lines.push(`Reason: ${data.rules}`);
    return lines.join("\n");
  }

  lines.push(`Result: cancellable`);

  // Canonical flat fields take precedence; fall back to legacy nested shape.
  const refund = data.refundAmount ?? data.refund?.estimatedAmount;
  const penalty = data.penaltyAmount ?? data.refund?.penalty;
  const currency = data.currency ?? data.refund?.currency ?? "";

  if (refund !== undefined) lines.push(`Refund: ${refund} ${currency}`.trim());
  if (penalty !== undefined && penalty > 0) lines.push(`Penalty: ${penalty} ${currency}`.trim());
  if (data.deadline) lines.push(`Deadline: ${data.deadline}`);

  if (data.details && data.details.length > 0) {
    lines.push("");
    lines.push("Per service:");
    for (const d of data.details) {
      const tag = d.refundable ? "refundable" : "non-refundable";
      const parts = [`  - [${d.type}] ${d.title} — ${tag}`];
      if (d.deadline) parts.push(`free until ${d.deadline}`);
      if (d.penalty !== undefined) parts.push(`penalty ${d.penalty} ${currency}`.trim());
      lines.push(parts.join(" · "));
    }
  }

  if (data.rules) lines.push(`Rules: ${data.rules}`);

  return lines.join("\n");
}

export function formatCancelResult(data: CancelResult): string {
  const lines: string[] = [];

  lines.push(`Order #${data.orderId} — ${data.status}`);

  if (data.cancelledAt) {
    lines.push(`Cancelled at: ${data.cancelledAt}`);
  }

  if (data.refund) {
    lines.push(`Refund: ${data.refund.amount} ${data.refund.currency} (${data.refund.type})`);
    if (data.refund.penalty > 0) {
      lines.push(`Penalty: ${data.refund.penalty} ${data.refund.currency}`);
    }
  }

  return lines.join("\n");
}

export function formatModifyCheck(data: ModifyCheckResponse, orderId: number): string {
  const lines: string[] = [];

  lines.push(`Modify check for order #${orderId}`);

  if (!data.modifiable) {
    lines.push(`Result: NOT modifiable`);
    return lines.join("\n");
  }

  lines.push(`Result: modifiable`);

  if (data.services && data.services.length > 0) {
    lines.push("");
    for (const s of data.services) {
      lines.push(`Service ${s.serviceId}: ${s.title}`);
      lines.push(`  Allowed changes: ${s.allowedChanges.join(", ")}`);
    }
  }

  return lines.join("\n");
}

export function formatModifyResult(data: ModifyResult): string {
  return `Order #${data.orderId} — ${data.status}\nUse get_order to check the result after modification completes.`;
}
