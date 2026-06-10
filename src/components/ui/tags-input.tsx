import { X } from "lucide-react";
import React, { useState, useEffect, useRef } from "react";

// Types
interface TagsInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value"> {
  value?: string[];
  onValueChange?: (value: string[]) => void;
  validate?: (val: string, tags: string[]) => string | undefined;
}

interface TagProps {
  value: string;
  disabled?: boolean;
  active: boolean;
  onDelete: (value: string) => void;
}

// Tag component
const TagsInputTag = ({ value, disabled, onDelete, active }: TagProps) => {
  return (
    <div
      className={`flex place-items-center gap-2 rounded-md bg-secondary px-2 py-0.5 ring-offset-background transition-all hover:cursor-default hover:bg-secondary/90 aria-selected:bg-secondary/90 aria-selected:ring-2 aria-selected:ring-ring aria-selected:ring-offset-2 ${
        active ? "ring-2 ring-ring ring-offset-2" : ""
      }`}
      aria-selected={active}
    >
      <span>{value}</span>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onDelete(value)}
        className="border-none bg-transparent p-0"
      >
        <X className="size-4" />
      </button>
    </div>
  );
};

// Default validation function
const defaultValidate = (val: string, tags: string[]): string | undefined => {
  const transformed = val.trim();

  if (transformed.length === 0) return undefined;
  if (tags.find((t) => transformed === t)) return undefined;

  return transformed;
};

// Main TagsInput component
const TagsInput = ({
  value = [],
  onValueChange,
  placeholder,
  className,
  disabled = false,
  validate = defaultValidate,
  ...rest
}: TagsInputProps) => {
  const [inputValue, setInputValue] = useState("");
  const [tagIndex, setTagIndex] = useState<number | undefined>();
  const [invalid, setInvalid] = useState(false);
  const [isComposing, setIsComposing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset invalid when input value changes
  useEffect(() => {
    setInvalid(false);
  }, [inputValue]);

  // Auto-add tags when comma or space is detected
  useEffect(() => {
    if (inputValue.includes(",") || inputValue.includes(" ")) {
      const newTags = inputValue
        .replace(/[,\s]+$/, "")
        .split(/[,\s]+/)
        .map((chunk) => chunk.trim())
        .filter((chunk) => chunk.length > 0);

      let newValue = [...value];
      for (const tag of newTags) {
        const validated = validate(tag, newValue);
        if (validated) {
          newValue = [...newValue, validated];
        }
      }

      if (newValue.length !== value.length) {
        onValueChange?.(newValue);
      }
      setInputValue("");
    }
  }, [inputValue, value, validate, onValueChange]);

  const enter = () => {
    if (isComposing) return;

    const validated = validate(inputValue, value);

    if (!validated) {
      setInvalid(true);
      return;
    }

    onValueChange?.([...value, validated]);
    setInputValue("");
  };

  const handleCompositionStart = () => {
    setIsComposing(true);
  };

  const handleCompositionEnd = () => {
    setIsComposing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const target = e.target as HTMLInputElement;

    if (e.key === "Enter") {
      e.preventDefault();
      if (isComposing) return;
      enter();
      return;
    } else if (e.key === ",") {
      e.preventDefault();
      if (isComposing) return;
      enter();
      return;
    }

    const isAtBeginning = target.selectionStart === 0 && target.selectionEnd === 0;
    let shouldResetIndex = true;

    if (e.key === "Backspace") {
      if (isAtBeginning) {
        e.preventDefault();

        if (tagIndex !== undefined) {
          deleteIndex(tagIndex);

          const prev = tagIndex - 1;
          if (prev < 0) {
            setTagIndex(undefined);
          } else {
            setTagIndex(prev);
          }
        } else {
          setTagIndex(value.length - 1);
        }

        shouldResetIndex = false;
      }
    }

    if (e.key === "Delete") {
      if (isAtBeginning) {
        if (inputValue.length === 0) {
          if (tagIndex !== undefined) {
            e.preventDefault();

            deleteIndex(tagIndex);

            if (value.length === 1) setTagIndex(undefined);

            shouldResetIndex = false;
          }
        }
      }
    }

    if (isAtBeginning) {
      if (e.key === "ArrowLeft") {
        if (tagIndex !== undefined) {
          const prev = tagIndex - 1;
          if (prev < 0) {
            setTagIndex(0);
          } else {
            setTagIndex(prev);
          }
        } else {
          setTagIndex(value.length - 1);
        }

        shouldResetIndex = false;
      }

      if (inputValue.length === 0) {
        if (e.key === "ArrowRight") {
          if (tagIndex !== undefined) {
            const next = tagIndex + 1;

            if (next > value.length - 1) {
              setTagIndex(undefined);
            } else {
              setTagIndex(next);
            }

            shouldResetIndex = false;
          }
        }
      }
    }

    if (shouldResetIndex) {
      setTagIndex(undefined);
    }
  };

  const deleteValue = (val: string) => {
    const index = value.findIndex((v) => val === v);
    if (index === -1) return;
    deleteIndex(index);
  };

  const deleteIndex = (index: number) => {
    const newValue = [...value.slice(0, index), ...value.slice(index + 1)];
    onValueChange?.(newValue);
  };

  const handleBlur = () => {
    setTagIndex(undefined);
  };

  return (
    <div
      className={`flex min-h-9 w-full flex-wrap place-items-center gap-1 rounded-md border border-input bg-background py-0.5 pr-1 pl-1 selection:bg-primary disabled:opacity-50 aria-disabled:cursor-not-allowed dark:bg-input/30 ${className || ""}`}
      aria-disabled={disabled}
    >
      {value.map((tag, i) => (
        <TagsInputTag
          key={tag}
          value={tag}
          disabled={disabled}
          onDelete={deleteValue}
          active={i === tagIndex}
        />
      ))}
      <input
        {...rest}
        ref={inputRef}
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onBlur={handleBlur}
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
        disabled={disabled}
        placeholder={placeholder}
        data-invalid={invalid}
        onKeyDown={handleKeyDown}
        className="min-w-16 shrink grow basis-0 border-none bg-transparent px-2 outline-hidden placeholder:text-muted-foreground focus:outline-hidden disabled:cursor-not-allowed data-[invalid=true]:text-red-500 md:text-sm"
      />
    </div>
  );
};

export default TagsInput;
