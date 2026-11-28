/**
 * Acesso ao Supabase apenas com a chave publicável (`sb_publishable_…`).
 *
 * O Lovable Cloud não expõe a SERVICE_ROLE_KEY, então nada aqui depende dela:
 * são chamadas HTTP diretas ao PostgREST/Auth, carregando o JWT do usuário
 * quando a operação precisa de RLS. As operações privilegiadas (contador,
 * cotas) são funções `security definer` no banco.
 */

type Env = { url: string; key: string };

export class SupabaseRestError extends Error {
  status: number;
  code: string | undefined;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "SupabaseRestError";
    this.status = status;
    this.code = code;
  }
}

function readEnv(): Env {
  const url = import.meta.env["VITE_SUPABASE_URL"] || process.env["SUPABASE_URL"];
  const key =
    import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] || process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) {
    throw new SupabaseRestError("Missing SUPABASE_URL/SUPABASE_PUBLISHABLE_KEY", 500);
  }
  return { url: url.replace(/\/+$/, ""), key };
}

async function request(path: string, init: RequestInit, token?: string): Promise<unknown> {
  const env = readEnv();
  const headers = new Headers(init.headers);
  headers.set("apikey", env.key);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${env.url}${path}`, { ...init, headers });
  const raw = await res.text();
  let body: unknown = null;
  if (raw) {
    try {
      body = JSON.parse(raw);
    } catch {
      body = raw;
    }
  }
  if (!res.ok) {
    const detail = body as { message?: string; msg?: string; code?: string } | null;
    throw new SupabaseRestError(
      detail?.message ?? detail?.msg ?? res.statusText,
      res.status,
      detail?.code,
    );
  }
  return body;
}

/** Chama uma função RPC. Sem token, executa como `anon`. */
export function rpc<T>(fn: string, args: Record<string, unknown> = {}, token?: string): Promise<T> {
  return request(
    `/rest/v1/rpc/${fn}`,
    { method: "POST", body: JSON.stringify(args) },
    token,
  ) as Promise<T>;
}

/** SELECT via PostgREST (query já codificada, ex.: `profiles?id=eq.<uuid>&select=*`). */
export function selectRows<T>(query: string, token?: string): Promise<T> {
  return request(`/rest/v1/${query}`, { method: "GET" }, token) as Promise<T>;
}

/** INSERT simples (sem upsert); não devolve corpo. */
export function insertRow(table: string, row: Record<string, unknown>, token?: string): Promise<unknown> {
  return request(
    `/rest/v1/${table}`,
    {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(row),
    },
    token,
  );
}

/** INSERT com resolução de conflito pela chave primária (upsert); não devolve corpo. */
export function upsertRow(table: string, row: Record<string, unknown>, token?: string): Promise<unknown> {
  return request(
    `/rest/v1/${table}`,
    {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(row),
    },
    token,
  );
}

/** Valida o access token do usuário e devolve o id (equivale a `auth.getUser`). */
export async function authUser(token: string): Promise<{ id: string; email?: string | undefined } | null> {
  try {
    const body = (await request("/auth/v1/user", { method: "GET" }, token)) as {
      id?: string;
      email?: string;
    } | null;
    if (!body?.id) return null;
    return { id: body.id, email: body.email };
  } catch {
    return null;
  }
}

/** `true` quando a RPC recusou por permissão (RLS ou `raise ... 42501`). */
export function isForbidden(error: unknown): boolean {
  return (
    error instanceof SupabaseRestError && (error.status === 403 || error.code === "42501")
  );
}
