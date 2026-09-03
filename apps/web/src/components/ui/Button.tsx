import type { ButtonHTMLAttributes } from 'react';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary';
};

export function Button({ variant = 'primary', style, ...rest }: ButtonProps) {
  const base = {
    padding: '0.5rem 1rem',
    borderRadius: 'var(--radius)',
    fontSize: '0.9rem',
    fontWeight: 500,
    cursor: rest.disabled ? 'default' : 'pointer',
    opacity: rest.disabled ? 0.5 : 1,
    border: '1px solid transparent',
  };

  const variantStyle =
    variant === 'primary'
      ? { background: 'var(--color-primary)', color: '#0a0a0a' }
      : { background: 'transparent', color: 'var(--color-text)', borderColor: 'var(--color-border)' };

  return <button {...rest} style={{ ...base, ...variantStyle, ...style }} />;
}
