import type { ComponentProps } from 'react';

/** White bordered frame; wide tables scroll inside it, not the page. */
export function Table({ className = '', ...props }: ComponentProps<'table'>) {
  return (
    <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white shadow-sm">
      <table className={`w-full border-collapse text-sm ${className}`} {...props} />
    </div>
  );
}

export function THead({ className = '', ...props }: ComponentProps<'thead'>) {
  return <thead className={`border-b border-stone-200 bg-stone-50 ${className}`} {...props} />;
}

export function TBody({ className = '', ...props }: ComponentProps<'tbody'>) {
  return <tbody className={`divide-y divide-stone-100 ${className}`} {...props} />;
}

export function TR({ className = '', ...props }: ComponentProps<'tr'>) {
  return <tr className={`hover:bg-stone-50/70 ${className}`} {...props} />;
}

export function TH({ className = '', ...props }: ComponentProps<'th'>) {
  return (
    <th
      className={`whitespace-nowrap px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-stone-500 ${className}`}
      {...props}
    />
  );
}

export function TD({ className = '', ...props }: ComponentProps<'td'>) {
  return <td className={`px-3 py-2.5 align-top ${className}`} {...props} />;
}
