// Must come first: it stops the wipe before any connection is opened.
import "./guard";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../lib/password";
import { approvePayout, markPaid } from "../lib/payouts";
import { shiftMonth } from "../lib/performance";

const db = new PrismaClient();

function monthKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * N days from today's LOCAL calendar date, pinned to midday UTC — the same way
 * the app stores a date the user types into a date field.
 */
function daysFromNow(n: number) {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() + n, 12));
}

/** Every demo account signs in with this password. Local development only. */
const DEMO_PASSWORD = "demo1234";

// Pay: per_task earns rate per delivery, salary earns a fixed monthly amount,
// hybrid earns both. Whole rupees.
const MEMBERS = [
  {
    name: "Darun Kumar",
    email: "ceo@demo.test",
    role: "ceo",
    payType: "salary",
    rate: 0,
    salary: 0,
  },
  {
    name: "Anitha Raj",
    email: "manager@demo.test",
    role: "manager",
    payType: "salary",
    rate: 0,
    salary: 45000,
  },
  {
    name: "Vikram Sundar",
    email: "writer@demo.test",
    role: "scriptwriter",
    payType: "per_task",
    rate: 400,
    salary: 0,
  },
  {
    name: "Divya Menon",
    email: "writer2@demo.test",
    role: "scriptwriter",
    payType: "hybrid",
    rate: 250,
    salary: 12000,
  },
  {
    name: "Rahul Pillai",
    email: "camera@demo.test",
    role: "cameraman",
    payType: "per_task",
    rate: 1500,
    salary: 0,
  },
  {
    name: "Sana Qureshi",
    email: "camera2@demo.test",
    role: "cameraman",
    payType: "hybrid",
    rate: 800,
    salary: 15000,
  },
  {
    name: "Joel Thomas",
    email: "editor@demo.test",
    role: "editor",
    payType: "per_task",
    rate: 500,
    salary: 0,
  },
  {
    name: "Neha Bhatt",
    email: "editor2@demo.test",
    role: "editor",
    payType: "hybrid",
    rate: 300,
    salary: 12000,
  },
  {
    name: "Farid Ali",
    email: "posting@demo.test",
    role: "publisher",
    payType: "salary",
    rate: 0,
    salary: 25000,
  },
];

const CLIENTS = [
  {
    name: "ABC Restaurant",
    industry: "Food & Beverage",
    accent: "amber",
    status: "active",
    monthlyTarget: 12,
    retainer: 45000,
    services: "Reels, Shoots, Post design",
    contactName: "Priya Nair",
    contactEmail: "priya@abcrestaurant.in",
    contactPhone: "+91 98765 43210",
    notes: "Warm, food-forward tone. Never show the kitchen back area.",
    ideas: [
      "Restaurant introduction",
      "Signature dish reel",
      "Behind the scenes",
      "Customer reaction",
      "Chef interview",
      "Weekend offer",
      "How the biryani is layered",
      "Trending audio reel",
      "New menu showcase",
      "Regular customer testimonial",
      "Late night kitchen tour",
      "Festival special",
    ],
    published: 5,
  },
  {
    name: "Glow Skin Clinic",
    industry: "Healthcare",
    accent: "rose",
    status: "active",
    monthlyTarget: 8,
    retainer: 35000,
    services: "Reels, Ads",
    contactName: "Dr. Meera",
    contactEmail: "hello@glowskin.co",
    contactPhone: "+91 90000 11223",
    notes: "All medical claims need doctor sign-off before posting.",
    ideas: [
      "Myth vs fact: sunscreen",
      "Patient before and after",
      "Meet the dermatologist",
      "Three skincare mistakes",
      "Treatment walkthrough",
      "Monsoon skin routine",
      "Clinic tour",
      "FAQ rapid fire",
    ],
    published: 3,
  },
  {
    name: "Urban Threads",
    industry: "Fashion Retail",
    accent: "violet",
    status: "active",
    monthlyTarget: 16,
    retainer: 60000,
    services: "Reels, Shoots, Influencer, Ads",
    contactName: "Karan Mehta",
    contactEmail: "karan@urbanthreads.com",
    ideas: [
      "New drop teaser",
      "Styling one shirt five ways",
      "Store walkthrough",
      "Fabric close up",
      "Customer haul",
      "Founder story",
      "Sale announcement",
      "Behind the photoshoot",
      "Festive lookbook",
      "Size guide explainer",
      "Packaging unboxing",
      "Street style challenge",
      "Model casting day",
      "Restock alert",
    ],
    published: 9,
  },
  {
    name: "Peak Fitness Studio",
    industry: "Fitness",
    accent: "emerald",
    status: "active",
    monthlyTarget: 10,
    retainer: 28000,
    services: "Reels, Shoots",
    contactName: "Arjun R",
    contactPhone: "+91 99887 66554",
    ideas: [
      "Member transformation",
      "Trainer form check",
      "5am class energy",
      "Equipment tour",
      "Three beginner mistakes",
      "Protein myth busted",
      "Weekend bootcamp recap",
      "New batch announcement",
      "Coach introduction",
    ],
    published: 6,
  },
  {
    name: "Nimbus Tech",
    industry: "SaaS",
    accent: "blue",
    status: "paused",
    monthlyTarget: 6,
    retainer: 50000,
    services: "Explainers, Ads",
    contactName: "Sneha Iyer",
    contactEmail: "sneha@nimbus.dev",
    notes: "Paused while they rebrand. Resuming next quarter.",
    ideas: ["Product explainer v2", "Customer success story"],
    published: 1,
  },
  {
    name: "Coastal Cafe",
    industry: "Food & Beverage",
    accent: "cyan",
    status: "archived",
    monthlyTarget: 0,
    retainer: 0,
    services: "Reels",
    ideas: [],
    published: 0,
  },
];

