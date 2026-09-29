import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';
import { Text } from './text';
import { PressableScale, type PressableScaleProps } from './pressable-scale';

const buttonVariants = cva('items-center justify-center rounded-full active:opacity-80', {
  variants: {
    variant: {
      primary: 'bg-accent px-6 py-3.5',
      secondary: 'border border-border bg-muted px-5 py-3',
      ghost: 'px-4 py-2.5',
      destructive: 'px-4 py-2.5',
    },
    size: {
      default: '',
      sm: 'px-4 py-2',
    },
  },
  defaultVariants: { variant: 'primary', size: 'default' },
});

const textVariants = cva('text-base font-semibold', {
  variants: {
    variant: {
      primary: 'text-accent-foreground',
      secondary: 'text-foreground',
      ghost: 'text-muted-foreground',
      destructive: 'text-destructive',
    },
  },
  defaultVariants: { variant: 'primary' },
});

interface ButtonProps extends PressableScaleProps, VariantProps<typeof buttonVariants> {
  children: React.ReactNode;
}

export function Button({ className, variant, size, children, ...props }: ButtonProps) {
  // A disabled button dims, so a form that can't submit yet reads that way.
  return (
    <PressableScale className={cn(buttonVariants({ variant, size }), props.disabled ? 'opacity-50' : '', className)} {...props}>
      {typeof children === 'string' ? <Text className={textVariants({ variant })}>{children}</Text> : children}
    </PressableScale>
  );
}
