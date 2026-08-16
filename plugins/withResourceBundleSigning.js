/* eslint-disable no-param-reassign */
// ============================================================================
// LEVL — withResourceBundleSigning
//
// Fixes the EAS build failure:
//
//   "Starting from Xcode 14, resource bundles are signed by default, which
//    requires setting the development team for each resource bundle target."
//
// WHAT IS ACTUALLY GOING ON
// CocoaPods generates a separate target for every pod that ships resources —
// this project has ~145 of them, mostly the privacy-manifest bundles Apple now
// requires. Since Xcode 14 those bundles are code-signed by default, and each
// signing target wants a DEVELOPMENT_TEAM. On a local build with
// CODE_SIGNING_ALLOWED=NO nothing notices, which is why this only appeared on
// EAS, where signing is real.
//
// Resource bundles do not need to be signed independently: they are copied
// inside the .app, and the app itself is signed as a unit. So the correct fix
// is to turn signing off for those targets specifically — not to weaken signing
// on the app, and not to pin an older Xcode image, which would eventually stop
// being available.
//
// This has to be a plugin rather than a hand edit because `expo prebuild`
// regenerates the Podfile from scratch on every build, including on EAS.
// ============================================================================

const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const MARKER = '# LEVL: resource bundle signing';

const SNIPPET = `
    ${MARKER}
    # Resource bundles are copied into the app and signed with it, so signing
    # them individually is unnecessary — and since Xcode 14 it fails the build
    # unless every one has a development team. Turning it off for these targets
    # only; the app's own signing is untouched.
    installer.target_installation_results.pod_target_installation_results.each do |_name, result|
      result.resource_bundle_targets.each do |bundle_target|
        bundle_target.build_configurations.each do |config|
          config.build_settings['CODE_SIGNING_ALLOWED'] = 'NO'
          config.build_settings['CODE_SIGNING_REQUIRED'] = 'NO'
          config.build_settings['CODE_SIGN_IDENTITY'] = ''
          config.build_settings['EXPANDED_CODE_SIGN_IDENTITY'] = ''
        end
      end
    end
`;

module.exports = function withResourceBundleSigning(config) {
  return withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const podfilePath = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      if (!fs.existsSync(podfilePath)) return cfg;

      let contents = fs.readFileSync(podfilePath, 'utf8');
      if (contents.includes(MARKER)) return cfg;   // prebuild re-runs; stay idempotent

      // Inject INTO the existing post_install block — a Podfile may only have
      // one, so appending a second would be silently ignored by CocoaPods.
      const anchor = 'post_install do |installer|';
      const at = contents.indexOf(anchor);
      if (at === -1) {
        throw new Error(
          '[withResourceBundleSigning] No post_install block found in the Podfile. '
          + 'The Expo template changed shape — this plugin needs updating rather than '
          + 'silently doing nothing.',
        );
      }
      const insertAt = at + anchor.length;
      contents = contents.slice(0, insertAt) + '\n' + SNIPPET + contents.slice(insertAt);

      fs.writeFileSync(podfilePath, contents);
      return cfg;
    },
  ]);
};
