/** Domain index namespaces — one logical index per agent domain (§4). */
export const RAG_DOMAINS = ['credit', 'legal', 'product', 'ops'] as const;
export type RagDomain = (typeof RAG_DOMAINS)[number];

export function isRagDomain(v: string): v is RagDomain {
  return (RAG_DOMAINS as readonly string[]).includes(v);
}
