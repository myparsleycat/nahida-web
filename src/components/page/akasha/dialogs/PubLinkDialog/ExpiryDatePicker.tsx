import { Save as SaveIcon } from "pixelarticons/react";
import { useTranslation } from "react-i18next";

import { DatePicker } from "@/components/DatePicker";
import { Label } from "@/components/ui/label";

interface ExpiryDatePickerProps {
  selectedDate: Date | undefined;
  onDateChange: (date: Date | undefined) => void;
  onSave: () => void;
}

export function ExpiryDatePicker({ selectedDate, onDateChange, onSave }: ExpiryDatePickerProps) {
  const { t } = useTranslation();

  return (
    <div className="flex w-full min-w-0 flex-col gap-1.5">
      <Label>{t("#.PubLinkDialog.shareExpiry")}</Label>
      <div className="relative w-full">
        <DatePicker
          className="w-full"
          value={selectedDate}
          onChange={onDateChange}
          disabled={(date) => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            return date <= today;
          }}
        />
        <div className="absolute inset-y-0 right-2 flex items-center">
          <button className="pointer-events-auto z-50" onClick={onSave}>
            <SaveIcon className="size-5.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
