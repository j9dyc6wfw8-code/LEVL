require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', '..', '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'LevlHealth'
  s.version        = package['version']
  s.summary        = 'Apple Health context for LEVL'
  s.description    = 'Reads daily activity for display, and writes completed LEVL workouts to Health. Never feeds XP, stats or rank.'
  s.author         = 'LEVL'
  s.homepage       = 'https://levl.app'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true
  s.license        = { :type => 'MIT' }

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'HealthKit'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
