"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAppStore } from "@/stores/app.store";

export function FinalAnswer() {
  const activeRun = useAppStore((s) => s.activeRun);

  if (!activeRun?.finalAnswer) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Câu trả lời tổng hợp</CardTitle>
          <CardDescription>
            Bộ điều phối sẽ tổng hợp khi mọi bước hoàn tất.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Câu trả lời tổng hợp</CardTitle>
        <CardDescription>
          Một câu trả lời duy nhất từ bộ điều phối
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm leading-relaxed whitespace-pre-wrap">
          {activeRun.finalAnswer}
        </p>
        {activeRun.citations.length > 0 ? (
          <div>
            <p className="mb-2 text-xs font-medium tracking-wide uppercase">
              Trích dẫn
            </p>
            <ul className="space-y-1.5">
              {activeRun.citations.map((c) => (
                <li
                  key={`${c.sourceDoc}-${c.section}`}
                  className="bg-muted/60 rounded-md px-3 py-2 text-xs"
                >
                  <span className="font-medium">{c.sourceDoc}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    · {c.section} · {c.score.toFixed(2)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
