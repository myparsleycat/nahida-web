import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Inbox as InboxIcon } from "pixelarticons/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { BentoCard } from "@/components/magicui/bento-grid";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { authClient, useSession } from "@/lib/auth-client";
import { eden } from "@/lib/eden";

export const Route = createFileRoute("/u/")({
  component: RouteComponent,
});

function Bentos() {
  const { t } = useTranslation();

  const query = useQuery({
    queryKey: ["u:mods-count"],
    queryFn: async () => {
      const { data, error } = await eden.hello.mymods.count.get();

      if (error) {
        throw new Error(error.value.toString());
      }

      return data.count;
    },
    retry: false,
    placeholderData: (prev) => prev,
  });

  const features = [
    {
      Icon: InboxIcon,
      name: t("u.my_mods"),
      description: `${query.data}개의 업로드된 모드`,
      href: "/u/mods",
      cta: t("g.continue"),
      background: null,
      className: "col-span-3 lg:col-span-1",
    },
  ];

  return (
    <>
      {features.map((feature) => (
        <BentoCard key={feature.name} {...feature} />
      ))}
    </>
  );
}

function RouteComponent() {
  const { t } = useTranslation();
  const session = useSession().data;
  const navi = useNavigate();

  const [delaccinput, setDelAccInput] = useState("");

  return (
    <>
      <div className="h-18"></div>
      <div className="z-0 mx-auto flex w-full flex-1 flex-col overflow-auto px-0 py-4 sm:overflow-visible">
        <div className="mx-auto flex flex-col items-center gap-20 p-4">
          <div className="flex h-47.5 justify-center gap-4 md:gap-12">
            <Bentos />
          </div>

          <div className="flex w-lg flex-col gap-6 rounded-lg border p-4">
            <div className="flex items-center gap-4 sm:gap-16">
              <div className="flex-1">
                <Label>{t("g.name")}</Label>
                <p className="text-sm text-muted-foreground">
                  <span>Your display name can be edited</span>
                </p>
              </div>
              <div className="w-32 justify-items-end md:w-48">
                <Input disabled defaultValue={session?.user.name} />
              </div>
            </div>

            <Separator />

            <div className="flex items-center gap-4 sm:gap-16">
              <div className="flex-1">
                <Label>{t("u.delete_account")}</Label>
                <p className="text-sm text-muted-foreground">
                  <span>계정을 삭제합니다</span>
                </p>
              </div>
              <div className="justify-items-end">
                <AlertDialog>
                  <AlertDialogTrigger className={buttonVariants({ variant: "destructive" })}>
                    {t("g.delete")}
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>정말로 계정을 삭제할까요?</AlertDialogTitle>
                      <AlertDialogDescription>
                        삭제 버튼을 누르는 즉시 계정 데이터가 영구적으로 삭제됩니다. 이 작업은
                        되돌릴 수 없습니다!
                      </AlertDialogDescription>

                      <Accordion type="single">
                        <AccordionItem value="item-1">
                          <AccordionTrigger>제거되는 데이터</AccordionTrigger>
                          <AccordionContent>
                            <div className="space-y-1">
                              <p>- 사용자 이름, 아이디, 이메일, 비밀번호를 포함한 전체 유저 정보</p>
                              <p>- 로그인 세션</p>
                              <p>
                                - 나히다 드라이브의 전체 데이터 (공유 링크와 공유 드라이브 포함)
                              </p>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="item-2">
                          <AccordionTrigger>제거되지 않는 데이터</AccordionTrigger>
                          <AccordionContent>
                            <div className="space-y-1">
                              <p>- 업로드한 모드 (나히다 드라이브 공유 제외)</p>
                              <p>- 모드 다운로드 기록</p>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>

                      <div className="mt-6 space-y-1">
                        <Label className="text-xs">
                          계정을 삭제하려면 아래에 '삭제'를 입력하고 삭제 버튼을 클릭하세요
                        </Label>
                        <Input placeholder="삭제" onValueChange={setDelAccInput} />
                      </div>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t("g.cancel")}</AlertDialogCancel>
                      <AlertDialogAction
                        className={buttonVariants({ variant: "destructive" })}
                        disabled={delaccinput !== "삭제"}
                        onClick={async () => {
                          try {
                            const res = await authClient.deleteUser();
                            if (res.data?.success) {
                              toast.success("계정이 삭제되었습니다");
                              await navi({ to: "/" }).catch((error: unknown) => {
                                console.error("Failed to navigate after account deletion:", error);
                              });
                              return;
                            }

                            if (res.error?.message) {
                              toast.error(res.error.message);
                            }
                          } catch (error) {
                            toast.error(error instanceof Error ? error.message : String(error));
                          }
                        }}
                      >
                        {t("g.delete")}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
