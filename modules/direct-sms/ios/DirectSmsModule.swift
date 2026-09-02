import ExpoModulesCore

/**
 * iOS deliberately provides no API for sending an SMS without the user
 * confirming it in the system composer — MFMessageComposeViewController always
 * requires a tap, and there is no private-free alternative.
 *
 * So this target exists only to report "unsupported" honestly, letting the JS
 * layer fall back to the composer instead of silently believing an alert went
 * out when it did not.
 */
public class DirectSmsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("DirectSms")

    Function("isSupported") { () -> Bool in
      false
    }

    Function("hasPermission") { () -> Bool in
      false
    }

    AsyncFunction("sendSms") { (_ phoneNumbers: [String], _ message: String) -> [String: Any] in
      throw Exception(
        name: "ERR_DIRECT_SMS",
        description: "iOS cannot send SMS without user confirmation."
      )
    }
  }
}
