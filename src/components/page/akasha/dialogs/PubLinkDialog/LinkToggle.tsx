import { Earth as EarthIcon, Lock as LockIcon } from "pixelarticons/react";
import { useTranslation } from "react-i18next";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface LinkToggleProps {
  hasLink: boolean;
  checked: boolean;
  onToggle: () => void;
  onCheckedChange: (checked: boolean) => void;
}

export function LinkToggle({ hasLink, checked, onToggle, onCheckedChange }: LinkToggleProps) {
  const { t } = useTranslation();

  return (
    <div className="w-full">
      <Label>{t("#.PubLinkDialog.generalAccess")}</Label>
      <div className="mt-2 flex flex-col">
        <div className="flex w-full flex-row items-center gap-4">
          <div className="flex">
            {hasLink ? <EarthIcon color="green" /> : <LockIcon color="orange" />}
          </div>
          <div>
            <p className="text-base">
              {hasLink ? t("#.PubLinkDialog.sharing") : t("#.PubLinkDialog.restricted")}
            </p>
            <p className="text-sm">
              {hasLink ? t("#.PubLinkDialog.sharingDesc") : t("#.PubLinkDialog.restrictedDesc")}
            </p>
          </div>
          <div className="flex grow justify-end">
            <Switch checked={checked} onCheckedChange={onCheckedChange} onClick={onToggle} />
          </div>
        </div>
      </div>
    </div>
  );
}
