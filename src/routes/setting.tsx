import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { calculateOpfsSize, clearAllOpfsData } from "@/lib/opfs";
import { formatSize } from "@/lib/utils";
import { useSettingsStore } from "@/stores/setting.store";

export const Route = createFileRoute("/setting")({
  component: RouteComponent,
});

function RouteComponent() {
  const setting = useSettingsStore();
  const [opfsSize, setOpfsSize] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isClearing, setIsClearing] = useState(false);

  const fetchSize = async () => {
    setIsLoading(true);
    try {
      const size = await calculateOpfsSize();
      setOpfsSize(size);
    } catch (e) {
      console.error("Failed to calculate OPFS size:", e);
      toast.error("크기 계산 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSize();
  }, []);

  const handleClearData = async () => {
    setIsClearing(true);
    try {
      await clearAllOpfsData();
      toast.success("모든 임시 파일을 삭제했습니다.");
      await fetchSize();
    } catch (e) {
      console.error("Failed to clear OPFS data:", e);
      toast.error("파일 삭제 중 오류가 발생했습니다.");
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="flex justify-center p-4">
      <div className="w-full max-w-2xl space-y-8 py-20">
        <Card>
          <CardHeader>
            <CardTitle>커스텀 커서</CardTitle>
            <CardDescription>커스텀 커서 상태를 변경합니다</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-end">
            <Switch
              checked={setting.gifCursor}
              onCheckedChange={(v) => setting.updateSettings({ gifCursor: v })}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>임시 파일</CardTitle>
            <CardDescription>아카샤 임시 파일</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-sm text-muted-foreground">현재 사용량</span>
                <span className="font-semibold">
                  {isLoading ? "계산 중..." : formatSize(opfsSize)}
                </span>
              </div>
              <Button
                variant="destructive"
                onClick={handleClearData}
                disabled={isClearing || isLoading}
              >
                {isClearing ? "삭제 중..." : "전체 정리"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
