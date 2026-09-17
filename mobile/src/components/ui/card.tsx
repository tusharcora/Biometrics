import React from 'react';
import { View, type ViewProps } from 'react-native';
import { cn } from '../../lib/utils';

export function Card({ className, ...props }: ViewProps & { className?: string }) {
  return (
    <View
      className={cn('rounded-2xl border border-border bg-card p-4 shadow-sm shadow-black/5', className)}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: ViewProps & { className?: string }) {
  return <View className={cn('mb-2', className)} {...props} />;
}

export function CardContent({ className, ...props }: ViewProps & { className?: string }) {
  return <View className={cn('', className)} {...props} />;
}
