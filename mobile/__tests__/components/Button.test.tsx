import React from 'react';
import { Text, View } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { getAnimatedStyle, useReducedMotion } from 'react-native-reanimated';
import {
  Button,
  ButtonGroup,
  buttonIconSize,
  buttonTextVariants,
  buttonVariants,
  hitSlopFor,
  pressNudge,
  resolveVariant,
  type ButtonSize,
  type ButtonVariant,
} from '../../src/components/ui/button';
import { cn } from '../../src/lib/utils';
import { MOTION } from '../../src/theme';

jest.mock('react-native-reanimated', () => {
  const actual = jest.requireActual('react-native-reanimated');
  return { __esModule: true, ...actual, default: actual.default, useReducedMotion: jest.fn(() => false) };
});

const classesOf = (el: { props: { className?: string } }) => String(el.props.className ?? '').split(/\s+/);

describe('buttonVariants', () => {
  const BASE = ['flex-row', 'items-center', 'justify-center', 'gap-1.5', 'rounded-lg', 'border', 'border-transparent', 'active:opacity-90'];

  it('carries the shadcn base classes', () => {
    const classes = buttonVariants().split(' ');
    for (const c of BASE) expect(classes).toContain(c);
  });

  it.each<[ButtonVariant, string[]]>([
    ['default', ['bg-foreground']],
    ['outline', ['border-border', 'bg-background', 'shadow-sm', 'active:bg-muted', 'dark:border-hairline', 'dark:bg-hairline/30', 'dark:shadow-none']],
    ['secondary', ['bg-secondary']],
    ['ghost', ['active:bg-muted', 'dark:active:bg-muted/50']],
    ['destructive', ['bg-destructive/10', 'dark:bg-destructive/20', 'active:bg-destructive/20']],
    ['link', ['h-auto', 'px-0']],
  ])('%s variant', (variant, expected) => {
    // Through cn, as the Button merges them (the old-name aliases are covered below).
    const classes = cn(buttonVariants({ variant })).split(' ');
    for (const c of expected) expect(classes).toContain(c);
  });

  it('renders the variant classes on the Pressable', () => {
    const { getByTestId } = render(
      <Button testID="b" variant="link">
        Go
      </Button>,
    );
    expect(classesOf(getByTestId('b'))).toEqual(expect.arrayContaining(['h-auto', 'px-0']));
    expect(classesOf(getByTestId('b'))).not.toContain('h-9');
  });

  it('keeps the border transparent except on outline', () => {
    expect(cn(buttonVariants({ variant: 'default' }))).toContain('border-transparent');
    expect(cn(buttonVariants({ variant: 'outline' }))).not.toContain('border-transparent');
  });

  it.each<[ButtonSize, string[]]>([
    ['xs', ['h-6', 'px-2', 'gap-1']],
    ['sm', ['h-8', 'px-2.5', 'gap-1']],
    ['default', ['h-9', 'px-2.5', 'gap-1.5']],
    ['lg', ['h-10', 'px-3', 'gap-1.5']],
    ['icon', ['size-9']],
    ['icon-xs', ['size-6']],
    ['icon-sm', ['size-8']],
    ['icon-lg', ['size-10']],
  ])('%s size', (size, expected) => {
    const { getByTestId } = render(
      <Button testID="b" size={size} accessibilityLabel="Add">
        <View />
      </Button>,
    );
    const classes = classesOf(getByTestId('b'));
    for (const c of expected) expect(classes).toContain(c);
    expect(classes).toContain('rounded-lg');
  });
});

describe('buttonTextVariants', () => {
  it.each<[ButtonVariant, string]>([
    ['default', 'text-background'],
    ['outline', 'text-foreground'],
    ['secondary', 'text-secondary-foreground'],
    ['ghost', 'text-foreground'],
    ['destructive', 'text-destructive'],
    ['link', 'underline'],
  ])('%s label colour', (variant, expected) => {
    const classes = buttonTextVariants({ variant }).split(' ');
    expect(classes).toContain(expected);
    expect(classes).toContain('font-medium');
  });

  it('puts the label classes on the label Text', () => {
    const { getByTestId } = render(
      <Button variant="destructive" size="sm" labelTestID="label">
        Remove
      </Button>,
    );
    expect(classesOf(getByTestId('label'))).toEqual(expect.arrayContaining(['font-medium', 'text-destructive', 'text-[13px]']));
  });

  it.each<[ButtonSize, string]>([
    ['xs', 'text-xs'],
    ['sm', 'text-[13px]'],
    ['default', 'text-sm'],
    ['lg', 'text-sm'],
  ])('%s label size', (size, expected) => {
    expect(buttonTextVariants({ size }).split(' ')).toContain(expected);
  });

  it('uses Geist Medium for the label', () => {
    const { getByText } = render(<Button>Save</Button>);
    expect(getByText('Save')).toHaveStyle({ fontFamily: 'Geist_500Medium' });
  });

  it('merges textClassName last', () => {
    const { getByTestId } = render(
      <Button labelTestID="label" textClassName="text-accent">
        Go
      </Button>,
    );
    const classes = classesOf(getByTestId('label'));
    expect(classes).toContain('text-accent');
    expect(classes).not.toContain('text-background');
  });
});

