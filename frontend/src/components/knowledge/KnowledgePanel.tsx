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
import { useAppStore } from "@/stores/app.store";
import { BookOpenCheck, RefreshCw, Send } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

type KnowledgeDocument = {
  id: string;
  domain: "credit" | "legal" | "product" | "ops";
  title: string;
  content: string;
  status: "draft" | "active" | "superseded";
  updatedAt: string;
  publishedAt: string | null;
};

const API_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ??
  "http://localhost:8387";

export function KnowledgePanel() {
  const employeeId = useAppStore((s) => s.employeeId);
  const employees = useAppStore((s) => s.employees);
  const actor = employees.find((e) => e.id === employeeId);
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [domain, setDomain] =
    useState<KnowledgeDocument["domain"]>("credit");
  const [content, setContent] = useState("");

  const request = useCallback(
    async (path: string, init?: RequestInit) => {
      const response = await fetch(`${API_URL}${path}`, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          "X-Demo-Employee-Id": employeeId,
          ...init?.headers,
        },
      });
      if (!response.ok) {
        const error = (await response.json().catch(() => null)) as
          | { message?: string }
          | null;
        throw new Error(error?.message ?? `HTTP ${response.status}`);
      }
      return response.json();
    },
    [employeeId],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setDocuments(
        (await request("/api/knowledge/documents")) as KnowledgeDocument[],
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không tải được KB");
    } finally {
      setLoading(false);
    }
  }, [request]);

  useEffect(() => {
    if (actor?.accessLayer === "manager") void load();
  }, [actor?.accessLayer, load]);

  async function createDraft() {
    if (!title.trim() || !content.trim()) {
      toast.error("Cần nhập tiêu đề và nội dung");
      return;
    }
    setLoading(true);
    try {
      await request("/api/knowledge/documents", {
        method: "POST",
        body: JSON.stringify({ title, domain, content }),
      });
      setTitle("");
      setContent("");
      toast.success("Đã lưu bản nháp");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không tạo được draft");
    } finally {
      setLoading(false);
    }
  }

  async function publish(id: string) {
    setLoading(true);
    try {
      await request(`/api/knowledge/documents/${id}/publish`, {
        method: "POST",
      });
      toast.success("Đã publish và rebuild RAG index");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Publish thất bại");
    } finally {
      setLoading(false);
    }
  }

  if (actor?.accessLayer !== "manager") return null;

  return (
    <div className="grid gap-4 xl:grid-cols-[380px_1fr]">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpenCheck className="size-4" />
            Tạo tài liệu RAG
          </CardTitle>
          <CardDescription>
            Trưởng phòng chỉ xuất bản tri thức; không sửa Agent Catalog hoặc MCP.
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
              setDomain(value as KnowledgeDocument["domain"])
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="credit">Credit</SelectItem>
              <SelectItem value="legal">Legal / Compliance</SelectItem>
              <SelectItem value="product">Product</SelectItem>
              <SelectItem value="ops">Operations</SelectItem>
            </SelectContent>
          </Select>
          <Textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="Nội dung đã chuẩn hóa..."
            className="min-h-52"
          />
          <Button className="w-full" onClick={createDraft} disabled={loading}>
            Lưu bản nháp
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Knowledge Documents</CardTitle>
            <CardDescription>
              Chỉ tài liệu active mới được ingest vào live RAG index.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={loading ? "animate-spin" : ""} />
            Tải lại
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {documents.length === 0 ? (
            <p className="text-muted-foreground py-10 text-center text-sm">
              Chưa có tài liệu hoặc backend chưa kết nối.
            </p>
          ) : (
            documents.map((document) => (
              <div
                key={document.id}
                className="flex items-start justify-between gap-3 rounded-lg border p-3"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-medium">
                      {document.title}
                    </p>
                    <Badge variant="outline">{document.domain}</Badge>
                    <Badge
                      variant={
                        document.status === "active" ? "default" : "secondary"
                      }
                    >
                      {document.status}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">
                    {document.content}
                  </p>
                </div>
                {document.status === "draft" ? (
                  <Button
                    size="sm"
                    onClick={() => publish(document.id)}
                    disabled={loading}
                  >
                    <Send />
                    Publish
                  </Button>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
