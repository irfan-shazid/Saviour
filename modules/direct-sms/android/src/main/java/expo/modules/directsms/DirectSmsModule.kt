package expo.modules.directsms

import android.Manifest
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.os.Build
import android.telephony.SmsManager
import androidx.core.content.ContextCompat
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise
import java.util.concurrent.atomic.AtomicInteger

/**
 * Sends SMS directly through the radio, with no composer and no user tap.
 *
 * This is the whole point of the module: an emergency alert is worthless if it
 * needs the person who just fell to pick up the phone and press send. It
 * requires the SEND_SMS runtime permission, granted from JS.
 *
 * Delivery is confirmed against the platform's sent-intent broadcast rather
 * than assumed, so the app can honestly tell the user whether the text left
 * the device or not.
 */
class DirectSmsModule : Module() {
  private val requestCounter = AtomicInteger(0)

  override fun definition() = ModuleDefinition {
    Name("DirectSms")

    Function("isSupported") { true }

    Function("hasPermission") {
      val context = appContext.reactContext ?: return@Function false
      ContextCompat.checkSelfPermission(context, Manifest.permission.SEND_SMS) ==
        PackageManager.PERMISSION_GRANTED
    }

    AsyncFunction("sendSms") { phoneNumbers: List<String>, message: String, promise: Promise ->
      val context = appContext.reactContext
        ?: return@AsyncFunction promise.reject(SmsFailure("No Android context available."))

      if (ContextCompat.checkSelfPermission(context, Manifest.permission.SEND_SMS) !=
        PackageManager.PERMISSION_GRANTED
      ) {
        return@AsyncFunction promise.reject(SmsFailure("SEND_SMS permission not granted."))
      }

      val recipients = phoneNumbers.map { it.filter { c -> c.isDigit() || c == '+' } }
        .filter { it.isNotEmpty() }
      if (recipients.isEmpty()) {
        return@AsyncFunction promise.reject(SmsFailure("No valid phone numbers."))
      }

      val smsManager = resolveSmsManager(context)
        ?: return@AsyncFunction promise.reject(SmsFailure("No SMS service on this device."))

      val action = "expo.modules.directsms.SENT.${requestCounter.incrementAndGet()}"
      // One broadcast arrives per message part, so count parts, not recipients.
      var expectedParts = 0
      val sent = AtomicInteger(0)
      val failed = AtomicInteger(0)
      var settled = false

      val receiver = object : BroadcastReceiver() {
        override fun onReceive(ctx: Context?, intent: Intent?) {
          if (resultCode == android.app.Activity.RESULT_OK) sent.incrementAndGet()
          else failed.incrementAndGet()

          if (sent.get() + failed.get() < expectedParts || settled) return
          settled = true
          runCatching { context.unregisterReceiver(this) }
          promise.resolve(
            mapOf(
              "sentParts" to sent.get(),
              "failedParts" to failed.get(),
              "recipients" to recipients.size
            )
          )
        }
      }

      val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        Context.RECEIVER_NOT_EXPORTED
      } else {
        0
      }
      ContextCompat.registerReceiver(context, receiver, IntentFilter(action), flags)

      try {
        recipients.forEach { number ->
          val parts = smsManager.divideMessage(message)
          expectedParts += parts.size
          val intents = ArrayList<PendingIntent>(parts.size)
          repeat(parts.size) { index ->
            intents.add(
              PendingIntent.getBroadcast(
                context,
                requestCounter.incrementAndGet() * 1000 + index,
                Intent(action).setPackage(context.packageName),
                PendingIntent.FLAG_ONE_SHOT or PendingIntent.FLAG_IMMUTABLE
              )
            )
          }
          smsManager.sendMultipartTextMessage(number, null, parts, intents, null)
        }
      } catch (e: Exception) {
        if (!settled) {
          settled = true
          runCatching { context.unregisterReceiver(receiver) }
          promise.reject(SmsFailure(e.message ?: "Failed to hand the message to the radio."))
        }
      }
    }
  }

  private fun resolveSmsManager(context: Context): SmsManager? = runCatching {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      context.getSystemService(SmsManager::class.java)
    } else {
      @Suppress("DEPRECATION")
      SmsManager.getDefault()
    }
  }.getOrNull()
}

class SmsFailure(message: String) : CodedException("ERR_DIRECT_SMS", message, null)
