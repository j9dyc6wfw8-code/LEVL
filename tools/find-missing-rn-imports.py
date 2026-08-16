#!/usr/bin/env python3
"""
ASCEND — missing react-native import auditor.

Runtime crashes like "Property 'Pressable' doesn't exist" pass `tsc` and only
blow up on device. This scans your source for RN components/APIs that are USED
but not imported from 'react-native' (or anywhere), and prints file:line.

Usage:
    python3 find-missing-rn-imports.py /path/to/your/project/src
    (defaults to ./src, ./app, and . if none given)
"""

import os
import re
import sys

# Common react-native exports people forget to import.
RN_NAMES = [
    "View", "Text", "TextInput", "Pressable", "TouchableOpacity",
    "TouchableHighlight", "TouchableWithoutFeedback", "ScrollView", "FlatList",
    "SectionList", "Modal", "Image", "ImageBackground", "ActivityIndicator",
    "Switch", "Button", "SafeAreaView", "KeyboardAvoidingView", "RefreshControl",
    "StyleSheet", "Platform", "Dimensions", "Alert", "Linking", "Animated",
    "Keyboard", "StatusBar", "AppState", "PanResponder", "Vibration",
]

SKIP_DIRS = {"node_modules", ".git", "ios", "android", ".expo", "build", "dist"}
EXTS = (".js", ".jsx", ".ts", ".tsx")


def imported_names(src):
    """Every identifier brought in by any import in the file."""
    names = set()
    # import { A, B as C } from '...'
    for block in re.findall(r"import\s*\{([^}]*)\}\s*from", src):
        for part in block.split(","):
            part = part.strip()
            if not part:
                continue
            names.add(part.split(" as ")[-1].strip())
    # import Foo from '...'   /   import Foo, { ... } from '...'
    for m in re.finditer(r"import\s+([A-Za-z_$][\w$]*)\s*(?:,|\s+from)", src):
        names.add(m.group(1))
    # import * as NS from '...'
    for m in re.finditer(r"import\s+\*\s+as\s+([A-Za-z_$][\w$]*)", src):
        names.add(m.group(1))
    return names


def scan_file(path):
    hits = []
    try:
        with open(path, "r", encoding="utf-8") as f:
            src = f.read()
    except Exception:
        return hits

    have = imported_names(src)
    lines = src.splitlines()
    for name in RN_NAMES:
        if name in have:
            continue
        # Used as a JSX tag <Name  or  <Name>  or as Name.method / Name(
        used = re.search(rf"<{name}[\s/>]", src) or \
               re.search(rf"\b{name}\.", src) or \
               re.search(rf"\b{name}\(", src)
        if not used:
            continue
        for i, line in enumerate(lines, 1):
            if re.search(rf"<{name}[\s/>]", line) or re.search(rf"\b{name}[.(]", line):
                hits.append((path, i, name, line.strip()[:80]))
                break
    return hits


def main():
    roots = sys.argv[1:] or ["src", "app", "."]
    roots = [r for r in roots if os.path.exists(r)] or ["."]
    seen = set()
    total = 0
    for root in roots:
        for dirpath, dirnames, filenames in os.walk(root):
            dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
            for fn in filenames:
                if not fn.endswith(EXTS):
                    continue
                p = os.path.join(dirpath, fn)
                if p in seen:
                    continue
                seen.add(p)
                for path, ln, name, snippet in scan_file(p):
                    total += 1
                    print(f"{path}:{ln}  MISSING import '{name}'  ->  {snippet}")
    print(f"\n{total} potential missing import(s) found.")
    if total:
        print("Fix each by adding the name to the react-native import in that file.")


if __name__ == "__main__":
    main()
