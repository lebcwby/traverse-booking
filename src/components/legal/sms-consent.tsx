/**
 * A2P 10DLC / TCPA consent block for any form that collects a phone number.
 *
 * Carriers (Verizon, AT&T, T-Mobile) review the whole site before approving an
 * A2P campaign, and reject on specifics. The rules this component exists to
 * satisfy, from the A2P Compliance Guide (April 2026), Steps 3 and 4:
 *
 *   · TWO separate checkboxes — notifications and marketing. Combining them
 *     into one is an explicit rejection reason.
 *   · Neither may be pre-checked.
 *   · Neither may be required. A form that cannot be submitted without ticking
 *     a consent box is rejected, even when the phone field itself is required.
 *   · Both sit next to the phone field, not at the bottom of the page.
 *   · The legal business name appears in both, and the notifications box
 *     carries a HELP number.
 *   · Privacy Policy and Terms links must be visible before submit — not
 *     behind a modal and not in small print.
 *
 * ⚠️ LEGAL_NAME must match the EIN registration exactly — punctuation,
 * capitalisation and spacing included — and must match what is submitted for
 * the A2P brand. A mismatch between the checkbox text and the registration is a
 * rejection reason.
 *
 * We trade under a DBA, so the guide's required format is
 * "[Legal Business Name] DBA [Trade Name]". The same DBA line also has to be
 * visible somewhere on the site outside the form — it is in the footers of the
 * main site and of both landing pages. "DBA name is used but not explained
 * anywhere on the website" is its own rejection reason.
 */
export const LEGAL_NAME = "HALTAN LLC dba Traverse Hospitality";

/** Used for the "Text HELP to …" instruction. B2B line, since these are owner forms. */
export const SMS_HELP_NUMBER = "(970) 533-3583";

export function SmsConsent({ id }: { id: string }) {
  return (
    <div className="audit-sms">
      <label className="audit-consent">
        {/* No `required`, no `defaultChecked` — both are rejection reasons. */}
        <input type="checkbox" name="smsNotifications" />
        <span>
          I consent to receive SMS Notifications and Alerts from {LEGAL_NAME}.
          Message frequency varies. Message &amp; data rates may apply. Text
          HELP to {SMS_HELP_NUMBER} for assistance. Reply STOP to unsubscribe at
          any time.
        </span>
      </label>

      <label className="audit-consent">
        <input type="checkbox" name="smsMarketing" />
        <span>
          By checking this box, I agree to receive occasional marketing messages
          from {LEGAL_NAME}. Message frequency varies. Message &amp; data rates
          may apply. Text HELP for assistance. Reply STOP to unsubscribe at any
          time.
        </span>
      </label>

      <p className="audit-legal-links" id={`${id}-legal`}>
        Optional — you can submit this form without either box. See our{" "}
        <a
          href="https://www.booktraverse.com/privacy"
          target="_blank"
          rel="noopener noreferrer"
        >
          Privacy Policy
        </a>{" "}
        and{" "}
        <a
          href="https://www.booktraverse.com/terms"
          target="_blank"
          rel="noopener noreferrer"
        >
          Terms &amp; Conditions
        </a>
        .
      </p>
    </div>
  );
}
