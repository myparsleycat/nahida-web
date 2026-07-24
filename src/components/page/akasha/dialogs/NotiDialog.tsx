import Validator from "@backend/lib/utils/Validator";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { useForm, type AnyFieldApi } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import { Loader as Loader2Icon } from "pixelarticons/react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Center, Random1619 } from "@/components/common";
import { DiscordIcon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDialogStore } from "@/lib/akasha";
import { eden } from "@/lib/eden";

function FieldInfo({ field }: { field: AnyFieldApi }) {
  return (
    <>
      {field.state.meta.isTouched && !field.state.meta.isValid ? (
        <em className="text-destructive">{field.state.meta.errors.join(", ")}</em>
      ) : null}
      {field.state.meta.isValidating ? "Validating..." : null}
    </>
  );
}

export function NotiDialog() {
  const { t } = useTranslation();
  const { notiDialog, setOpen } = useDialogStore();

  const query = useQuery({
    queryKey: ["akasha", "notiDialog", notiDialog.data?.id],
    queryFn: async () => {
      const { data, error } = await eden.akasha.webhook
        .item({ itemId: notiDialog.data.id as string })
        .get();

      if (error) {
        if (error.status === 404) {
          return null;
        }

        throw new Error(error.value.toString());
      }

      return data;
    },
    enabled: !!notiDialog.data?.id,
  });

  const form = useForm({
    defaultValues: {
      name: "",
      provider: "discord",
      url: "",
    },
    onSubmit: async ({ value }) => {
      const { name, provider, url } = value;

      const link = notiDialog.data?.link;
      const srcId = notiDialog.data?.id;
      if (!srcId) {
        throw new Error("selection item is empty");
      }

      const { data, error } = await eden.akasha.webhook.post({
        name,
        srcId,
        // @ts-ignore
        provider,
        webhookUrl: url,
        ...(link && { link }),
      });

      if (error) {
        throw new Error(error.value.toString());
      }

      await query.refetch();

      return data;
    },
  });

  useEffect(() => {
    if (notiDialog.open) {
      form.reset();
    }
  }, [notiDialog.open, form]);

  return (
    <Dialog open={notiDialog.open} onOpenChange={(v) => setOpen("notiDialog", v)}>
      <DialogContent aria-describedby={undefined} showCloseButton={false}>
        <VisuallyHidden>
          <DialogTitle></DialogTitle>
        </VisuallyHidden>

        {query.isLoading ? (
          <Center>
            <Random1619 />
          </Center>
        ) : query.data ? (
          <>
            <div className="flex space-x-2">
              <Input value={query.data.name} disabled />
              <Button
                onClick={() => {
                  if (!query.data?.id) return;

                  void eden.akasha
                    .webhook({ webhookId: query.data.id })
                    .delete()
                    .then(({ error }) => {
                      if (!error) {
                        void query.refetch();
                      } else {
                        toast.warning(t("#.NotiDialog.deleteError"));
                      }
                    });
                }}
              >
                {t("#.NotiDialog.deleteWebhook")}
              </Button>
            </div>
          </>
        ) : (
          <>
            <form
              className="flex flex-col space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                e.stopPropagation();
                form.handleSubmit().catch((err) => {
                  toast.warning(err.message);
                });
              }}
            >
              <div className="flex flex-col space-y-5">
                <form.Field
                  name="name"
                  validators={{
                    onChange: ({ value }) =>
                      !value
                        ? t("#.NotiDialog.validation.nameRequired")
                        : value.length < 1 || value.length > 255
                          ? t("#.NotiDialog.validation.nameLength")
                          : undefined,
                    onChangeAsyncDebounceMs: 500,
                  }}
                  children={(field) => {
                    return (
                      <div className="grid w-full items-center gap-1">
                        <Label htmlFor={field.name}>{t("#.NotiDialog.name")}</Label>
                        <Input
                          id={field.name}
                          name={field.name}
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
                        />
                        <FieldInfo field={field} />
                      </div>
                    );
                  }}
                />

                <form.Field
                  name="provider"
                  validators={{
                    onChange: ({ value }) =>
                      !value ? t("#.NotiDialog.validation.providerRequired") : undefined,
                    onChangeAsyncDebounceMs: 500,
                  }}
                  children={(f) => {
                    return (
                      <div className="grid w-full items-center gap-1">
                        <Label htmlFor={f.name}>{t("#.NotiDialog.provider")}</Label>
                        <Select value={f.state.value} onValueChange={(v) => f.handleChange(v)}>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              <SelectLabel>{t("#.NotiDialog.provider")}</SelectLabel>
                              <SelectItem value="discord">
                                <DiscordIcon />
                                Discord
                              </SelectItem>
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </div>
                    );
                  }}
                />

                <form.Field
                  name="url"
                  validators={{
                    onChange: ({ value }) =>
                      !Validator.url(value) ? t("#.NotiDialog.validation.urlInvalid") : undefined,
                    onChangeAsyncDebounceMs: 500,
                  }}
                  children={(f) => {
                    return (
                      <div className="grid w-full items-center gap-1">
                        <Label htmlFor={f.name}>{t("#.NotiDialog.webhookUrl")}</Label>
                        <Input
                          id={f.name}
                          name={f.name}
                          value={f.state.value}
                          onBlur={f.handleBlur}
                          onChange={(e) => f.handleChange(e.target.value)}
                        />
                        <FieldInfo field={f} />
                      </div>
                    );
                  }}
                />
              </div>

              <div className="flex justify-end">
                <form.Subscribe
                  selector={(state) => [state.canSubmit, state.isSubmitting]}
                  children={([canSubmit, isSubmitting]) => (
                    <Button className="w-16" type="submit" disabled={!canSubmit}>
                      {isSubmitting ? <Loader2Icon className="animate-spin" /> : t("g.continue")}
                    </Button>
                  )}
                />
              </div>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
