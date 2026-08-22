import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/admin/")({
  component: RouteComponent,
  head: () => ({
    meta: [{ title: "관리 | 나히다 라이브" }],
  }),
});

function RouteComponent() {
  const { t } = useTranslation();

  return (
    <div className="flex justify-center p-4">
      <div className="w-full max-w-2xl space-y-8 py-20">
        <Card>
          <CardHeader>
            <CardTitle>{t("g.admin")}</CardTitle>
            <CardDescription>운영 설정을 변경합니다</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-end">
            <Button asChild>
              <Link to="/admin/settings">포인트 설정</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
