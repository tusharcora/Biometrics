// The single named target for "open this night". The combined Sleep page work repoints only this.
export function openNight(navigation: { navigate: (...args: any[]) => void }, date: string): void {
  navigation.navigate('SleepNight', { date });
}
