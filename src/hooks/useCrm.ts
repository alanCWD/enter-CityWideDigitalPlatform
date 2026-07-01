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

export function useCrmClients(opts: { q?: string; status?: string; agency_id?: string; page?: number; pageSize?: number } = {}) {
  const [clients, setClients] = useState<CrmClient[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pageSize = opts.pageSize ?? 100;
  const page = opts.page ?? 0;
  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await crm<{ clients: CrmClient[]; total: number }>("clients.list", {
        q: opts.q,
        status: opts.status,
        agency_id: opts.agency_id,
        limit: pageSize,
        offset: page * pageSize,
      });
      setClients(data.clients ?? []);
      setTotal(data.total ?? 0);
      setError(null);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, [opts.q, opts.status, opts.agency_id, page, pageSize]);
  useEffect(() => { reload(); }, [reload]);
  return { clients, total, loading, error, reload };
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
