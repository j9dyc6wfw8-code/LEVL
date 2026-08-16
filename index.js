// LEVL — app entry point.
//
// Two jobs, in this order:
//
//  1. INSTALL A GLOBAL ERROR HANDLER *BEFORE* ANYTHING ELSE IS IMPORTED.
//     In a release build, React Native routes any unhandled JS error to
//     RCTFatal, which calls abort() — the app vanishes with no message. A React
//     error boundary CANNOT help here, because boundaries only catch errors
//     thrown during a component's render. They cannot catch:
//       - errors thrown at module scope (while a file is being imported)
//       - errors in async code / rejected promises
//       - errors inside native module callbacks
//     Those are exactly the errors that only show up in production. So we install
//     ErrorUtils.setGlobalHandler and render the error to the screen instead of
//     dying. A visible error beats a silent crash every time.
//
//  2. Register the root component. registerRootComponent() is the canonical entry
//     for Expo SDK 50+. The old "main": "node_modules/expo/AppEntry.js" convention
//     (SDK <=49) does not reliably resolve in a standalone build — when it fails,
//     nothing mounts and you get a black screen with no error at all.
import { registerRootComponent } from 'expo';
import React from 'react';
import { View, Text, ScrollView, Platform } from 'react-native';

/* ----------------------- global JS crash interception ------------------- */
let fatal = null;
const listeners = new Set();

const setFatal = (err) => {
  const msg = [
    (err && err.name) || 'Error',
    (err && err.message) || String(err),
    '',
    err && err.stack ? String(err.stack).split('\n').slice(0, 24).join('\n') : '(no stack)',
  ].join('\n');
  fatal = { msg };
  listeners.forEach((fn) => fn());
};

if (typeof ErrorUtils !== 'undefined' && ErrorUtils.setGlobalHandler) {
  ErrorUtils.setGlobalHandler((err) => {
    try { setFatal(err); } catch (e) { /* the handler must never throw */ }
    // Deliberately do NOT forward to the previous handler in production: that is
    // what calls RCTFatal -> abort(), which is the crash we are preventing.
  });
}

/* --------------------------- the crash screen --------------------------- */
function CrashScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: '#08090f', paddingTop: 64, paddingHorizontal: 20, paddingBottom: 28 }}>
      <Text style={{ color: '#f5c542', fontSize: 20, fontWeight: '800' }}>LEVL hit an error</Text>
      <Text style={{ color: '#9ba3b4', fontSize: 12, marginTop: 6, marginBottom: 14, lineHeight: 17 }}>
        Screenshot this screen and send it over — the text below is the exact cause.
      </Text>
      <ScrollView style={{ flex: 1, backgroundColor: '#12151e', borderRadius: 10, padding: 12 }}>
        <Text
          selectable
          style={{
            color: '#ffffff', fontSize: 11, lineHeight: 16,
            fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
          }}>
          {fatal ? fatal.msg : ''}
        </Text>
      </ScrollView>
    </View>
  );
}

/* ------------------------------- mount ---------------------------------- */
// App is required lazily inside try/catch so that even a module-scope throw
// (a bad import, an unregistered native component) renders the crash screen
// rather than killing the process before anything can mount.
function Root() {
  const [, force] = React.useReducer((x) => x + 1, 0);
  React.useEffect(() => {
    listeners.add(force);
    return () => { listeners.delete(force); };
  }, []);

  if (fatal) return <CrashScreen />;

  try {
    const App = require('./App').default;
    return <App />;
  } catch (err) {
    setFatal(err);
    return <CrashScreen />;
  }
}

registerRootComponent(Root);
