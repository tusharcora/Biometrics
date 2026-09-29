import React from 'react';
import { type TextProps } from 'react-native';
import { cn } from '../../lib/utils';
import { Text } from './text';

// The small uppercase label that heads a group ("YOUR METRICS"). Screens use
// this instead of a bold title per card, so hierarchy comes from the numbers.
export function SectionLabel({ className, children, ...props }: TextProps & { className?: string }) {
  return (
    <Text className={cn('text-eyebrow font-semibold uppercase text-muted-foreground', className)} {...props}>
      {children}
    </Text>
  );
}