describe('deprecated variant aliases (removed in Task 6)', () => {
  it.each([
    ['primary', 'default'],
    ['secondary', 'outline'],
    ['ghost', 'ghost'],
    ['destructive', 'destructive'],
  ] as const)('%s resolves to %s', (legacy, current) => {
    expect(resolveVariant(legacy)).toBe(current);
  });

  it('treats a missing variant as default', () => {
    expect(resolveVariant(undefined)).toBe('default');
    expect(resolveVariant(null)).toBe('default');
  });

  it('renders the old secondary as outline for now', () => {
    const { getByTestId } = render(
      <Button testID="b" variant="secondary">
        Go
      </Button>,
    );
    expect(classesOf(getByTestId('b'))).toContain('border-border');
  });
});

describe('children', () => {
  it('wraps a string in a Text with the label classes', () => {
    const { getByText } = render(<Button>Continue</Button>);
    expect(classesOf(getByText('Continue'))).toContain('text-background');
  });

  it('renders node children as-is', () => {
    const { getByTestId, queryByText } = render(
      <Button testID="b">
        <Text testID="custom">Custom</Text>
      </Button>,
    );
    expect(getByTestId('custom').props.className).toBeUndefined();
    expect(queryByText('Custom')).toBeTruthy();
  });

  it('puts iconStart before and iconEnd after the label, tightening that side', () => {
    const { getByTestId } = render(
      <Button testID="b" iconStart={<View testID="start" />} iconEnd={<View testID="end" />}>
        Send
      </Button>,
    );
    const button = getByTestId('b');
    const order = (React.Children.toArray(button.props.children) as React.ReactElement<any>[])
      .map((kid) => kid.props.testID ?? kid.props.children)
      .filter((key) => key === 'start' || key === 'Send' || key === 'end');
    expect(order).toEqual(['start', 'Send', 'end']);
    const classes = classesOf(button);
    expect(classes).toContain('pl-2');
    expect(classes).toContain('pr-2');
  });

  it('tightens by size: pl-1.5 on sm', () => {
    const { getByTestId } = render(
      <Button testID="b" size="sm" iconStart={<View />}>
        Send
      </Button>,
    );
    expect(classesOf(getByTestId('b'))).toContain('pl-1.5');
  });

  it('sizes icons like shadcn: 12 on xs sizes, 16 elsewhere', () => {
    expect(buttonIconSize('xs')).toBe(12);
    expect(buttonIconSize('icon-xs')).toBe(12);
    expect(buttonIconSize('default')).toBe(16);
    expect(buttonIconSize('icon-lg')).toBe(16);
  });
});

