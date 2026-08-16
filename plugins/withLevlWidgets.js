/* eslint-disable no-param-reassign */
// ============================================================================
// LEVL — withLevlWidgets
//
// Adds the WidgetKit app extension that hosts BOTH the workout Live Activity
// (Dynamic Island + Lock Screen) and the LEVL Today home screen widget.
//
// WHY A CONFIG PLUGIN RATHER THAN EDITING XCODE BY HAND
// An app extension is a second Xcode target, and `expo prebuild` regenerates
// the ios/ directory from scratch. Anything added by hand disappears on the
// next prebuild — and on EAS Build, which always prebuilds. Expressing the
// target as a plugin means the extension exists identically on every machine
// and every CI run, with no manual Xcode steps.
//
// WHAT IT DOES
//   1. Copies the widget sources into ios/LevlWidgets/, together with the two
//      Swift files shared with the app (LevlWorkoutAttributes, LevlSharedStore).
//      Those live in modules/levl-live-activity/ios/ as the single source of
//      truth and are COPIED here, so the app and the extension can never
//      compile two different versions of the ActivityAttributes contract.
//   2. Writes the extension's entitlements (App Group) and Info.plist.
//   3. Puts the App Group on the main app too, so both processes share it.
//   4. Registers the target in project.pbxproj: group, build phases, build
//      settings, an "Embed App Extensions" phase and a target dependency.
//
// Re-running prebuild is safe: if the target already exists the plugin leaves
// the project alone.
// ============================================================================

const {
  withXcodeProject,
  withEntitlementsPlist,
  withInfoPlist,
  withDangerousMod,
} = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const TARGET_NAME = 'LevlWidgets';
const APP_GROUP = 'group.com.matteo.ascend';

// Sources that belong ONLY to the extension.
const WIDGET_SOURCES = [
  'LevlWidgetBundle.swift',
  'LevlWorkoutLiveActivity.swift',
  'LevlTodayWidget.swift',
];

// Sources shared with the app target. Canonical copies live in the
// levl-live-activity module and are duplicated into the extension at prebuild.
const SHARED_SOURCES = [
  'LevlWorkoutAttributes.swift',
  'LevlSharedStore.swift',
];

const ALL_SOURCES = [...WIDGET_SOURCES, ...SHARED_SOURCES];

const ENTITLEMENTS = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>com.apple.security.application-groups</key>
	<array>
		<string>${APP_GROUP}</string>
	</array>