const STAGES = [
  "planned",
  "scripting",
  "script_review",
  "shooting",
  "footage_review",
  "editing",
  "edit_review",
  "ready",
  "published",
];

// How unpublished items are spread across the pipeline.
const FLOW = [
  "planned",
  "scripting",
  "script_review",
  "shooting",
  "footage_review",
  "editing",
  "edit_review",
  "ready",
  "scripting",
  "shooting",
];

/** Roughly how many days into its cycle a video in each stage would be. */
const DAYS_IN: Record<string, number> = {
  planned: -3, // cycle starts next week
  scripting: 2,
  script_review: 4,
  shooting: 9,
  footage_review: 12,
  editing: 16,
  edit_review: 21,
  ready: 24,
  published: 30,
};

// Offsets match lib/schedule.ts: Thu wk1, Fri wk1, Fri wk2, Fri wk3, Tue wk4, Fri wk4.
const STEP_OFFSETS = {
  scriptDue: 3,
  scriptApprovalDue: 4,
  shootDue: 11,
  editDue: 18,
  finalApprovalDue: 22,
  publishDue: 25,
};

const SCRIPT_SAMPLE = `HOOK
You have been eating this wrong for years.

BODY
Chef plates the signature dish and calls out the two ingredients nobody expects.
Cut to the first bite reaction.

CTA
Save this for your next visit.`;

function addDays(d: Date, n: number) {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() + n);
  return out;
}