describe('loading', () => {
  it('shows a spinner in the icon-start slot, disables the button and marks it busy', () => {
    const onPress = jest.fn();
    const { getByTestId, queryByTestId } = render(
      <Button testID="save" loading onPress={onPress} iconStart={<View testID="icon" />}>
        Saving
      </Button>,
    );
    expect(getByTestId('save-spinner')).toBeTruthy();
    expect(classesOf(getByTestId('save-spinner'))).toContain('text-background');
    expect(queryByTestId('icon')).toBeNull();
    const button = getByTestId('save');
    expect(button).toBeDisabled();
    expect(button.props.accessibilityState).toEqual(expect.objectContaining({ busy: true, disabled: true }));
    expect(classesOf(button)).toContain('opacity-50');
    fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('is not busy when idle', () => {
    const { getByTestId } = render(<Button testID="b">Save</Button>);
    expect(getByTestId('b').props.accessibilityState?.busy).toBeUndefined();
  });
});

describe('disabled', () => {
  it('passes disabled through to the Pressable and dims', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(
      <Button testID="b" disabled onPress={onPress}>
        Save
      </Button>,
    );
    const button = getByTestId('b');
    expect(button).toBeDisabled();
    expect(button.props.accessibilityState).toEqual(expect.objectContaining({ disabled: true }));
    expect(classesOf(button)).toContain('opacity-50');
    fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('is enabled by default', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(
      <Button testID="b" onPress={onPress}>
        Save
      </Button>,
    );
    expect(getByTestId('b')).not.toBeDisabled();
    expect(classesOf(getByTestId('b'))).not.toContain('opacity-50');
    fireEvent.press(getByTestId('b'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('keeps caller accessibilityState fields', () => {
    const { getByTestId } = render(
      <Button testID="b" accessibilityState={{ selected: true }}>
        Day
      </Button>,
    );
    expect(getByTestId('b').props.accessibilityState).toEqual(expect.objectContaining({ selected: true, disabled: false }));
  });
});

describe('accessibility', () => {
  it('defaults accessibilityRole to button', () => {
    const { getByRole } = render(<Button>Go</Button>);
    expect(getByRole('button', { name: 'Go' })).toBeTruthy();
  });

  it('lets a caller override the role', () => {
    const { getByTestId } = render(
      <Button testID="b" variant="link" accessibilityRole="link">
        Terms
      </Button>,
    );
    expect(getByTestId('b').props.accessibilityRole).toBe('link');
  });

  it('forwards accessibilityLabel on an icon button', () => {
    const { getByLabelText } = render(
      <Button size="icon" accessibilityLabel="Close">
        <View />
      </Button>,
    );
    expect(getByLabelText('Close')).toBeTruthy();
  });

  // Type-only: never called. tsc fails (an unused @ts-expect-error) if an
  // icon-only size ever stops requiring accessibilityLabel.
  function iconSizesRequireALabel() {
    return (
      <>
        {/* @ts-expect-error icon needs accessibilityLabel */}
        <Button size="icon"><View /></Button>
        {/* @ts-expect-error icon-xs needs accessibilityLabel */}
        <Button size="icon-xs"><View /></Button>
        {/* @ts-expect-error icon-sm needs accessibilityLabel */}
        <Button size="icon-sm"><View /></Button>
        {/* @ts-expect-error icon-lg needs accessibilityLabel */}
        <Button size="icon-lg"><View /></Button>
        <Button size="icon" accessibilityLabel="Add"><View /></Button>
        <Button size="sm">Text sizes need no label</Button>
      </>
    );
  }
  it('has the type-only label check compiled in', () => {
    expect(typeof iconSizesRequireALabel).toBe('function');
  });
});

describe('hitSlop', () => {
  it.each<[ButtonSize, number, number]>([
    ['xs', 10, 0],
    ['sm', 6, 0],
    ['default', 4, 0],
    ['lg', 2, 0],
    ['icon-xs', 10, 10],
    ['icon-sm', 6, 6],
    ['icon', 4, 4],
    ['icon-lg', 2, 2],
  ])('%s grows to 44: vertical %d, horizontal %d', (size, vertical, horizontal) => {
    expect(hitSlopFor(size)).toEqual({ top: vertical, bottom: vertical, left: horizontal, right: horizontal });
  });

  it('uses the measured layout once known (a narrow text button gets side slop)', () => {
    expect(hitSlopFor('xs', 'default', { width: 30, height: 24 })).toEqual({ top: 10, bottom: 10, left: 7, right: 7 });
    expect(hitSlopFor('lg', 'default', { width: 200, height: 48 })).toEqual({ top: 0, bottom: 0, left: 0, right: 0 });
  });

  it('treats a link as one line of text', () => {
    expect(hitSlopFor('default', 'link')).toEqual({ top: 12, bottom: 12, left: 0, right: 0 });
  });

  it('applies the computed slop and recomputes after layout', () => {
    const { getByTestId } = render(
      <Button testID="b" size="xs">
        OK
      </Button>,
    );
    expect(getByTestId('b').props.hitSlop).toEqual({ top: 10, bottom: 10, left: 0, right: 0 });
    fireEvent(getByTestId('b'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 32, height: 24 } } });
    expect(getByTestId('b').props.hitSlop).toEqual({ top: 10, bottom: 10, left: 6, right: 6 });
  });

  it('lets a caller override hitSlop', () => {
    const { getByTestId } = render(
      <Button testID="b" size="icon-xs" accessibilityLabel="Add" hitSlop={20}>
        <View />
      </Button>,
    );
    expect(getByTestId('b').props.hitSlop).toBe(20);
  });
});

describe('passthrough', () => {
  it('forwards style, testID, onPress and other Pressable props', () => {
    const onPress = jest.fn();
    const onLongPress = jest.fn();
    const onLayout = jest.fn();
    const { getByTestId } = render(
      <Button testID="cta" style={{ backgroundColor: 'rgb(1, 2, 3)' }} onPress={onPress} onLongPress={onLongPress} onLayout={onLayout}>
        Go
      </Button>,
    );
    const button = getByTestId('cta');
    expect(button).toHaveStyle({ backgroundColor: 'rgb(1, 2, 3)' });
    fireEvent.press(button);
    fireEvent(button, 'longPress');
    fireEvent(button, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 100, height: 36 } } });
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onLongPress).toHaveBeenCalledTimes(1);
    expect(onLayout).toHaveBeenCalledTimes(1);
  });

  it('puts labelTestID on the label Text', () => {
    const { getByTestId } = render(
      <Button testID="b" labelTestID="b-label">
        Again
      </Button>,
    );
    expect(getByTestId('b-label').props.children).toBe('Again');
  });

  it('merges className last', () => {
    const { getByTestId } = render(
      <Button testID="b" className="w-full rounded-full">
        Go
      </Button>,
    );
    const classes = classesOf(getByTestId('b'));
    expect(classes).toContain('w-full');
    expect(classes).toContain('rounded-full');
    expect(classes).not.toContain('rounded-lg');
  });

  it('still calls onPressIn and onPressOut', () => {
    const onPressIn = jest.fn();
    const onPressOut = jest.fn();
    const { getByTestId } = render(
      <Button testID="b" onPressIn={onPressIn} onPressOut={onPressOut}>
        Go
      </Button>,
    );
    fireEvent(getByTestId('b'), 'pressIn');
    fireEvent(getByTestId('b'), 'pressOut');
    expect(onPressIn).toHaveBeenCalledTimes(1);
    expect(onPressOut).toHaveBeenCalledTimes(1);
  });
});

