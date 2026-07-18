"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DOMAIN_LABEL,
  KB_STATUS_LABEL,
  formatTime,
  labelOf,
} from "@/lib/labels";
import type { KnowledgeUiDocument } from "@/lib/mock/governance";
import { useAppStore } from "@/stores/app.store";
import {
  ArrowLeft,
  BookOpen,
  ChevronRight,
  Landmark,
  Loader2,
  Package,
  RefreshCw,
  Scale,
  Search,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { syncKnowledgeFromHqApi } from "@/lib/api";
import { toast } from "sonner";

type ExpertDomain = KnowledgeUiDocument["domain"];
type StatusFilter = "all" | KnowledgeUiDocument["status"];

const EXPERTS: Array<{
  domain: ExpertDomain;
  icon: typeof Landmark;
  mission: string;
}> = [
  {
    domain: "credit",
    icon: Landmark,
    mission: "Chính sách LTV/DTI, điều kiện vay, thẩm định tín dụng.",
  },
  {
    domain: "legal",
    icon: Scale,
    mission: "AML/KYC, thông tư SBV, quy định tuân thủ nội bộ.",
  },
  {
    domain: "collateral",
    icon: ShieldCheck,
    mission: "LTV, định giá, quyền sở hữu và đăng ký giao dịch bảo đảm.",
  },
  {
    domain: "product",
    icon: Package,
    mission: "Biểu lãi suất, phí, danh mục sản phẩm vay/tiết kiệm.",
  },
  {
    domain: "ops",
    icon: Wrench,
    mission: "Quy trình giải ngân, ticket vận hành, SLA nội bộ.",
  },
];

export function KnowledgePanel() {
  const employeeId = useAppStore((s) => s.employeeId);
  const documents = useAppStore((s) => s.knowledgeDocuments);
  const focus = useAppStore((s) => s.knowledgeFocus);
  const openKnowledgeSource = useAppStore((s) => s.openKnowledgeSource);
  const clearKnowledgeFocus = useAppStore((s) => s.clearKnowledgeFocus);
  const refreshKnowledge = useAppStore((s) => s.refreshKnowledge);

  const [selectedDomain, setSelectedDomain] = useState<ExpertDomain | null>(
    focus?.domain ?? null,
  );
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(
    focus?.documentId ?? null,
  );
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [syncing, setSyncing] = useState(false);

  async function syncFromHq() {
    setSyncing(true);
    try {
      const result = await syncKnowledgeFromHqApi(employeeId);
      await refreshKnowledge();
      toast.success(
        `Đã đồng bộ ${result.documents} văn bản từ Hội sở (phiên bản ${result.version})`,
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Đồng bộ Hội sở thất bại",
      );
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => {
    if (!focus) return;
    setSelectedDomain(focus.domain);
    setSelectedDocumentId(focus.documentId);
  }, [focus]);

  const expertStats = useMemo(() => {
    const stats = new Map<
      ExpertDomain,
      { active: number; draft: number; superseded: number; latest: string | null }
    >();
    for (const expert of EXPERTS) {
      stats.set(expert.domain, {
        active: 0,
        draft: 0,
        superseded: 0,
        latest: null,
      });
    }
    for (const document of documents) {
      const entry = stats.get(document.domain);
      if (!entry) continue;
      entry[document.status] += 1;
      if (!entry.latest || document.updatedAt > entry.latest) {
        entry.latest = document.updatedAt;
      }
    }
    return stats;
  }, [documents]);

  const visibleDocuments = useMemo(() => {
    if (!selectedDomain) return [];
    const needle = query.trim().toLowerCase();
    return documents
      .filter((document) => document.domain === selectedDomain)
      .filter((document) =>
        statusFilter === "all" ? true : document.status === statusFilter,
      )
      .filter((document) =>
        needle
          ? document.title.toLowerCase().includes(needle) ||
            document.content.toLowerCase().includes(needle)
          : true,
      );
  }, [documents, query, selectedDomain, statusFilter]);

  const selectedDocument =
    documents.find((document) => document.id === selectedDocumentId) ?? null;

  function openExpert(domain: ExpertDomain) {
    setSelectedDomain(domain);
    setSelectedDocumentId(null);
    setQuery("");
    setStatusFilter("all");
    clearKnowledgeFocus();
  }

  function openDocument(document: KnowledgeUiDocument) {
    setSelectedDocumentId(document.id);
    openKnowledgeSource(document.domain, document.id);
  }

  function closeDocument() {
    setSelectedDocumentId(null);
    clearKnowledgeFocus();
  }

  if (!selectedDomain) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">
              Tri thức chuẩn hóa
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Nguồn do Hội sở phát hành qua API — app chỉ đồng bộ về làm RAG,
              không chỉnh sửa. Tra cứu trực tiếp hoặc hỏi qua Trợ lý AI.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={syncing}
            onClick={() => void syncFromHq()}
          >
            {syncing ? (
              <Loader2 className="animate-spin" />
            ) : (
              <RefreshCw />
            )}
            Đồng bộ từ Hội sở
          </Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {EXPERTS.map((expert) => {
          const stats = expertStats.get(expert.domain)!;
          const Icon = expert.icon;
          return (
            <Card
              key={expert.domain}
              role="button"
              tabIndex={0}
              onClick={() => openExpert(expert.domain)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  openExpert(expert.domain);
                }
              }}
              className="cursor-pointer transition-colors hover:border-foreground/30 hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-2 text-base">
                  <span className="flex items-center gap-2">
                    <Icon className="size-4" />
                    Chuyên gia {DOMAIN_LABEL[expert.domain]}
                  </span>
                  <ChevronRight className="text-muted-foreground size-4" />
                </CardTitle>
                <CardDescription className="line-clamp-2">
                  {expert.mission}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  <Badge>{stats.active} đang dùng</Badge>
                  {stats.draft > 0 ? (
                    <Badge variant="secondary">{stats.draft} nháp</Badge>
                  ) : null}
                  {stats.superseded > 0 ? (
                    <Badge variant="outline">
                      {stats.superseded} đã thay thế
                    </Badge>
                  ) : null}
                </div>
                <p className="text-muted-foreground text-xs">
                  Cập nhật gần nhất:{" "}
                  {stats.latest ? formatTime(stats.latest) : "—"}
                </p>
              </CardContent>
            </Card>
          );
        })}
        </div>
      </div>
    );
  }

  const expert = EXPERTS.find((item) => item.domain === selectedDomain)!;
  const ExpertIcon = expert.icon;

  if (selectedDocument) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" size="sm" onClick={closeDocument}>
            <ArrowLeft />
            Danh sách tài liệu
          </Button>
          <div className="flex items-center gap-2 text-sm font-medium">
            <ExpertIcon className="size-4" />
            {DOMAIN_LABEL[selectedDomain]}
          </div>
          <Badge
            variant={
              selectedDocument.status === "active"
                ? "default"
                : selectedDocument.status === "draft"
                  ? "secondary"
                  : "outline"
            }
          >
            {labelOf(KB_STATUS_LABEL, selectedDocument.status)}
          </Badge>
        </div>

        <div className="space-y-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">
              {selectedDocument.title}
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">
              {DOMAIN_LABEL[selectedDocument.domain]} · cập nhật{" "}
              {formatTime(selectedDocument.updatedAt)}
              {selectedDocument.publishedAt
                ? ` · xuất bản ${formatTime(selectedDocument.publishedAt)}`
                : ""}
            </p>
            <p className="text-muted-foreground mt-2 text-sm">
              Đọc văn bản ở đây và hỏi Trợ lý AI bên cạnh để tra cứu nhanh có
              trích dẫn.
            </p>
          </div>
          <div className="whitespace-pre-wrap rounded-lg border bg-background p-4 text-sm leading-relaxed">
            {selectedDocument.content}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setSelectedDomain(null);
            closeDocument();
          }}
        >
          <ArrowLeft />
          Tất cả chuyên gia
        </Button>
        <div className="flex items-center gap-2 text-sm font-medium">
          <ExpertIcon className="size-4" />
          Chuyên gia {DOMAIN_LABEL[selectedDomain]}
        </div>
        <Badge variant="outline">Thư viện chỉ đọc</Badge>
      </div>

      <Card>
        <CardHeader className="gap-3">
          <div>
            <CardTitle className="text-base">
              Nguồn tri thức — {DOMAIN_LABEL[selectedDomain]}
            </CardTitle>
            <CardDescription>
              Văn bản chuẩn hóa do Hội sở phát hành. Mở tài liệu để xem nội
              dung, hoặc hỏi Trợ lý AI để tra cứu nhanh có trích dẫn.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-48 flex-1">
              <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Tra cứu tiêu đề, nội dung..."
                className="pl-8"
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(value) =>
                setStatusFilter(value as StatusFilter)
              }
            >
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả trạng thái</SelectItem>
                <SelectItem value="draft">{KB_STATUS_LABEL.draft}</SelectItem>
                <SelectItem value="active">{KB_STATUS_LABEL.active}</SelectItem>
                <SelectItem value="superseded">
                  {KB_STATUS_LABEL.superseded}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {visibleDocuments.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">
              Chưa có tài liệu trong chuyên gia này.
            </p>
          ) : null}
          {visibleDocuments.map((document) => (
            <button
              key={document.id}
              type="button"
              onClick={() => openDocument(document)}
              className="hover:bg-muted/50 flex w-full items-start justify-between gap-3 rounded-lg border p-3 text-left transition-colors"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <BookOpen className="size-4 shrink-0" />
                  <p className="truncate text-sm font-medium">
                    {document.title}
                  </p>
                  <Badge
                    variant={
                      document.status === "active"
                        ? "default"
                        : document.status === "draft"
                          ? "secondary"
                          : "outline"
                    }
                  >
                    {labelOf(KB_STATUS_LABEL, document.status)}
                  </Badge>
                </div>
                <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">
                  {document.content}
                </p>
                <p className="text-muted-foreground mt-1 text-xs">
                  Cập nhật: {formatTime(document.updatedAt)}
                </p>
              </div>
              <ChevronRight className="text-muted-foreground mt-1 size-4 shrink-0" />
            </button>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