</dict>
</plist>
`;

/* -------------------------------------------------------------------------
 * 1. Copy sources into ios/LevlWidgets/
 * ---------------------------------------------------------------------- */
const withWidgetSources = (config) =>
  withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const projectRoot = cfg.modRequest.projectRoot;
      const iosRoot = cfg.modRequest.platformProjectRoot;
      const destDir = path.join(iosRoot, TARGET_NAME);
      fs.mkdirSync(destDir, { recursive: true });

      const widgetSrcDir = path.join(projectRoot, 'targets', 'levl-widgets');
      const sharedSrcDir = path.join(projectRoot, 'modules', 'levl-live-activity', 'ios');

      const copy = (from, name) => {
        const src = path.join(from, name);
        if (!fs.existsSync(src)) {
          throw new Error(
            `[withLevlWidgets] Missing ${name} in ${from}. The widget extension cannot be built without it.`,
          );
        }
        fs.copyFileSync(src, path.join(destDir, name));
      };

      WIDGET_SOURCES.forEach((f) => copy(widgetSrcDir, f));
      SHARED_SOURCES.forEach((f) => copy(sharedSrcDir, f));
      copy(widgetSrcDir, 'Info.plist');

      fs.writeFileSync(path.join(destDir, `${TARGET_NAME}.entitlements`), ENTITLEMENTS);
      return cfg;
    },
  ]);

/* -------------------------------------------------------------------------
 * 2. App-side capabilities
 * ---------------------------------------------------------------------- */
const withAppGroupOnApp = (config) =>
  withEntitlementsPlist(config, (cfg) => {
    const key = 'com.apple.security.application-groups';
    const groups = new Set(cfg.modResults[key] || []);
    groups.add(APP_GROUP);
    cfg.modResults[key] = [...groups];
    return cfg;
  });

const withLiveActivitySupport = (config) =>
  withInfoPlist(config, (cfg) => {
    // Without this the app can request Live Activities all it likes and iOS
    // will refuse every one of them.
    cfg.modResults.NSSupportsLiveActivities = true;
    // Lets a running activity update without the app being foregrounded.
    cfg.modResults.NSSupportsLiveActivitiesFrequentUpdates = true;
    return cfg;
  });

/* -------------------------------------------------------------------------
 * 3. Register the target in project.pbxproj
 * ---------------------------------------------------------------------- */
const withWidgetTarget = (config) =>
  withXcodeProject(config, (cfg) => {
    const proj = cfg.modResults;

    // Prebuild is re-run constantly. Adding the target twice would produce a
    // project that fails to open, so bail out if it is already there.
    if (proj.pbxTargetByName(TARGET_NAME)) return cfg;

    const appBundleId =
      (cfg.ios && cfg.ios.bundleIdentifier) || 'com.matteo.ascend';
    const widgetBundleId = `${appBundleId}.${TARGET_NAME}`;

    // The xcode library assumes these sections exist. A single-target project
    // (which this was) has neither, and addTarget crashes without them.
    const objects = proj.hash.project.objects;
    objects.PBXTargetDependency = objects.PBXTargetDependency || {};
    objects.PBXContainerItemProxy = objects.PBXContainerItemProxy || {};

    // ---- group ----------------------------------------------------------
    const group = proj.addPbxGroup(
      [...ALL_SOURCES, 'Info.plist', `${TARGET_NAME}.entitlements`],
      TARGET_NAME,
      TARGET_NAME,
    );

    // Hang it off the project's root group (the only group with no name/path).
    const groups = objects.PBXGroup;
    Object.keys(groups).forEach((key) => {
      const g = groups[key];
      if (typeof g === 'object' && g.name === undefined && g.path === undefined) {
        proj.addToPbxGroup(group.uuid, key);
      }
    });

    // ---- target ---------------------------------------------------------
    const target = proj.addTarget(TARGET_NAME, 'app_extension', TARGET_NAME, widgetBundleId);

    proj.addBuildPhase(ALL_SOURCES, 'PBXSourcesBuildPhase', 'Sources', target.uuid);
    proj.addBuildPhase([], 'PBXResourcesBuildPhase', 'Resources', target.uuid);
    proj.addBuildPhase(
      ['SwiftUI.framework', 'WidgetKit.framework'],
      'PBXFrameworksBuildPhase',
      'Frameworks',
      target.uuid,
    );

    // ---- build settings -------------------------------------------------
    const deploymentTarget = '16.2';
    const configurations = proj.pbxXCBuildConfigurationSection();
    for (const key of Object.keys(configurations)) {
      const entry = configurations[key];
      if (!entry || typeof entry.buildSettings === 'undefined') continue;
      const bs = entry.buildSettings;
      if (bs.PRODUCT_NAME !== `"${TARGET_NAME}"`) continue;

      bs.INFOPLIST_FILE = `"${TARGET_NAME}/Info.plist"`;
      bs.CODE_SIGN_ENTITLEMENTS = `"${TARGET_NAME}/${TARGET_NAME}.entitlements"`;
      bs.PRODUCT_BUNDLE_IDENTIFIER = `"${widgetBundleId}"`;
      bs.CODE_SIGN_STYLE = 'Automatic';
      bs.SWIFT_VERSION = '5.0';
      bs.SWIFT_EMIT_LOC_STRINGS = 'YES';
      bs.TARGETED_DEVICE_FAMILY = '"1,2"';
      // 16.2 is the floor for the ActivityKit content API used by the Live
      // Activity. The APP still deploys to 15.1 — Live Activities simply do
      // not appear below 16.2, which is handled with #available in Swift.
      bs.IPHONEOS_DEPLOYMENT_TARGET = deploymentTarget;
      // Extensions must not be archived as standalone products.
      bs.SKIP_INSTALL = 'YES';
      bs.GENERATE_INFOPLIST_FILE = 'NO';
      bs.CURRENT_PROJECT_VERSION = `"${(cfg.ios && cfg.ios.buildNumber) || '1'}"`;
      bs.MARKETING_VERSION = `"${cfg.version || '1.0.0'}"`;
      bs.LD_RUNPATH_SEARCH_PATHS = '"$(inherited) @executable_path/Frameworks @executable_path/../../Frameworks"';
      bs.ASSETCATALOG_COMPILER_GENERATE_ASSET_SYMBOLS = 'NO';
    }

    // ---- embed into the app + build ordering -----------------------------
    normaliseEmbedding(proj, target);

    return cfg;
  });

/**
 * Make the app embed the extension exactly once, and depend on it exactly once.
 *
 * `addTarget` already creates a "Copy Files" phase holding the .appex and a
 * target dependency — but the xcode library decides WHICH target owns them by
 * searching build phases by name, which is not something to rely on across
 * versions. Adding our own phase on top produced a project where the same build
 * file appeared in two phases, and Xcode fails that with "multiple commands
 * produce LevlWidgets.appex".
 *
 * So rather than adding anything, this normalises what is already there:
 * one embed phase, on the app, correctly named, and one dependency.
 */
function normaliseEmbedding(proj, target) {
  const nativeTargets = proj.pbxNativeTargetSection();
  const appKey = Object.keys(nativeTargets).find((key) => {
    const t = nativeTargets[key];
    return t && typeof t === 'object' && t.productType === '"com.apple.product-type.application"';
  });
  if (!appKey) return;
  const app = nativeTargets[appKey];
  app.buildPhases = app.buildPhases || [];
  app.dependencies = app.dependencies || [];

  const copyPhases = proj.hash.project.objects.PBXCopyFilesBuildPhase || {};
  const appexPhaseKeys = Object.keys(copyPhases).filter((key) => {
    if (key.endsWith('_comment')) return false;
    const phase = copyPhases[key];
    return (
      phase &&
      typeof phase === 'object' &&
      Array.isArray(phase.files) &&
      phase.files.some((f) => f && String(f.comment || '').includes('.appex'))
    );
  });

  // Keep the first phase; drop any others entirely.
  const keep = appexPhaseKeys[0];
  appexPhaseKeys.slice(1).forEach((key) => {
    delete copyPhases[key];
    delete copyPhases[`${key}_comment`];
    app.buildPhases = app.buildPhases.filter((p) => p.value !== key);
  });

  if (keep) {
    // dstSubfolderSpec 13 is PlugIns — where app extensions must land.
    copyPhases[keep].name = '"Embed App Extensions"';
    copyPhases[keep].dstSubfolderSpec = 13;
    copyPhases[`${keep}_comment`] = 'Embed App Extensions';
    if (!app.buildPhases.some((p) => p.value === keep)) {
      app.buildPhases.push({ value: keep, comment: 'Embed App Extensions' });
    } else {
      app.buildPhases.forEach((p) => {
        if (p.value === keep) p.comment = 'Embed App Extensions';
      });
    }
  }

  // One dependency on the widget target, no more.
  const deps = proj.hash.project.objects.PBXTargetDependency || {};
  const widgetDeps = app.dependencies.filter((d) => {
    const dep = deps[d.value];
    return dep && dep.target === target.uuid;
  });
  if (widgetDeps.length > 1) {
    const [first, ...extra] = widgetDeps;
    extra.forEach((d) => {
      delete deps[d.value];
      delete deps[`${d.value}_comment`];
    });
    app.dependencies = app.dependencies.filter(
      (d) => !extra.some((e) => e.value === d.value),
    );
    void first;
  }
}

/* ---------------------------------------------------------------------- */

module.exports = function withLevlWidgets(config) {
  config = withWidgetSources(config);
  config = withAppGroupOnApp(config);
  config = withLiveActivitySupport(config);
  config = withWidgetTarget(config);
  return config;
};

module.exports.APP_GROUP = APP_GROUP;
module.exports.TARGET_NAME = TARGET_NAME;
