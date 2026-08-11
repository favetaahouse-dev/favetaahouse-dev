"use client";

import { type ReactNode } from "react";
import {
  useForm, FormProvider, useFormContext, useController,
  type DefaultValues, type SubmitHandler, type FieldValues, type Path, type UseFormReturn,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { ZodType } from "zod";
import { X } from "lucide-react";
import { Button, Spinner } from "./primitives";
import { cn } from "@/lib/utils";

const inputCls =
  "w-full border border-edge bg-canvas px-3 py-2 text-[13px] text-foreground outline-none placeholder:text-faint focus:border-accent/60";

/**
 * useForm preconfigured with a zod resolver. The return type is pinned because
 * `useForm<T>()` leaves RHF 7.80's third TTransformedValues generic unresolved, which
 * otherwise leaks into every caller and won't match <Form>'s prop.
 */
export function useZodForm<T extends FieldValues>(
  schema: ZodType<T>,
  defaultValues: DefaultValues<T>,
): UseFormReturn<T, unknown, T> {
  return useForm<T>({
    // @ts-expect-error resolver generic variance across zod/RHF versions
    resolver: zodResolver(schema),
    defaultValues,
    mode: "onBlur",
  }) as unknown as UseFormReturn<T, unknown, T>;
}

export function Form<T extends FieldValues>({
  form, onSubmit, children, className,
}: {
  // RHF 7.80 carries a third TTransformedValues generic that `useForm<T>()` leaves
  // unresolved, so pinning this to ReturnType<typeof useForm<T>> rejects the very
  // object useZodForm hands back. Only TFieldValues matters here.
  form: UseFormReturn<T, unknown, T>;
  onSubmit: SubmitHandler<T>;
  children: ReactNode;
  className?: string;
}) {
  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className={className} noValidate>
        {children}
      </form>
    </FormProvider>
  );
}

function FieldShell({
  label, error, hint, children,
}: {
  label?: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      {label && <span className="mb-1 block text-[11px] uppercase tracking-[0.12em] text-faint">{label}</span>}
      {children}
      {hint && !error && <span className="mt-1 block text-[11px] text-faint">{hint}</span>}
      {error && <span className="mt-1 block text-[11px] text-danger">{error}</span>}
    </label>
  );
}

function useField<T extends FieldValues>(name: Path<T>) {
  const { formState } = useFormContext<T>();
  const err = formState.errors[name] as { message?: string } | undefined;
  return err?.message;
}

export function TextField<T extends FieldValues>({
  name, label, placeholder, hint, type = "text",
}: {
  name: Path<T>;
  label?: string;
  placeholder?: string;
  hint?: string;
  type?: string;
}) {
  const { register } = useFormContext<T>();
  return (
    <FieldShell label={label} hint={hint} error={useField<T>(name)}>
      <input {...register(name)} type={type} placeholder={placeholder} className={inputCls} />
    </FieldShell>
  );
}

export function TextareaField<T extends FieldValues>({
  name, label, placeholder, rows = 4, hint,
}: {
  name: Path<T>;
  label?: string;
  placeholder?: string;
  rows?: number;
  hint?: string;
}) {
  const { register } = useFormContext<T>();
  return (
    <FieldShell label={label} hint={hint} error={useField<T>(name)}>
      <textarea {...register(name)} rows={rows} placeholder={placeholder} className={cn(inputCls, "resize-y")} />
    </FieldShell>
  );
}

export function NumberField<T extends FieldValues>({
  name, label, placeholder, hint, step, min,
}: {
  name: Path<T>;
  label?: string;
  placeholder?: string;
  hint?: string;
  step?: number;
  min?: number;
}) {
  const { register } = useFormContext<T>();
  return (
    <FieldShell label={label} hint={hint} error={useField<T>(name)}>
      <input
        {...register(name, { valueAsNumber: true })}
        type="number"
        step={step}
        min={min}
        placeholder={placeholder}
        className={inputCls}
      />
    </FieldShell>
  );
}

export function SelectField<T extends FieldValues>({
  name, label, options, hint,
}: {
  name: Path<T>;
  label?: string;
  options: { value: string; label: string }[];
  hint?: string;
}) {
  const { register } = useFormContext<T>();
  return (
    <FieldShell label={label} hint={hint} error={useField<T>(name)}>
      <select {...register(name)} className={inputCls}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </FieldShell>
  );
}

export function ToggleField<T extends FieldValues>({
  name, label,
}: {
  name: Path<T>;
  label: string;
}) {
  const { control } = useFormContext<T>();
  const { field } = useController({ name, control });
  const on = !!field.value;
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-[13px] text-foreground">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={() => field.onChange(!on)}
        className={cn("relative h-5 w-9 rounded-full transition-colors", on ? "bg-accent" : "bg-elevated")}
      >
        <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all", on ? "start-[18px]" : "start-0.5")} />
      </button>
    </div>
  );
}

/** English input beside an RTL Arabic input for `${name}` / `${name}_ar` pairs. */
export function BilingualField<T extends FieldValues>({
  name, label, textarea,
}: {
  name: Path<T>;
  label?: string;
  textarea?: boolean;
}) {
  const { register } = useFormContext<T>();
  const arName = `${name}_ar` as Path<T>;
  const Comp = textarea ? "textarea" : "input";
  return (
    <FieldShell label={label} error={useField<T>(name)}>
      <div className="grid gap-2 sm:grid-cols-2">
        <Comp {...register(name)} placeholder="English" className={cn(inputCls, textarea && "resize-y")} rows={textarea ? 3 : undefined} />
        <Comp {...register(arName)} dir="rtl" placeholder="العربية" className={cn(inputCls, "text-right", textarea && "resize-y")} rows={textarea ? 3 : undefined} />
      </div>
    </FieldShell>
  );
}

export function TagField<T extends FieldValues>({
  name, label, placeholder = "Add a tag and press Enter",
}: {
  name: Path<T>;
  label?: string;
  placeholder?: string;
}) {
  const { control } = useFormContext<T>();
  const { field } = useController({ name, control });
  const tags: string[] = Array.isArray(field.value) ? field.value : [];
  const add = (raw: string) => {
    const v = raw.trim();
    if (v && !tags.includes(v)) field.onChange([...tags, v]);
  };
  const remove = (t: string) => field.onChange(tags.filter((x) => x !== t));
  return (
    <FieldShell label={label} error={useField<T>(name)}>
      <div className="flex flex-wrap items-center gap-1.5 border border-edge bg-canvas p-2">
        {tags.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 bg-elevated px-2 py-0.5 text-xs text-foreground">
            {t}
            <button type="button" onClick={() => remove(t)} className="text-faint hover:text-danger"><X size={11} /></button>
          </span>
        ))}
        <input
          placeholder={placeholder}
          className="flex-1 bg-transparent px-1 py-0.5 text-[13px] text-foreground outline-none placeholder:text-faint"
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add((e.target as HTMLInputElement).value);
              (e.target as HTMLInputElement).value = "";
            }
          }}
        />
      </div>
    </FieldShell>
  );
}

export function SubmitButton({ children = "Save", className }: { children?: ReactNode; className?: string }) {
  const { formState } = useFormContext();
  return (
    <Button type="submit" variant="primary" disabled={formState.isSubmitting} className={className}>
      {formState.isSubmitting && <Spinner />} {children}
    </Button>
  );
}
