import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';
import { Text } from './text';
import { PressableScale, type PressableScaleProps } from './pressable-scale';

const buttonVariants = cva('items-center justify-center rounded-xl active:opacity-80', {
  variants: {
    variant: {
      primary: 'bg-accent px-6 py-3.5',
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
  return (
    <PressableScale className={cn(buttonVariants({ variant, size }), className)} {...props}>
      {typeof children === 'string' ? <Text className={textVariants({ variant })}>{children}</Text> : children}
    </PressableScale>
  );
}
