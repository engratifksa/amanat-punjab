# Project Rules: Amanat (امانت) — Transparent Zakat, Welfare & Crowdfunding PWA

## 1. Brand Identity & Core Mission
- **App Name:** Amanat (امانت) — *"Sacred Trust. Direct Impact."*
- **Mission:** A zero-cost Progressive Web App (PWA) connecting overseas and local donors, accredited Field Verifiers, direct vendors, and deserving families in Punjab, Pakistan.
- **Visual Aesthetic:** Deep Emerald (`#064E3B` / `#059669`), Warm Gold (`#D97706` / `#F59E0B`), and glassmorphic alabaster cards conveying dignity, Islamic stewardship, and financial transparency.

## 2. Strict Zero-Cost Technical Stack
- **NO PAID SERVICES:** Do NOT introduce paid APIs, paid SaaS SDKs, paid map tiles, or paid SMS/OTP gateways. Use exclusively open-source libraries and free-tier Supabase/Vercel infrastructure.
- **Core Stack:** Vite + React 18 + TypeScript + `vite-plugin-pwa` (Workbox offline caching + install manifest).
- **Offline Storage & Compression:** `dexie` (IndexedDB for offline Field Verifier inspection queues & local demo seed mode) + `browser-image-compression` (client-side compression before storage upload).
- **3D & Motion:** `three`, `@react-three/fiber`, `@react-three/drei`, `framer-motion`, `react-parallax-tilt`, `canvas-confetti`.
- **UI & Localization:** Tailwind CSS + `shadcn/ui` + `lucide-react` + `i18next` / `react-i18next` (English `ltr` and Urdu `rtl` with instant `document.documentElement.dir` switching and Nastaliq-friendly line heights).
- **Client-Side Receipts:** `jspdf` + `qrcode.react` (generate PDF donation certificates and QR vendor vouchers locally in the browser).
- **Backend:** Supabase Free Tier (PostgreSQL, Auth, Storage, Row-Level Security) with seamless local `dexie` + seed-data fallback when Supabase keys are not set.

## 3. Anti-Fraud, Dignity & Vendor Escrow Guardrails
- **4 User Roles:** `donor`, `beneficiary`, `verifier` (Accredited Field Verifier), `admin` (Verification Board).
- **Zero-Exposure Privacy:** Public case and campaign cards MUST NEVER expose beneficiary full names, CNIC numbers, phone numbers, or street addresses. Display only anonymized Case/Campaign IDs (`AMN-KSR-001`, `AMN-CF-01`), District/Tehsil, category, Zakat-eligibility badge, and verified cost breakdown.
- **Mandatory Field Verification:** No individual case appears in the public feed until a `verifier` uploads ground-visit evidence and an `admin` approves it (`status = 'approved'`).
- **Direct Vendor Escrow:** Funds are NEVER disbursed as raw cash to applicants. Every individual case and crowdfunding campaign links to a named vendor/institution (hospital, pharmacy, school, ration store, wedding essentials vendor) with an uploaded pro-forma invoice/estimate and closes with an uploaded paid vendor receipt.

## 4. Multi-Campaign Crowdfunding Engine Rules
- **Multiple Simultaneous Drives:** Admins can create, edit, pause, and publish multiple active crowdfunding campaigns concurrently (e.g., collective daughters' marriage drives, hospital equipment funds, district ration drives).
- **Dual-Layer Target & Collected Progress Bars:** Every crowdfunding card must display:
  - Target Amount (`target_amount_pkr`)
  - Confirmed Collected Amount (`collected_amount_pkr` — solid emerald fill)
  - Pledged / Pending Verification Amount (`pledged_amount_pkr` — secondary gold fill segment)
  - Percentage funded, contributor count, countdown/deadline, and Zakat-eligibility tag.
- **Auto-Milestone Lock:** When `collected_amount_pkr >= target_amount_pkr`, the campaign automatically transitions to `fully_funded` and locks new contributions unless the admin raises the target.

## 5. 3D UI & Low-Bandwidth Mobile Performance
- Lazy-load (`React.lazy` + `Suspense`) all `@react-three/fiber` WebGL canvases.
- Detect low-end devices or `navigator.connection?.saveData === true` and gracefully fall back from WebGL 3D scenes to lightweight CSS/Framer-Motion 3D tilt cards (`react-parallax-tilt`).
- Include a sticky mobile bottom navigation bar for one-hand thumb operation in the field.