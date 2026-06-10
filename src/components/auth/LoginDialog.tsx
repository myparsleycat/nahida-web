import { useAutoAnimate } from "@formkit/auto-animate/react";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { ArrowLeftFromLineIcon, LoaderCircleIcon, UserIcon } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { DiscordIcon, GoogleIcon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn } from "@/lib/auth-client";
import { useUIStore } from "@/stores/ui.store";

export function LoginDialog() {
  const { loginDialogOpen, setLoginDialogOpen } = useUIStore();
  const [parent] = useAutoAnimate();
  const { t } = useTranslation();

  const [isCredentials, setIsCredentials] = useState(false);
  const [isLoading, setLoading] = useState(false);
  const [turnstileSuccess, setTurnstileSuccess] = useState(false);

  const turnstileRef = useRef<TurnstileInstance>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);

    const username = formData.get("username")?.toString();
    const password = formData.get("password")?.toString();
    const token = formData.get("cf-turnstile-response")?.toString();

    try {
      if (!username || !password) {
        return toast.warning(t("toast.warning.username_or_pw_missing"));
      } else if (!token) {
        return toast.warning(t("toast.warning.missing_cftoken"));
      }

      setLoading(true);

      try {
        const data = await signIn.username({
          username,
          password,
          fetchOptions: { headers: { "x-captcha-response": token } },
        });

        if (data.error?.message) {
          toast.warning(data.error.message);
          return;
        } else if (!data.data) {
          throw new Error("Fetch Error");
        }

        toast.success(t("toast.success.login"));
        setLoginDialogOpen(false);
      } catch (err: any) {
        console.error("Login error:", err);
        toast.error(t("toast.error.login"), {
          description: err.message,
        });
      }
    } finally {
      setLoading(false);
      turnstileRef.current?.reset();
      setTurnstileSuccess(false);
    }
  };

  return (
    <Dialog open={loginDialogOpen} onOpenChange={setLoginDialogOpen}>
      <DialogContent className="w-sm overflow-hidden select-none" aria-describedby={undefined}>
        <DialogHeader className="mb-4">
          <DialogTitle className="text-center text-xl">Login to Akasha</DialogTitle>
        </DialogHeader>

        <div className="w-full space-y-8" ref={parent}>
          {isCredentials && (
            <form onSubmit={handleSubmit}>
              <div className="flex w-full flex-col space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username">{t("g.username")}</Label>
                  <Input
                    id="username"
                    name="username"
                    required
                    type="text"
                    disabled={isLoading}
                    autoFocus
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center">
                    <Label htmlFor="password">{t("g.password")}</Label>
                  </div>
                  <Input
                    id="password"
                    name="password"
                    required
                    type="password"
                    disabled={isLoading}
                  />
                </div>

                <Turnstile
                  siteKey="0x4AAAAAAAQ2y1gqLezBfMo4"
                  ref={turnstileRef}
                  options={{ size: "flexible" }}
                  onSuccess={() => setTurnstileSuccess(true)}
                />

                <Button
                  className="w-full dark:bg-gray-200"
                  type="submit"
                  disabled={isLoading || !turnstileSuccess}
                >
                  {isLoading ? (
                    <LoaderCircleIcon
                      aria-hidden="true"
                      className="h-5 w-5 animate-spin transition-transform"
                    />
                  ) : (
                    t("g.login")
                  )}
                </Button>
              </div>
            </form>
          )}

          {isCredentials ? (
            <Button variant="outline" size="icon" onClick={() => setIsCredentials(false)}>
              <ArrowLeftFromLineIcon className="pointer-events-none" />
            </Button>
          ) : (
            <div className="space-y-3">
              <button
                className="flex w-full items-center justify-center gap-3 rounded-lg border p-2 transition-colors duration-200 hover:bg-muted"
                onClick={() => setIsCredentials(true)}
              >
                <UserIcon className="h-5 w-5" />
                Login with Username
              </button>
              <button
                className="flex w-full items-center justify-center gap-3 rounded-lg border p-2 transition-colors duration-200 hover:bg-muted"
                onClick={async () =>
                  await signIn.social({
                    provider: "google",
                    callbackURL: window.location.href,
                  })
                }
              >
                <GoogleIcon className="h-5 w-5" />
                Login with Google
              </button>
              <button
                className="flex w-full items-center justify-center gap-3 rounded-lg border p-2 transition-colors duration-200 hover:bg-muted"
                onClick={async () =>
                  await signIn.social({
                    provider: "discord",
                    callbackURL: window.location.href,
                  })
                }
              >
                <DiscordIcon className="h-5 w-5" />
                Login with Discord
              </button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
