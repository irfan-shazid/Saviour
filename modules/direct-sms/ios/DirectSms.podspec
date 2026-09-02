Pod::Spec.new do |s|
  s.name           = 'DirectSms'
  s.version        = '1.0.0'
  s.summary        = 'Direct SMS sending (Android only; iOS reports unsupported).'
  s.description    = 'iOS provides no API for sending SMS without user confirmation, so this target exists only to report that cleanly to JS.'
  s.author         = ''
  s.homepage       = 'https://github.com/irfan-shazid/Saviour'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
