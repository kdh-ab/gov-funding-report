import {
  Children,
  cloneElement,
  isValidElement,
  useId,
  type ReactNode,
} from "react";

export function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  const fieldId = useId();
  const child = Children.count(children) === 1 && isValidElement(children)
    ? cloneElement(children, {
        id: fieldId,
        "aria-required": required || undefined,
      })
    : children;

  return (
    <div>
      <label htmlFor={fieldId} className="block text-sm font-medium text-[#676C73] mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {child}
    </div>
  );
}
