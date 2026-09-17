import React from 'react';
import { Pressable, type PressableProps, type GestureResponderEvent } from 'react-native';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';
import { Text } from './text';

const buttonVariants = cva('items-center justify-center rounded-xl active:opacity-70', {
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

interface ButtonProps extends PressableProps, VariantProps<typeof buttonVariants> {
  className?: string;
  children: React.ReactNode;
  onPress?: (e: GestureResponderEvent) => void;
}

export function Button({ className, variant, size, children, ...props }: ButtonProps) {
  return (
    <Pressable className={cn(buttonVariants({ variant, size }), className)} {...props}>
      {typeof children === 'string' ? (
        <Text className={textVariants({ variant })}>{children}</Text>
      ) : (
        children
      )}
    </Pressable>
  );
}
