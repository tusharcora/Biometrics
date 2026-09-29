import { cn, withAlpha } from '../../src/lib/utils';

describe('cn', () => {
  it('keeps a custom font size alongside a text colour', () => {
    expect(cn('text-foreground', 'text-eyebrow text-muted-foreground')).toBe('text-eyebrow text-muted-foreground');
  });

  it('lets a later custom font size replace an earlier one', () => {
    expect(cn('text-2xl', 'text-numeral-xl')).toBe('text-numeral-xl');
  });

  it('treats font-display as a family, so it survives a weight class', () => {
    expect(cn('font-display', 'font-bold')).toBe('font-display font-bold');
  });

  it('merges the custom radii with stock ones', () => {
    expect(cn('rounded-xl', 'rounded-card')).toBe('rounded-card');
  });
});

describe('withAlpha', () => {
  it('turns an rgb() token into rgba()', () => {
    expect(withAlpha('rgb(45, 212, 191)', 0.16)).toBe('rgba(45, 212, 191, 0.16)');
  });

  it('leaves anything else untouched', () => {
    expect(withAlpha('#fff', 0.5)).toBe('#fff');
  });
});
