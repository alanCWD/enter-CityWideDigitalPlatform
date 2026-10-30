export const PAYMENT_METHODS = [
  { value: "e_transfer", label: "e-Transfer" },
  { value: "cash", label: "Cash" },
  { value: "cheque", label: "Cheque" },
  { value: "credit_card", label: "Credit Card" },
  { value: "bank_wire", label: "Bank Wire" },
  { value: "other", label: "Other" },
];

export function paymentMethodLabel(method: string | null | undefined) {
  if (!method) return "—";
  return PAYMENT_METHODS.find((m) => m.value === method)?.label ?? method;
}
