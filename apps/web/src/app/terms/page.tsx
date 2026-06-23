import type { Metadata } from "next";

import { LegalLayout } from "@/components/legal/legal-layout";

export const metadata: Metadata = {
  title: "Terms of Service · ZenBuild",
  description:
    "Terms of Service for ZenBuild — the AI-assisted product delivery platform.",
};

export default function TermsPage() {
  return (
    <LegalLayout
      eyebrow="Legal"
      title="Terms of Service"
      alternate={{ href: "/privacy", label: "Privacy Policy" }}
    >
      <p>
        These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and use of ZenBuild
        (&ldquo;ZenBuild,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;), an
        AI-assisted product delivery platform that helps teams move features from request to
        release. By creating an account, signing in, or otherwise using the service, you agree
        to these Terms. If you do not agree, do not use ZenBuild.
      </p>

      <h2>1. Eligibility and accounts</h2>
      <p>
        You must be at least 16 years old and able to form a binding contract to use ZenBuild.
        You are responsible for the accuracy of registration information and for maintaining the
        confidentiality of your credentials. Notify us promptly if you suspect unauthorized access
        to your account.
      </p>
      <p>
        If you use ZenBuild on behalf of an organization, you represent that you have authority
        to bind that organization to these Terms. Workspace owners and admins are responsible
        for managing members, invitations, and billing for their organization.
      </p>

      <h2>2. The service</h2>
      <p>
        ZenBuild provides tools for feature intake, product discovery, PRD authoring, task
        planning, GitHub integration, AI-assisted code review, workflow automation, and related
        collaboration features. We may add, change, or discontinue features at any time. Beta or
        preview features may be offered &ldquo;as is&rdquo; and may be modified or withdrawn
        without notice.
      </p>
      <p>
        AI-generated outputs (including PRDs, tasks, reviews, and suggested code changes) are
        assistive and may be inaccurate or incomplete. You are responsible for reviewing,
        validating, and approving all outputs before relying on them in production.
      </p>

      <h2>3. Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Violate applicable laws or third-party rights.</li>
        <li>
          Upload, connect, or process content you do not have the right to use, including
          proprietary source code or personal data without proper authorization.
        </li>
        <li>
          Attempt to probe, scan, or test the vulnerability of our systems, or circumvent access
          controls, rate limits, or usage limits.
        </li>
        <li>
          Reverse engineer, scrape, or resell the service except as expressly permitted in
          writing.
        </li>
        <li>
          Use ZenBuild to develop competing models or services by systematically extracting
          outputs or training on our proprietary systems.
        </li>
        <li>Interfere with or disrupt the service or other users&apos; use of it.</li>
      </ul>
      <p>
        We may suspend or terminate access if we reasonably believe you have violated these Terms
        or pose a security or legal risk.
      </p>

      <h2>4. Your content and GitHub integrations</h2>
      <p>
        You retain ownership of content you submit to ZenBuild, including feature requests, PRDs,
        tasks, and connected repository metadata. You grant us a limited license to host, process,
        display, and transmit your content solely to operate, secure, and improve the service,
        including running AI workflows you initiate.
      </p>
      <p>
        When you connect a GitHub account or install our GitHub App, you authorize ZenBuild to
        access repositories and related data according to the permissions you grant. You are
        responsible for ensuring your use of GitHub integrations complies with GitHub&apos;s
        terms and your organization&apos;s policies.
      </p>

      <h2>5. Plans, billing, and credits</h2>
      <p>
        Paid plans, subscriptions, and usage-based credits (where offered) are billed according
        to the pricing shown in the product or an order form. Fees are non-refundable except where
        required by law or explicitly stated otherwise. We may change pricing with reasonable
        notice; continued use after a price change constitutes acceptance.
      </p>
      <p>
        Free tiers and promotional credits may include usage limits. We may enforce plan limits on
        repositories, seats, AI credits, and premium features.
      </p>

      <h2>6. Intellectual property</h2>
      <p>
        ZenBuild, including its software, branding, documentation, and underlying technology, is
        owned by us and our licensors and is protected by intellectual property laws. These Terms
        do not grant you any rights to our trademarks or service marks except as needed to
        describe your lawful use of the service.
      </p>

      <h2>7. Confidentiality and security</h2>
      <p>
        We implement administrative, technical, and organizational measures designed to protect
        the service and your data. No system is perfectly secure. You are responsible for
        configuring workspace access, reviewing AI outputs, and following secure development
        practices in connected repositories.
      </p>

      <h2>8. Disclaimers</h2>
      <p>
        THE SERVICE IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE.&rdquo; TO THE
        FULLEST EXTENT PERMITTED BY LAW, WE DISCLAIM ALL WARRANTIES, WHETHER EXPRESS, IMPLIED, OR
        STATUTORY, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE,
        NON-INFRINGEMENT, AND ACCURACY OF AI-GENERATED CONTENT. WE DO NOT WARRANT THAT THE SERVICE
        WILL BE UNINTERRUPTED, ERROR-FREE, OR FREE OF HARMFUL COMPONENTS.
      </p>

      <h2>9. Limitation of liability</h2>
      <p>
        TO THE FULLEST EXTENT PERMITTED BY LAW, NEITHER ZENBUILD NOR ITS AFFILIATES, OFFICERS,
        EMPLOYEES, OR SUPPLIERS WILL BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL,
        CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, DATA, GOODWILL, OR BUSINESS
        OPPORTUNITIES, ARISING FROM OR RELATED TO YOUR USE OF THE SERVICE.
      </p>
      <p>
        OUR TOTAL LIABILITY FOR ANY CLAIM ARISING OUT OF OR RELATING TO THESE TERMS OR THE SERVICE
        WILL NOT EXCEED THE GREATER OF (A) THE AMOUNTS YOU PAID US FOR THE SERVICE IN THE TWELVE
        MONTHS BEFORE THE CLAIM OR (B) ONE HUNDRED U.S. DOLLARS (USD $100).
      </p>

      <h2>10. Termination</h2>
      <p>
        You may stop using ZenBuild at any time. We may suspend or terminate your access if you
        breach these Terms, if required by law, or if we discontinue the service. Upon
        termination, your right to use the service ends. Provisions that by their nature should
        survive (including ownership, disclaimers, limitations of liability, and governing law)
        will survive.
      </p>

      <h2>11. Changes to these Terms</h2>
      <p>
        We may update these Terms from time to time. If changes are material, we will provide
        notice through the product, by email, or by updating the date at the top of this page.
        Continued use after the effective date of updated Terms constitutes acceptance.
      </p>

      <h2>12. Governing law and contact</h2>
      <p>
        These Terms are governed by the laws of India, without regard to conflict-of-law rules,
        except where mandatory consumer protection laws in your jurisdiction provide otherwise.
      </p>
      <p>
        Questions about these Terms may be directed to{" "}
        <a href="mailto:legal@zenbuild.app">legal@zenbuild.app</a>. For privacy-related requests,
        see our <a href="/privacy">Privacy Policy</a>.
      </p>
    </LegalLayout>
  );
}