describe('ButtonGroup', () => {
  it('squares the inner corners and overlaps borders', () => {
    const { getByTestId } = render(
      <ButtonGroup testID="group" accessibilityLabel="Range">
        <Button testID="day" variant="outline">
          Day
        </Button>
        <Button testID="week" variant="outline">
          Week
        </Button>
        {null}
        <Button testID="more" variant="outline" size="icon" accessibilityLabel="More">
          <View />
        </Button>
      </ButtonGroup>,
    );
    expect(getByTestId('group').props.role).toBe('group');
    const first = classesOf(getByTestId('day'));
    const middle = classesOf(getByTestId('week'));
    const last = classesOf(getByTestId('more'));
    expect(first).toEqual(expect.arrayContaining(['rounded-lg', 'rounded-r-none']));
    expect(first).not.toContain('-ml-px');
    expect(middle).toEqual(expect.arrayContaining(['rounded-none', '-ml-px']));
    expect(middle).not.toContain('rounded-lg');
    expect(last).toEqual(expect.arrayContaining(['rounded-lg', 'rounded-l-none', '-ml-px']));
  });

  it('leaves a lone button rounded', () => {
    const { getByTestId } = render(
      <ButtonGroup>
        <Button testID="only">Only</Button>
      </ButtonGroup>,
    );
    const classes = classesOf(getByTestId('only'));
    expect(classes).toContain('rounded-lg');
    expect(classes).not.toContain('rounded-r-none');
  });

  it('does not affect buttons outside a group', () => {
    const { getByTestId } = render(<Button testID="b">Go</Button>);
    expect(classesOf(getByTestId('b')).some((c) => c.includes('rounded-') && c !== 'rounded-lg')).toBe(false);
  });
});

describe('pressed state', () => {
  afterEach(() => {
    (useReducedMotion as jest.Mock).mockReturnValue(false);
    jest.useRealTimers();
  });

  it('nudges down 1 px when pressed, not at rest', () => {
    expect(pressNudge(false, true)).toBe(MOTION.buttonPress.translateY);
    expect(MOTION.buttonPress.translateY).toBe(1);
    expect(pressNudge(false, false)).toBe(0);
  });

  it('never translates under reduced motion', () => {
    expect(pressNudge(true, true)).toBe(0);
    expect(pressNudge(true, false)).toBe(0);
  });

  it('moves the rendered button down 1 px while pressed', () => {
    jest.useFakeTimers();
    const { getByTestId } = render(<Button testID="b">Go</Button>);
    fireEvent(getByTestId('b'), 'pressIn');
    act(() => jest.advanceTimersByTime(500));
    expect(getAnimatedStyle(getByTestId('b') as any)).toEqual(expect.objectContaining({ transform: [{ translateY: 1 }] }));
  });

  it('stays put under reduced motion (it only dims via active:opacity-90)', () => {
    (useReducedMotion as jest.Mock).mockReturnValue(true);
    jest.useFakeTimers();
    const { getByTestId } = render(<Button testID="b">Go</Button>);
    fireEvent(getByTestId('b'), 'pressIn');
    act(() => jest.advanceTimersByTime(500));
    expect(getAnimatedStyle(getByTestId('b') as any)).toEqual(expect.objectContaining({ transform: [{ translateY: 0 }] }));
    expect(classesOf(getByTestId('b'))).toContain('active:opacity-90');
  });
});
