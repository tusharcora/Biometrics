import React, { createContext, useContext, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  View,
  type GestureResponderEvent,
  type Insets,
  type LayoutChangeEvent,
  type PressableProps,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { cva } from 'class-variance-authority';
import { cn } from '../../lib/utils';
import { MOTION } from '../../theme';
import { Text } from './text';

// The app's standard button: shadcn/ui's Base Button (base-vega) ported to
// React Native + NativeWind. Same variants, sizes and classes as far as RN
// allows; the web-only parts (focus rings, svg sizing, hover) are dropped, and
// hover becomes the pressed (`active:`) state.

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type ButtonVariant = 'default' | 'outline' | 'secondary' | 'ghost' | 'destructive' | 'link';
export type ButtonTextSize = 'default' | 'xs' | 'sm' | 'lg';
export type ButtonIconSize = 'icon' | 'icon-xs' | 'icon-sm' | 'icon-lg';
export type ButtonSize = ButtonTextSize | ButtonIconSize;

/**
 * TEMPORARY: the pre-shadcn variant names, still used by screens that later
 * migration tasks move over. Each resolves to its shadcn equivalent.
 * Task 6 of the shadcn button migration removes these aliases.
 */
const LEGACY_VARIANTS = {
  /** @deprecated Use `variant="default"` (or omit it). Removed in Task 6 of the shadcn button migration. */
  primary: 'default',
  /**
   * @deprecated The old bordered `secondary` is now `outline`; until Task 6 of the shadcn button migration,
   * `variant="secondary"` still means `outline`. After Task 6 it is the shadcn `secondary` fill.
   */
  secondary: 'outline',
  /** @deprecated Kept for the migration: maps to the shadcn `ghost`. Removed as an alias in Task 6. */
  ghost: 'ghost',
  /** @deprecated Kept for the migration: maps to the shadcn `destructive`. Removed as an alias in Task 6. */
  destructive: 'destructive',
} as const satisfies Record<string, ButtonVariant>;

/** @deprecated Old variant names; see LEGACY_VARIANTS. Task 6 of the shadcn button migration removes them. */
export type LegacyButtonVariant = keyof typeof LEGACY_VARIANTS;

// Task 6: drop the LEGACY_VARIANTS lookup and pass `variant` straight through.
export function resolveVariant(variant: ButtonVariant | LegacyButtonVariant | null | undefined): ButtonVariant {
  if (!variant) return 'default';
  if (variant in LEGACY_VARIANTS) return LEGACY_VARIANTS[variant as LegacyButtonVariant];
  return variant as ButtonVariant;
}

export const buttonVariants = cva(
  'shrink-0 flex-row items-center justify-center gap-1.5 rounded-lg border border-transparent active:opacity-90',
  {
    variants: {
      variant: {
        default: 'bg-foreground',
        outline: 'border-border bg-background shadow-sm active:bg-muted dark:border-hairline dark:bg-hairline/30 dark:shadow-none dark:active:bg-hairline/50',
        secondary: 'bg-secondary',
        ghost: 'active:bg-muted dark:active:bg-muted/50',
        destructive: 'bg-destructive/10 active:bg-destructive/20 dark:bg-destructive/20 dark:active:bg-destructive/30',
        link: '',
      },
      size: {
        default: 'h-9 px-2.5',
        xs: 'h-6 gap-1 px-2',
        sm: 'h-8 gap-1 px-2.5',
        lg: 'h-10 px-3',
        icon: 'size-9',
        'icon-xs': 'size-6',
        'icon-sm': 'size-8',
        'icon-lg': 'size-10',
      },
    },
    // A link is just underlined text: no fixed height or side padding.
    compoundVariants: [{ variant: 'link', className: 'h-auto px-0' }],
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

// shadcn's has-data-[icon=inline-start|end] padding: the icon side sits a
// little tighter than the text side.
const ICON_START_PADDING: Record<ButtonTextSize, string> = { default: 'pl-2', xs: 'pl-1.5', sm: 'pl-1.5', lg: 'pl-2.5' };
const ICON_END_PADDING: Record<ButtonTextSize, string> = { default: 'pr-2', xs: 'pr-1.5', sm: 'pr-1.5', lg: 'pr-2.5' };

// Kept separate from buttonTextVariants so the loading spinner can take the
// label colour (NativeWind maps `text-*` onto ActivityIndicator's `color`).
const TEXT_COLOR: Record<ButtonVariant, string> = {
  default: 'text-background',
  outline: 'text-foreground',
  secondary: 'text-secondary-foreground',
  ghost: 'text-foreground',
  destructive: 'text-destructive',
  link: 'text-foreground underline',
};

export const buttonTextVariants = cva('text-sm font-medium', {
  variants: {
    variant: TEXT_COLOR,
    size: {
      default: 'text-sm',
      xs: 'text-xs',
      sm: 'text-[13px]',
      lg: 'text-sm',
      icon: 'text-sm',
      'icon-xs': 'text-xs',
      'icon-sm': 'text-sm',
      'icon-lg': 'text-sm',
    },
  },
  defaultVariants: { variant: 'default', size: 'default' },
});

/** shadcn's default svg size per button size (size-3 on the xs sizes, size-4 elsewhere), for icon children. */
export function buttonIconSize(size: ButtonSize = 'default'): number {
  return size === 'xs' || size === 'icon-xs' ? 12 : 16;
}

// The drawn height of each size (and width, for the square icon sizes). A link
// has no fixed height; its line of text-sm is 20 tall.
const SIZE_PX: Record<ButtonSize, { height: number; width?: number }> = {
  xs: { height: 24 },
  sm: { height: 32 },
  default: { height: 36 },
  lg: { height: 40 },
  'icon-xs': { height: 24, width: 24 },
  'icon-sm': { height: 32, width: 32 },
  icon: { height: 36, width: 36 },
  'icon-lg': { height: 40, width: 40 },
};
const LINK_HEIGHT = 20;

export const MIN_TOUCH_TARGET = 44;

/**
 * Invisible hitSlop that grows the tappable area to at least 44x44 while the
 * button keeps its exact shadcn size. Each side gets half the shortfall. A
 * measured layout (from onLayout) wins over the nominal size; text sizes have
 * no nominal width, so they get side slop only once measured.
 */
export function hitSlopFor(
  size: ButtonSize = 'default',
  variant: ButtonVariant = 'default',
  layout?: { width: number; height: number },
): Insets {
  const nominal = SIZE_PX[size];
  const height = layout?.height ?? (variant === 'link' ? LINK_HEIGHT : nominal.height);
  const width = layout?.width ?? nominal.width ?? MIN_TOUCH_TARGET;
  const vertical = Math.max(0, (MIN_TOUCH_TARGET - height) / 2);
  const horizontal = Math.max(0, (MIN_TOUCH_TARGET - width) / 2);
  return { top: vertical, bottom: vertical, left: horizontal, right: horizontal };
}

/** How far down a pressed button sits: shadcn's 1-px nudge, none with reduced motion (it only dims). */
export function pressNudge(reduced: boolean, pressed: boolean): number {
  return pressed && !reduced ? MOTION.buttonPress.translateY : 0;
}

type GroupPosition = 'first' | 'middle' | 'last';
const ButtonGroupContext = createContext<GroupPosition | null>(null);

// Inside a ButtonGroup, inner corners go square and each button after the
// first overlaps its neighbour's border by 1 px.
const GROUP_CLASSES: Record<GroupPosition, string> = {
  first: 'rounded-r-none',
  middle: '-ml-px rounded-none',
  last: '-ml-px rounded-l-none',
};

type ButtonBaseProps = Omit<PressableProps, 'style' | 'children'> & {
  /** @deprecated names (primary, the old secondary) still resolve until Task 6; see LEGACY_VARIANTS. */
  variant?: ButtonVariant | LegacyButtonVariant | null;
  className?: string;
  style?: StyleProp<ViewStyle>;
  /** A string is wrapped in a Text with the variant's label classes; anything else renders as-is. */
  children?: React.ReactNode;
  /** Shown before the label (shadcn's data-icon="inline-start"). Replaced by the spinner while loading. */
  iconStart?: React.ReactNode;
  /** Shown after the label (shadcn's data-icon="inline-end"). */
  iconEnd?: React.ReactNode;
  /** Shows a spinner in the icon-start slot, disables the button and marks it busy. */
  loading?: boolean;
  /** Merged onto the label Text when children is a string. */
  textClassName?: string;
  /** testID for the label Text when children is a string. */
  labelTestID?: string;
};

// An icon-only button has no text for a screen reader, so it must be labelled.
export type ButtonProps = ButtonBaseProps &
  ({ size: ButtonIconSize; accessibilityLabel: string } | { size?: ButtonTextSize | null; accessibilityLabel?: string });

export function Button({
  variant: variantProp,
  size: sizeProp,
  className,
  style,
  children,
  iconStart,
  iconEnd,
  loading = false,
  textClassName,
  labelTestID,
  disabled,
  accessibilityRole = 'button',
  accessibilityState,
  hitSlop,
  testID,
  onPressIn,
  onPressOut,
  onLayout,
  ...props
}: ButtonProps) {
  const variant = resolveVariant(variantProp);
  const size: ButtonSize = sizeProp ?? 'default';
  const isIconSize = size.startsWith('icon');
  const isDisabled = !!disabled || loading;
  const groupPosition = useContext(ButtonGroupContext);

  const reduced = useReducedMotion();
  const nudge = useSharedValue(0);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ translateY: nudge.value }] }));
  function animateTo(pressed: boolean) {
    nudge.value = withTiming(pressNudge(reduced, pressed), { duration: MOTION.buttonPress.duration });
  }

  const [layout, setLayout] = useState<{ width: number; height: number }>();

  const startSlot = loading ? (
    <ActivityIndicator testID={`${testID ?? 'button'}-spinner`} size="small" className={TEXT_COLOR[variant]} />
  ) : (
    iconStart
  );
  const hasStart = startSlot != null && startSlot !== false;
  const hasEnd = iconEnd != null && iconEnd !== false;

  return (
    <AnimatedPressable
      testID={testID}
      disabled={isDisabled}
      accessibilityRole={accessibilityRole}
      accessibilityState={{ ...accessibilityState, disabled: isDisabled, ...(loading ? { busy: true } : null) }}
      hitSlop={hitSlop ?? hitSlopFor(size, variant, layout)}
      className={cn(
        buttonVariants({ variant, size }),
        !isIconSize && hasStart && variant !== 'link' && ICON_START_PADDING[size as ButtonTextSize],
        !isIconSize && hasEnd && variant !== 'link' && ICON_END_PADDING[size as ButtonTextSize],
        groupPosition && GROUP_CLASSES[groupPosition],
        isDisabled && 'opacity-50',
        className,
      )}
      style={[style, animatedStyle]}
      onPressIn={(e: GestureResponderEvent) => {
        animateTo(true);
        onPressIn?.(e);
      }}
      onPressOut={(e: GestureResponderEvent) => {
        animateTo(false);
        onPressOut?.(e);
      }}
      onLayout={(e: LayoutChangeEvent) => {
        const { width, height } = e.nativeEvent.layout;
        setLayout((prev) => (prev && prev.width === width && prev.height === height ? prev : { width, height }));
        onLayout?.(e);
      }}
      {...props}
    >
      {startSlot}
      {typeof children === 'string' || typeof children === 'number' ? (
        <Text testID={labelTestID} className={cn(buttonTextVariants({ variant, size }), textClassName)}>
          {children}
        </Text>
      ) : (
        children
      )}
      {iconEnd}
    </AnimatedPressable>
  );
}

type ButtonGroupProps = ViewProps & { className?: string };

/**
 * A row of joined Buttons (shadcn's ButtonGroup): inner corners squared and
 * borders overlapped, so outline buttons share one hairline between them.
 * Children that are not elements (null, false) are skipped.
 */
export function ButtonGroup({ className, children, ...props }: ButtonGroupProps) {
  const items = React.Children.toArray(children).filter(React.isValidElement);
  return (
    <View role="group" className={cn('flex-row items-stretch', className)} {...props}>
      {items.map((child, i) => {
        const position: GroupPosition | null =
          items.length < 2 ? null : i === 0 ? 'first' : i === items.length - 1 ? 'last' : 'middle';
        return (
          <ButtonGroupContext.Provider key={child.key ?? i} value={position}>
            {child}
          </ButtonGroupContext.Provider>
        );
      })}
    </View>
  );
}
