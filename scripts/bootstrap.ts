/**
 * Creates a real agency and its first CEO account.
 *
 *   npm run bootstrap -- "Frame & Focus Media" "Darun Kumar" darun@agency.com "a-strong-password"
 *
 * Safe to point at a live database: it refuses to touch an agency that already
 * exists, and never deletes anything.
 */
import { PrismaClient } from "@prisma/client";
import { MIN_PASSWORD_LENGTH, hashPassword } from "../lib/password";

const db = new PrismaClient();

function slugify(name: string) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "agency"
  );
}

async function main() {
  const [agencyName, ceoName, emailRaw, password] = process.argv.slice(2);
  const email = (emailRaw ?? "").trim().toLowerCase();

  if (!agencyName || !ceoName || !email || !password) {
    console.error(
      'Usage: npm run bootstrap -- "<agency name>" "<your name>" <your email> <password>',
    );
    process.exit(1);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error("That email doesn't look valid.");
    process.exit(1);
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    console.error(`Use a password of at least ${MIN_PASSWORD_LENGTH} characters.`);
    process.exit(1);
  }
  if (email.endsWith("@demo.test")) {
    console.error("@demo.test addresses are for the demo data. Use your real email.");
    process.exit(1);
  }

  if (await db.member.findUnique({ where: { email } })) {
    console.error(`${email} already has an account. Nothing changed.`);
    process.exit(1);
  }

  let slug = slugify(agencyName);
  while (await db.agency.findUnique({ where: { slug } })) slug = `${slug}-1`;

  const agency = await db.agency.create({ data: { name: agencyName, slug } });
  await db.member.create({
    data: {
      agencyId: agency.id,
      name: ceoName,
      email,
      role: "ceo",
      passwordHash: await hashPassword(password),
      payType: "salary",
    },
  });

  console.log(`\nCreated "${agency.name}".`);
  console.log(`Sign in as ${email} with the password you chose.`);
  console.log("Then add your team from the Team page.\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
