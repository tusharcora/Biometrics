import React from 'react';
import { View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { KipHead } from '../../kip/KipHead';
import type { ThinkingTextId } from '../../../lib/thinkingText';
import { KIP_COPY } from '../../../lib/kipCopy';
import { Lines } from './Lines';
import { Placeholder } from './Placeholder';
import { spoken } from './shared';
import { Shimmer } from './Shimmer';
import { Steps } from './Steps';
import type { ThinkingStyleProps } from './types';
import { Typewriter } from './Typewriter';

export type { ThinkingStyleProps } from './types';

const STYLES: Record<ThinkingTextId, React.ComponentType<ThinkingStyleProps>> = {
  lines: Lines,
  placeholder: Placeholder,
  typewriter: Typewriter,
  steps: Steps,
  shimmer: Shimmer,
};

/** Steps speaks the step it is on; every other style a steady "KIP is typing it up" (no re-announce per line). */
export function thinkingRowLabel(style: ThinkingTextId, props: ThinkingStyleProps): string {
  if (style === 'steps' && props.steps.length) {
    const current = props.steps.find((step) => !step.done) ?? props.steps[props.steps.length - 1]!;
    return spoken(current.label);
  }
  return KIP_COPY.thinkingLabel;
}

// The KIP page's "a reply is on its way" row (spec §3.4 Thinking): KIP's head, glancing, and the chosen thinking
// text. Reduce Motion freezes every style on its first frame.
export function ThinkingRow({ style, steps, paused, testID }: ThinkingStyleProps & { style: ThinkingTextId; testID?: string }) {
  const reduceMotion = useReducedMotion();
  const props: ThinkingStyleProps = { steps, paused: paused || reduceMotion };
  const Body = STYLES[style];
  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="text"
      accessibilityLabel={thinkingRowLabel(style, props)}
      accessibilityLiveRegion="polite"
      className="flex-row items-end gap-1.5"
    >
      <View className="pb-3">
        <KipHead testID="thinking-kip-head" mood="glance" />
      </View>
      <View className="flex-1">
        <Body {...props} />
      </View>
    </View>
  );
}
