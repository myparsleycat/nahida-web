import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { useRouter } from "@tanstack/react-router";
import { motion } from "motion/react";
import { Image as ImageIcon, Loader as Loader2Icon } from "pixelarticons/react";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";

import { Center } from "@/components/common";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { modStorage } from "@/lib/akasha/services/mod-drive/localstorage";
import { eden } from "@/lib/eden";
import { base64url } from "@/lib/utils";

import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle } from "../ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

interface AkashaModPwdProtectProps {
  modId: string;
  errMsg?: string | null;
  preview?: {
    mime: string;
    url: string;
  };
}

export function AkashaModPwdProtect(props: AkashaModPwdProtectProps) {
  const { modId, errMsg: errM, preview } = props;
  const { t } = useTranslation();
  const [password, setModPwd] = useState("");
  const router = useRouter();

  const [ts, setTs] = useState(0);
  const [errMsg, setErrMsg] = useState(errM);
  const [loading, setLoading] = useState(false);

  const refetch = () => {
    router.invalidate();
  };

  const tryit = async (e: React.FormEvent) => {
    try {
      e.preventDefault();

      const modStorageData = modStorage.getMod(modId);

      setLoading(true);
      const { error } = await eden.akasha.mod({ modId }).get({
        query: {
          sig: modStorageData?.sig,
          ...(password && { password: base64url.encode(password) }),
        },
      });

      if (!error) {
        sessionStorage.setItem(
          `akasha-mod:${modId}`,
          JSON.stringify({
            pwd: base64url.encode(password),
          }),
        );
        refetch();
      } else {
        let msg = error.value.toString();
        if (error.status === 429) {
          msg = t("toast.warning.retryAfter", {
            sec: error.value.retryAfter,
          });
        }
        setErrMsg(msg);
        setTs(Date.now());
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative h-full w-full">
      <Center size="page-full">
        <Card className="relative overflow-hidden bg-card">
          <CardContent className="flex flex-col space-y-3">
            <div className="flex w-full items-center justify-between">
              <CardTitle>비밀번호로 보호된 모드</CardTitle>
              {preview && (
                <Dialog>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <DialogTrigger className={buttonVariants({ variant: "ghost", size: "icon" })}>
                        <ImageIcon />
                      </DialogTrigger>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Show Preview</p>
                    </TooltipContent>
                  </Tooltip>
                  <VisuallyHidden>
                    <DialogHeader>
                      <DialogTitle></DialogTitle>
                    </DialogHeader>
                  </VisuallyHidden>

                  <DialogContent className="size-fit overflow-hidden p-0 sm:max-w-none">
                    {preview.mime.startsWith("image") ? (
                      <img
                        src={preview?.url}
                        draggable="false"
                        className="max-h-[80vh] max-w-[80vw]"
                      />
                    ) : preview.mime.startsWith("video") ? (
                      <video
                        src={preview?.url}
                        draggable="false"
                        muted
                        autoPlay
                        loop
                        controls={false}
                        className="max-h-[80vh] max-w-[80vw]"
                      />
                    ) : (
                      <div className="p-4 text-center text-gray-500">
                        File type not supported for preview.
                      </div>
                    )}
                  </DialogContent>
                </Dialog>
              )}
            </div>

            {errMsg && (
              <motion.span
                key={ts}
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                className="text-destructive"
              >
                {errMsg}
              </motion.span>
            )}

            <form className="flex gap-2" onSubmit={tryit}>
              <Input
                autoFocus
                required
                value={password}
                disabled={loading}
                onValueChange={(v) => {
                  setModPwd(v);
                }}
              />
              <Button
                type="submit"
                className="min-w-16"
                disabled={!password || loading}
                variant="outline"
              >
                {loading ? <Loader2Icon className="animate-spin" /> : t("g.continue")}
              </Button>
            </form>
          </CardContent>
        </Card>
      </Center>
    </div>
  );
}
