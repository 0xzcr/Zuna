import { useState } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import { StatusBar } from 'expo-status-bar';
import {
  Pressable,
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { createChunkQueue } from './src/reader-state.mjs';

type Tab = 'home' | 'library' | 'voices' | 'settings';
type Voice = 'elias' | 'mira';

const colors = {
  canvas: '#f5efe6', ink: '#282723', muted: '#817b72', line: '#ded7cb', accent: '#c76650', accentDeep: '#914031', surface: '#fbf8f2', soft: '#eae3d7', sage: '#82927f', white: '#fffaf2',
};

export default function App() {
  const [tab, setTab] = useState<Tab>('home');
  const [voice, setVoice] = useState<Voice>('elias');
  const [book, setBook] = useState<{ name: string; uri: string } | null>(null);
  const [chunkCount, setChunkCount] = useState(0);

  async function importBook() {
    const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'text/plain'], copyToCacheDirectory: true });
    if (!result.canceled) {
      const asset = result.assets[0];
      setBook({ name: asset.name, uri: asset.uri });
      setChunkCount(createChunkQueue([asset.name], voice, 'kokoro').length);
      setTab('library');
    }
  }

  function renderContent() {
    if (tab === 'voices') return <VoiceScreen voice={voice} onVoiceChange={setVoice} />;
    if (tab === 'settings') return <SettingsScreen />;
    if (tab === 'library') return <LibraryScreen book={book} chunkCount={chunkCount} onImport={importBook} />;
    return <HomeScreen book={book} onImport={importBook} />;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <View style={styles.app}>
        <View style={styles.header}><Text style={styles.brand}><Text style={styles.brandMark}>z</Text>una</Text><Text style={styles.localLabel}>●  SAVED LOCALLY</Text></View>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>{renderContent()}</ScrollView>
          <View style={styles.player}>
            <View style={styles.playerCopy}><Text style={styles.overline}>{book?.name ?? 'YOUR LISTENING ROOM'}</Text><Text style={styles.playerTitle}>{book ? 'Ready when you are.' : 'Bring a book to begin.'}</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel="Play" style={styles.play} onPress={() => { if (book) Alert.alert('Kokoro is coming next', 'Your book is queued locally. Native ONNX narration will be enabled in the next Phase 1 build.'); }}><Text style={styles.playText}>▶</Text></Pressable>
        </View>
        <View style={styles.nav}>{([['home', '⌂', 'Home'], ['library', '▱', 'Library'], ['voices', '◌', 'Voices'], ['settings', '⌘', 'Settings']] as const).map(([key, icon, label]) => <Pressable key={key} accessibilityRole="button" accessibilityState={{ selected: tab === key }} style={[styles.navItem, tab === key && styles.navItemSelected]} onPress={() => setTab(key)}><Text style={styles.navIcon}>{icon}</Text><Text style={[styles.navLabel, tab === key && styles.navLabelSelected]}>{label}</Text></Pressable>)}</View>
      </View>
    </SafeAreaView>
  );
}

function HomeScreen({ book, onImport }: { book: { name: string; uri: string } | null; onImport: () => void }) {
  return <View><Text style={styles.eyebrow}>A QUIETER WAY TO READ</Text><Text style={styles.hero}>Your books,{ '\n' }with a <Text style={styles.italic}>voice.</Text></Text><Text style={styles.body}>A listening room for the books you already own. Private, calm, and close at hand.</Text><Pressable accessibilityRole="button" style={styles.primary} onPress={onImport}><Text style={styles.primaryText}>{book ? 'Bring in another book' : 'Bring in a book'}  ↗</Text></Pressable><View style={styles.promise}><Text style={styles.promiseNumber}>01</Text><Text style={styles.promiseTitle}>Local first</Text><Text style={styles.promiseBody}>Your books stay on this device.</Text></View><View style={styles.promise}><Text style={styles.promiseNumber}>02</Text><Text style={styles.promiseTitle}>Start sooner</Text><Text style={styles.promiseBody}>Listen while the rest loads.</Text></View></View>;
}

function LibraryScreen({ book, chunkCount, onImport }: { book: { name: string; uri: string } | null; chunkCount: number; onImport: () => void }) {
  return <View><Text style={styles.eyebrow}>01 / YOUR LIBRARY</Text><Text style={styles.sectionTitle}>A quiet shelf for{ '\n' }<Text style={styles.italic}>the good ones.</Text></Text><Pressable accessibilityRole="button" style={styles.dropZone} onPress={onImport}><Text style={styles.dropIcon}>＋</Text><Text style={styles.dropTitle}>{book ? book.name : 'Bring in a book'}</Text><Text style={styles.dropBody}>{book ? `${chunkCount} local chunk queued · Kokoro next` : 'PDF or TXT · it never leaves your device'}</Text></Pressable></View>;
}

function VoiceScreen({ voice, onVoiceChange }: { voice: Voice; onVoiceChange: (value: Voice) => void }) {
  return <View><Text style={styles.eyebrow}>02 / THE ROOM TONE</Text><Text style={styles.sectionTitle}>Choose a narrator.</Text><VoiceCard name="Elias" role="The theatrical narrator" description="Warm, wise, expressive long-form delivery." selected={voice === 'elias'} onPress={() => onVoiceChange('elias')} /><VoiceCard name="Mira" role="The intimate storyteller" description="Textured, gentle, and quietly confident." selected={voice === 'mira'} onPress={() => onVoiceChange('mira')} /></View>;
}

