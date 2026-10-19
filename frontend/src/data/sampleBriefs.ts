export interface SampleBrief {
  title: string;
  projectName: string;
  clientName: string;
  hourlyRate: number;
  brief: string;
}

export const SAMPLE_BRIEFS: SampleBrief[] = [
  {
    title: 'Fintech Mobile MVP',
    projectName: 'AeroPay Consumer App',
    clientName: 'Aero Financial Inc.',
    hourlyRate: 140,
    brief: `We need a high-performance consumer mobile app (iOS and Android) for our modern debit card product.
Key features required:
- Biometric authentication (FaceID / TouchID) with JWT refresh rotation.
- Plaid Link account linking so customers can connect their external bank accounts.
- Transaction history screen with category icons, search filter, and monthly spending bar chart.
- Push notifications via Firebase for real-time card swipe alerts.
- Offline support so cached balances and recent transactions display without internet.

Notes from client call:
- We will supply all Figma mobile screen designs and brand guidelines.
- Our backend engineering team will provide the REST API endpoints and documentation.
- We expect this MVP delivered within 6 weeks.`
  },
  {
    title: 'Headless E-Commerce Store',
    projectName: 'Verdant Botanical Storefront',
    clientName: 'Verdant Organics LLC',
    hourlyRate: 125,
    brief: `Looking to rebuild our Shopify store into a fast, headless Next.js/React storefront with custom branding.
Deliverables:
- Product catalog with faceted filtering by plant light requirement, pot size, and pet friendliness.
- Custom interactive Plant Care Quiz that recommends products based on user answers.
- Seamless Shopify Storefront GraphQL integration for cart and checkout redirection.
- Klaviyo newsletter signup and abandon cart webhook integration.
- Responsive mobile-first design targeting 95+ Google PageSpeed score.

Assumptions & boundaries:
- Client handles all product photography and copywriting.
- Shopify Plus subscription already active.
- Multi-currency / international shipping is out of scope for phase 1.`
  },
  {
    title: 'AI Workflow Automation',
    projectName: 'OmniFlow Document Processor',
    clientName: 'Corvus Logistics',
    hourlyRate: 150,
    brief: `We receive hundreds of PDF freight invoices and shipping manifests daily and need an automated extraction portal.
Requirements:
- Web dashboard where operations team can drag-and-drop batches of PDF freight manifests.
- Local OCR extraction pipeline to pull bill-of-lading numbers, weights, sender addresses, and line-item freight charges.
- Side-by-side verification viewer allowing human operators to quickly validate low-confidence fields before approval.
- Webhook exporter that sends approved structured JSON directly into our internal ERP database.
- Audit log tracking operator edits and processing timestamps.`
  }
];

export const SAMPLE_CLIENT_MESSAGES: string[] = [
  "Hey! Quick thought: while you're wrapping up the transaction screen, could we also add an 'Export All Statements to PDF' button, multi-currency conversion for Euro and GBP, and a referral code sharing popup? Our marketing team says we really need this for launch next week!",
  "Can we also let users change their primary billing address directly in the app and upload a PDF copy of their utility bill for instant identity verification? Should just take an hour or two right?",
  "We decided we also want dark mode, light mode, and an automated weekly email digest sent to all active users with their spending breakdown."
];
