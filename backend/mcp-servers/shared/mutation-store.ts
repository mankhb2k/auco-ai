import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const STORE = resolve(process.cwd(), 'data/runtime/mcp-mutations.json');

type MutationStore = {
  loanApplications: Array<Record<string, unknown>>;
  flaggedTransactions: Array<Record<string, unknown>>;
  tickets: Array<Record<string, unknown>>;
};

async function load(): Promise<MutationStore> {
  try {
    const raw = await readFile(STORE, 'utf8');
    return JSON.parse(raw) as MutationStore;
  } catch {
    return { loanApplications: [], flaggedTransactions: [], tickets: [] };
  }
}

async function save(data: MutationStore): Promise<void> {
  await mkdir(dirname(STORE), { recursive: true });
  await writeFile(STORE, JSON.stringify(data, null, 2), 'utf8');
}

export async function persistLoanApplication(
  app: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const store = await load();
  store.loanApplications.push(app);
  await save(store);
  return app;
}

export async function getLoanApplication(id: string) {
  const store = await load();
  return store.loanApplications.find((a) => a.applicationId === id) ?? null;
}

export async function persistFlag(flag: Record<string, unknown>) {
  const store = await load();
  store.flaggedTransactions.push(flag);
  await save(store);
  return flag;
}

export async function persistTicket(ticket: Record<string, unknown>) {
  const store = await load();
  store.tickets.push(ticket);
  await save(store);
  return ticket;
}

export async function getTicket(id: string) {
  const store = await load();
  return store.tickets.find((t) => t.ticketId === id) ?? null;
}
