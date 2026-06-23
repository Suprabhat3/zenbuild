import type { Metadata } from "next";

import { LegalLayout } from "@/components/legal/legal-layout";

export const metadata: Metadata = {
  title: "Privacy Policy · ZenBuild",
  description:
    "Privacy Policy for ZenBuild — how we collect, use, and protect your information.",
};

export default function PrivacyPage() {
  return (
    <LegalLayout
      eyebrow="Legal"
      title="Privacy Policy"
      alternate={{ href: "/terms", label: "Terms of Service" }}
    >
      <p>
        This Privacy Policy explains how ZenBuild (&ldquo;ZenBuild,&rdquo; &ldquo;we,&rdquo;
        &ldquo;us,&rdquo; or &ldquo;our&rdquo;) collects, uses, shares, and protects information
        when you use our website, application, and related services (collectively, the
        &ldquo;Service&rdquo;). By using ZenBuild, you acknowledge the practices described
        here. Please also read our <a href="/terms">Terms of Service</a>.
      </p>

      <h2>1. Information we collect</h2>

      <h3>Account and profile information</h3>
      <p>
        When you register or sign in, we collect information such as your name, email address,
        profile image (if provided by an OAuth provider), and authentication identifiers. If you
        sign in with Google or GitHub, we receive basic profile details permitted by your provider
        settings.
      </p>

      <h3>Workspace and product data</h3>
      <p>
        We process content you and your teammates submit to ZenBuild, including organization and
        project names, feature requests, PRDs, tasks, comments, workflow status, billing plan
        selections, and audit events related to workspace activity.
      </p>

      <h3>GitHub and integration data</h3>
      <p>
        If you connect GitHub, we may receive repository metadata, pull requests, diffs, review
        comments, installation identifiers, and webhook events needed to provide development and
        review features. We access only the data authorized by the permissions you grant.
      </p>

      <h3>Usage, device, and log data</h3>
      <p>
        We automatically collect technical information such as IP address, browser type, device
        identifiers, pages viewed, timestamps, and diagnostic logs. We use this data to secure the
        Service, troubleshoot issues, understand usage, and improve performance.
      </p>

      <h3>Payment information</h3>
      <p>
        Paid subscriptions are processed by our payment provider (e.g., Razorpay). We receive
        billing status, plan tier, and transaction references, but we do not store full payment
        card numbers on our servers.
      </p>

      <h2>2. How we use information</h2>
      <p>We use collected information to:</p>
      <ul>
        <li>Provide, maintain, and improve the Service.</li>
        <li>Authenticate users, manage sessions, and enforce workspace access controls.</li>
        <li>
          Send transactional messages such as verification codes, invitations, security alerts,
          and service announcements.
        </li>
        <li>
          Run AI-assisted workflows you request, including clarification, PRD generation, task
          planning, code review, and release readiness analysis.
        </li>
        <li>Process subscriptions, enforce plan limits, and manage credits.</li>
        <li>Detect, prevent, and respond to fraud, abuse, and security incidents.</li>
        <li>Comply with legal obligations and enforce our Terms.</li>
      </ul>

      <h2>3. AI processing</h2>
      <p>
        When you invoke AI features, relevant portions of your workspace content (such as feature
        descriptions, PRDs, tasks, and code diffs) may be transmitted to AI model providers to
        generate outputs. We configure providers to process data for inference purposes and do not
        use your private workspace content to train public models without your consent. AI outputs
        may be stored in your workspace so you can review and edit them.
      </p>

      <h2>4. How we share information</h2>
      <p>We do not sell your personal information. We may share information:</p>
      <ul>
        <li>
          <strong>With your workspace members</strong> — content you submit is visible to others
          in your organization according to role and product settings.
        </li>
        <li>
          <strong>With service providers</strong> — such as hosting (e.g., Vercel), database
          (e.g., Neon), email delivery (e.g., Resend), analytics, error monitoring, payment
          processing, AI inference, and background job infrastructure (e.g., Inngest), under
          contracts that limit their use of data.
        </li>
        <li>
          <strong>With GitHub</strong> — when you connect repositories or post review comments via
          our GitHub App, as directed by your actions.
        </li>
        <li>
          <strong>For legal reasons</strong> — if required by law, regulation, legal process, or
          to protect rights, safety, and security.
        </li>
        <li>
          <strong>In a business transfer</strong> — if we are involved in a merger, acquisition,
          or asset sale, subject to continued protection of your information.
        </li>
      </ul>

      <h2>5. Cookies and similar technologies</h2>
      <p>
        We use cookies and similar technologies to keep you signed in, remember workspace
        preferences, protect against cross-site request forgery, and measure product usage. You
        can control cookies through your browser settings, but disabling essential cookies may
        prevent you from using authenticated features.
      </p>

      <h2>6. Data retention</h2>
      <p>
        We retain information for as long as your account is active or as needed to provide the
        Service, comply with legal obligations, resolve disputes, and enforce agreements. When you
        delete content or close an account, we delete or anonymize data within a reasonable period,
        except where retention is required by law or legitimate business needs (such as security
        logs and billing records).
      </p>

      <h2>7. Security</h2>
      <p>
        We use industry-standard safeguards including encryption in transit, access controls,
        org-scoped authorization, and monitoring. No method of transmission or storage is 100%
        secure. You are responsible for safeguarding credentials and reviewing who has access to
        your workspaces and connected repositories.
      </p>

      <h2>8. International transfers</h2>
      <p>
        We may process and store information in countries other than where you live. Where
        required, we implement appropriate safeguards for cross-border transfers consistent with
        applicable law.
      </p>

      <h2>9. Your rights and choices</h2>
      <p>Depending on your location, you may have the right to:</p>
      <ul>
        <li>Access, correct, or delete personal information we hold about you.</li>
        <li>Object to or restrict certain processing activities.</li>
        <li>Export workspace data you control.</li>
        <li>Withdraw consent where processing is based on consent.</li>
        <li>Lodge a complaint with a supervisory authority.</li>
      </ul>
      <p>
        To exercise these rights, contact{" "}
        <a href="mailto:privacy@zenbuild.app">privacy@zenbuild.app</a>. We may need to verify
        your identity before fulfilling a request.
      </p>

      <h2>10. Children</h2>
      <p>
        ZenBuild is not directed to children under 16, and we do not knowingly collect personal
        information from them. If you believe a child has provided us information, contact us and
        we will take appropriate steps to delete it.
      </p>

      <h2>11. Changes to this policy</h2>
      <p>
        We may update this Privacy Policy from time to time. Material changes will be communicated
        through the Service or by email. The &ldquo;Last updated&rdquo; date at the top indicates
        when this policy was last revised.
      </p>

      <h2>12. Contact us</h2>
      <p>
        For privacy questions or requests, email{" "}
        <a href="mailto:privacy@zenbuild.app">privacy@zenbuild.app</a>.
      </p>
    </LegalLayout>
  );
}
