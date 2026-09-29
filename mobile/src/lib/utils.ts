import { type ClassValue, clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// tailwind-merge only knows Tailwind's stock scales. Unregistered, the custom
// font sizes in tailwind.config.js read as text *colours*, so
// cn('text-eyebrow', 'text-muted-foreground') would silently drop the size.
// Keep these lists in step with the fontSize/fontFamily/borderRadius keys there.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: ['eyebrow', 'numeral-sm', 'numeral', 'numeral-lg', 'numeral-xl', 'display-sm', 'display', 'display-lg'] }],
      'font-family': [{ font: ['sans', 'display'] }],
      rounded: [{ rounded: ['tile', 'card'] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// 'rgb(r, g, b)' -> 'rgba(r, g, b, a)', for tinting a surface with a token
// colour (COLORS values are always rgb()).
export function withAlpha(color: string, alpha: number): string {
  const match = color.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
  if (!match) return color;
  return `rgba(${match[1]}, ${match[2]}, ${match[3]}, ${alpha})`;
}
