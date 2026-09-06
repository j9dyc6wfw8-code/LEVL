// ============================================================================
// LEVL — Text and TextInput, with a Dynamic Type ceiling
//
// WHY THIS FILE EXISTS
//
// `FONT_SCALE_CAP` sat in theme.js for months, exported and read by nothing, so
// text scaled without any limit at all. At the largest accessibility size the
// auth screen collapsed outright: the wordmark wrapped to "LEV"/"L", "Create
// account" clipped to "accoun", and the form left the screen.
//
// The usual global fix is one line:
//
//     Text.defaultProps.maxFontSizeMultiplier = 1.5
//
// It does not work here, and that was measured on device rather than assumed.
// React 19 dropped `defaultProps` for function components, and RN 0.81's Text is
// one — the assignment is silently ignored. So the cap has to arrive as a real
// prop, which means every screen has to render THIS Text rather than RN's.
//
// HOW TO USE IT
//
// Import Text/TextInput from here instead of from 'react-native'. That is the
// only difference; every prop behaves exactly as before.
//
// The cap is a DEFAULT, not a lock. It is spread first, so any component that
// genuinely needs a different ceiling just passes its own:
//
//     <Text maxFontSizeMultiplier={1.2}>…</Text>      // tighter
//     <Text allowFontScaling={false}>LEVL</Text>       // a logo, not content
//
// WHY CAP AT ALL, RATHER THAN LET IT SCALE
//
// Because LEVL is dense by nature — six stat tiles, a versus board, a set-entry
// grid. Unbounded scaling does not make those readable, it makes them unusable.
// A ceiling of 1.5 still honours most of the range someone actually sets, and
// 1.25 on inputs keeps fixed-height fields from swallowing their own text.
// ============================================================================

import React from 'react';
import { Text as RNText, TextInput as RNTextInput } from 'react-native';
import { FONT_SCALE_CAP } from '../theme';

export const Text = React.forwardRef(function Text(props, ref) {
  return <RNText ref={ref} maxFontSizeMultiplier={FONT_SCALE_CAP.normal} {...props} />;
});

// Inputs get the tighter ceiling: they are the fixed-height boxes that clip
// first, and a caret that has left its own field is worse than small text.
export const TextInput = React.forwardRef(function TextInput(props, ref) {
  return <RNTextInput ref={ref} maxFontSizeMultiplier={FONT_SCALE_CAP.tight} {...props} />;
});

export default Text;
