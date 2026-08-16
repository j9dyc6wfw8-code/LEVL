require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', '..', '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'LevlLiveActivity'
  s.version        = package['version']
  s.summary        = 'ActivityKit workout Live Activity + WidgetKit snapshot for LEVL'
  s.description    = 'Starts, updates and ends the workout Live Activity, and publishes the home screen widget snapshot to the shared App Group.'
  s.author         = 'LEVL'
  s.homepage       = 'https://levl.app'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true
  s.license        = { :type => 'MIT' }

  s.dependency 'ExpoModulesCore'

  # ActivityKit and WidgetKit are weak-linked: the app's deployment target is
  # iOS 15.1, and every call into them is behind `if #available(iOS 16.2, *)`.
  # Live Activities light up on 16.2+; older devices simply never take the path.
  s.weak_frameworks = 'ActivityKit', 'WidgetKit', 'SwiftUI'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
