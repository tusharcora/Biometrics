import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, ScrollView, View, findNodeHandle, type Text as RNText } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { fetchRoomCheers, type RoomCheersDTO } from '../api/rooms';
import { Button } from '../components/ui/button';
import { Text } from '../components/ui/text';
import { ROOM_COPY } from '../lib/room/roomCopy';
import type { RootStackParamList } from '../navigation/RootNavigator';

const G = ROOM_COPY.gifts;
type State = { status: 'loading' } | { status: 'ready'; body: RoomCheersDTO } | { status: 'failed' };

// Who cheered your room this week (spec 2026-10-15 §10.2): your buddies' names, in your own sheet only, newest
// first as the server sends them (anyone blocked either way is already left out, PF4-F18). A screen reader lands on
// the title. Read once per open; a failed read says so rather than "no cheers".
export function RoomCheersScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'RoomCheers'>>();
  const [state, setState] = useState<State>({ status: 'loading' });
  const titleRef = useRef<RNText>(null);
  useEffect(() => {
    let live = true;
    fetchRoomCheers()
      .then((body) => { if (live) setState({ status: 'ready', body: { count: body?.count ?? 0, cheers: Array.isArray(body?.cheers) ? body.cheers : [] } }); })
      .catch(() => { if (live) setState({ status: 'failed' }); });
    const node = titleRef.current ? findNodeHandle(titleRef.current) : null;
    if (node) AccessibilityInfo.setAccessibilityFocus(node);
    return () => {
      live = false;
    };
  }, []);
  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-background">
      <View className="flex-row items-center justify-between gap-2 px-4 pb-2 pt-1">
        <Text ref={titleRef} testID="cheers-title" accessibilityRole="header" className="shrink text-heading">{G.cheersTitle}</Text>
        <Button testID="cheers-close" variant="ghost" className="h-[44px]" onPress={() => navigation.goBack()}>{G.close}</Button>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 4, gap: 8 }}>
        {state.status === 'loading' ? <ActivityIndicator testID="cheers-loading" /> : null}
        {state.status === 'failed' ? <Text testID="cheers-failed" className="text-body text-muted-foreground">{G.cheersFailed}</Text> : null}
        {state.status === 'ready' && !state.body.cheers.length ? (
          <Text testID="cheers-none" className="text-body text-muted-foreground">{G.cheersNone}</Text>
        ) : null}
        {state.status === 'ready'
          ? state.body.cheers.map((c, i) => <Text key={`${c.name}-${i}`} testID={`cheer-row-${i}`} className="text-body">{c.name}</Text>)
          : null}
      </ScrollView>
    </SafeAreaView>
  );
}
