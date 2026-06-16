/**
 * ============================================================================
 * FMS — Database Seed Script
 * ----------------------------------------------------------------------------
 * Creates working sample data for a fresh FMS database, including four
 * login-able accounts (one per platform role).
 *
 * PREREQUISITES:
 *   1. Run `backend/schema.sql` once in the Supabase SQL Editor first, so all
 *      tables and the `platform_role` enum exist.
 *   2. Create a `.dev.vars` file next to this project with:
 *          SUPABASE_URL=<your-project-url>
 *          SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
 *      The SERVICE ROLE key is required (not the anon key) because this script
 *      creates auth users via the admin API.
 *   3. Install deps:  npm install @supabase/supabase-js dotenv
 *
 * HOW TO RUN:
 *      node scripts/seed.js
 *
 * The script is idempotent where reasonable: re-running it logs and skips
 * accounts that already exist instead of crashing.
 *
 * CREATED LOGIN CREDENTIALS (all password: Password123!):
 *      admin@example.com       -> platform_role 'admin'
 *      controller@example.com  -> platform_role 'controller'
 *      member@example.com      -> platform_role 'member'
 *      superadmin@example.com  -> platform_role 'superadmin'
 * ============================================================================
 */

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".dev.vars" });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. " +
      "Fill them in .dev.vars before running."
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const PASSWORD = "Password123!";

const ACCOUNTS = [
  { email: "admin@example.com", name: "Admin User", platform_role: "admin" },
  { email: "controller@example.com", name: "Controller User", platform_role: "controller" },
  { email: "member@example.com", name: "Member User", platform_role: "member" },
  { email: "superadmin@example.com", name: "Super Admin User", platform_role: "superadmin" },
];

/**
 * Find an existing auth user by email (used for idempotent re-runs).
 * Paginates through the admin user list.
 */
async function findAuthUserByEmail(email) {
  let page = 1;
  const perPage = 1000;
  // listUsers is paginated; one page is plenty for a seed DB but loop to be safe.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const match = data.users.find((u) => u.email === email);
    if (match) return match;
    if (data.users.length < perPage) return null;
    page += 1;
  }
}

