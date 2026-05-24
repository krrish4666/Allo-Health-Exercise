const fs = require("node:fs");
const path = require("node:path");
const { PrismaClient } = require("@prisma/client");

const envPath = path.join(process.cwd(), ".env");
for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const match = line.match(/^([^#][^=]+)=(.*)$/);
  if (!match) continue;
  process.env[match[1].trim()] = match[2].trim().replace(/^"|"$/g, "");
}

const prisma = new PrismaClient();

prisma
  .$queryRawUnsafe("SELECT 1 AS ok")
  .then((rows) => {
    console.log(JSON.stringify({ ok: true, rows }));
  })
  .catch((error) => {
    console.log(
      JSON.stringify({
        ok: false,
        name: error.name,
        code: error.code ?? null,
        message: error.message
      })
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
