import { useEffect, useState, useCallback } from "react";
import { crm, CrmClient, CrmInvoice, CrmMetrics, CrmProduct, CrmContact, CrmSubscription, CrmPayment } from "@/lib/crm";

export function useCrmMetrics() {
  const [data, setData] = useState<CrmMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setData(await crm<CrmMetrics>("metrics.summary"));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { reload(); }, [reload]);
  return { data, loading, error, reload };
}

export function useCrmClients(opts: { q?: string; status?: string } = {}) {
  const [clients, setClients] = useState<CrmClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await crm<{ clients: CrmClient[] }>("clients.list", opts);
      setClients(data.clients ?? []);
      setError(null);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.q, opts.status]);
  useEffect(() => { reload(); }, [reload]);
  return { clients, loading, error, reload };
}

export interface CrmClientDetail {
  client: CrmClient;
  contacts: CrmContact[];
  subscriptions: CrmSubscription[];
  invoices: CrmInvoice[];
  payments: CrmPayment[];
}

export function useCrmClient(id: string | undefined) {
  const [detail, setDetail] = useState<CrmClientDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      setDetail(await crm<CrmClientDetail>("clients.get", { id }));
      setError(null);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, [id]);
  useEffect(() => { reload(); }, [reload]);
  return { detail, loading, error, reload };
}

export function useCrmProducts() {
  const [products, setProducts] = useState<CrmProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await crm<{ products: CrmProduct[] }>("products.list");
      setProducts(data.products ?? []);
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { reload(); }, [reload]);
  return { products, loading, reload };
}

export function useCrmInvoices(opts: { client_id?: string; status?: string } = {}) {
  const [invoices, setInvoices] = useState<CrmInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await crm<{ invoices: CrmInvoice[] }>("invoices.list", opts);
      setInvoices(data.invoices ?? []);
    } finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.client_id, opts.status]);
  useEffect(() => { reload(); }, [reload]);
  return { invoices, loading, reload };
}
