import type { ReactNode } from 'react';
import type { Option } from '../core/labels';

interface FieldShellProps {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  full?: boolean;
  children: ReactNode;
}

export function FieldShell({ id, label, required, error, hint, full, children }: FieldShellProps) {
  return (
    <div className={`field${error ? ' field--error' : ''}${full ? ' full' : ''}`}>
      <label htmlFor={id}>
        {label}
        {required && <span className="field__req" aria-hidden="true"> *</span>}
      </label>
      {children}
      {error ? (
        <p className="field__error" id={`${id}-error`}>
          {error}
        </p>
      ) : (
        hint && <p className="field__hint">{hint}</p>
      )}
    </div>
  );
}

interface CommonProps {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  full?: boolean;
  disabled?: boolean;
}

interface TextFieldProps extends CommonProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  mono?: boolean;
  type?: 'text' | 'date' | 'email' | 'tel';
  autoFocus?: boolean;
}

export function TextField({ value, onChange, placeholder, mono, type = 'text', autoFocus, disabled, ...shell }: TextFieldProps) {
  return (
    <FieldShell {...shell}>
      <input
        id={shell.id}
        className={`input${mono ? ' mono' : ''}`}
        type={type}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        autoFocus={autoFocus}
        autoComplete="off"
        aria-invalid={shell.error ? true : undefined}
        aria-describedby={shell.error ? `${shell.id}-error` : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
    </FieldShell>
  );
}

interface NumberFieldProps extends CommonProps {
  value: number | null;
  onChange: (value: number | null) => void;
  unit?: string;
  placeholder?: string;
}

export function NumberField({ value, onChange, unit, placeholder, disabled, ...shell }: NumberFieldProps) {
  return (
    <FieldShell {...shell}>
      <div className="input-group">
        <input
          id={shell.id}
          className="input num"
          type="number"
          inputMode="decimal"
          step="any"
          value={value ?? ''}
          placeholder={placeholder}
          disabled={disabled}
          aria-invalid={shell.error ? true : undefined}
          aria-describedby={shell.error ? `${shell.id}-error` : undefined}
          onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        />
        {unit && <span className="input-group__unit">{unit}</span>}
      </div>
    </FieldShell>
  );
}

interface SelectFieldProps extends CommonProps {
  value: string | null;
  onChange: (value: string | null) => void;
  options: Option[];
  /** 값이 없을 때 보일 문구. 필수 항목이면 선택 안내, 아니면 "선택 안 함" */
  emptyLabel?: string;
}

export function SelectField({ value, onChange, options, emptyLabel, disabled, ...shell }: SelectFieldProps) {
  return (
    <FieldShell {...shell}>
      <select
        id={shell.id}
        className="input select"
        value={value ?? ''}
        disabled={disabled}
        aria-invalid={shell.error ? true : undefined}
        aria-describedby={shell.error ? `${shell.id}-error` : undefined}
        onChange={(e) => onChange(e.target.value === '' ? null : e.target.value)}
      >
        <option value="" disabled={shell.required}>
          {emptyLabel ?? (shell.required ? '선택하세요' : '선택 안 함')}
        </option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

interface SwitchFieldProps {
  id: string;
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  full?: boolean;
}

export function SwitchField({ id, label, hint, checked, onChange, full }: SwitchFieldProps) {
  return (
    <div className={`field field--switch${full ? ' full' : ''}`}>
      <label className="switch" htmlFor={id}>
        <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="switch__track" aria-hidden="true" />
        <span className="switch__label">{label}</span>
      </label>
      {hint && <p className="field__hint">{hint}</p>}
    </div>
  );
}

interface TextAreaFieldProps extends CommonProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  mono?: boolean;
  readOnly?: boolean;
}

export function TextAreaField({ value, onChange, placeholder, rows = 3, mono, readOnly, disabled, ...shell }: TextAreaFieldProps) {
  return (
    <FieldShell {...shell}>
      <textarea
        id={shell.id}
        className={`input textarea${mono ? ' mono' : ''}`}
        rows={rows}
        value={value}
        placeholder={placeholder}
        readOnly={readOnly}
        disabled={disabled}
        aria-invalid={shell.error ? true : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
    </FieldShell>
  );
}