async function main() {
  await db.session.deleteMany();
  await db.payout.deleteMany();
  await db.contentEvent.deleteMany();
  await db.contentItem.deleteMany();
  await db.client.deleteMany();
  await db.member.deleteMany();
  await db.agency.deleteMany();

  const agency = await db.agency.create({
    data: { name: "Frame & Focus Media", slug: "frame-and-focus" },
  });

  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const members = await Promise.all(
    MEMBERS.map((m) => db.member.create({ data: { ...m, passwordHash, agencyId: agency.id } })),
  );

  const pick = (role: string, i: number) => {
    const pool = members.filter((m) => m.role === role);
    return pool.length ? pool[i % pool.length].id : null;
  };

  const key = monthKey();
  let ref = 1;

  for (const c of CLIENTS) {
    const { ideas, published, ...data } = c;
    const client = await db.client.create({ data: { ...data, agencyId: agency.id } });

    for (let i = 0; i < ideas.length; i++) {
      const stage = i < published ? "published" : FLOW[(i - published) % FLOW.length];
      const reached = (s: string) => STAGES.indexOf(stage) > STAGES.indexOf(s);

      // Cycle start chosen so the video is about where it should be, with a
      // little drift either way — some ahead, some running late.
      const drift = (i % 3) - 1; // -1, 0, +1
      const cycleStart = daysFromNow(-(DAYS_IN[stage] + drift * 2));

      const due = Object.fromEntries(
        Object.entries(STEP_OFFSETS).map(([k, off]) => [k, addDays(cycleStart, off)]),
      ) as Record<keyof typeof STEP_OFFSETS, Date>;

      // Most steps land on their deadline; a realistic few run 1–3 days late,
      // so team profiles have delays worth looking at.
      const LATE_BY = [0, 0, 2, 0, 1, 0, 0, 3, 0, 1, 0];
      const stepKeys = Object.keys(STEP_OFFSETS);
      const doneAt = (step: keyof typeof STEP_OFFSETS, passed: boolean) =>
        passed
          ? // never later than now: a step can't have been finished in the future
            new Date(
              Math.min(
                addDays(
                  due[step],
                  LATE_BY[(i * 3 + stepKeys.indexOf(step)) % LATE_BY.length],
                ).getTime(),
                Date.now(),
              ),
            )
          : null;

      const item = await db.contentItem.create({
        data: {
          agencyId: agency.id,
          clientId: client.id,
          ref: ref++,
          title: ideas[i],
          idea: i % 3 === 0 ? "Shot vertically, captions burned in, under 30 seconds." : null,
          format: i % 7 === 0 ? "ad" : "reel",
          priority: i % 6 === 0 ? "high" : "normal",
          stage,
          monthKey: key,

          cycleStart,
          ...due,
          dueDate: due.publishDue,

          scriptwriterId: stage === "planned" ? null : pick("scriptwriter", i),
          cameramanId: reached("script_review") ? pick("cameraman", i) : null,
          editorId: reached("footage_review") ? pick("editor", i) : null,
          publisherId: reached("edit_review") ? pick("publisher", i) : null,

          scriptBody: reached("scripting") || stage === "scripting" ? SCRIPT_SAMPLE : null,
          scriptSubmittedAt: doneAt("scriptDue", reached("scripting")),
          scriptApprovedAt: doneAt("scriptApprovalDue", reached("script_review")),

          shootDate: reached("script_review") ? addDays(cycleStart, 9) : null,
          shootLocation: reached("script_review") ? "On site" : null,
          shootCompletedAt: doneAt("shootDue", reached("shooting")),
          footageUrl: reached("shooting")
            ? "https://drive.google.com/drive/folders/demo"
            : null,

          editStartedAt: reached("footage_review") ? due.shootDue : null,
          editSubmittedAt: doneAt("editDue", reached("editing")),
          editApprovedAt: doneAt("finalApprovalDue", reached("edit_review")),
          editUrl: reached("editing") ? "https://frame.io/demo-cut" : null,

          platform: reached("edit_review") ? "Instagram Reels" : null,
          publishedAt: doneAt("publishDue", stage === "published"),
          publishedUrl: stage === "published" ? "https://instagram.com/p/demo" : null,

          revisions: i % 5 === 0 ? 1 : 0,
        },
      });

      await db.contentEvent.create({
        data: {
          contentId: item.id,
          kind: "created",
          message: `Planned for ${client.name}`,
          createdAt: addDays(cycleStart, -2),
        },
      });

      // The videos marked with a revision get the send-back that caused it.
      if (i % 5 === 0 && reached("script_review")) {
        await db.contentEvent.create({
          data: {
            contentId: item.id,
            kind: "revision",
            message: "Sent back to Scripting: Hook is too slow, tighten the first 3 seconds",
            actor: "Darun Kumar",
            createdAt: due.scriptApprovalDue,
          },
        });
      }
      if (i % 4 === 0 && reached("edit_review")) {
        await db.contentEvent.create({
          data: {
            contentId: item.id,
            kind: "revision",
            message: "Sent back to Editing: Colour grade is off in the second half",
            actor: "Darun Kumar",
            createdAt: due.finalApprovalDue,
          },
        });
      }
    }
  }

  // Last month is already settled, so every payout status is on show.
  const lastMonth = shiftMonth(key, -1);
  for (const m of members) {
    if (m.role === "ceo") continue;
    await approvePayout({
      agencyId: agency.id,
      memberId: m.id,
      monthKey: lastMonth,
      approvedBy: "Darun Kumar",
      ...(m.email === "editor@demo.test"
        ? { adjustment: 1000, note: "Rush edits for the festival campaign" }
        : {}),
    });
    await markPaid(agency.id, m.id, lastMonth);
  }

  const total = await db.contentItem.count();
  console.log(
    `Seeded ${agency.name}: ${CLIENTS.length} clients, ${MEMBERS.length} team members, ${total} content items.`,
  );
  console.log(`\nDemo sign-ins (password for all: ${DEMO_PASSWORD})`);
  for (const m of MEMBERS) console.log(`  ${m.role.padEnd(13)} ${m.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
