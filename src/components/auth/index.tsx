import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { Loader as Loader2, Pound as Key } from "pixelarticons/react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { signIn, signUp } from "@/lib/auth-client";
import { ORIGIN } from "@/lib/const";
import { cn } from "@/lib/utils";

export function SignInCard({ className }: { className?: string }) {
  const search = useSearch({ from: "/sign-in" });
  const { t } = useTranslation();
  const navi = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const tokenRef = useRef<TurnstileInstance>(null);
  const [token, setToken] = useState("");

  const handleSignIn = async () => {
    setLoading(true);
    await signIn.username({
      username,
      password,
      rememberMe,
      fetchOptions: {
        headers: {
          "x-captcha-response": token,
        },
        onResponse: () => {
          setLoading(false);
          tokenRef.current?.reset();
          setToken("");
        },
        onRequest: () => {
          setLoading(true);
        },
        onError: (ctx) => {
          toast.warning(ctx.error.message);
        },
        onSuccess: async () => {
          await navi({ to: "/u" });
        },
      },
    });
  };

  return (
    <Card
      className={cn("w-full max-w-md bg-card", className)}
      onKeyDown={async (e) => {
        if (e.key === "Enter") {
          if (loading || !username || !password || !token) {
            return;
          }

          await handleSignIn();
        }
      }}
    >
      <CardHeader>
        <CardTitle className="text-lg md:text-xl">Sign In</CardTitle>
        <CardDescription className="text-xs md:text-sm">
          Enter your username below to login to your account
          <br />
          Or{" "}
          <Link to="/sign-up" className="font-semibold underline">
            Sign Up
          </Link>
        </CardDescription>
      </CardHeader>
      <CardContent className="">
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="username">{t("g.username")}</Label>
            <Input
              id="username"
              type="text"
              placeholder="username"
              required
              onChange={(e) => {
                setUsername(e.target.value);
              }}
              value={username}
            />
          </div>

          <div className="grid gap-2">
            <div className="flex items-center">
              <Label htmlFor="password">{t("g.password")}</Label>
            </div>

            <Input
              id="password"
              type="password"
              placeholder="password"
              autoComplete="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="remember"
              defaultChecked={rememberMe}
              onClick={() => {
                setRememberMe(!rememberMe);
              }}
            />
            <Label htmlFor="remember">Remember me</Label>
          </div>

          <Turnstile
            siteKey="0x4AAAAAAAQ2y1gqLezBfMo4"
            ref={tokenRef}
            options={{ size: "flexible" }}
            onSuccess={(v) => setToken(v)}
          />

          <Button
            type="submit"
            className="w-full"
            disabled={loading || !username || !password || !token}
            onClick={handleSignIn}
          >
            {loading ? (
              <Loader2 width={16} height={16} className="animate-spin" />
            ) : (
              <p> {t("g.login")} </p>
            )}
          </Button>

          <Separator />

          <div className={cn("flex w-full items-center gap-2", "flex-col justify-between")}>
            <Button
              variant="outline"
              className={cn("w-full gap-2")}
              disabled={loading}
              onClick={async () => {
                await signIn.social(
                  {
                    provider: "google",
                    callbackURL: search.redirect || ORIGIN + "/u",
                  },
                  {
                    onRequest: (ctx) => {
                      setLoading(true);
                    },
                    onResponse: (ctx) => {
                      setLoading(false);
                    },
                  },
                );
              }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="0.98em"
                height="1em"
                viewBox="0 0 256 262"
              >
                <path
                  fill="#4285F4"
                  d="M255.878 133.451c0-10.734-.871-18.567-2.756-26.69H130.55v48.448h71.947c-1.45 12.04-9.283 30.172-26.69 42.356l-.244 1.622l38.755 30.023l2.685.268c24.659-22.774 38.875-56.282 38.875-96.027"
                ></path>
                <path
                  fill="#34A853"
                  d="M130.55 261.1c35.248 0 64.839-11.605 86.453-31.622l-41.196-31.913c-11.024 7.688-25.82 13.055-45.257 13.055c-34.523 0-63.824-22.773-74.269-54.25l-1.531.13l-40.298 31.187l-.527 1.465C35.393 231.798 79.49 261.1 130.55 261.1"
                ></path>
                <path
                  fill="#FBBC05"
                  d="M56.281 156.37c-2.756-8.123-4.351-16.827-4.351-25.82c0-8.994 1.595-17.697 4.206-25.82l-.073-1.73L15.26 71.312l-1.335.635C5.077 89.644 0 109.517 0 130.55s5.077 40.905 13.925 58.602z"
                ></path>
                <path
                  fill="#EB4335"
                  d="M130.55 50.479c24.514 0 41.05 10.589 50.479 19.438l36.844-35.974C195.245 12.91 165.798 0 130.55 0C79.49 0 35.393 29.301 13.925 71.947l42.211 32.783c10.59-31.477 39.891-54.251 74.414-54.251"
                ></path>
              </svg>
              Sign in with Google
            </Button>
            <Button
              variant="outline"
              className={cn("w-full gap-2")}
              disabled={loading}
              onClick={async () => {
                await signIn.social(
                  {
                    provider: "discord",
                    callbackURL: search.redirect || ORIGIN + "/u",
                  },
                  {
                    onRequest: (ctx) => {
                      setLoading(true);
                    },
                    onResponse: (ctx) => {
                      setLoading(false);
                    },
                  },
                );
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M19.27 5.33C17.94 4.71 16.5 4.26 15 4a.1.1 0 0 0-.07.03c-.18.33-.39.76-.53 1.09a16.1 16.1 0 0 0-4.8 0c-.14-.34-.35-.76-.54-1.09c-.01-.02-.04-.03-.07-.03c-1.5.26-2.93.71-4.27 1.33c-.01 0-.02.01-.03.02c-2.72 4.07-3.47 8.03-3.1 11.95c0 .02.01.04.03.05c1.8 1.32 3.53 2.12 5.24 2.65c.03.01.06 0 .07-.02c.4-.55.76-1.13 1.07-1.74c.02-.04 0-.08-.04-.09c-.57-.22-1.11-.48-1.64-.78c-.04-.02-.04-.08-.01-.11c.11-.08.22-.17.33-.25c.02-.02.05-.02.07-.01c3.44 1.57 7.15 1.57 10.55 0c.02-.01.05-.01.07.01c.11.09.22.17.33.26c.04.03.04.09-.01.11c-.52.31-1.07.56-1.64.78c-.04.01-.05.06-.04.09c.32.61.68 1.19 1.07 1.74c.03.01.06.02.09.01c1.72-.53 3.45-1.33 5.25-2.65c.02-.01.03-.03.03-.05c.44-4.53-.73-8.46-3.1-11.95c-.01-.01-.02-.02-.04-.02M8.52 14.91c-1.03 0-1.89-.95-1.89-2.12s.84-2.12 1.89-2.12c1.06 0 1.9.96 1.89 2.12c0 1.17-.84 2.12-1.89 2.12m6.97 0c-1.03 0-1.89-.95-1.89-2.12s.84-2.12 1.89-2.12c1.06 0 1.9.96 1.89 2.12c0 1.17-.83 2.12-1.89 2.12"
                ></path>
              </svg>
              Sign in with Discord
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function SignUpCard({ className }: { className?: string }) {
  const navi = useNavigate();
  const { t } = useTranslation();
  const search = useSearch({ from: "/sign-up" });

  const tokenRef = useRef<TurnstileInstance>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState("");

  const handleSignUp = async () => {
    if (password !== passwordConfirmation) {
      toast.warning("Passwords do not match");
      return;
    }

    await signUp.email({
      name: username,
      username,
      email: `${username}@nahida.live`,
      password,
      callbackURL: search.redirect || ORIGIN + "/u",
      fetchOptions: {
        headers: {
          "x-captcha-response": token,
        },
        onResponse: () => {
          setLoading(false);
          tokenRef.current?.reset();
          setToken("");
        },
        onRequest: () => {
          setLoading(true);
        },
        onError: (ctx) => {
          toast.warning(ctx.error.message);
        },
        onSuccess: async () => {
          await navi({ to: "/u" });
        },
      },
    });
  };

  return (
    <Card
      className={cn("w-full max-w-md bg-card", className)}
      onKeyDown={async (e) => {
        if (e.key === "Enter") {
          if (loading || !username || !password || !token) {
            return;
          }

          await handleSignUp();
        }
      }}
    >
      <CardHeader>
        <CardTitle className="text-lg md:text-xl">Sign Up</CardTitle>
        <CardDescription className="text-xs md:text-sm">
          Enter your information to create an account
          <br />
          Or{" "}
          <Link to="/sign-in" className="font-semibold underline">
            Sign In
          </Link>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="username">{t("g.username")}</Label>
            <Input
              id="username"
              type="text"
              placeholder="username"
              required
              onChange={(e) => {
                setUsername(e.target.value);
              }}
              value={username}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              placeholder="Password"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">Confirm Password</Label>
            <Input
              id="password_confirmation"
              type="password"
              value={passwordConfirmation}
              onChange={(e) => setPasswordConfirmation(e.target.value)}
              autoComplete="new-password"
              placeholder="Confirm Password"
            />
          </div>
          <Turnstile
            siteKey="0x4AAAAAAAQ2y1gqLezBfMo4"
            ref={tokenRef}
            options={{ size: "flexible" }}
            onSuccess={(v) => setToken(v)}
          />
          <Button
            type="submit"
            className="w-full"
            disabled={loading || !token || !username || !password}
            onClick={handleSignUp}
          >
            {loading ? (
              <Loader2 width={16} height={16} className="animate-spin" />
            ) : (
              "Create an account"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
