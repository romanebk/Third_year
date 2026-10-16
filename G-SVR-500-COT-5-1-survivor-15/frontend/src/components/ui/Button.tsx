import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export type ButtonVariant = 'lime' | 'forest' | 'dark' | 'white' | 'outline';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'md' | 'lg';
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'dark', size = 'md', type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'btn',
        variant === 'lime' && 'btn-lime',
        variant === 'forest' && 'btn-forest',
        variant === 'dark' && 'btn-dark',
        variant === 'white' && 'btn-white',
        variant === 'outline' && 'btn-outline',
        size === 'lg' && 'btn-lg',
        className,
      )}
      {...props}
    />
  );
});
