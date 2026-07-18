"use client";

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
import { Textarea } from "@/components/ui/textarea";
import { DOMAIN_LABEL, KB_STATUS_LABEL, labelOf } from "@/lib/labels";
import {
  seedKnowledgeDocuments,
  type KnowledgeUiDocument,
} from "@/lib/mock/governance";
import { useAppStore } from "@/stores/app.store";
import { BookOpenCheck, Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function KnowledgePanel() {
  const employeeId = useAppStore((s) => s.employeeId);
  const employees = useAppStore((s) => s.employees);
  const actor = employees.find((e) => e.id === employeeId);
  const [documents, setDocuments] = useState<KnowledgeUiDocument[]>(
    () => structuredClone(seedKnowledgeDocuments),
  );
  const [title, setTitle] = useState("");
  const [domain, setDomain] =
    useState<KnowledgeUiDocument["domain"]>("credit");
  const [content, setContent] = useState("");

  function createDraft() {
    if (!title.trim() || !content.trim()) {
      toast.error("Cần nhập tiêu đề và nội dung");
      return;
    }
    const now = new Date().toISOString();
    const draft: KnowledgeUiDocument = {
      id: `kb-draft-${Math.random().toString(36).slice(2, 8)}`,
      domain,
      title: title.trim(),
      content: content.trim(),
      status: "draft",
      updatedAt: now,
      publishedAt: null,
    };
    setDocuments((prev) => [draft, ...prev]);
    setTitle("");
    setContent("");
    toast.success("Đã lưu bản nháp (mô phỏng)");
  }

  function publish(id: string) {
    const now = new Date().toISOString();
    setDocuments((prev) =>
      prev.map((document) =>
        document.id === id
          ? {
              ...document,
              status: "active",
              publishedAt: now,
              updatedAt: now,
            }
          : document,
      ),
    );
    toast.success("Đã xuất bản và dựng lại chỉ mục tri thức (mô phỏng)");
  }

  if (actor?.accessLayer !== "manager") return null;

  return (
    <div className="grid gap-4 xl:grid-cols-[380px_1fr]">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpenCheck className="size-4" />
            Tạo tài liệu tri thức
          </CardTitle>
          <CardDescription>
            Trưởng phòng chỉ xuất bản tri thức; không sửa danh mục chuyên gia
            hoặc kết nối MCP. Dữ liệu mô phỏng để test giao diện.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Tiêu đề chính sách / quy trình"
          />
          <Select
            value={domain}
            onValueChange={(value) =>
              setDomain(value as KnowledgeUiDocument["domain"])
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="credit">{DOMAIN_LABEL.credit}</SelectItem>
              <SelectItem value="legal">{DOMAIN_LABEL.legal}</SelectItem>
              <SelectItem value="product">{DOMAIN_LABEL.product}</SelectItem>
              <SelectItem value="ops">{DOMAIN_LABEL.ops}</SelectItem>
            </SelectContent>
          </Select>
          <Textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="Nội dung đã chuẩn hóa..."
            className="min-h-52"
          />
          <Button className="w-full" onClick={createDraft}>
            Lưu bản nháp
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Danh sách tài liệu</CardTitle>
            <CardDescription>
              Chỉ tài liệu đang dùng mới được đưa vào chỉ mục tri thức.
            </CardDescription>
          </div>
          <Badge variant="outline">Mô phỏng</Badge>
        </CardHeader>
        <CardContent className="space-y-3">
          {documents.map((document) => (
            <div
              key={document.id}
              className="flex items-start justify-between gap-3 rounded-lg border p-3"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-medium">
                    {document.title}
                  </p>
                  <Badge variant="outline">
                    {labelOf(DOMAIN_LABEL, document.domain)}
                  </Badge>
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
              </div>
              {document.status === "draft" ? (
                <Button size="sm" onClick={() => publish(document.id)}>
                  <Send />
                  Xuất bản
                </Button>
              ) : null}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
