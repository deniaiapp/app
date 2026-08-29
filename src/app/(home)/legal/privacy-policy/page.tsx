import type { Metadata } from "next";
import { useExtracted } from "next-intl";
import { getExtracted } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();
  return {
    title: t("Privacy Policy"),
    description: t("How Deni AI collects, uses, and shares information."),
  };
}

export default function PrivacyPolicyPage() {
  const t = useExtracted();
  return (
    <main className="min-h-screen bg-background" id="main-content">
      <div className="mx-auto flex max-w-4xl flex-col gap-10 px-4 pb-16 pt-28 sm:px-6 lg:px-8">
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{t("Last updated: 2025-12-31")}</p>
          <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
            {t("Privacy Policy")}
          </h1>
          <p className="text-base text-muted-foreground">
            {t(
              "This Privacy Policy explains how Deni AI collects, uses, and shares information when you use the Service. By using the Service, you agree to this Policy.",
            )}
          </p>
        </div>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{t("1. Information We Collect")}</h2>
          <ul className="list-disc space-y-2 pl-6 text-muted-foreground">
            <li>
              {t(
                "Account information, such as your name, email address, and authentication provider identifiers.",
              )}
            </li>
            <li>{t("Content you submit, including prompts, messages, and files you upload.")}</li>
            <li>
              {t(
                "Usage data, such as logs, device information, IP address, and approximate location.",
              )}
            </li>
            <li>
              {t(
                "Cookies and similar technologies used for authentication, security, and analytics.",
              )}
            </li>
            <li>
              {t(
                "Payment details are handled by payment processors; we receive only limited billing information such as plan status and transaction IDs.",
              )}
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{t("2. How We Use Information")}</h2>
          <ul className="list-disc space-y-2 pl-6 text-muted-foreground">
            <li>{t("Provide, maintain, and improve the Service.")}</li>
            <li>{t("Authenticate users and secure accounts.")}</li>
            <li>{t("Monitor usage and prevent abuse or fraud.")}</li>
            <li>{t("Communicate with you about updates, support, or billing.")}</li>
            <li>{t("Comply with legal obligations.")}</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{t("3. How We Share Information")}</h2>
          <p className="text-muted-foreground">
            {t(
              "We share information with trusted service providers who help us operate the Service, such as hosting, analytics, customer support, authentication, and payment processing. We may also share information if required by law or to protect the rights and safety of Deni AI or others.",
            )}
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{t("4. Data Retention")}</h2>
          <p className="text-muted-foreground">
            {t(
              "We retain information for as long as necessary to provide the Service and for legitimate business purposes. You can request deletion of your account, subject to legal or contractual obligations.",
            )}
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{t("5. Security")}</h2>
          <p className="text-muted-foreground">
            {t(
              "We use reasonable safeguards to protect your information. No method of transmission or storage is completely secure, so we cannot guarantee absolute security.",
            )}
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{t("6. Your Choices")}</h2>
          <ul className="list-disc space-y-2 pl-6 text-muted-foreground">
            <li>{t("Access, update, or delete your account information.")}</li>
            <li>
              {t(
                "Download a copy of your account data, including chats, memories, and projects, from Account settings.",
              )}
            </li>
            <li>{t("Control cookies through your browser settings.")}</li>
            <li>{t("Opt out of marketing communications where offered.")}</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{t("7. International Transfers")}</h2>
          <p className="text-muted-foreground">
            {t(
              "Your information may be processed in countries other than your own, where data protection laws may differ. We take steps to protect your information when it is transferred.",
            )}
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{t("8. Children's Privacy")}</h2>
          <p className="text-muted-foreground">
            {t(
              "The Service is not intended for children under 13. We do not knowingly collect personal information from children under 13.",
            )}
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{t("9. Changes to This Policy")}</h2>
          <p className="text-muted-foreground">
            {t(
              "We may update this Policy from time to time. We will update the date above and, if required, provide additional notice.",
            )}
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{t("10. Contact")}</h2>
          <p className="text-muted-foreground">
            {t("If you have questions about this Policy, contact us at:")}
          </p>
          <p className="text-muted-foreground">contact@deniai.app</p>
        </section>
      </div>
    </main>
  );
}