function VoiceCard({ name, role, description, selected, onPress }: { name: string; role: string; description: string; selected: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="radio" accessibilityState={{ selected }} style={[styles.voiceCard, selected && styles.voiceCardSelected]} onPress={onPress}><View style={styles.voiceTop}><Text style={styles.number}>0{selected ? 1 : 2}</Text><Text style={styles.wave}>▂▅▇▆▅▃</Text></View><Text style={styles.voiceName}>{name}</Text><Text style={styles.voiceRole}>{role}</Text><Text style={styles.voiceDescription}>{description}</Text>{selected && <Text style={styles.check}>✓</Text>}</Pressable>;
}

function SettingsScreen() { return <View><Text style={styles.eyebrow}>YOUR PREFERENCES</Text><Text style={styles.sectionTitle}>Settings</Text><View style={styles.setting}><Text style={styles.settingTitle}>Local storage</Text><Text style={styles.settingBody}>Your books and progress stay in this app.</Text><Text style={styles.on}>ON</Text></View><View style={styles.setting}><Text style={styles.settingTitle}>Free narration</Text><Text style={styles.settingBody}>Kokoro on-device engine · unlimited when configured.</Text><Text style={styles.on}>KOKORO</Text></View></View>; }

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.canvas }, app: { flex: 1, backgroundColor: colors.canvas }, header: { height: 70, borderBottomWidth: 1, borderBottomColor: colors.line, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, brand: { color: colors.ink, fontSize: 24, fontWeight: '600', letterSpacing: -2 }, brandMark: { borderWidth: 1, borderColor: colors.ink, borderRadius: 16, fontFamily: 'Georgia', fontStyle: 'italic', fontSize: 19, paddingHorizontal: 4 }, localLabel: { color: colors.muted, fontSize: 9, letterSpacing: 1 }, scroll: { padding: 24, paddingBottom: 180 }, eyebrow: { color: colors.accent, fontSize: 10, letterSpacing: 1.7, marginTop: 25, marginBottom: 17 }, hero: { color: colors.ink, fontFamily: 'Georgia', fontSize: 52, lineHeight: 51, letterSpacing: -3 }, italic: { color: colors.accentDeep, fontStyle: 'italic' }, body: { color: colors.muted, fontSize: 15, lineHeight: 24, marginTop: 22, maxWidth: 330 }, primary: { alignSelf: 'flex-start', backgroundColor: colors.accent, borderRadius: 5, marginTop: 28, paddingHorizontal: 17, paddingVertical: 14 }, primaryText: { color: colors.white, fontSize: 12, fontWeight: '700' }, promise: { borderTopWidth: 1, borderTopColor: colors.line, marginTop: 50, paddingTop: 14 }, promiseNumber: { color: colors.accent, fontSize: 10, marginBottom: 9 }, promiseTitle: { color: colors.ink, fontFamily: 'Georgia', fontSize: 18 }, promiseBody: { color: colors.muted, fontSize: 11, marginTop: 4 }, sectionTitle: { color: colors.ink, fontFamily: 'Georgia', fontSize: 36, lineHeight: 38, letterSpacing: -1.5, marginBottom: 26 }, dropZone: { minHeight: 190, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.line, borderRadius: 10, alignItems: 'center', justifyContent: 'center', padding: 22 }, dropIcon: { color: colors.accent, fontSize: 29, marginBottom: 10 }, dropTitle: { color: colors.ink, fontFamily: 'Georgia', fontSize: 21, textAlign: 'center' }, dropBody: { color: colors.muted, fontSize: 11, marginTop: 8, textAlign: 'center' }, voiceCard: { minHeight: 190, borderWidth: 1, borderColor: colors.line, borderRadius: 10, padding: 19, marginBottom: 12 }, voiceCardSelected: { borderColor: colors.accent, backgroundColor: '#f4e6dc' }, voiceTop: { flexDirection: 'row', justifyContent: 'space-between' }, number: { color: colors.muted, fontSize: 10 }, wave: { color: colors.accent, fontSize: 16, letterSpacing: 2 }, voiceName: { color: colors.ink, fontFamily: 'Georgia', fontSize: 32, marginTop: 23 }, voiceRole: { color: colors.accentDeep, fontSize: 12, marginTop: 3 }, voiceDescription: { color: colors.muted, fontSize: 12, marginTop: 27 }, check: { color: colors.accent, fontSize: 18, position: 'absolute', right: 18, bottom: 15 }, setting: { borderTopWidth: 1, borderTopColor: colors.line, paddingVertical: 18, position: 'relative' }, settingTitle: { color: colors.ink, fontFamily: 'Georgia', fontSize: 17 }, settingBody: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 5, paddingRight: 58 }, on: { color: colors.sage, fontSize: 9, letterSpacing: 1, position: 'absolute', right: 0, top: 22 }, player: { position: 'absolute', left: 16, right: 16, bottom: 80, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 11, padding: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, playerCopy: { flex: 1, paddingRight: 10 }, overline: { color: colors.muted, fontSize: 9, letterSpacing: 1, textTransform: 'uppercase' }, playerTitle: { color: colors.ink, fontFamily: 'Georgia', fontSize: 17, marginTop: 5 }, play: { alignItems: 'center', backgroundColor: colors.accent, borderRadius: 22, height: 44, justifyContent: 'center', width: 44 }, playText: { color: colors.white, fontSize: 13 }, nav: { position: 'absolute', left: 12, right: 12, bottom: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 12, flexDirection: 'row', padding: 7 }, navItem: { alignItems: 'center', borderRadius: 7, flex: 1, paddingVertical: 6 }, navItemSelected: { backgroundColor: colors.soft }, navIcon: { color: colors.accent, fontSize: 16 }, navLabel: { color: colors.muted, fontSize: 9, marginTop: 3 }, navLabelSelected: { color: colors.ink } });
