import { Link as LinkIcon } from "pixelarticons/react";
import { WarningDiamond as AlertTriangleIcon } from "pixelarticons/react";
import { useTranslation } from "react-i18next";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface Permission {
  id: string;
  name: string;
  image: string | null;
  permission: string;
}

interface PermissionListProps {
  permissions: Permission[];
  onChangePermission: (pid: string) => void;
  onDeletePermission: (pid: string) => void;
  onCopyInviteUrl: () => void;
}

function getPermissionLabel(permission: string, t: (key: string) => string): string {
  switch (permission) {
    case "VIEW":
      return t("#.PubLinkDialog.permissionView");
    case "EDIT":
      return t("#.PubLinkDialog.permissionEdit");
    case "UPLOAD":
      return t("#.PubLinkDialog.permissionUpload");
    default:
      return permission;
  }
}

export function PermissionList({
  permissions,
  onChangePermission,
  onDeletePermission,
  onCopyInviteUrl,
}: PermissionListProps) {
  const { t } = useTranslation();

  return (
    <div className="w-full">
      <Label>{t("#.PubLinkDialog.accessUsers")}</Label>
      <div className="mt-2 flex flex-row items-center space-x-4">
        {permissions.length > 0 ? (
          <div className="grid max-h-28 grid-cols-8 gap-4 overflow-x-hidden overflow-y-auto p-1 select-none">
            {permissions.map((permission) => (
              <div className="flex" key={permission.id}>
                <DropdownMenu>
                  <DropdownMenuTrigger>
                    <Avatar>
                      <AvatarImage
                        src={permission.image || "https://placehold.co/100"}
                        alt={permission.name}
                      />
                      <AvatarFallback>{permission.name}</AvatarFallback>
                    </Avatar>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuGroup>
                      <DropdownMenuLabel>
                        {permission.name} ({getPermissionLabel(permission.permission, t)})
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="cursor-pointer"
                        onClick={() => onChangePermission(permission.id)}
                      >
                        {t("#.PubLinkDialog.changePermission")}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="cursor-pointer"
                        onClick={() => onDeletePermission(permission.id)}
                      >
                        {t("#.PubLinkDialog.deletePermission")}
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>
        ) : (
          <Alert>
            <AlertTriangleIcon className="h-4 w-4" />
            <AlertTitle>{t("#.PubLinkDialog.emptyPermissions")}</AlertTitle>
            <AlertDescription>{t("#.PubLinkDialog.noAccessUsers")}</AlertDescription>
          </Alert>
        )}

        <div>
          <Tooltip delayDuration={50}>
            <TooltipTrigger
              className={buttonVariants({ variant: "outline", size: "icon" })}
              onClick={onCopyInviteUrl}
            >
              <LinkIcon className="pointer-events-none" />
            </TooltipTrigger>
            <TooltipContent className="w-full max-w-sm">
              <p>{t("#.PubLinkDialog.inviteUrlTooltip")}</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
