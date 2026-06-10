import { SaveIcon, XIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface PasswordFormProps {
  hasPassword: boolean;
  password: string;
  onPasswordChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export function PasswordForm({
  hasPassword,
  password,
  onPasswordChange,
  onSubmit,
}: PasswordFormProps) {
  const { t } = useTranslation();

  return (
    <div className="flex w-full min-w-0 flex-col gap-1.5">
      <Label>{t("g.password")}</Label>
      <form className="relative" onSubmit={onSubmit}>
        <Input
          type="text"
          name="password"
          disabled={hasPassword}
          required
          minLength={4}
          maxLength={150}
          onValueChange={onPasswordChange}
          value={password}
        />
        <div className="absolute inset-y-0 right-2 flex items-center">
          <button type="submit">
            {hasPassword ? <XIcon className="size-5.5" /> : <SaveIcon className="size-5.5" />}
          </button>
        </div>
      </form>
    </div>
  );
}