async function main() {
  console.log("🌱 Starting FMS seed...\n");

  // --------------------------------------------------------------------------
  // 1. Company
  // --------------------------------------------------------------------------
  let company;
  try {
    // Reuse an existing "Acme Workspace" if present (idempotent re-runs).
    const { data: existing, error: selErr } = await supabase
      .from("companies")
      .select("id, name")
      .eq("name", "Acme Workspace")
      .limit(1)
      .maybeSingle();
    if (selErr) throw selErr;

    if (existing) {
      company = existing;
      console.log(`ℹ️  Company "Acme Workspace" already exists (id=${company.id}). Reusing.`);
    } else {
      const { data, error } = await supabase
        .from("companies")
        .insert({ name: "Acme Workspace" })
        .select("id, name")
        .single();
      if (error) throw error;
      company = data;
      console.log(`✅ Created company "Acme Workspace" (id=${company.id}).`);
    }
  } catch (err) {
    console.error("❌ Failed to create/find company:", err.message);
    process.exit(1); // company is required for everything else
  }

  // --------------------------------------------------------------------------
  // 2. Auth users + matching public.users rows
  // --------------------------------------------------------------------------
  console.log("\n👤 Creating accounts...");
  for (const acct of ACCOUNTS) {
    try {
      let userId;

      const { data: created, error: createErr } =
        await supabase.auth.admin.createUser({
          email: acct.email,
          password: PASSWORD,
          email_confirm: true,
        });

      if (createErr) {
        // Most likely already exists -> look it up and continue.
        console.log(
          `   ⚠️  ${acct.email}: ${createErr.message}. Trying to reuse existing auth user.`
        );
        const existing = await findAuthUserByEmail(acct.email);
        if (!existing) {
          console.error(`   ❌ ${acct.email}: could not create or find. Skipping.`);
          continue;
        }
        userId = existing.id;
      } else {
        userId = created.user.id;
        console.log(`   ✅ Auth user created: ${acct.email}`);
      }

      // Upsert the matching public.users profile row (id = auth user id).
      const { error: profileErr } = await supabase.from("users").upsert(
        {
          id: userId,
          company_id: company.id,
          name: acct.name,
          platform_role: acct.platform_role,
          email: acct.email,
          is_active: true,
        },
        { onConflict: "id" }
      );
      if (profileErr) throw profileErr;
      console.log(`      profile row ready (role=${acct.platform_role}).`);
    } catch (err) {
      console.error(`   ❌ ${acct.email}: ${err.message}. Continuing.`);
    }
  }

  // --------------------------------------------------------------------------
  // 3. Clients
  // --------------------------------------------------------------------------
  console.log("\n🏢 Creating sample clients...");
  const sampleClients = [
    { company_id: company.id, name: "Northwind Traders", email: "contact@northwind.example", status: "active" },
    { company_id: company.id, name: "Globex Corporation", email: "hello@globex.example", status: "active" },
  ];
  for (const client of sampleClients) {
    try {
      const { data: existing } = await supabase
        .from("clients")
        .select("id")
        .eq("company_id", company.id)
        .eq("name", client.name)
        .limit(1)
        .maybeSingle();
      if (existing) {
        console.log(`   ℹ️  Client "${client.name}" already exists. Skipping.`);
        continue;
      }
      const { error } = await supabase.from("clients").insert(client);
      if (error) throw error;
      console.log(`   ✅ Client "${client.name}" created.`);
    } catch (err) {
      console.error(`   ❌ Client "${client.name}": ${err.message}. Continuing.`);
    }
  }

  // --------------------------------------------------------------------------
  // 4. Project template + template_tasks + template_task_checklist_items
  // --------------------------------------------------------------------------
  console.log("\n📋 Creating sample project template...");
  let project;
  try {
    const { data: existing } = await supabase
      .from("projects")
      .select("id, name")
      .eq("company_id", company.id)
      .eq("name", "Sample Content Workflow")
      .limit(1)
      .maybeSingle();

    if (existing) {
      project = existing;
      console.log(`   ℹ️  Project "Sample Content Workflow" already exists (id=${project.id}). Reusing.`);
    } else {
      // `projects` required columns: company_id (nullable but set here), name.
      // start_date defaults to CURRENT_DATE, status defaults to 'active'.
      const { data, error } = await supabase
        .from("projects")
        .insert({
          company_id: company.id,
          name: "Sample Content Workflow",
          description: "A template project demonstrating a multi-step content workflow.",
          type: "template",
          category: "content",
        })
        .select("id, name")
        .single();
      if (error) throw error;
      project = data;
      console.log(`   ✅ Project "Sample Content Workflow" created (id=${project.id}).`);
    }
  } catch (err) {
    console.error(`   ❌ Failed to create project: ${err.message}. Skipping template tasks.`);
    project = null;
  }

  if (project) {
    // template_tasks required columns: project_id, title (step_order defaults to 1).
    const templateTasks = [
      {
        project_id: project.id,
        company_id: company.id,
        title: "Draft copy",
        description: "Write the first draft of the content.",
        step_order: 1,
        estimated_minutes: 120,
        assigned_role: "copywriter",
        approval_required: true,
        approval_levels: 1,
      },
      {
        project_id: project.id,
        company_id: company.id,
        title: "Design assets",
        description: "Produce the supporting visual assets.",
        step_order: 2,
        estimated_minutes: 180,
        assigned_role: "designer",
        approval_required: true,
        approval_levels: 1,
      },
      {
        project_id: project.id,
        company_id: company.id,
        title: "Final review & publish",
        description: "Review everything and publish.",
        step_order: 3,
        estimated_minutes: 60,
        assigned_role: "editor",
        approval_required: false,
        approval_levels: 1,
      },
    ];

    for (const tt of templateTasks) {
      try {
        const { data: existing } = await supabase
          .from("template_tasks")
          .select("id")
          .eq("project_id", project.id)
          .eq("title", tt.title)
          .limit(1)
          .maybeSingle();

        let templateTaskId;
        if (existing) {
          templateTaskId = existing.id;
          console.log(`   ℹ️  Template task "${tt.title}" already exists. Reusing.`);
        } else {
          const { data, error } = await supabase
            .from("template_tasks")
            .insert(tt)
            .select("id")
            .single();
          if (error) throw error;
          templateTaskId = data.id;
          console.log(`   ✅ Template task "${tt.title}" created.`);
        }

        // A couple of checklist items for the first task only (keeps it minimal).
        if (tt.step_order === 1) {
          // template_task_checklist_items required columns: template_task_id, item_text.
          const checklistItems = [
            { template_task_id: templateTaskId, company_id: company.id, item_text: "Confirm the brief", sort_order: 0 },
            { template_task_id: templateTaskId, company_id: company.id, item_text: "Write headline & body", sort_order: 1 },
            { template_task_id: templateTaskId, company_id: company.id, item_text: "Proofread for tone", sort_order: 2 },
          ];
          const { data: existingItems } = await supabase
            .from("template_task_checklist_items")
            .select("id")
            .eq("template_task_id", templateTaskId)
            .limit(1);
          if (existingItems && existingItems.length > 0) {
            console.log(`      ℹ️  Checklist items already exist for "${tt.title}". Skipping.`);
          } else {
            const { error: itemErr } = await supabase
              .from("template_task_checklist_items")
              .insert(checklistItems);
            if (itemErr) throw itemErr;
            console.log(`      ✅ ${checklistItems.length} checklist items added to "${tt.title}".`);
          }
        }
      } catch (err) {
        console.error(`   ❌ Template task "${tt.title}": ${err.message}. Continuing.`);
      }
    }
  }

  console.log("\n🎉 Seed complete.\n");
  console.log("Login credentials (password: Password123!):");
  for (const acct of ACCOUNTS) {
    console.log(`   ${acct.email.padEnd(24)} -> ${acct.platform_role}`);
  }
}

main().catch((err) => {
  console.error("❌ Unexpected error:", err);
  process.exit(1);
});
